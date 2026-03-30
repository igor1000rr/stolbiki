/**
 * AI для игры «Перехват высотки»
 * MCTS + нейросеть гибрид
 *
 * CPU-сеть: 8,961 params (27µs/eval) — fallback
 * GPU-сеть: 840,321 params (1.2ms/eval) — значительно сильнее
 * 
 * С GPU-сетью достаточно меньше симуляций — каждая оценка точнее.
 */

import {
  GameState, getValidTransfers, getValidPlacements,
  applyAction, MAX_CHIPS, MAX_PLACE, FIRST_TURN_MAX
} from './game.js'
import { evaluate as nnEvaluate, isReady as nnReady, isGpuReady, loadWeights } from './neuralnet.js'

// Автозагрузка весов при импорте
loadWeights().catch(() => {})

export function sampleRandomAction(state) {
  if (state.gameOver) return {}
  if (state.turn === 1 && state.swapAvailable && Math.random() < 0.3) return { swap: true }

  const opens = state.openStands()
  let transfer = null

  const transfers = getValidTransfers(state)
  const closing = [], normal = []
  for (const [src, dst] of transfers) {
    const [, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS) closing.push([src, dst])
    else normal.push([src, dst])
  }

  if (closing.length && Math.random() < 0.7)
    transfer = closing[Math.floor(Math.random() * closing.length)]
  else if (normal.length && Math.random() < 0.4)
    transfer = normal[Math.floor(Math.random() * normal.length)]

  const maxChips = state.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canClose = state.canCloseByPlacement()
  const available = []
  for (const idx of opens) {
    const space = state.standSpace(idx)
    if (canClose) {
      if (space <= 0) continue
      available.push([idx, Math.min(space, maxChips)])
    } else {
      if (space <= 1) continue
      available.push([idx, Math.min(space - 1, maxChips)])
    }
  }

  const placement = {}
  if (available.length) {
    let remaining = maxChips
    const num = Math.min(1 + Math.floor(Math.random() * 2), available.length)
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, num)
    for (const [idx, cap] of shuffled) {
      if (remaining <= 0) break
      const count = 1 + Math.floor(Math.random() * Math.min(cap, remaining))
      placement[idx] = count
      remaining -= count
    }
  }

  if (state.isFirstTurn() && !Object.keys(placement).length && !transfer) {
    if (available.length) placement[available[0][0]] = 1
  }

  if (canClose && !Object.keys(placement).length && available.length) {
    placement[available[0][0]] = available[0][1]
  }

  return { transfer, placement }
}

/**
 * Оценка позиции: гибрид (N-ходовой rollout + нейросеть) или чистый rollout
 * rolloutDepth: сколько ходов доиграть перед оценкой NN (больше = точнее, но медленнее)
 */
function evaluatePosition(state, player, rolloutDepth = 3) {
  if (state.gameOver) {
    if (state.winner === player) return 1
    if (state.winner === 1 - player) return -1
    return 0
  }

  // С нейросетью: доиграть rolloutDepth ходов рандомно → оценить NN
  if (nnReady()) {
    let s = state
    for (let d = 0; d < rolloutDepth && !s.gameOver; d++) {
      s = applyAction(s, sampleRandomAction(s))
    }
    if (s.gameOver) {
      if (s.winner === player) return 1
      if (s.winner === 1 - player) return -1
      return 0
    }
    const val = nnEvaluate(s)
    return s.currentPlayer === player ? val : -val
  }

  // Fallback: случайный rollout
  let s = state
  let depth = 0
  while (!s.gameOver && depth < 80) {
    s = applyAction(s, sampleRandomAction(s))
    depth++
  }
  if (s.winner === player) return 1
  if (s.winner === 1 - player) return -1
  return 0
}

/**
 * MCTS поиск с нейросетью
 *
 * numSimulations: 20 (лёгкая), 50 (средняя), 100 (сложная)
 * С нейросетью каждая симуляция даёт точную оценку вместо случайного rollout
 */
export function mctsSearch(state, numSimulations = 150, rolloutDepth = 3) {
  const actions = []
  const visits = []
  const values = []
  const transfers = getValidTransfers(state)
  const player = state.currentPlayer
  const maxP = state.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const useNN = nnReady()
  const useGpuNet = isGpuReady()

  function randPlacement(st, exclude = []) {
    const canClose = st.canCloseByPlacement()
    const minSpace = canClose ? 0 : 1
    const avail = st.openStands().filter(i => !exclude.includes(i) && st.standSpace(i) > minSpace)
    if (!avail.length) return {}
    const pl = {}
    let rem = maxP
    const num = Math.min(1 + Math.floor(Math.random() * 2), avail.length)
    const chosen = [...avail].sort(() => Math.random() - 0.5).slice(0, num)
    for (const idx of chosen) {
      if (rem <= 0) break
      const cap = canClose ? Math.min(st.standSpace(idx), rem) : Math.min(st.standSpace(idx) - 1, rem)
      if (cap > 0) { pl[idx] = 1 + Math.floor(Math.random() * cap); rem -= pl[idx] }
    }
    return pl
  }

  // ── Генерация кандидатов — чем сильнее AI, тем больше ──
  const isHard = numSimulations >= 300

  // Swap
  if (state.turn === 1 && state.swapAvailable) {
    actions.push({ swap: true })
  }

  // ВСЕ закрывающие переносы (полный перебор)
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS) {
      // Каждый закрывающий перенос с несколькими вариантами установки
      for (let k = 0; k < (gc === player ? 4 : 2); k++) {
        actions.push({ transfer: [src, dst], placement: randPlacement(state, [src, dst]) })
      }
    }
  }

  // Стратегические переносы
  const strat = transfers.filter(([s, d]) => {
    const [, gs] = state.topGroup(s)
    return state.stands[d].length + gs < MAX_CHIPS
  })
  // Для сложных: все переносы, для лёгких: рандомная выборка
  const stratSample = isHard ? strat : strat.sort(() => Math.random() - 0.5).slice(0, 5)
  for (const t of stratSample) {
    actions.push({ transfer: t, placement: randPlacement(state, [t[0], t[1]]) })
    if (isHard) actions.push({ transfer: t, placement: randPlacement(state, [t[0], t[1]]) })
  }

  // Установки: на каждую открытую стойку — несколько вариантов
  const canCloseP = state.canCloseByPlacement()
  const minSpP = canCloseP ? 0 : 1
  const avail = state.openStands().filter(i => state.standSpace(i) > minSpP)
  if (avail.length) {
    const sorted = [...avail].sort((a, b) => state.stands[b].length - state.stands[a].length)
    // Одиночные установки
    for (let k = 0; k < Math.min(isHard ? 10 : 6, sorted.length); k++) {
      const idx = sorted[k]
      const sp = canCloseP ? state.standSpace(idx) : state.standSpace(idx) - 1
      if (sp > 0) actions.push({ placement: { [idx]: Math.min(maxP, sp) } })
      if (sp > 1 && maxP >= 2) actions.push({ placement: { [idx]: 1 } })
      if (sp > 2 && maxP >= 3) actions.push({ placement: { [idx]: 2 } })
    }
    // Двойные установки
    if (avail.length >= 2 && maxP >= 2) {
      const lim = isHard ? 5 : 3
      for (let i = 0; i < Math.min(lim, sorted.length); i++) {
        for (let j = i + 1; j < Math.min(lim + 1, sorted.length); j++) {
          const [i1, i2] = [sorted[i], sorted[j]]
          const s1 = canCloseP ? state.standSpace(i1) : state.standSpace(i1) - 1
          const s2 = canCloseP ? state.standSpace(i2) : state.standSpace(i2) - 1
          if (s1 > 0 && s2 > 0) {
            actions.push({ placement: { [i1]: Math.min(2, s1), [i2]: 1 } })
            actions.push({ placement: { [i1]: 1, [i2]: Math.min(2, s2) } })
            if (maxP >= 3 && s1 > 1 && s2 > 1) {
              actions.push({ placement: { [i1]: 2, [i2]: 1 } })
            }
          }
        }
      }
    }
  }

  // Рандомные для exploration
  const minActions = isHard ? 25 : 15
  while (actions.length < minActions) actions.push(sampleRandomAction(state))

  // Дедупликация
  const seen = new Set()
  const finalActions = []
  for (const a of actions) {
    const key = JSON.stringify(a)
    if (!seen.has(key)) { seen.add(key); finalActions.push(a) }
  }

  for (let i = 0; i < finalActions.length; i++) { visits.push(0); values.push(0) }

  // ── MCTS симуляции ──
  // GPU-сеть точнее → меньше exploration нужен
  const cExplore = useGpuNet ? 1.0 : useNN ? 1.2 : 1.4

  for (let sim = 0; sim < numSimulations; sim++) {
    const totalV = visits.reduce((a, b) => a + b, 0) + 1

    // UCB1
    let bestIdx = 0, bestScore = -Infinity
    for (let i = 0; i < finalActions.length; i++) {
      const score = visits[i] === 0
        ? 1000 + Math.random()
        : values[i] / visits[i] + cExplore * Math.sqrt(Math.log(totalV) / visits[i])
      if (score > bestScore) { bestScore = score; bestIdx = i }
    }

    const s = applyAction(state, finalActions[bestIdx])
    const val = evaluatePosition(s, player, rolloutDepth)

    visits[bestIdx]++
    values[bestIdx] += val
  }

  // Выбираем ход с наибольшим числом посещений
  let bestIdx = 0, bestVisits = 0
  for (let i = 0; i < finalActions.length; i++) {
    if (visits[i] > bestVisits) { bestVisits = visits[i]; bestIdx = i }
  }

  return finalActions[bestIdx]
}
