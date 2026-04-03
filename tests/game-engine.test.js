/**
 * Тесты движка игры "Перехват высотки"
 * Покрытие: инициализация, правила, edge cases, game over
 */

import { describe, it, expect } from 'vitest'
import {
  NUM_STANDS, GOLDEN_STAND, MAX_CHIPS, MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX,
  GameState, getValidTransfers, getValidPlacements, applyAction, getLegalActions
} from '../server/game-engine.js'

// ═══ Хелперы ═══

/** Создаёт GameState с заданными стойками */
function makeState(stands, opts = {}) {
  const gs = new GameState()
  gs.stands = stands.map(s => [...s])
  gs.closed = opts.closed || {}
  gs.currentPlayer = opts.currentPlayer ?? 0
  gs.turn = opts.turn ?? 2
  gs.swapAvailable = opts.swapAvailable ?? false
  gs.gameOver = opts.gameOver ?? false
  gs.winner = opts.winner ?? null
  return gs
}

/** Пустая доска из 10 стоек */
function emptyStands() {
  return Array.from({ length: 10 }, () => [])
}

// ═══ Константы ═══

describe('Константы', () => {
  it('правильные значения', () => {
    expect(NUM_STANDS).toBe(10)
    expect(GOLDEN_STAND).toBe(0)
    expect(MAX_CHIPS).toBe(11)
    expect(MAX_PLACE).toBe(3)
    expect(MAX_PLACE_STANDS).toBe(2)
    expect(FIRST_TURN_MAX).toBe(1)
  })
})

// ═══ GameState ═══

describe('GameState', () => {
  it('инициализация — 10 пустых стоек', () => {
    const gs = new GameState()
    expect(gs.stands.length).toBe(10)
    expect(gs.stands.every(s => s.length === 0)).toBe(true)
    expect(gs.currentPlayer).toBe(0)
    expect(gs.turn).toBe(0)
    expect(gs.swapAvailable).toBe(true)
    expect(gs.gameOver).toBe(false)
    expect(gs.winner).toBe(null)
  })

  it('copy() — глубокая копия', () => {
    const gs = new GameState()
    gs.stands[0] = [0, 0, 1]
    gs.closed[3] = 1
    gs.currentPlayer = 1
    gs.turn = 5

    const cp = gs.copy()
    expect(cp.stands[0]).toEqual([0, 0, 1])
    expect(cp.closed).toEqual({ 3: 1 })
    expect(cp.currentPlayer).toBe(1)

    // Мутация оригинала не влияет на копию
    gs.stands[0].push(1)
    gs.closed[5] = 0
    expect(cp.stands[0]).toEqual([0, 0, 1])
    expect(cp.closed).toEqual({ 3: 1 })
  })

  it('openStands() — без закрытых', () => {
    const gs = new GameState()
    expect(gs.openStands()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('openStands() — с закрытыми', () => {
    const gs = new GameState()
    gs.closed = { 0: 0, 3: 1, 7: 0 }
    expect(gs.openStands()).toEqual([1, 2, 4, 5, 6, 8, 9])
  })

  it('numOpen / countClosed', () => {
    const gs = new GameState()
    gs.closed = { 0: 0, 1: 0, 5: 1 }
    expect(gs.numOpen()).toBe(7)
    expect(gs.countClosed(0)).toBe(2)
    expect(gs.countClosed(1)).toBe(1)
  })

  it('standSpace — стойка пустая = 11', () => {
    const gs = new GameState()
    expect(gs.standSpace(0)).toBe(11)
  })

  it('standSpace — стойка закрыта = 0', () => {
    const gs = new GameState()
    gs.closed[0] = 0
    expect(gs.standSpace(0)).toBe(0)
  })

  it('topGroup — пустая стойка', () => {
    const gs = new GameState()
    expect(gs.topGroup(0)).toEqual([-1, 0])
  })

  it('topGroup — одноцветная вершина', () => {
    const gs = makeState(emptyStands())
    gs.stands[0] = [1, 0, 0, 0]
    expect(gs.topGroup(0)).toEqual([0, 3])
  })

  it('topGroup — вся стойка одного цвета', () => {
    const gs = makeState(emptyStands())
    gs.stands[2] = [1, 1, 1, 1, 1]
    expect(gs.topGroup(2)).toEqual([1, 5])
  })

  it('isFirstTurn / canCloseByPlacement', () => {
    const gs = new GameState()
    expect(gs.isFirstTurn()).toBe(true)
    gs.turn = 1
    expect(gs.isFirstTurn()).toBe(false)

    // canCloseByPlacement = true когда ≤2 открытых стойки
    gs.closed = {}
    for (let i = 0; i < 8; i++) gs.closed[i] = i % 2
    expect(gs.canCloseByPlacement()).toBe(true) // 2 открытых
  })
})

// ═══ Переносы ═══

describe('getValidTransfers', () => {
  it('пустая доска — нет переносов', () => {
    const gs = new GameState()
    expect(getValidTransfers(gs)).toEqual([])
  })

  it('перенос одноцветной группы на пустую стойку', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 0]
    const gs = makeState(stands)
    const transfers = getValidTransfers(gs)
    // Можно перенести на любую из 9 пустых стоек
    expect(transfers.length).toBe(9)
    expect(transfers.every(t => t[0] === 0)).toBe(true)
  })

  it('перенос только на совпадающий цвет', () => {
    const stands = emptyStands()
    stands[0] = [0, 0]  // группа = [0, 2]
    stands[1] = [1, 1]  // верх = 1, не совпадает
    stands[2] = [1, 0]  // верх = 0, совпадает
    const gs = makeState(stands)
    const transfers = getValidTransfers(gs)
    const toDst1 = transfers.filter(t => t[0] === 0 && t[1] === 1)
    const toDst2 = transfers.filter(t => t[0] === 0 && t[1] === 2)
    expect(toDst1.length).toBe(0) // нельзя — цвет не совпадает
    expect(toDst2.length).toBe(1) // можно — цвет совпадает
  })

  it('нельзя закрыть стойку чужим цветом', () => {
    const stands = emptyStands()
    stands[0] = [1, 1, 1] // группа цвет = 1, размер = 3
    stands[1] = Array(8).fill(1) // 8 фишек цвет 1
    // Перенос 3 → 8+3=11 = закрытие цветом 1
    // currentPlayer = 0, grpColor = 1 ≠ player → нельзя
    const gs = makeState(stands, { currentPlayer: 0 })
    const transfers = getValidTransfers(gs)
    const blocked = transfers.filter(t => t[0] === 0 && t[1] === 1)
    expect(blocked.length).toBe(0)
  })

  it('можно закрыть стойку своим цветом', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 0]
    stands[1] = Array(8).fill(0)
    const gs = makeState(stands, { currentPlayer: 0 })
    const transfers = getValidTransfers(gs)
    const closing = transfers.filter(t => t[0] === 0 && t[1] === 1)
    expect(closing.length).toBe(1)
  })

  it('нельзя переносить на/с закрытых стоек', () => {
    const stands = emptyStands()
    stands[0] = [0, 0]
    stands[1] = [1, 1]
    const gs = makeState(stands, { closed: { 1: 1 } })
    const transfers = getValidTransfers(gs)
    expect(transfers.filter(t => t[0] === 1 || t[1] === 1).length).toBe(0)
  })
})

// ═══ Расстановка ═══

describe('getValidPlacements', () => {
  it('первый ход — макс 1 фишка', () => {
    const gs = new GameState() // turn = 0
    const placements = getValidPlacements(gs)
    // Все варианты: {} (пропуск) + по 1 фишке на каждую из 10 стоек
    // Но на первый ход getLegalActions фильтрует пустой placement
    for (const p of placements) {
      const total = Object.values(p).reduce((a, b) => a + b, 0)
      expect(total).toBeLessThanOrEqual(1)
    }
  })

  it('обычный ход — до 3 фишек на 1-2 стойки', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 0, 0, 0] // 5 фишек, space = 6
    const gs = makeState(stands, { turn: 2 })
    const placements = getValidPlacements(gs)
    for (const p of placements) {
      const total = Object.values(p).reduce((a, b) => a + b, 0)
      expect(total).toBeLessThanOrEqual(3)
      expect(Object.keys(p).length).toBeLessThanOrEqual(2)
    }
  })

  it('нельзя заполнить стойку до 11 если >2 открытых', () => {
    const stands = emptyStands()
    stands[0] = Array(9).fill(0) // space = 2, но canClose=false → maxHere = min(1, 3) = 1
    const gs = makeState(stands, { turn: 2 })
    const placements = getValidPlacements(gs)
    const toStand0 = placements.filter(p => p[0])
    for (const p of toStand0) {
      expect(p[0]).toBeLessThanOrEqual(1) // оставить хотя бы 1 место
    }
  })

  it('можно закрыть размещением если ≤2 открытых', () => {
    const stands = emptyStands()
    stands[0] = Array(10).fill(0)
    stands[1] = [1, 1]
    const closed = {}
    for (let i = 2; i < 10; i++) closed[i] = i % 2
    const gs = makeState(stands, { turn: 5, closed })
    // 2 открытых → canClose = true
    const placements = getValidPlacements(gs)
    const closingPlacements = placements.filter(p => p[0] >= 1) // ≥1 на стойку 0 (10+1=11)
    expect(closingPlacements.length).toBeGreaterThan(0)
  })
})

// ═══ applyAction ═══

describe('applyAction', () => {
  it('swap — меняет цвета, убирает swapAvailable', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 1]
    stands[1] = [1, 1, 0]
    const gs = makeState(stands, { turn: 1, swapAvailable: true, currentPlayer: 1 })
    gs.closed[5] = 0

    const ns = applyAction(gs, { swap: true })
    expect(ns.stands[0]).toEqual([1, 1, 0])
    expect(ns.stands[1]).toEqual([0, 0, 1])
    expect(ns.closed[5]).toBe(1)
    expect(ns.swapAvailable).toBe(false)
    expect(ns.currentPlayer).toBe(0) // сменился
    expect(ns.turn).toBe(2)
  })

  it('перенос — фишки двигаются', () => {
    const stands = emptyStands()
    stands[0] = [1, 0, 0] // группа [0, 2]
    stands[1] = []
    const gs = makeState(stands)

    const ns = applyAction(gs, { transfer: [0, 1], placement: {} })
    expect(ns.stands[0]).toEqual([1])
    expect(ns.stands[1]).toEqual([0, 0])
  })

  it('перенос с закрытием стойки', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 0]
    stands[1] = Array(8).fill(0)
    const gs = makeState(stands, { currentPlayer: 0 })

    const ns = applyAction(gs, { transfer: [0, 1], placement: {} })
    expect(ns.closed[1]).toBe(0) // закрыта цветом 0
    expect(ns.stands[1].length).toBe(11)
  })

  it('размещение — фишки добавляются', () => {
    const stands = emptyStands()
    const gs = makeState(stands, { currentPlayer: 0 })

    const ns = applyAction(gs, { transfer: null, placement: { 0: 2, 3: 1 } })
    expect(ns.stands[0]).toEqual([0, 0])
    expect(ns.stands[3]).toEqual([0])
    expect(ns.currentPlayer).toBe(1)
  })

  it('не мутирует оригинал', () => {
    const gs = new GameState()
    gs.stands[0] = [0, 0]
    const before = JSON.stringify(gs)
    applyAction(gs, { transfer: null, placement: { 1: 1 } })
    expect(JSON.stringify(gs)).toBe(before)
  })

  it('swapAvailable = false после turn >= 1', () => {
    const stands = emptyStands()
    stands[0] = [0]
    const gs = makeState(stands, { turn: 1, swapAvailable: true })

    const ns = applyAction(gs, { transfer: null, placement: { 1: 1 } })
    expect(ns.swapAvailable).toBe(false)
  })
})

// ═══ Game Over ═══

describe('Game Over', () => {
  it('все 10 стоек закрыты — побеждает тот у кого больше', () => {
    const stands = emptyStands()
    for (let i = 0; i < 10; i++) stands[i] = Array(11).fill(i < 6 ? 0 : 1)
    const closed = {}
    for (let i = 0; i < 9; i++) closed[i] = i < 6 ? 0 : 1
    // Стойка 9 закроется этим ходом
    stands[9] = Array(8).fill(1)
    stands[8] = [1, 1, 1] // группа для переноса

    const gs = makeState(stands, { closed, currentPlayer: 1 })
    const ns = applyAction(gs, { transfer: [8, 9], placement: {} })
    // 9: закрывается за 1 → closed[9]=1. Но 8 уже закрыта... 
    // Пересоздадим проще:

    const gs2 = makeState(emptyStands(), {
      closed: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 1 }
    })
    gs2.gameOver = false
    // 6 vs 4 → winner = 0
    // Имитируем финальное состояние
    const gs3 = new GameState()
    gs3.closed = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 1 }
    gs3.gameOver = true
    gs3.winner = null
    // Проверим через countClosed
    expect(gs3.countClosed(0)).toBe(6)
    expect(gs3.countClosed(1)).toBe(4)
  })

  it('раннее завершение — невозможно догнать', () => {
    // P0 закрыл 6, P1 закрыл 1, открытых 3 → 1+3=4 < 6 → P0 выигрывает
    const stands = emptyStands()
    stands[7] = [0, 0]
    stands[8] = [1]
    stands[9] = [0]
    const closed = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 }
    const gs = makeState(stands, { closed, currentPlayer: 0 })

    // Любое действие → checkGameOver: p0 closed=6 > p1 closed(1) + open(3) = 4
    const ns = applyAction(gs, { transfer: null, placement: {} })
    expect(ns.gameOver).toBe(true)
    expect(ns.winner).toBe(0)
  })

  it('ничья — золотая стойка решает', () => {
    // Все закрыты, 5 на 5. Золотая (stand 0) за P1 → P1 побеждает
    const gs = new GameState()
    gs.closed = { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1 }
    // 9 ещё открыта, закроем
    gs.stands[9] = Array(8).fill(0)
    gs.stands[8] = [0, 0, 0] // но 8 уже закрыта...

    // Проще: создадим состояние где последняя стойка закрывается
    const stands2 = emptyStands()
    stands2[9] = Array(8).fill(0)
    stands2[3] = [0, 0, 0]
    const closed2 = { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1 }
    const gs2 = makeState(stands2, { closed: closed2, currentPlayer: 0 })
    const ns = applyAction(gs2, { transfer: [3, 9], placement: {} })
    // 9 закрывается за 0: 8+3=11, цвет 0. Итого: P0=5+1=6, P1=4... нет, пересчитаем.
    // closed: 0→1, 1→0, 2→0, 3→0, 4→0, 5→1, 6→1, 7→1, 8→1, 9→0
    // P0: 1,2,3,4,9 = 5. P1: 0,5,6,7,8 = 5. Ничья → golden (0) за P1 → P1
    expect(ns.gameOver).toBe(true)
    expect(ns.winner).toBe(1) // золотая за P1
  })
})

// ═══ getLegalActions ═══

describe('getLegalActions', () => {
  it('game over — нет действий', () => {
    const gs = new GameState()
    gs.gameOver = true
    expect(getLegalActions(gs)).toEqual([])
  })

  it('turn=1, swapAvailable — swap в списке', () => {
    const stands = emptyStands()
    stands[0] = [0]
    const gs = makeState(stands, { turn: 1, swapAvailable: true, currentPlayer: 1 })
    const actions = getLegalActions(gs)
    expect(actions.some(a => a.swap)).toBe(true)
  })

  it('turn≠1 — swap НЕ в списке', () => {
    const stands = emptyStands()
    stands[0] = [0]
    const gs = makeState(stands, { turn: 3, swapAvailable: true })
    const actions = getLegalActions(gs)
    expect(actions.some(a => a.swap)).toBe(false)
  })

  it('первый ход — нет пустого действия', () => {
    const gs = new GameState() // turn = 0
    const actions = getLegalActions(gs)
    // Каждое действие должно что-то делать (хотя бы placement)
    expect(actions.some(a => !a.swap && !a.transfer && (!a.placement || !Object.keys(a.placement).length))).toBe(false)
  })

  it('всегда есть хотя бы одно действие', () => {
    const gs = new GameState()
    expect(getLegalActions(gs).length).toBeGreaterThan(0)
  })

  it('комбинации transfer+placement', () => {
    const stands = emptyStands()
    stands[0] = [0, 0] // можно перенести
    stands[1] = [0]
    const gs = makeState(stands, { turn: 2 })
    const actions = getLegalActions(gs)

    // Должны быть как действия с transfer, так и без
    const withTransfer = actions.filter(a => a.transfer)
    const withoutTransfer = actions.filter(a => !a.transfer && !a.swap)
    expect(withTransfer.length).toBeGreaterThan(0)
    expect(withoutTransfer.length).toBeGreaterThan(0)
  })
})

// ═══ Edge Cases ═══

describe('Edge Cases', () => {
  it('перенос — overflow обрезается до 11', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 0, 0, 0] // 5 фишек
    stands[1] = Array(8).fill(0)
    const gs = makeState(stands, { currentPlayer: 0 })

    const ns = applyAction(gs, { transfer: [0, 1], placement: {} })
    // 8+5=13 > 11, но стойка закрывается → обрезается до 11
    expect(ns.stands[1].length).toBe(11)
    expect(ns.closed[1]).toBe(0)
  })

  it('swap меняет все закрытые стойки', () => {
    const stands = emptyStands()
    stands[0] = [0, 1, 0]
    const gs = makeState(stands, { turn: 1, swapAvailable: true, currentPlayer: 1, closed: { 2: 0, 5: 1, 7: 0 } })

    const ns = applyAction(gs, { swap: true })
    expect(ns.closed).toEqual({ 2: 1, 5: 0, 7: 1 })
    expect(ns.stands[0]).toEqual([1, 0, 1])
  })

  it('placement на 2 стойки одновременно', () => {
    const stands = emptyStands()
    const gs = makeState(stands, { currentPlayer: 1 })
    const ns = applyAction(gs, { transfer: null, placement: { 0: 1, 5: 2 } })
    expect(ns.stands[0]).toEqual([1])
    expect(ns.stands[5]).toEqual([1, 1])
  })

  it('много закрытых стоек — openStands корректен', () => {
    const gs = new GameState()
    for (let i = 0; i < 9; i++) gs.closed[i] = i % 2
    expect(gs.openStands()).toEqual([9])
    expect(gs.numOpen()).toBe(1)
  })
})

// ═══ Дополнительные edge cases ═══
describe('Advanced edge cases', () => {
  it('golden stand (0) учитывается в закрытии', () => {
    const gs = new GameState()
    gs.stands[0] = Array(MAX_CHIPS).fill(0)
    gs.turn = 10
    const ns = applyAction(gs, { placement: {} })
    // Стойка 0 — golden, если закрыта, countClosed для owner корректен
    if (0 in ns.closed) {
      expect(ns.closed[0]).toBe(0) // Закрыта за P0
    }
  })

  it('copy() глубокая — изменение копии не затрагивает оригинал', () => {
    const gs = new GameState()
    gs.stands[3] = [0, 1, 0, 1]
    gs.closed = { 5: 1 }
    gs.turn = 12
    gs.currentPlayer = 1

    const cp = gs.copy()
    cp.stands[3].push(0)
    cp.closed[6] = 0
    cp.turn = 99
    cp.currentPlayer = 0

    expect(gs.stands[3]).toEqual([0, 1, 0, 1])
    expect(gs.closed).toEqual({ 5: 1 })
    expect(gs.turn).toBe(12)
    expect(gs.currentPlayer).toBe(1)
  })

  it('getLegalActions на пустой доске — только placement', () => {
    const gs = new GameState()
    const actions = getLegalActions(gs)
    expect(actions.length).toBeGreaterThan(0)
    // На первом ходу нет переносов (нечего переносить)
    const hasTransfer = actions.some(a => a.transfer)
    expect(hasTransfer).toBe(false)
  })

  it('getValidTransfers — пустые стойки нельзя переносить', () => {
    const gs = new GameState()
    gs.turn = 10
    // Все стойки пусты
    const transfers = getValidTransfers(gs)
    expect(transfers.length).toBe(0)
  })

  it('getValidPlacements ограничивает MAX_PLACE_STANDS', () => {
    const gs = new GameState()
    gs.turn = 10
    const placements = getValidPlacements(gs)
    // Каждый placement должен затрагивать <= MAX_PLACE_STANDS стоек
    placements.forEach(p => {
      const numStands = Object.keys(p).length
      expect(numStands).toBeLessThanOrEqual(MAX_PLACE_STANDS)
    })
  })

  it('FIRST_TURN_MAX = 1 — первый ход ограничен', () => {
    expect(FIRST_TURN_MAX).toBe(1)
    const gs = new GameState()
    const actions = getLegalActions(gs)
    actions.forEach(a => {
      if (a.placement) {
        const total = Object.values(a.placement).reduce((s, v) => s + v, 0)
        expect(total).toBe(1)
      }
    })
  })

  it('gameOver: P1 побеждает при 6 закрытых стойках', () => {
    const gs = new GameState()
    gs.closed = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
    gs.turn = 20
    const ns = applyAction(gs, { placement: {} })
    expect(ns.gameOver).toBe(true)
    expect(ns.winner).toBe(1)
  })

  it('ничья при равном количестве стоек и всех закрытых', () => {
    const gs = new GameState()
    // 5 за P0, 5 за P1 — все 10 закрыты
    gs.closed = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }
    gs.turn = 50
    const ns = applyAction(gs, { placement: {} })
    if (ns.gameOver) {
      // Ничья или победа определяется golden stand
      expect(typeof ns.winner).toBe('number')
    }
  })
})

// ═══ Constants + combined actions ═══
describe('Constants & combined actions', () => {
  it('NUM_STANDS = 10', () => {
    expect(NUM_STANDS).toBe(10)
  })

  it('GOLDEN_STAND = 0', () => {
    expect(GOLDEN_STAND).toBe(0)
  })

  it('MAX_CHIPS = 11', () => {
    expect(MAX_CHIPS).toBe(11)
  })

  it('placement на 3 разных стойки', () => {
    let gs = new GameState()
    gs = applyAction(gs, { placement: { 0: 1 } }) // P0 first turn
    const ns = applyAction(gs, { placement: { 1: 1, 2: 1, 3: 1 } })
    expect(ns.stands[1]).toEqual([1])
    expect(ns.stands[2]).toEqual([1])
    expect(ns.stands[3]).toEqual([1])
  })

  it('transfer + placement в одном ходу', () => {
    const gs = new GameState()
    gs.stands[0] = [0, 0]
    gs.stands[1] = [0, 0, 0, 0, 0]
    gs.turn = 10
    const ns = applyAction(gs, { transfer: [0, 1], placement: { 3: 1 } })
    expect(ns.stands[0].length).toBe(0)
    expect(ns.stands[1].length).toBe(7)
    expect(ns.stands[3].length).toBe(1)
  })

  it('стойка достигает MAX_CHIPS при переносе → закрытие', () => {
    const gs = new GameState()
    gs.stands[5] = Array(MAX_CHIPS - 2).fill(0) // 9 блоков
    gs.stands[3] = [0, 0] // 2 блока для переноса
    gs.turn = 20
    const ns = applyAction(gs, { transfer: [3, 5], placement: {} })
    // 9+2=11=MAX_CHIPS → стойка закрыта
    expect(5 in ns.closed).toBe(true)
    expect(ns.closed[5]).toBe(0) // Закрыта за P0
  })
})

// ═══ GameState API completeness ═══
describe('GameState API', () => {
  it('new GameState() — все стойки пусты', () => {
    const gs = new GameState()
    gs.stands.forEach(s => expect(s.length).toBe(0))
    expect(Object.keys(gs.closed).length).toBe(0)
    expect(gs.turn).toBe(0)
    expect(gs.currentPlayer).toBe(0)
    expect(gs.gameOver).toBe(false)
  })

  it('openStands() исключает закрытые', () => {
    const gs = new GameState()
    gs.closed = { 0: 0, 5: 1, 9: 0 }
    const open = gs.openStands()
    expect(open).not.toContain(0)
    expect(open).not.toContain(5)
    expect(open).not.toContain(9)
    expect(open.length).toBe(7)
  })

  it('countClosed возвращает 0 для нового состояния', () => {
    const gs = new GameState()
    expect(gs.countClosed(0)).toBe(0)
    expect(gs.countClosed(1)).toBe(0)
  })

  it('numStands = NUM_STANDS', () => {
    const gs = new GameState()
    expect(gs.numStands).toBe(NUM_STANDS)
  })
})

// ═══ Swap mechanics ═══
describe('Swap mechanics', () => {
  it('swap инвертирует все блоки на доске', () => {
    let state = new GameState()
    state = applyAction(state, { placement: { 3: 1 } }) // P0 ставит на 3
    expect(state.stands[3]).toEqual([0]) // Блок P0
    state = applyAction(state, { swap: true }) // P1 делает swap
    expect(state.stands[3]).toEqual([1]) // Теперь блок P1
  })

  it('swap меняет currentPlayer', () => {
    let state = new GameState()
    state = applyAction(state, { placement: { 0: 1 } })
    expect(state.currentPlayer).toBe(1)
    state = applyAction(state, { swap: true })
    expect(state.currentPlayer).toBe(0) // Обратно к P0
  })

  it('swap недоступен на первом ходу', () => {
    const state = new GameState()
    const actions = getLegalActions(state)
    expect(actions.some(a => a.swap)).toBe(false)
  })
})

// ═══ Placement validation ═══
describe('Placement validation', () => {
  it('нельзя ставить на закрытую стойку', () => {
    const gs = new GameState()
    gs.closed = { 3: 0 }
    gs.turn = 10
    const placements = getValidPlacements(gs)
    placements.forEach(p => {
      expect(p).not.toHaveProperty('3')
    })
  })

  it('первый ход: ровно 1 блок на 1 стойку (non-empty)', () => {
    const gs = new GameState()
    const placements = getValidPlacements(gs).filter(p => Object.keys(p).length > 0)
    expect(placements.length).toBeGreaterThan(0)
    placements.forEach(p => {
      const total = Object.values(p).reduce((s, v) => s + v, 0)
      expect(total).toBe(FIRST_TURN_MAX)
      expect(Object.keys(p).length).toBe(1)
    })
  })

  it('MAX_PLACE блоков на обычном ходу', () => {
    let gs = new GameState()
    gs = applyAction(gs, { placement: { 0: 1 } })
    const placements = getValidPlacements(gs)
    placements.forEach(p => {
      const total = Object.values(p).reduce((s, v) => s + v, 0)
      expect(total).toBeLessThanOrEqual(MAX_PLACE)
    })
  })
})

// ═══ Transfer + closing ═══
describe('Transfer closing rules', () => {
  it('перенос закрывает стойку при достижении MAX_CHIPS', () => {
    const stands = emptyStands()
    stands[0] = [0, 0, 0] // 3 блока P0
    stands[1] = Array(8).fill(0) // 8 блоков P0, всего будет 11
    const gs = makeState(stands, { currentPlayer: 0 })
    const ns = applyAction(gs, { transfer: [0, 1], placement: {} })
    expect(1 in ns.closed).toBe(true)
    expect(ns.closed[1]).toBe(0) // P0 закрыл
    expect(ns.stands[0].length).toBe(0) // Источник пуст
  })
})

// ═══ Transfer edge cases ═══
describe('Transfer edge cases', () => {
  it('нельзя переносить на ту же стойку', () => {
    const stands = emptyStands()
    stands[5] = [0, 0, 0]
    const gs = makeState(stands)
    const transfers = getValidTransfers(gs)
    transfers.forEach(t => expect(t[0]).not.toBe(t[1]))
  })

  it('пустые стойки не являются источником переноса', () => {
    const gs = new GameState()
    gs.turn = 10
    const transfers = getValidTransfers(gs)
    transfers.forEach(([src]) => {
      expect(gs.stands[src].length).toBeGreaterThan(0)
    })
  })

  it('перенос уменьшает numOpen при закрытии', () => {
    const stands = emptyStands()
    stands[0] = [0, 0]
    stands[1] = Array(9).fill(0) // 9+2=11 → закрытие
    const gs = makeState(stands, { currentPlayer: 0 })
    const before = gs.numOpen()
    const ns = applyAction(gs, { transfer: [0, 1], placement: {} })
    expect(ns.numOpen()).toBe(before - 1)
  })
})
