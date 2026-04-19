import { describe, it, expect } from 'vitest'
import { verifyGameFromMoves, walkMoves } from './anticheat.js'

describe('verifyGameFromMoves — bad inputs', () => {
  it('rejects null / non-array', () => {
    expect(verifyGameFromMoves(null).ok).toBe(false)
    expect(verifyGameFromMoves('not-array').ok).toBe(false)
  })
  it('rejects empty array', () => {
    expect(verifyGameFromMoves([]).ok).toBe(false)
  })
  it('rejects moves without action field', () => {
    expect(verifyGameFromMoves([{ notAction: {} }]).ok).toBe(false)
    expect(verifyGameFromMoves([null]).ok).toBe(false)
  })
  it('rejects illegal action (first-turn 5 blocks — only 1 allowed)', () => {
    expect(verifyGameFromMoves([{ action: { placement: { 1: 5 } } }]).ok).toBe(false)
  })
  it('rejects unfinished game (game not over after replay)', () => {
    // Один легальный ход — не заканчивает игру.
    expect(verifyGameFromMoves([{ action: { placement: { 1: 1 } } }]).ok).toBe(false)
  })
})

describe('walkMoves — non-finished replay verification', () => {
  it('rejects null / empty', () => {
    expect(walkMoves(null).ok).toBe(false)
    expect(walkMoves([]).ok).toBe(false)
  })
  it('accepts 2 legal moves without requiring game over', () => {
    const r = walkMoves([
      { action: { placement: { 1: 1 } } },
      { action: { placement: { 5: 1 } } },
    ])
    expect(r.ok).toBe(true)
    expect(r.turns).toBe(2)
    expect(r.gameOver).toBe(false)
  })
  it('rejects illegal move mid-sequence', () => {
    const r = walkMoves([
      { action: { placement: { 1: 1 } } },
      { action: { placement: { 5: 99 } } }, // overflow
    ])
    expect(r.ok).toBe(false)
  })
  it('accepts swap on turn 1', () => {
    const r = walkMoves([
      { action: { placement: { 1: 1 } } },
      { action: { swap: true } },
    ])
    expect(r.ok).toBe(true)
    expect(r.turns).toBe(2)
  })
  it('rejects swap after turn 1', () => {
    const r = walkMoves([
      { action: { placement: { 1: 1 } } },
      { action: { placement: { 5: 1 } } },
      { action: { swap: true } }, // уже нельзя
    ])
    expect(r.ok).toBe(false)
  })
})

describe('actionsEqual edge cases (via walkMoves)', () => {
  it('placement with different key order still matches', () => {
    // turn 2, legal action placement { 1: 2, 3: 1 } — любой порядок ключей
    const r = walkMoves([
      { action: { placement: { 1: 1 } } },
      { action: { placement: { 5: 1 } } },
      { action: { placement: { 3: 1, 1: 2 } } }, // обратный порядок
    ])
    expect(r.ok).toBe(true)
  })
})
