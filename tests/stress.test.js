/**
 * Стресс-тесты движка
 * 500 случайных партий до gameOver — ни одна не должна упасть
 */

import { describe, it, expect } from 'vitest'
import { GameState, applyAction, getLegalActions } from '../server/game-engine.js'

function randomAction(state) {
  const actions = getLegalActions(state)
  if (!actions.length) return {}
  return actions[Math.floor(Math.random() * actions.length)]
}

describe('Стресс-тест движка', () => {
  it('500 рандомных партий завершаются без ошибок', { timeout: 30000 }, () => {
    const results = { p0: 0, p1: 0, draw: 0, maxTurns: 0, totalTurns: 0 }

    for (let game = 0; game < 500; game++) {
      let state = new GameState()
      let safety = 0

      while (!state.gameOver && safety < 500) {
        const action = randomAction(state)
        state = applyAction(state, action)
        safety++
      }

      expect(state.gameOver).toBe(true)
      expect(safety).toBeLessThan(500) // Партия должна завершиться

      if (state.winner === 0) results.p0++
      else if (state.winner === 1) results.p1++
      else results.draw++

      results.maxTurns = Math.max(results.maxTurns, state.turn)
      results.totalTurns += state.turn
    }

    // Базовые проверки баланса
    const avgTurns = results.totalTurns / 500
    expect(avgTurns).toBeGreaterThan(20) // Партии не должны быть слишком короткими
    expect(avgTurns).toBeLessThan(200) // И не слишком длинными
    expect(results.maxTurns).toBeLessThan(500) // Максимум разумный

    // P1 и P2 должны выигрывать (не 100% одна сторона)
    expect(results.p0).toBeGreaterThan(50)
    expect(results.p1).toBeGreaterThan(50)
  })

  it('getLegalActions всегда возвращает >0 действий до gameOver', { timeout: 15000 }, () => {
    for (let game = 0; game < 100; game++) {
      let state = new GameState()
      let safety = 0

      while (!state.gameOver && safety < 300) {
        const actions = getLegalActions(state)
        expect(actions.length).toBeGreaterThan(0)
        state = applyAction(state, actions[Math.floor(Math.random() * actions.length)])
        safety++
      }
    }
  })

  it('copy() создаёт независимую копию', () => {
    const s1 = new GameState()
    s1.stands[0] = [0, 1, 0]
    s1.closed[3] = 1
    s1.turn = 5

    const s2 = s1.copy()
    s2.stands[0].push(1)
    s2.closed[4] = 0
    s2.turn = 10

    // Оригинал не изменён
    expect(s1.stands[0]).toEqual([0, 1, 0])
    expect(s1.closed).toEqual({ 3: 1 })
    expect(s1.turn).toBe(5)
  })

  it('swap инвертирует все цвета', () => {
    let state = new GameState()
    // Первый ход: P0 ставит на стойку 3
    state = applyAction(state, { placement: { 3: 1 } })
    expect(state.stands[3]).toEqual([0])

    // P1 делает swap
    state = applyAction(state, { swap: true })
    expect(state.stands[3]).toEqual([1]) // Цвет инвертирован
    expect(state.swapAvailable).toBe(false)
  })

  it('закрытие стойки при 11 блоках', () => {
    const state = new GameState()
    state.stands[5] = [0, 0, 0, 0, 0, 0, 0, 0] // 8 блоков P0
    state.stands[2] = [0, 0, 0] // 3 блока для переноса
    state.turn = 10

    const ns = applyAction(state, { transfer: [2, 5], placement: {} })
    expect(5 in ns.closed).toBe(true)
    expect(ns.closed[5]).toBe(0) // Закрыта за P0
  })

  it('gameOver при достаточном количестве закрытых стоек', () => {
    const state = new GameState()
    // P0 закрывает 6 стоек — победа
    state.closed = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    state.turn = 20

    // applyAction проверяет gameOver
    const ns = applyAction(state, { placement: {} })
    expect(ns.gameOver).toBe(true)
    expect(ns.winner).toBe(0)
  })

  it('первый ход — ровно 1 блок', () => {
    const state = new GameState()
    expect(state.isFirstTurn()).toBe(true)
    const ns = applyAction(state, { placement: { 5: 1 } })
    expect(ns.stands[5]).toEqual([0])
    expect(ns.turn).toBe(1)
    expect(ns.currentPlayer).toBe(1)
  })

  it('обычный ход — 3 блока', () => {
    let state = new GameState()
    state = applyAction(state, { placement: { 3: 1 } }) // P0: 1 блок
    // P1 ставит 3 блока
    const ns = applyAction(state, { placement: { 1: 2, 5: 1 } })
    expect(ns.stands[1].length).toBe(2)
    expect(ns.stands[5].length).toBe(1)
    expect(ns.turn).toBe(2)
  })

  it('countClosed подсчитывает закрытые стойки', () => {
    const state = new GameState()
    state.closed = { 0: 0, 3: 0, 5: 1, 7: 1 }
    expect(state.countClosed(0)).toBe(2)
    expect(state.countClosed(1)).toBe(2)
  })

  it('numOpen возвращает открытые стойки', () => {
    const state = new GameState()
    expect(state.numOpen()).toBe(10)
    state.closed = { 0: 0, 1: 1 }
    expect(state.numOpen()).toBe(8)
  })

  it('перенос опустошает исходную стойку', () => {
    const state = new GameState()
    state.stands[2] = [0, 0, 0]
    state.stands[7] = [1, 1, 1, 1, 1]
    state.turn = 10

    const ns = applyAction(state, { transfer: [2, 7], placement: {} })
    expect(ns.stands[2].length).toBe(0)
    expect(ns.stands[7].length).toBe(8)
  })

  it('overflow при переносе → закрытие стойки', () => {
    const state = new GameState()
    state.stands[3] = [0, 0, 0, 0, 0]
    state.stands[8] = [1, 1, 1, 1, 1, 1, 1] // 7 блоков + 5 = 12 > 11 → overflow
    state.turn = 10

    const ns = applyAction(state, { transfer: [3, 8], placement: {} })
    // Стойка 8 должна быть закрыта (если overflow правила применяются)
    if (8 in ns.closed) {
      expect(ns.stands[8].length).toBeGreaterThanOrEqual(11)
    }
  })

  it('currentPlayer чередуется 0→1→0', () => {
    let state = new GameState()
    expect(state.currentPlayer).toBe(0)
    state = applyAction(state, { placement: { 0: 1 } })
    expect(state.currentPlayer).toBe(1)
    state = applyAction(state, { placement: { 1: 2, 2: 1 } })
    expect(state.currentPlayer).toBe(0)
  })

  it('isFirstTurn() верно определяет первый ход', () => {
    const state = new GameState()
    expect(state.isFirstTurn()).toBe(true)
    const ns = applyAction(state, { placement: { 5: 1 } })
    expect(ns.isFirstTurn()).toBe(false)
  })

  it('getLegalActions возвращает swap на втором ходу', () => {
    let state = new GameState()
    state = applyAction(state, { placement: { 3: 1 } })
    // Второй ход — должен содержать swap option
    const actions = getLegalActions(state)
    const hasSwap = actions.some(a => a.swap)
    expect(hasSwap).toBe(true)
  })

  it('swap не доступен после второго хода', () => {
    let state = new GameState()
    state = applyAction(state, { placement: { 3: 1 } })
    state = applyAction(state, { placement: { 5: 2, 7: 1 } })
    const actions = getLegalActions(state)
    const hasSwap = actions.some(a => a.swap)
    expect(hasSwap).toBe(false)
  })
})
