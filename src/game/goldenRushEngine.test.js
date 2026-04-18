import { describe, it, expect } from 'vitest'
import {
  NUM_STANDS, MAX_CHIPS, STAND_META, CENTER_IDX,
  GoldenRushState, applyAction, getLegalActions, getPlayerStands,
  getPairedStand, getValidTransfers, getValidPlacements, computeScores,
} from './goldenRushEngine.js'

function forceFill(state, standIdx, count, color) {
  state.stands[standIdx] = Array(count).fill(color)
}

describe('GoldenRushState init', () => {
  it('has 9 empty stands by default', () => {
    const s = new GoldenRushState()
    expect(s.stands.length).toBe(NUM_STANDS)
    expect(s.stands.every(st => st.length === 0)).toBe(true)
    expect(s.closed).toEqual({})
    expect(s.currentPlayer).toBe(0)
    expect(s.gameOver).toBe(false)
  })

  it('defaults to FFA mode for 4 players', () => {
    const s = new GoldenRushState()
    expect(s.mode).toBe('ffa')
    expect(s.numPlayers).toBe(4)
    expect(s.teams).toBe(null)
  })

  it('2v2 mode sets default teams [[0,2],[1,3]]', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    expect(s.teams).toEqual([[0, 2], [1, 3]])
  })
})

describe('STAND_META topology', () => {
  it('stand 0 is center', () => {
    expect(STAND_META[0].type).toBe('center')
  })

  it('getPlayerStands returns 2 arm stands per player in order 1→2', () => {
    for (let p = 0; p < 4; p++) {
      const stands = getPlayerStands(p)
      expect(stands.length).toBe(2)
      expect(STAND_META[stands[0]].order).toBe(1)
      expect(STAND_META[stands[1]].order).toBe(2)
    }
  })

  it('getPairedStand returns the other stand of the same slot', () => {
    expect(getPairedStand(1)).toBe(2)
    expect(getPairedStand(2)).toBe(1)
    expect(getPairedStand(3)).toBe(4)
    expect(getPairedStand(0)).toBe(-1)
  })
})

describe('effectiveCap', () => {
  it('order=1 stand has cap = MAX_CHIPS', () => {
    const s = new GoldenRushState()
    expect(s.effectiveCap(1)).toBe(MAX_CHIPS)
  })

  it('order=2 stand has cap = MAX_CHIPS - 1 while pair not closed', () => {
    const s = new GoldenRushState()
    expect(s.effectiveCap(2)).toBe(MAX_CHIPS - 1)
  })

  it('order=2 cap jumps to MAX_CHIPS after pair closes', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0
    expect(s.effectiveCap(2)).toBe(MAX_CHIPS)
  })

  it('center cap = MAX_CHIPS - 1 until someone eligible', () => {
    const s = new GoldenRushState()
    expect(s.effectiveCap(CENTER_IDX)).toBe(MAX_CHIPS - 1)
    s.eligibleForCenter.push(0)
    expect(s.effectiveCap(CENTER_IDX)).toBe(MAX_CHIPS)
  })
})

describe('placements validation', () => {
  it('multi-placement actions are generated', () => {
    const s = new GoldenRushState()
    const pls = getValidPlacements(s)
    expect(pls.length).toBeGreaterThan(10)
    expect(pls.some(p => Object.keys(p).length === 2)).toBe(true)
  })

  it('does not offer placing on a closed stand', () => {
    const s = new GoldenRushState()
    forceFill(s, 1, MAX_CHIPS, 0)
    s.closed[1] = 0
    const pls = getValidPlacements(s)
    expect(pls.every(p => !(1 in p))).toBe(true)
  })
})

describe('applyAction — order=1 closure', () => {
  it('player 0 finishes 11 blocks on stand 1 → closes with color 0', () => {
    let s = new GoldenRushState()
    forceFill(s, 1, 10, 0)
    s = applyAction(s, { placement: { 1: 1 } })
    expect(s.closed[1]).toBe(0)
  })
})

describe('applyAction — order=2 blocked until order=1', () => {
  it('pure-placement on stand 2 at 10 blocks is BLOCKED (would require 11th chip while stand 1 open)', () => {
    // Прямое placement на stand 2 — getValidPlacements должен его отсечь
    // независимо от того, разрешает ли getLegalActions combo transfer+placement
    // (которое сначала уводит блоки со stand 2 — это легитимная ветка игры).
    // Проверяем именно cap-правило стойки.
    const s = new GoldenRushState()
    forceFill(s, 2, 10, 0)
    const pls = getValidPlacements(s)
    // Ни одна placement-опция не должна добавлять блоки на stand 2,
    // потому что standSpace(2) = effectiveCap(2) - 10 = 10 - 10 = 0.
    expect(pls.every(p => !(2 in p))).toBe(true)
  })

  it('once stand 1 closes, paired stand 2 can reach 11 and close', () => {
    let s = new GoldenRushState()
    forceFill(s, 1, MAX_CHIPS, 0); s.closed[1] = 0
    forceFill(s, 2, 10, 0)
    s = applyAction(s, { placement: { 2: 1 } })
    expect(s.closed[2]).toBe(0)
  })
})

describe('eligibleForCenter queue', () => {
  it('player is added when both their stands are closed', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0
    s.closed[2] = 0
    s.currentPlayer = 1
    forceFill(s, 3, 10, 1)
    const s2 = applyAction(s, { placement: { 3: 1 } })
    expect(s2.eligibleForCenter).toContain(0)
  })

  it('FIFO: first eligible player wins the center flag', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0; s.closed[2] = 0
    s.closed[5] = 2; s.closed[6] = 2
    s.eligibleForCenter = [0, 2]
    forceFill(s, CENTER_IDX, 10, 3)
    s.currentPlayer = 3
    const s2 = applyAction(s, { placement: { [CENTER_IDX]: 1 } })
    expect(s2.closed[CENTER_IDX]).toBe(0)
  })
})

describe('transfer mechanics', () => {
  it('transfer options exist when stand has a top group', () => {
    const s = new GoldenRushState()
    forceFill(s, 1, 3, 0)
    const t = getValidTransfers(s)
    expect(t.some(([src]) => src === 1)).toBe(true)
  })

  it('transfer into order=2 pending stand blocked if would exceed cap', () => {
    const s = new GoldenRushState()
    forceFill(s, 3, 5, 1)
    forceFill(s, 4, 7, 1)
    s.currentPlayer = 1
    const t = getValidTransfers(s)
    expect(t.some(([src, dst]) => src === 3 && dst === 4)).toBe(false)
  })
})

describe('computeScores', () => {
  it('+1 per placed block of your color', () => {
    const s = new GoldenRushState()
    forceFill(s, 1, 3, 0)
    forceFill(s, 3, 2, 1)
    const sc = computeScores(s)
    expect(sc[0]).toBe(3)
    expect(sc[1]).toBe(2)
    expect(sc[2]).toBe(0)
  })

  it('+5 order=1, +8 order=2, +15 center', () => {
    const s = new GoldenRushState()
    s.closed[1] = 0
    s.closed[2] = 0
    s.closed[CENTER_IDX] = 0
    const sc = computeScores(s)
    expect(sc[0]).toBe(5 + 8 + 15)
  })

  it('2v2 bonus +5 each when team closes both lines', () => {
    const s = new GoldenRushState({ mode: '2v2' })
    s.closed[1] = 0; s.closed[2] = 0
    s.closed[5] = 2; s.closed[6] = 2
    const sc = computeScores(s)
    expect(sc[0]).toBeGreaterThanOrEqual(5 + 8 + 5)
    expect(sc[2]).toBeGreaterThanOrEqual(5 + 8 + 5)
    expect(sc[1]).toBe(0)
    expect(sc[3]).toBe(0)
  })
})

describe('game over detection', () => {
  it('game ends when all 9 stands are closed', () => {
    const s = new GoldenRushState()
    for (let i = 0; i < NUM_STANDS; i++) s.closed[i] = 0
    s.currentPlayer = 0
    const s2 = applyAction(s, {})
    expect(s2.gameOver).toBe(true)
    expect(s2.winner).toBe(0)
  })
})

describe('turn rotation', () => {
  it('currentPlayer rotates 0→1→2→3→0 in 4-player FFA', () => {
    let s = new GoldenRushState()
    expect(s.currentPlayer).toBe(0)
    s = applyAction(s, { placement: { 1: 1 } })
    expect(s.currentPlayer).toBe(1)
    s = applyAction(s, { placement: { 3: 1 } })
    expect(s.currentPlayer).toBe(2)
    s = applyAction(s, { placement: { 5: 1 } })
    expect(s.currentPlayer).toBe(3)
    s = applyAction(s, { placement: { 7: 1 } })
    expect(s.currentPlayer).toBe(0)
  })
})

describe('getLegalActions', () => {
  it('returns non-empty list at game start', () => {
    const s = new GoldenRushState()
    const legal = getLegalActions(s)
    expect(legal.length).toBeGreaterThan(10)
  })

  it('returns empty list after gameOver', () => {
    const s = new GoldenRushState()
    s.gameOver = true
    expect(getLegalActions(s)).toEqual([])
  })
})
