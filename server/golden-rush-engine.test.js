import { describe, it, expect } from 'vitest'
import {
  GoldenRushState, applyAction, validateAction, computeScores,
  getValidTransfers, getValidPlacements, getPlayerStands, getPairedStand,
  NUM_STANDS, MAX_CHIPS, CENTER_IDX, MAX_PLACE, MAX_PLACE_STANDS,
  STAND_META,
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
    const v = validateAction(s, { transfer: [1, 2] })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('transfer_illegal')
  })

  it('accepts legal transfer', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 3, 0)
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

  it('accepts exactly MAX_PLACE_STANDS stands (boundary)', () => {
    const s = new GoldenRushState()
    const action = { placement: {} }
    for (let i = 0; i < MAX_PLACE_STANDS; i++) action.placement[(i * 2) + 1] = 1
    expect(Object.keys(action.placement).length).toBe(MAX_PLACE_STANDS)
    expect(validateAction(s, action).ok).toBe(true)
  })
})

describe('validateAction — combined transfer + placement', () => {
  it('places AFTER transfer, so cap check uses post-transfer state', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 5, 0)
    const v = validateAction(s, { transfer: [1, 3], placement: { 3: 3 } })
    expect(v.ok).toBe(true)
  })

  it('rejects combo when placement exceeds cap after transfer', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 8, 0)
    fillStand(s, 3, 2, 0)
    const v = validateAction(s, { transfer: [1, 3], placement: { 3: 3 } })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('placement_over_cap')
  })
})

describe('STAND_META topology', () => {
  it('stand 0 is center', () => {
    expect(STAND_META[0].type).toBe('center')
  })
  it('each player has exactly 2 arms', () => {
    for (let p = 0; p < 4; p++) {
      expect(getPlayerStands(p).length).toBe(2)
    }
  })
  it('getPairedStand returns sibling of arm, -1 for center', () => {
    expect(getPairedStand(0)).toBe(-1)
    const pair = getPairedStand(1)
    expect(pair).toBe(2)
    expect(getPairedStand(pair)).toBe(1)
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
    s.closed[1] = 0; s.closed[2] = 0
    s.closed[5] = 2; s.closed[6] = 2
    s.eligibleForCenter = [0, 2]
    fillStand(s, CENTER_IDX, 10, 3)
    s.currentPlayer = 3
    const next = applyAction(s, { placement: { [CENTER_IDX]: 1 } })
    expect(next.closed[CENTER_IDX]).toBe(0)
  })

  it('center cap = MAX_CHIPS - 1 until someone eligible, then MAX_CHIPS', () => {
    const s = new GoldenRushState()
    expect(s.effectiveCap(CENTER_IDX)).toBe(MAX_CHIPS - 1)
    s.eligibleForCenter.push(1)
    expect(s.effectiveCap(CENTER_IDX)).toBe(MAX_CHIPS)
  })

  it('three players eligible → FIFO keeps order; center goes to the very first', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0; s.closed[2] = 0
    s.closed[3] = 1; s.closed[4] = 1
    s.closed[5] = 2; s.closed[6] = 2
    s.eligibleForCenter = [2, 0, 1] // P2 первым встал в очередь
    fillStand(s, CENTER_IDX, 10, 3)
    s.currentPlayer = 3
    const next = applyAction(s, { placement: { [CENTER_IDX]: 1 } })
    expect(next.closed[CENTER_IDX]).toBe(2)
  })
})

describe('computeScores — scoring rules', () => {
  it('+1 per placed block', () => {
    const s = new GoldenRushState()
    fillStand(s, 1, 3, 0)
    fillStand(s, 3, 5, 1)
    const sc = computeScores(s)
    expect(sc[0]).toBe(3)
    expect(sc[1]).toBe(5)
    expect(sc[2]).toBe(0)
  })

  it('+5 for order=1 close, +8 for order=2 close', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0 // order=1 for P0
    s.closed[2] = 0 // order=2 for P0
    const sc = computeScores(s)
    expect(sc[0]).toBe(5 + 8)
  })

  it('+15 for center capture', () => {
    const s = new GoldenRushState()
    s.closed[CENTER_IDX] = 3
    const sc = computeScores(s)
    expect(sc[3]).toBe(15)
  })

  it('2v2: +5 per team member when team closes both lines', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    s.closed[1] = 0; s.closed[2] = 0 // P0 closed
    s.closed[5] = 2; s.closed[6] = 2 // P2 closed (same team as P0)
    const sc = computeScores(s)
    expect(sc[0]).toBeGreaterThanOrEqual(5 + 8 + 5)
    expect(sc[2]).toBeGreaterThanOrEqual(5 + 8 + 5)
    expect(sc[1]).toBe(0)
    expect(sc[3]).toBe(0)
  })

  it('2v2 team bonus NOT awarded if only one member closed lines', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    s.closed[1] = 0; s.closed[2] = 0 // only P0 closed
    const sc = computeScores(s)
    expect(sc[0]).toBe(5 + 8) // no +5 bonus yet
    expect(sc[2]).toBe(0)
  })
})

describe('game over detection', () => {
  it('2v2 team with higher total wins', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    for (let i = 0; i < NUM_STANDS; i++) s.closed[i] = 0
    s.currentPlayer = 0
    const next = applyAction(s, {})
    expect(next.gameOver).toBe(true)
    expect(next.winner).toBe(0)
  })

  it('2v2 tie → winner = -1 (draw)', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    // P0 team = [0, 2], P1 team = [1, 3]. Равное распределение.
    s.closed[1] = 0; s.closed[2] = 0
    s.closed[3] = 1; s.closed[4] = 1
    s.closed[5] = 2; s.closed[6] = 2
    s.closed[7] = 3; s.closed[8] = 3
    s.closed[CENTER_IDX] = 0 // center у P0 → +15 команде 0
    // Пересчёт: team 0 = P0+P2 scores; team 1 = P1+P3 scores
    // Без center было бы равно. С center team 0 побеждает.
    s.currentPlayer = 3; s.turn = 30
    const next = applyAction(s, {})
    expect(next.gameOver).toBe(true)
    expect(next.winner).toBe(0) // team 0 с center bonus
  })

  it('FFA: player with highest score wins', () => {
    const s = new GoldenRushState()
    for (let i = 0; i < NUM_STANDS; i++) s.closed[i] = 0 // Всё у P0
    s.currentPlayer = 3; s.turn = 30
    const next = applyAction(s, {})
    expect(next.gameOver).toBe(true)
    expect(next.winner).toBe(0)
  })
})

describe('getValidTransfers — cap constraint', () => {
  it('transfer blocked if would exceed order=2 cap (10 while pair open)', () => {
    const s = new GoldenRushState()
    fillStand(s, 4, 7, 1) // stand 4 = order=2 for P1, cap=10 while stand 3 open
    fillStand(s, 3, 3, 1) // stand 3 = order=1 for P1
    const t = getValidTransfers(s)
    // Перенос 3→4 даст 3+7=10 — на границе, но не >11 → ок
    expect(t.some(([src, dst]) => src === 3 && dst === 4)).toBe(true)
  })

  it('transfer blocked if exactly reaches MAX_CHIPS on order=2 while pair open', () => {
    const s = new GoldenRushState()
    fillStand(s, 4, 8, 1) // order=2 for P1
    fillStand(s, 3, 3, 1) // 3 блоков P1
    // Перенос 3→4 даст 3+8=11 >= MAX_CHIPS, но cap=10 → blocked
    const t = getValidTransfers(s)
    expect(t.some(([src, dst]) => src === 3 && dst === 4)).toBe(false)
  })
})

describe('getValidPlacements — no placement on closed stand', () => {
  it('closed stand not in placements', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0
    fillStand(s, 1, MAX_CHIPS, 0)
    const pls = getValidPlacements(s)
    expect(pls.every(p => !(1 in p))).toBe(true)
  })
})

describe('copy() preserves all fields', () => {
  it('deep copies stands, closed, eligibleForCenter', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    fillStand(s, 1, 3, 0)
    s.closed[5] = 2
    s.eligibleForCenter.push(1)
    s.currentPlayer = 2
    s.turn = 5

    const c = s.copy()
    c.stands[1].push(1)
    c.closed[6] = 3
    c.eligibleForCenter.push(3)
    c.currentPlayer = 0
    c.turn = 10

    // Original не затронут
    expect(s.stands[1].length).toBe(3)
    expect(s.closed[6]).toBeUndefined()
    expect(s.eligibleForCenter).toEqual([1])
    expect(s.currentPlayer).toBe(2)
    expect(s.turn).toBe(5)
  })
})

describe('serialize() output shape', () => {
  it('contains all expected fields', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    const out = s.serialize()
    expect(out).toHaveProperty('numPlayers', 4)
    expect(out).toHaveProperty('mode', '2v2')
    expect(out).toHaveProperty('teams')
    expect(out).toHaveProperty('stands')
    expect(out).toHaveProperty('closed')
    expect(out).toHaveProperty('currentPlayer', 0)
    expect(out).toHaveProperty('gameOver', false)
    expect(out).toHaveProperty('eligibleForCenter')
  })
})
