/**
 * Движок настольной игры "Перехват высотки"
 * Полная реализация правил
 *
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ.
 * Клиент реэкспортирует из src/engine/game.js → ../../server/game-engine.js
 * Vite резолвит путь при сборке, на VPS этот файл не меняется.
 *
 * @typedef {0|1} Color - Цвет игрока (0 = синий, 1 = красный)
 * @typedef {[number, number]} Transfer - [srcStand, dstStand]
 * @typedef {Object<string, number>} Placement - { [standIdx]: chipsCount }
 * @typedef {Object} Action
 * @property {Transfer} [transfer] - перенос верхней группы с src на dst
 * @property {Placement} [placement] - установка блоков на стойки
 * @property {boolean} [swap] - swap-ход (только turn=1, когда swapAvailable)
 * @typedef {Object} Move
 * @property {Action} action
 * @property {Color} [player]
 */

export const NUM_STANDS = 10
export const GOLDEN_STAND = 0
export const MAX_CHIPS = 11
export const MAX_PLACE = 3
export const MAX_PLACE_STANDS = 2
export const FIRST_TURN_MAX = 1

/**
 * Состояние партии. Иммутабелен с точки зрения API: applyAction возвращает новый экземпляр.
 */
export class GameState {
  constructor(numStands = NUM_STANDS) {
    this.numStands = numStands
    this.stands = Array.from({ length: numStands }, () => [])
    this.closed = {}
    this.currentPlayer = 0
    this.turn = 0
    this.swapAvailable = true
    this.gameOver = false
    this.winner = null
  }

  copy() {
    const s = new GameState(this.numStands)
    s.stands = this.stands.map(st => [...st])
    s.closed = { ...this.closed }
    s.currentPlayer = this.currentPlayer
    s.turn = this.turn
    s.swapAvailable = this.swapAvailable
    s.gameOver = this.gameOver
    s.winner = this.winner
    return s
  }

  openStands() {
    return Array.from({ length: this.numStands }, (_, i) => i)
      .filter(i => !(i in this.closed))
  }

  numOpen() { return this.numStands - Object.keys(this.closed).length }
  countClosed(p) { return Object.values(this.closed).filter(v => v === p).length }
  standSpace(i) { return (i in this.closed) ? 0 : MAX_CHIPS - this.stands[i].length }
  isFirstTurn() { return this.turn === 0 }
  canCloseByPlacement() { return this.numOpen() <= 2 }

  topGroup(i) {
    const chips = this.stands[i]
    if (!chips.length) return [-1, 0]
    const color = chips[chips.length - 1]
    let count = 0
    for (let j = chips.length - 1; j >= 0; j--) {
      if (chips[j] === color) count++; else break
    }
    return [color, count]
  }
}

export function getValidTransfers(state) {
  const transfers = []
  const opens = state.openStands()
  const player = state.currentPlayer

  for (const src of opens) {
    const [grpColor, grpSize] = state.topGroup(src)
    if (grpSize === 0) continue
    for (const dst of opens) {
      if (dst === src) continue
      const dstChips = state.stands[dst]
      const [dstTop] = state.topGroup(dst)
      if (dstChips.length > 0 && dstTop !== grpColor) continue
      // Закрыть переносом можно только своим цветом
      const newTotal = dstChips.length + grpSize
      if (newTotal >= MAX_CHIPS && grpColor !== player) continue
      transfers.push([src, dst])
    }
  }
  return transfers
}

export function getValidPlacements(state) {
  const maxChips = state.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canClose = state.canCloseByPlacement()
  const available = []

  for (const idx of state.openStands()) {
    const space = state.standSpace(idx)
    if (space <= 0) continue
    const maxHere = canClose ? Math.min(space, maxChips) : Math.min(space - 1, maxChips)
    if (maxHere > 0) available.push([idx, maxHere])
  }

  const placements = [{}]
  for (const [idx, cap] of available) {
    for (let c = 1; c <= Math.min(cap, maxChips); c++) {
      placements.push({ [idx]: c })
    }
  }
  if (maxChips >= 2) {
    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const [i1, c1] = available[i]
        const [i2, c2] = available[j]
        for (let a = 1; a <= Math.min(c1, maxChips - 1); a++) {
          for (let b = 1; b <= Math.min(c2, maxChips - a); b++) {
            if (a + b <= maxChips) placements.push({ [i1]: a, [i2]: b })
          }
        }
      }
    }
  }
  return placements
}

function applyTransfer(state, src, dst) {
  const [grpColor, grpSize] = state.topGroup(src)
  state.stands[src] = state.stands[src].slice(0, -grpSize)
  state.stands[dst] = state.stands[dst].concat(Array(grpSize).fill(grpColor))
  const total = state.stands[dst].length
  if (total >= MAX_CHIPS) {
    // Стойка закрывается цветом верхней группы, лишние снизу в сброс
    if (total > MAX_CHIPS) state.stands[dst] = state.stands[dst].slice(total - MAX_CHIPS)
    state.closed[dst] = grpColor
    return true
  }
  return false
}

function applyPlacement(state, placement) {
  const player = state.currentPlayer
  const canClose = state.canCloseByPlacement()
  for (const [idx, count] of Object.entries(placement)) {
    const i = +idx
    state.stands[i] = state.stands[i].concat(Array(count).fill(player))
    const total = state.stands[i].length
    if (total >= MAX_CHIPS && canClose) {
      if (total > MAX_CHIPS) state.stands[i] = state.stands[i].slice(total - MAX_CHIPS)
      state.closed[i] = player
    } else if (total > MAX_CHIPS) {
      // Обрезаем до MAX_CHIPS даже без закрытия (предотвращает overflow)
      state.stands[i] = state.stands[i].slice(total - MAX_CHIPS)
    }
  }
}

function applySwap(state) {
  for (let i = 0; i < state.numStands; i++) {
    state.stands[i] = state.stands[i].map(c => 1 - c)
  }
  const nc = {}
  for (const [k, v] of Object.entries(state.closed)) nc[k] = 1 - v
  state.closed = nc
}

function checkGameOver(state) {
  if (Object.keys(state.closed).length === state.numStands) {
    determineWinner(state)
    return
  }
  for (const p of [0, 1]) {
    if (state.countClosed(p) > state.countClosed(1 - p) + state.numOpen()) {
      state.gameOver = true
      state.winner = p
      return
    }
  }
}

function determineWinner(state) {
  state.gameOver = true
  const c0 = state.countClosed(0), c1 = state.countClosed(1)
  if (c0 > c1) state.winner = 0
  else if (c1 > c0) state.winner = 1
  else state.winner = (GOLDEN_STAND in state.closed) ? state.closed[GOLDEN_STAND] : -1
}

export function applyAction(state, action) {
  const ns = state.copy()
  if (action.swap) {
    applySwap(ns)
    ns.swapAvailable = false
    ns.currentPlayer = 1 - ns.currentPlayer
    ns.turn++
    checkGameOver(ns)
    return ns
  }
  if (action.transfer) applyTransfer(ns, action.transfer[0], action.transfer[1])
  if (action.placement) applyPlacement(ns, action.placement)

  // Авто-закрытие: если стойка ≥11 фишек и canClose — закрываем
  if (ns.canCloseByPlacement()) {
    for (const i of ns.openStands()) {
      if (ns.stands[i].length >= MAX_CHIPS) {
        if (ns.stands[i].length > MAX_CHIPS) ns.stands[i] = ns.stands[i].slice(ns.stands[i].length - MAX_CHIPS)
        const [topColor] = ns.topGroup(i)
        ns.closed[i] = topColor >= 0 ? topColor : ns.currentPlayer
      }
    }
  }

  if (ns.turn >= 1) ns.swapAvailable = false
  ns.currentPlayer = 1 - ns.currentPlayer
  ns.turn++
  checkGameOver(ns)
  return ns
}

export function getLegalActions(state) {
  if (state.gameOver) return []
  const actions = []
  if (state.turn === 1 && state.swapAvailable) actions.push({ swap: true })
  const transfers = [null, ...getValidTransfers(state)]
  for (const transfer of transfers) {
    const temp = state.copy()
    if (transfer) applyTransfer(temp, transfer[0], transfer[1])
    for (const placement of getValidPlacements(temp)) {
      if (state.isFirstTurn() && !Object.keys(placement).length && !transfer) continue
      actions.push({ transfer, placement })
    }
  }
  if (!actions.length) actions.push({})
  return actions
}
