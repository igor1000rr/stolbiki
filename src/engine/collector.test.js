/**
 * Тесты для collector.js — запись training data.
 * Мокаю localStorage и fetch вручную (Node env, нет jsdom).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock localStorage до любого импорта collector.js
function mockStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => store.clear(),
    _store: store,
  }
}

let collector

beforeEach(async () => {
  globalThis.localStorage = mockStorage()
  globalThis.fetch = vi.fn(async () => ({ ok: false, status: 200 }))
  // Сбрасываем модуль между тестами — _cache и currentGame сбрасываются.
  vi.resetModules()
  collector = await import('./collector.js')
})

afterEach(() => {
  delete globalThis.localStorage
  delete globalThis.fetch
})

describe('startRecording / recordMove / finishRecording', () => {
  it('startRecording initializes empty game', () => {
    collector.startRecording()
    collector.finishRecording(0, [6, 4])
    const { data } = collector.exportTrainingData()
    // Пустой game не сохраняется
    expect(data.length).toBe(0)
  })

  it('recordMove without startRecording is a no-op', () => {
    const state = { stands: [], closed: {}, turn: 0 }
    collector.recordMove(state, { placement: { 1: 1 } }, 0)
    // Не падает, не сохраняет
    const { data } = collector.exportTrainingData()
    expect(data.length).toBe(0)
  })

  it('full lifecycle: start → record 2 moves → finish → stored', () => {
    collector.startRecording()
    collector.setGameMeta('ai', 400)
    const state = { stands: [[], [0]], closed: {}, turn: 1 }
    collector.recordMove(state, { placement: { 1: 1 } }, 0)
    collector.recordMove(state, { placement: { 3: 1 } }, 1)
    collector.finishRecording(0, [6, 4])

    const { games, moves, data } = collector.exportTrainingData()
    expect(games).toBe(1)
    expect(moves).toBe(2)
    expect(data[0].winner).toBe(0)
    expect(data[0].mode).toBe('ai')
    expect(data[0].difficulty).toBe(400)
    expect(data[0].finalScore).toEqual([6, 4])
  })

  it('cancelRecording discards without saving', () => {
    collector.startRecording()
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { placement: { 1: 1 } }, 0)
    collector.cancelRecording()
    collector.finishRecording(0, [6, 4]) // no-op after cancel
    expect(collector.exportTrainingData().games).toBe(0)
  })

  it('recordMove filters placement entries with 0 count', () => {
    collector.startRecording()
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, {
      placement: { 1: 2, 3: 0, 5: 1 },
    }, 0)
    collector.finishRecording(0, [1, 0])
    const { data } = collector.exportTrainingData()
    const saved = data[0].moves[0].action.placement
    expect(saved).toEqual({ 1: 2, 5: 1 })
  })

  it('recordMove preserves swap action', () => {
    collector.startRecording()
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { swap: true }, 1)
    collector.finishRecording(1, [0, 1])
    const { data } = collector.exportTrainingData()
    expect(data[0].moves[0].action.swap).toBe(true)
  })

  it('recordMove preserves transfer action', () => {
    collector.startRecording()
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { transfer: [1, 3] }, 0)
    collector.finishRecording(0, [1, 0])
    const { data } = collector.exportTrainingData()
    expect(data[0].moves[0].action.transfer).toEqual([1, 3])
  })
})

describe('exportForTraining — python format conversion', () => {
  it('converts moves to (state, action, value) samples with ±1 reward', () => {
    collector.startRecording()
    collector.setGameMeta('ai', 400)
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { placement: { 1: 1 } }, 0)
    collector.recordMove({ stands: [], closed: {}, turn: 1 }, { placement: { 3: 1 } }, 1)
    collector.finishRecording(0, [6, 4])

    const samples = collector.exportForTraining()
    expect(samples.length).toBe(2)
    // Player 0 победил → value = +1
    expect(samples[0].value).toBe(1)
    // Player 1 проиграл → value = -1
    expect(samples[1].value).toBe(-1)
  })

  it('skips games with winner undefined or < 0', () => {
    collector.startRecording()
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { placement: { 1: 1 } }, 0)
    collector.finishRecording(-1, [0, 0]) // draw/no winner
    const samples = collector.exportForTraining()
    expect(samples.length).toBe(0)
  })
})

describe('getTrainingStats', () => {
  it('counts games by mode and difficulty', () => {
    // 2 AI игры, 1 PVP
    for (let i = 0; i < 2; i++) {
      collector.startRecording()
      collector.setGameMeta('ai', 400)
      collector.recordMove({ stands: [], closed: {}, turn: 0 }, { placement: { 1: 1 } }, 0)
      collector.finishRecording(0, [6, 4])
    }
    collector.startRecording()
    collector.setGameMeta('pvp', 0)
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { placement: { 1: 1 } }, 0)
    collector.finishRecording(0, [6, 4])

    const stats = collector.getTrainingStats()
    expect(stats.games).toBe(3)
    expect(stats.aiGames).toBe(2)
    expect(stats.pvpGames).toBe(1)
    expect(stats.byDifficulty[400]).toBe(2)
  })
})

describe('clearTrainingData', () => {
  it('removes all stored games', () => {
    collector.startRecording()
    collector.recordMove({ stands: [], closed: {}, turn: 0 }, { placement: { 1: 1 } }, 0)
    collector.finishRecording(0, [6, 4])
    expect(collector.exportTrainingData().games).toBe(1)

    collector.clearTrainingData()
    expect(collector.exportTrainingData().games).toBe(0)
  })
})

describe('MAX_GAMES trimming (FIFO)', () => {
  it('drops oldest games once > MAX_GAMES (200)', () => {
    // Записываем 202 игры — последние 200 должны остаться
    for (let i = 0; i < 202; i++) {
      collector.startRecording()
      collector.recordMove({ stands: [], closed: {}, turn: i }, { placement: { 1: 1 } }, 0)
      collector.finishRecording(0, [6, 4])
    }
    const { games } = collector.exportTrainingData()
    expect(games).toBe(200)
  })
})
