/**
 * AI для игры "Стойки"
 * MCTS с эвристиками, оптимизирован для браузера
 */

import {
  GameState, getValidTransfers, getValidPlacements,
  applyAction, MAX_CHIPS, MAX_PLACE, FIRST_TURN_MAX
} from './game.js'

export function sampleRandomAction(state) {
  if (state.gameOver) return {}
  if (state.turn === 1 && state.swapAvailable && Math.random() < 0.3) return { swap: true }

  const player = state.currentPlayer
  const opens = state.openStands()
  let transfer = null

  const transfers = getValidTransfers(state)
  const closing = [], normal = []
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS && gc === player) closing.push([src, dst])
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

  // Форсируем закрытие если ≤2 стойки и есть куда ставить
  if (canClose && !Object.keys(placement).length && available.length) {
    placement[available[0][0]] = available[0][1]
  }

  return { transfer, placement }
}

export function mctsSearch(state, numSimulations = 50) {
  const actions = []
  const visits = []
  const values = []
  const transfers = getValidTransfers(state)
  const player = state.currentPlayer
  const maxP = state.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE

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

  // Закрывающие переносы
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS && gc === player) {
      actions.push({ transfer: [src, dst], placement: randPlacement(state, [src, dst]) })
      actions.push({ transfer: [src, dst], placement: randPlacement(state, [src, dst]) })
    }
  }

  // Стратегические переносы
  const strat = transfers.filter(([s, d]) => {
    const [gc, gs] = state.topGroup(s)
    return state.stands[d].length + gs < MAX_CHIPS
  })
  for (let i = 0; i < Math.min(3, strat.length); i++) {
    const t = strat[Math.floor(Math.random() * strat.length)]
    actions.push({ transfer: t, placement: randPlacement(state, [t[0], t[1]]) })
  }

  // Только установка
  const canCloseP = state.canCloseByPlacement()
  const minSpP = canCloseP ? 0 : 1
  const avail = state.openStands().filter(i => state.standSpace(i) > minSpP)
  if (avail.length) {
    const sorted = [...avail].sort((a, b) => state.stands[b].length - state.stands[a].length)
    for (let k = 0; k < Math.min(4, sorted.length); k++) {
      const idx = sorted[k]
      const sp = canCloseP ? state.standSpace(idx) : state.standSpace(idx) - 1
      actions.push({ placement: { [idx]: Math.min(maxP, sp) } })
    }
    if (avail.length >= 2 && maxP >= 2) {
      const [i1, i2] = [sorted[0], sorted[1 % sorted.length]]
      if (i1 !== i2)
        actions.push({ placement: { [i1]: Math.min(2, state.standSpace(i1) - 1), [i2]: 1 } })
    }
  }

  // Добить рандомными
  while (actions.length < 12) actions.push(sampleRandomAction(state))
  for (let i = 0; i < actions.length; i++) { visits.push(0); values.push(0) }

  // Симуляции
  for (let sim = 0; sim < numSimulations; sim++) {
    const totalV = visits.reduce((a, b) => a + b, 0) + 1
    let bestIdx = 0, bestScore = -Infinity
    for (let i = 0; i < actions.length; i++) {
      const score = visits[i] === 0
        ? 1000 + Math.random()
        : values[i] / visits[i] + 1.4 * Math.sqrt(Math.log(totalV) / visits[i])
      if (score > bestScore) { bestScore = score; bestIdx = i }
    }

    let s = applyAction(state, actions[bestIdx])
    let depth = 0
    while (!s.gameOver && depth < 100) {
      s = applyAction(s, sampleRandomAction(s))
      depth++
    }

    visits[bestIdx]++
    if (s.winner === state.currentPlayer) values[bestIdx] += 1
    else if (s.winner === 1 - state.currentPlayer) values[bestIdx] -= 1
  }

  let bestIdx = 0, bestVisits = 0
  for (let i = 0; i < actions.length; i++) {
    if (visits[i] > bestVisits) { bestVisits = visits[i]; bestIdx = i }
  }
  return actions[bestIdx]
}
