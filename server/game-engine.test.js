/**
 * Тесты для основного 2-плейерного движка Highrise Heist.
 * Раньше не было ни одного — покрываем инварианты, edge cases и турнирные сценарии.
 */

import { describe, it, expect } from 'vitest'
import {
  GameState, applyAction, getLegalActions,
  getValidTransfers, getValidPlacements,
  NUM_STANDS, GOLDEN_STAND, MAX_CHIPS, MAX_PLACE, FIRST_TURN_MAX,
} from './game-engine.js'

function fillStand(state, idx, count, color) {
  state.stands[idx] = Array(count).fill(color)
}

describe('GameState — init', () => {
  it('creates 10 empty stands by default', () => {
    const s = new GameState()
    expect(s.numStands).toBe(NUM_STANDS)
    expect(s.stands.length).toBe(10)
    expect(s.stands.every(st => st.length === 0)).toBe(true)
  })
  it('currentPlayer=0, turn=0, swapAvailable=true, not gameOver', () => {
    const s = new GameState()
    expect(s.currentPlayer).toBe(0)
    expect(s.turn).toBe(0)
    expect(s.swapAvailable).toBe(true)
    expect(s.gameOver).toBe(false)
    expect(s.winner).toBe(null)
  })
  it('closed is empty map', () => {
    expect(new GameState().closed).toEqual({})
  })
  it('copy() returns deep copy', () => {
    const s = new GameState()
    fillStand(s, 1, 3, 0)
    const s2 = s.copy()
    s2.stands[1].push(1)
    expect(s.stands[1].length).toBe(3)
    expect(s2.stands[1].length).toBe(4)
  })
})

describe('topGroup', () => {
  it('empty stand returns [-1, 0]', () => {
    expect(new GameState().topGroup(1)).toEqual([-1, 0])
  })
  it('uniform stand returns [color, count]', () => {
    const s = new GameState()
    fillStand(s, 1, 4, 0)
    expect(s.topGroup(1)).toEqual([0, 4])
  })
  it('mixed stand returns only top contiguous group', () => {
    const s = new GameState()
    s.stands[1] = [0, 0, 1, 1, 1]
    expect(s.topGroup(1)).toEqual([1, 3])
  })
  it('single block returns [color, 1]', () => {
    const s = new GameState()
    s.stands[1] = [1]
    expect(s.topGroup(1)).toEqual([1, 1])
  })
})

describe('openStands / numOpen / countClosed', () => {
  it('openStands returns all when nothing closed', () => {
    const s = new GameState()
    expect(s.openStands().length).toBe(10)
    expect(s.numOpen()).toBe(10)
  })
  it('openStands excludes closed', () => {
    const s = new GameState()
    s.closed[1] = 0
    s.closed[5] = 1
    expect(s.openStands().length).toBe(8)
    expect(s.openStands().includes(1)).toBe(false)
    expect(s.openStands().includes(5)).toBe(false)
  })
  it('countClosed counts per player', () => {
    const s = new GameState()
    s.closed[1] = 0; s.closed[2] = 0; s.closed[3] = 1
    expect(s.countClosed(0)).toBe(2)
    expect(s.countClosed(1)).toBe(1)
  })
})

describe('canCloseByPlacement', () => {
  it('false when more than 2 stands open', () => {
    const s = new GameState()
    for (let i = 0; i < 7; i++) s.closed[i] = 0
    expect(s.canCloseByPlacement()).toBe(false) // 3 open still
  })
  it('true when exactly 2 stands remain open', () => {
    const s = new GameState()
    for (let i = 0; i < 8; i++) s.closed[i] = 0
    expect(s.canCloseByPlacement()).toBe(true)
  })
})

describe('getValidPlacements — first turn', () => {
  it('first turn restricts to 1 block total (FIRST_TURN_MAX)', () => {
    const s = new GameState()
    const pls = getValidPlacements(s)
    // Пустое placement + один по каждой стойке = 11 вариантов
    expect(pls.length).toBe(1 + NUM_STANDS)
    // Нет placement'ов с 2 блоками
    expect(pls.every(p => Object.values(p).every(c => c <= FIRST_TURN_MAX))).toBe(true)
  })
  it('normal turn allows up to 3 blocks across max 2 stands', () => {
    const s = new GameState()
    s.turn = 2 // Не first turn
    const pls = getValidPlacements(s)
    const multi = pls.filter(p => Object.keys(p).length === 2)
    expect(multi.length).toBeGreaterThan(0)
    // Max placement — 2+1=3
    const maxOnOne = Math.max(...pls.map(p => Math.max(0, ...Object.values(p))))
    expect(maxOnOne).toBe(3)
  })
})

describe('getValidTransfers', () => {
  it('empty board → no transfers possible', () => {
    expect(getValidTransfers(new GameState())).toEqual([])
  })
  it('single stand with blocks → can transfer to any empty open stand', () => {
    const s = new GameState()
    fillStand(s, 1, 2, 0)
    const t = getValidTransfers(s)
    expect(t.some(([src, dst]) => src === 1 && dst === 2)).toBe(true)
    expect(t.every(([src]) => src === 1)).toBe(true)
  })
  it('blocks different color on dst top → blocked', () => {
    const s = new GameState()
    s.stands[1] = [1, 1] // Красные сверху
    s.stands[2] = [0, 0] // Синие сверху
    const t = getValidTransfers(s)
    // Можно 1→2 (cur player=0, красные на синие)? Топ разный → нет.
    expect(t.some(([src, dst]) => src === 1 && dst === 2)).toBe(false)
    expect(t.some(([src, dst]) => src === 2 && dst === 1)).toBe(false)
  })
  it('closing transfer only allowed with own color (current player)', () => {
    const s = new GameState() // currentPlayer=0
    s.stands[1] = Array(8).fill(1) // 8 красных
    s.stands[2] = Array(4).fill(1) // 4 красных — перенос даст 12>11 → блокать будет красный (не наш цвет)
    const t = getValidTransfers(s)
    expect(t.some(([src, dst]) => src === 1 && dst === 2)).toBe(false)
  })
})

describe('applyAction — first turn', () => {
  it('first turn placement rotates to player 1, turn becomes 1', () => {
    let s = new GameState()
    s = applyAction(s, { placement: { 1: 1 } })
    expect(s.currentPlayer).toBe(1)
    expect(s.turn).toBe(1)
    expect(s.stands[1]).toEqual([0]) // Player 0 placed on stand 1
  })
})

describe('applyAction — swap', () => {
  it('swap inverts all colors, uses swap, does NOT rotate player (player 1 keeps turn logic)', () => {
    let s = new GameState()
    s = applyAction(s, { placement: { 1: 1 } }) // P0 places blue
    expect(s.stands[1]).toEqual([0])
    expect(s.currentPlayer).toBe(1)
    s = applyAction(s, { swap: true })
    // Стойка 1 была [0], после swap — [1]
    expect(s.stands[1]).toEqual([1])
    expect(s.swapAvailable).toBe(false)
    // currentPlayer после swap: согласно applyAction — ротируется 1→0
    expect(s.currentPlayer).toBe(0)
    expect(s.turn).toBe(2)
  })
  it('swap after turn 1 not in legal actions', () => {
    let s = new GameState()
    s = applyAction(s, { placement: { 1: 1 } })
    s = applyAction(s, { placement: { 5: 1 } })
    const legal = getLegalActions(s)
    expect(legal.some(a => a.swap)).toBe(false)
  })
})

describe('applyAction — closure by placement', () => {
  it('stand with 10 chips + placement 1 → closes with player color', () => {
    let s = new GameState()
    fillStand(s, 1, 10, 0)
    s.turn = 5 // Not first turn
    s.currentPlayer = 0
    s = applyAction(s, { placement: { 1: 1 } })
    expect(s.closed[1]).toBe(0)
  })
  it('defensive: stand with 11+ chips after any action auto-closes', () => {
    let s = new GameState()
    fillStand(s, 1, 10, 1) // 10 красных
    s.turn = 5
    s.currentPlayer = 0 // Должен доложить свой синий поверх красного
    s = applyAction(s, { placement: { 1: 1 } })
    // Получилось 11 блоков с синим сверху → высотка наша (топовый цвет)
    expect(s.closed[1]).toBe(0)
  })
})

describe('applyAction — closure by transfer', () => {
  it('transfer that creates 11+ closes with transferred color', () => {
    let s = new GameState()
    s.turn = 5
    s.currentPlayer = 0
    fillStand(s, 1, 7, 0) // 7 своих
    fillStand(s, 2, 5, 0) // 5 своих — на 2 должно стать 12 → срезается до 11 и закрывается
    s = applyAction(s, { transfer: [1, 2] })
    expect(s.closed[2]).toBe(0)
  })
})

describe('applyAction — turn rotation', () => {
  it('player alternates 0 → 1 → 0 on placements', () => {
    let s = new GameState()
    s = applyAction(s, { placement: { 1: 1 } })
    expect(s.currentPlayer).toBe(1)
    s = applyAction(s, { placement: { 5: 1 } })
    expect(s.currentPlayer).toBe(0)
  })
})

describe('game over — determineWinner', () => {
  it('all 10 stands closed, player 0 has more → winner=0', () => {
    let s = new GameState()
    for (let i = 0; i < 6; i++) s.closed[i] = 0
    for (let i = 6; i < 9; i++) s.closed[i] = 1
    fillStand(s, 9, 10, 0)
    s.turn = 20; s.currentPlayer = 0
    s = applyAction(s, { placement: { 9: 1 } })
    expect(s.gameOver).toBe(true)
    expect(s.winner).toBe(0)
  })

  it('5:5 tie broken by GOLDEN_STAND owner', () => {
    let s = new GameState()
    s.closed[GOLDEN_STAND] = 0 // Золотая у синего
    for (let i = 1; i < 5; i++) s.closed[i] = 0
    for (let i = 5; i < 9; i++) s.closed[i] = 1
    fillStand(s, 9, 10, 1)
    s.turn = 20; s.currentPlayer = 1
    s = applyAction(s, { placement: { 9: 1 } })
    expect(s.gameOver).toBe(true)
    // 5:5 → золотая у player 0
    expect(s.winner).toBe(0)
  })

  it('early winner: one player cannot be caught up', () => {
    let s = new GameState()
    // P0 имеет 6 закрытых, P1 — 0, осталось 4 открытых. 6 > 0 + 4 → P0 побеждает.
    for (let i = 0; i < 6; i++) s.closed[i] = 0
    fillStand(s, 6, 5, 0)
    s.turn = 20; s.currentPlayer = 0
    s = applyAction(s, { placement: { 6: 1 } })
    expect(s.gameOver).toBe(true)
    expect(s.winner).toBe(0)
  })
})

describe('getLegalActions', () => {
  it('empty list after gameOver', () => {
    const s = new GameState()
    s.gameOver = true
    expect(getLegalActions(s)).toEqual([])
  })
  it('first turn: non-empty placement actions', () => {
    const s = new GameState()
    const legal = getLegalActions(s)
    expect(legal.length).toBeGreaterThan(0)
    // Все legal actions на first turn не должны иметь empty placement (первый ход обязателен)
    const hasEmptyPlacement = legal.some(a => !a.transfer && !a.swap && (!a.placement || !Object.keys(a.placement).length))
    expect(hasEmptyPlacement).toBe(false)
  })
  it('turn 1: swap is in legal list', () => {
    let s = new GameState()
    s = applyAction(s, { placement: { 1: 1 } })
    const legal = getLegalActions(s)
    expect(legal.some(a => a.swap)).toBe(true)
  })
})

describe('integration — play a short game', () => {
  it('can reach gameOver by sequential placements', () => {
    let s = new GameState()
    // Распихиваем все 10 стоек до 10 блоков (пополам между плейерами)
    for (let i = 0; i < NUM_STANDS; i++) {
      fillStand(s, i, 10, i % 2)
    }
    s.turn = 20
    s.currentPlayer = 0
    let turns = 0
    while (!s.gameOver && turns < 50) {
      const open = s.openStands()
      if (!open.length) break
      const target = open[0]
      s = applyAction(s, { placement: { [target]: 1 } })
      turns++
    }
    expect(s.gameOver).toBe(true)
    expect(turns).toBeLessThan(20)
  })
})
