import { describe, it, expect } from 'vitest'
import {
  GoldenRushState, applyAction, validateAction,
  NUM_STANDS, MAX_CHIPS, CENTER_IDX,
} from './golden-rush-engine.js'

function fillStand(state, idx, count, color) {
  state.stands[idx] = Array(count).fill(color)
}

describe('validateAction — structural checks', () => {
  it('rejects null/undefined action', () => {
    const s = new GoldenRushState()
    expect(validateAction(s, null).ok).toBe(false)
    expect(validateAction(s, undefined).ok).toBe(false)
    expect(validateAction(s, 'not-object').ok).toBe(false)
  })

  it('rejects action in gameOver state', () => {
    const s = new GoldenRushState()
    s.gameOver = true
    const v = validateAction(s, { placement: { 1: 1 } })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('game_over')
  })

  it('rejects empty action (no transfer, no placement)', () => {
    const s = new GoldenRushState()
    expect(validateAction(s, {}).reason).toBe('empty_action')
    expect(validateAction(s, { placement: {} }).reason).toBe('empty_action')
  })
})

describe('validateAction — transfer', () => {
  it('rejects transfer with non-integer indices', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 3, 0)
    expect(validateAction(s, { transfer: ['a', 'b'] }).reason).toBe('transfer_non_int')
    expect(validateAction(s, { transfer: [1.5, 2] }).reason).toBe('transfer_non_int')
  })

  it('rejects transfer out of range', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 3, 0)
    expect(validateAction(s, { transfer: [-1, 2] }).reason).toBe('transfer_out_of_range')
    expect(validateAction(s, { transfer: [1, 99] }).reason).toBe('transfer_out_of_range')
  })

  it('rejects illegal transfer (empty source)', () => {
    const s = new GoldenRushState()
    // все стойки пустые — любой transfer нелегален
    const v = validateAction(s, { transfer: [1, 2] })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('transfer_illegal')
  })

  it('accepts legal transfer', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 3, 0)
    // transfer [1 → 3] только если dst пустой или сверху player 0; stand 3 пустой — ок
    const v = validateAction(s, { transfer: [1, 3] })
    expect(v.ok).toBe(true)
  })
})

describe('validateAction — placement', () => {
  it('rejects placement with too many stands (>2)', () => {
    const s = new GoldenRushState()
    const v = validateAction(s, { placement: { 1: 1, 3: 1, 5: 1 } })
    expect(v.reason).toBe('placement_too_many_stands')
  })

  it('rejects placement with bad indices', () => {
    const s = new GoldenRushState()
    expect(validateAction(s, { placement: { '-1': 1 } }).reason).toBe('placement_bad_idx')
    expect(validateAction(s, { placement: { '99': 1 } }).reason).toBe('placement_bad_idx')
  })

  it('rejects placement with bad count (0, negative, >MAX_PLACE)', () => {
    const s = new GoldenRushState()
    expect(validateAction(s, { placement: { 1: 0 } }).reason).toBe('placement_bad_count')
    expect(validateAction(s, { placement: { 1: -1 } }).reason).toBe('placement_bad_count')
    expect(validateAction(s, { placement: { 1: 4 } }).reason).toBe('placement_bad_count')
  })

  it('rejects placement over total max (>3 across stands)', () => {
    const s = new GoldenRushState()
    const v = validateAction(s, { placement: { 1: 2, 3: 2 } })
    expect(v.reason).toBe('placement_over_max')
  })

  it('rejects placement on closed stand', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0
    fillStand(s, 1, MAX_CHIPS, 0)
    const v = validateAction(s, { placement: { 1: 1 } })
    expect(v.reason).toBe('placement_over_cap')
  })

  it('rejects placement that would exceed cap (order=2 blocked before order=1 closes)', () => {
    const s = new GoldenRushState()
    fillStand(s, 2, 10, 0) // stand 2 at cap=10
    const v = validateAction(s, { placement: { 2: 1 } })
    expect(v.reason).toBe('placement_over_cap')
  })

  it('accepts legal single-stand placement', () => {
    const s = new GoldenRushState()
    expect(validateAction(s, { placement: { 1: 3 } }).ok).toBe(true)
  })

  it('accepts legal two-stand placement summing to MAX_PLACE', () => {
    const s = new GoldenRushState()
    expect(validateAction(s, { placement: { 1: 2, 3: 1 } }).ok).toBe(true)
  })
})

describe('validateAction — combined transfer + placement', () => {
  it('places AFTER transfer, so cap check uses post-transfer state', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 5, 0)
    // transfer [1→3] переносит 5 блоков с 1 на 3. Потом placement на 3 — должен быть валиден
    // (stand 3 станет 5 блоков, можно доложить до 11 если order=1, но order=2 cap=10).
    // 3 это order=1 (slot 1), cap=11. 5+3=8 ≤ 11 → ок.
    const v = validateAction(s, { transfer: [1, 3], placement: { 3: 3 } })
    expect(v.ok).toBe(true)
  })

  it('rejects combo when placement exceeds cap after transfer', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 8, 0)
    fillStand(s, 3, 2, 0)
    // transfer 8 блоков с 1 на 3 → 3 станет 10. Докладываем ещё 3 → overflow >11 для order=1? cap=11.
    // 10 + 3 = 13 > 11 → реальный cap в applyAction срежет до 11. Но validateAction оперирует standSpace=1.
    // placement 3 > space 1 → placement_over_cap.
    const v = validateAction(s, { transfer: [1, 3], placement: { 3: 3 } })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('placement_over_cap')
  })
})

describe('applyAction — turn rotation 0→1→2→3→0', () => {
  it('full cycle with 4 players', () => {
    let s = new GoldenRushState()
    expect(s.currentPlayer).toBe(0)
    s = applyAction(s, { placement: { 1: 1 } }); expect(s.currentPlayer).toBe(1)
    s = applyAction(s, { placement: { 3: 1 } }); expect(s.currentPlayer).toBe(2)
    s = applyAction(s, { placement: { 5: 1 } }); expect(s.currentPlayer).toBe(3)
    s = applyAction(s, { placement: { 7: 1 } }); expect(s.currentPlayer).toBe(0)
  })
})

describe('applyAction — eligibleForCenter FIFO', () => {
  it('first player to close both stands claims the center', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0; s.closed[2] = 0           // p0 замкнул
    s.closed[5] = 2; s.closed[6] = 2           // p2 замкнул
    s.eligibleForCenter = [0, 2]               // p0 первым
    fillStand(s, CENTER_IDX, 10, 3)
    s.currentPlayer = 3
    const next = applyAction(s, { placement: { [CENTER_IDX]: 1 } })
    expect(next.closed[CENTER_IDX]).toBe(0)    // центр → p0
  })
})

describe('game over', () => {
  it('2v2 team with higher total wins', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    // team [[0,2],[1,3]]. p0 берёт всё.
    for (let i = 0; i < NUM_STANDS; i++) s.closed[i] = 0
    s.currentPlayer = 0
    const next = applyAction(s, {})
    expect(next.gameOver).toBe(true)
    expect(next.winner).toBe(0) // team 0 (которая содержит p0)
  })
})
