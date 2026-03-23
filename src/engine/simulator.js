/**
 * Симулятор партий в браузере с настраиваемыми параметрами
 */

import { applyAction } from './game.js'
import { sampleRandomAction, mctsSearch } from './ai.js'

// GameState с кастомными параметрами
class CustomGameState {
  constructor(numStands = 10, maxChips = 11) {
    this.numStands = numStands
    this.maxChips = maxChips
    this.stands = Array.from({ length: numStands }, () => [])
    this.closed = {}
    this.currentPlayer = 0
    this.turn = 0
    this.swapAvailable = true
    this.gameOver = false
    this.winner = null
  }

  copy() {
    const s = new CustomGameState(this.numStands, this.maxChips)
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
    return Array.from({ length: this.numStands }, (_, i) => i).filter(i => !(i in this.closed))
  }
  numOpen() { return this.numStands - Object.keys(this.closed).length }
  countClosed(p) { return Object.values(this.closed).filter(v => v === p).length }
  standSpace(i) { return (i in this.closed) ? 0 : this.maxChips - this.stands[i].length }
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

// Быстрый рандомный ход для кастомного состояния
function fastRandomAction(state) {
  if (state.gameOver) return {}
  if (state.turn === 1 && state.swapAvailable && Math.random() < 0.3) return { swap: true }

  const player = state.currentPlayer
  const opens = state.openStands()
  let transfer = null
  const MAX_PLACE = 3

  // Ищем переносы
  const closing = [], normal = []
  if (opens.length >= 2) {
    for (const src of opens) {
      const [gc, gs] = state.topGroup(src)
      if (gs === 0) continue
      for (const dst of opens) {
        if (dst === src) continue
        const dstChips = state.stands[dst]
        const [dt] = state.topGroup(dst)
        if (dstChips.length > 0 && dt !== gc) continue
        const newTotal = dstChips.length + gs
        if (newTotal >= state.maxChips) {
          if (gc === player) closing.push([src, dst])
          continue
        }
        normal.push([src, dst])
      }
    }
  }

  if (closing.length && Math.random() < 0.7) transfer = closing[Math.floor(Math.random() * closing.length)]
  else if (normal.length && Math.random() < 0.4) transfer = normal[Math.floor(Math.random() * normal.length)]

  const maxChips = state.isFirstTurn() ? 1 : MAX_PLACE
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

  return { transfer, placement }
}

// Apply action для кастомного состояния
function applyCustomAction(state, action) {
  const ns = state.copy()

  if (action.swap) {
    for (let i = 0; i < ns.numStands; i++) ns.stands[i] = ns.stands[i].map(c => 1 - c)
    const nc = {}; for (const [k, v] of Object.entries(ns.closed)) nc[k] = 1 - v; ns.closed = nc
    ns.swapAvailable = false
    ns.currentPlayer = 1 - ns.currentPlayer
    ns.turn++
    checkCustomGameOver(ns)
    return ns
  }

  if (action.transfer) {
    const [src, dst] = action.transfer
    const [grpColor, grpSize] = ns.topGroup(src)
    ns.stands[src] = ns.stands[src].slice(0, -grpSize)
    ns.stands[dst] = ns.stands[dst].concat(Array(grpSize).fill(grpColor))
    const total = ns.stands[dst].length
    if (total >= ns.maxChips && grpColor === ns.currentPlayer) {
      if (total > ns.maxChips) ns.stands[dst] = ns.stands[dst].slice(total - ns.maxChips)
      ns.closed[dst] = ns.currentPlayer
    } else if (total > ns.maxChips) {
      ns.stands[dst] = ns.stands[dst].slice(total - ns.maxChips)
    }
  }

  if (action.placement) {
    const player = ns.currentPlayer
    const canClose = ns.canCloseByPlacement()
    for (const [idx, count] of Object.entries(action.placement)) {
      const i = +idx
      ns.stands[i] = ns.stands[i].concat(Array(count).fill(player))
      const total = ns.stands[i].length
      if (total >= ns.maxChips && canClose) {
        if (total > ns.maxChips) ns.stands[i] = ns.stands[i].slice(total - ns.maxChips)
        ns.closed[i] = player
      }
    }
  }

  if (ns.turn >= 1) ns.swapAvailable = false
  ns.currentPlayer = 1 - ns.currentPlayer
  ns.turn++
  checkCustomGameOver(ns)
  return ns
}

function checkCustomGameOver(state) {
  if (Object.keys(state.closed).length === state.numStands) {
    state.gameOver = true
    const c0 = state.countClosed(0), c1 = state.countClosed(1)
    if (c0 > c1) state.winner = 0
    else if (c1 > c0) state.winner = 1
    else state.winner = (0 in state.closed) ? state.closed[0] : -1
    return
  }
  for (const p of [0, 1]) {
    if (state.countClosed(p) > state.countClosed(1 - p) + state.numOpen()) {
      state.gameOver = true; state.winner = p; return
    }
  }
}

/**
 * Запускает симуляцию — возвращает результаты пачками через callback
 */
export function runSimulation(params, onBatch, onComplete) {
  const { numStands, maxChips, numGames, batchSize = 50 } = params
  let played = 0
  const results = {
    p1Wins: 0, p2Wins: 0, draws: 0,
    turns: [],
    goldenDecisive: 0,
    standCloseCount: Array(numStands).fill(0),
  }

  function runBatch() {
    const batchEnd = Math.min(played + batchSize, numGames)

    for (let g = played; g < batchEnd; g++) {
      let state = new CustomGameState(numStands, maxChips)
      let t = 0

      while (!state.gameOver && t < 300) {
        state = applyCustomAction(state, fastRandomAction(state))
        t++
      }

      results.turns.push(state.turn)

      if (state.winner === 0) results.p1Wins++
      else if (state.winner === 1) results.p2Wins++
      else results.draws++

      // Золотая при ничьей по стойкам
      const c0 = state.countClosed(0), c1 = state.countClosed(1)
      const half = Math.floor(numStands / 2)
      if (c0 === half && c1 === half && numStands % 2 === 0) results.goldenDecisive++

      // Какие стойки закрывались
      for (const idx of Object.keys(state.closed)) {
        results.standCloseCount[+idx]++
      }
    }

    played = batchEnd
    onBatch({ ...results, played, total: numGames })

    if (played < numGames) {
      setTimeout(runBatch, 0) // Не блокируем UI
    } else {
      onComplete(results)
    }
  }

  setTimeout(runBatch, 0)
}
