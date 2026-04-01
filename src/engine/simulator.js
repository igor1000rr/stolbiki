/**
 * Симулятор партий в браузере с настраиваемыми параметрами
 */

import { applyAction } from './game.js'
import { sampleRandomAction, mctsSearch } from './ai.js'

// GameState с кастомными параметрами
class CustomGameState {
  constructor(numStands = 10, maxChips = 11, maxPlace = 3, maxPlaceStands = 2) {
    this.numStands = numStands
    this.maxChips = maxChips
    this.maxPlace = maxPlace
    this.maxPlaceStands = maxPlaceStands
    this.stands = Array.from({ length: numStands }, () => [])
    this.closed = {}
    this.currentPlayer = 0
    this.turn = 0
    this.swapAvailable = true
    this.gameOver = false
    this.winner = null
  }

  copy() {
    const s = new CustomGameState(this.numStands, this.maxChips, this.maxPlace, this.maxPlaceStands)
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
          closing.push([src, dst])
          continue
        }
        normal.push([src, dst])
      }
    }
  }

  if (closing.length && Math.random() < 0.7) transfer = closing[Math.floor(Math.random() * closing.length)]
  else if (normal.length && Math.random() < 0.4) transfer = normal[Math.floor(Math.random() * normal.length)]

  const maxChips = state.isFirstTurn() ? 1 : state.maxPlace
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
    const num = Math.min(1 + Math.floor(Math.random() * state.maxPlaceStands), available.length)
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
    if (total >= ns.maxChips) {
      if (total > ns.maxChips) ns.stands[dst] = ns.stands[dst].slice(total - ns.maxChips)
      ns.closed[dst] = grpColor
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
      } else if (total > ns.maxChips) {
        ns.stands[i] = ns.stands[i].slice(total - ns.maxChips)
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
  const { numStands, maxChips, numGames, batchSize = 50, maxPlace = 3, maxPlaceStands = 2 } = params
  let played = 0
  const results = {
    p1Wins: 0, p2Wins: 0, draws: 0,
    turns: [],
    goldenDecisive: 0,
    standCloseCount: Array(numStands).fill(0),
    swapCount: 0,
    transferCount: 0,
    firstCloseTurns: [],
    scores: [],           // [{p1, p2}]
    goldenOwner: [0, 0],  // [p1_owns, p2_owns]
    goldenWins: 0,        // владелец золотой побеждает
    lastCloserWins: 0,    // кто закрыл последнюю → побеждает
    closeByTransfer: 0,
    closeByPlacement: 0,
  }

  function runBatch() {
    const batchEnd = Math.min(played + batchSize, numGames)

    for (let g = played; g < batchEnd; g++) {
      let state = new CustomGameState(numStands, maxChips, maxPlace, maxPlaceStands)
      let t = 0
      let firstClose = null
      let lastCloser = -1
      let transfers = 0

      while (!state.gameOver && t < 300) {
        const oldClosed = Object.keys(state.closed).length
        const action = fastRandomAction(state)
        if (action.swap) results.swapCount++
        if (action.transfer) transfers++

        const player = state.currentPlayer
        state = applyCustomAction(state, action)

        const newClosed = Object.keys(state.closed).length
        if (newClosed > oldClosed) {
          lastCloser = player
          if (firstClose === null) firstClose = state.turn
          if (action.transfer) results.closeByTransfer++
          else results.closeByPlacement++
        }
        t++
      }

      results.turns.push(state.turn)
      results.transferCount += transfers

      if (state.winner === 0) results.p1Wins++
      else if (state.winner === 1) results.p2Wins++
      else results.draws++

      if (firstClose !== null) results.firstCloseTurns.push(firstClose)
      if (lastCloser === state.winner) results.lastCloserWins++

      const c0 = state.countClosed(0), c1 = state.countClosed(1)
      results.scores.push({ p1: c0, p2: c1 })

      const half = Math.floor(numStands / 2)
      if (c0 === half && c1 === half && numStands % 2 === 0) results.goldenDecisive++

      if (0 in state.closed) {
        results.goldenOwner[state.closed[0]]++
        if (state.closed[0] === state.winner) results.goldenWins++
      }

      for (const idx of Object.keys(state.closed)) {
        results.standCloseCount[+idx]++
      }
    }

    played = batchEnd
    onBatch({ ...results, played, total: numGames })

    if (played < numGames) {
      setTimeout(runBatch, 0)
    } else {
      onComplete(results)
    }
  }

  setTimeout(runBatch, 0)
}
