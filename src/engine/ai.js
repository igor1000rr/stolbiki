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
import { evaluate as nnEvaluate, isReady as nnReady, isGpuReady, loadWeights, loadGpuWeights } from './neuralnet.js'

// Автозагрузка CPU-весов при импорте (маленькие, 179KB)
loadWeights().catch(() => {})

/**
 * Предзагрузка GPU-сети для сложных уровней
 * Вызывается из Game.jsx при выборе difficulty >= hard
 */
export function preloadGpuNet() {
  loadGpuWeights().catch(() => {})
}

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
 * Тактическая эвристика — бонусы/штрафы за конкретные паттерны
 * Возвращает значение от -1 до +1 с точки зрения player
 */
function heuristicEval(state, player) {
  const opp = 1 - player
  let score = 0

  // Закрытые стойки — самое важное
  const myClosed = state.countClosed(player)
  const oppClosed = state.countClosed(opp)
  score += (myClosed - oppClosed) * 0.15

  // Золотая стойка — двойная ценность
  if (0 in state.closed) {
    score += state.closed[0] === player ? 0.12 : -0.12
  }

  // Анализ открытых стоек
  for (let i = 0; i < state.numStands; i++) {
    if (i in state.closed) continue
    const chips = state.stands[i]
    if (!chips.length) continue
    const [topColor, topSize] = state.topGroup(i)
    const total = chips.length
    const space = 11 - total

    // Стойка почти закрыта (8+ фишек) с нашими сверху — очень ценно
    if (total >= 8 && topColor === player) {
      score += (i === 0 ? 0.08 : 0.05) // золотая ценнее
    }
    // Стойка почти закрыта с чужими сверху — опасность
    if (total >= 8 && topColor === opp) {
      score -= (i === 0 ? 0.08 : 0.05)
    }

    // Доминирование верха — контроль позиции
    if (topSize >= 3 && topColor === player) score += 0.02
    if (topSize >= 3 && topColor === opp) score -= 0.02
  }

  return Math.max(-1, Math.min(1, score))
}

/**
 * Оценка позиции: GPU eval + тактические эвристики
 * GPU-сеть даёт стратегическую оценку, эвристики — тактическую
 */
function evaluatePosition(state, player, rolloutDepth = 3) {
  if (state.gameOver) {
    if (state.winner === player) return 1
    if (state.winner === 1 - player) return -1
    return 0
  }

  // С нейросетью: гибрид NN + heuristic
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
    const nnVal = nnEvaluate(s)
    const nn = s.currentPlayer === player ? nnVal : -nnVal
    const heur = heuristicEval(s, player)
    // GPU-сеть: 60% NN + 40% эвристика (сеть v500 ещё слабая)
    // CPU-сеть: 40% NN + 60% эвристика
    const nnWeight = isGpuReady() ? 0.6 : 0.4
    return nn * nnWeight + heur * (1 - nnWeight)
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

  /** Умная установка: приоритет стойкам с нашим контролем и близким к закрытию */
  function smartPlacement(st, exclude = []) {
    const canClose = st.canCloseByPlacement()
    const minSpace = canClose ? 0 : 1
    const avail = st.openStands().filter(i => !exclude.includes(i) && st.standSpace(i) > minSpace)
    if (!avail.length) return {}

    // Оцениваем каждую стойку
    const scored = avail.map(i => {
      const chips = st.stands[i]
      const [tc, ts] = st.topGroup(i)
      const total = chips.length
      let score = total * 2 // Больше фишек — ближе к закрытию
      if (tc === player) score += 10 + ts * 3 // Наши сверху — ценно
      if (tc === 1 - player) score -= 5 // Чужие сверху — не ставим
      if (i === 0) score += 5 // Золотая
      if (total >= 7 && tc === player) score += 20 // Почти закрываем!
      if (total >= 7 && tc === 1 - player) score += 8 // Блокируем
      return { i, score }
    }).sort((a, b) => b.score - a.score)

    const pl = {}
    let rem = maxP
    // Ставим на лучшие стойки
    const topN = Math.min(2, scored.filter(s => s.score > 0).length)
    for (let k = 0; k < topN && rem > 0; k++) {
      const { i } = scored[k]
      const cap = canClose ? Math.min(st.standSpace(i), rem) : Math.min(st.standSpace(i) - 1, rem)
      if (cap > 0) { pl[i] = Math.min(cap, rem); rem -= pl[i] }
    }
    // Если остались фишки — на следующую лучшую
    if (rem > 0 && scored.length > topN) {
      const { i } = scored[topN]
      const cap = canClose ? Math.min(st.standSpace(i), rem) : Math.min(st.standSpace(i) - 1, rem)
      if (cap > 0) pl[i] = Math.min(cap, rem)
    }
    return pl
  }

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

  // ── Генерация кандидатов ──
  const isHard = numSimulations >= 300

  // Swap
  if (state.turn === 1 && state.swapAvailable) {
    actions.push({ swap: true })
  }

  // ═══ ЗАКРЫВАЮЩИЕ ПЕРЕНОСЫ (высший приоритет) ═══
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS && gc === player) {
      // Наш закрывающий — 6 вариантов установки (максимальный приоритет)
      for (let k = 0; k < 6; k++) {
        actions.push({ transfer: [src, dst], placement: k < 3 ? smartPlacement(state, [src, dst]) : randPlacement(state, [src, dst]) })
      }
    }
  }
  // Вражеские закрывающие — тоже добавляем (иногда выгодно закрыть за противника, захватив потом)
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS && gc !== player) {
      actions.push({ transfer: [src, dst], placement: smartPlacement(state, [src, dst]) })
    }
  }

  // ═══ ПОДГОТОВИТЕЛЬНЫЕ ПЕРЕНОСЫ — строим к закрытию ═══
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    const dstTotal = state.stands[dst].length
    if (dstTotal + gs >= MAX_CHIPS) continue // уже выше
    // Перенос наших фишек на стойку где мы доминируем — строим к 11
    const [dtc] = state.topGroup(dst)
    if (gc === player && (dstTotal + gs >= 7)) {
      // Высокая стойка + наш перенос = почти закрытие
      actions.push({ transfer: [src, dst], placement: smartPlacement(state, [src, dst]) })
      actions.push({ transfer: [src, dst], placement: smartPlacement(state, [src, dst]) })
    } else if (gc === player) {
      actions.push({ transfer: [src, dst], placement: smartPlacement(state, [src, dst]) })
    }
  }

  // ═══ УМНЫЕ УСТАНОВКИ ═══
  const canCloseP = state.canCloseByPlacement()
  const minSpP = canCloseP ? 0 : 1
  const avail = state.openStands().filter(i => state.standSpace(i) > minSpP)
  if (avail.length) {
    // Сортируем: наши высокие стойки первые
    const scored = avail.map(i => {
      const [tc, ts] = state.topGroup(i)
      const total = state.stands[i].length
      let s = total * 2
      if (tc === player) s += 10 + ts * 3
      if (tc === 1 - player) s -= 3
      if (i === 0) s += 5
      if (total >= 7 && tc === player) s += 20
      return { i, s }
    }).sort((a, b) => b.s - a.s)

    // Полная установка на лучшие стойки
    for (let k = 0; k < Math.min(isHard ? 8 : 5, scored.length); k++) {
      const idx = scored[k].i
      const sp = canCloseP ? state.standSpace(idx) : state.standSpace(idx) - 1
      if (sp > 0) {
        actions.push({ placement: { [idx]: Math.min(maxP, sp) } })
        if (sp > 1 && maxP >= 2) actions.push({ placement: { [idx]: 2 } })
        if (maxP >= 1) actions.push({ placement: { [idx]: 1 } })
      }
    }

    // Двойные установки на 2 лучших стойки
    if (scored.length >= 2 && maxP >= 2) {
      for (let i = 0; i < Math.min(4, scored.length); i++) {
        for (let j = i + 1; j < Math.min(5, scored.length); j++) {
          const [i1, i2] = [scored[i].i, scored[j].i]
          const s1 = canCloseP ? state.standSpace(i1) : state.standSpace(i1) - 1
          const s2 = canCloseP ? state.standSpace(i2) : state.standSpace(i2) - 1
          if (s1 > 0 && s2 > 0) {
            actions.push({ placement: { [i1]: Math.min(2, s1), [i2]: 1 } })
            actions.push({ placement: { [i1]: 1, [i2]: Math.min(2, s2) } })
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
