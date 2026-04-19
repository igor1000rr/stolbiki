import { describe, it, expect } from 'vitest'
import { computeMyReward } from './goldenRushReward.js'

const REWARDS = { participation: 2, win: 10, centerCapture: 3 }

describe('computeMyReward — guard clauses', () => {
  it('returns null when rewards missing', () => {
    expect(computeMyReward({ state: {}, winner: 0, yourSlot: 0 })).toBe(null)
  })
  it('returns null when yourSlot is null/undefined', () => {
    expect(computeMyReward({ state: {}, winner: 0, rewards: REWARDS, yourSlot: null })).toBe(null)
    expect(computeMyReward({ state: {}, winner: 0, rewards: REWARDS, yourSlot: undefined })).toBe(null)
  })
  it('yourSlot=0 (falsy) still works (not treated as null)', () => {
    const r = computeMyReward({ state: { mode: 'ffa' }, winner: 1, rewards: REWARDS, yourSlot: 0 })
    expect(r).not.toBe(null)
    expect(r.total).toBe(2) // participation only
  })
})

describe('computeMyReward — FFA winner detection', () => {
  it('FFA: I won, not center owner → participation + win = 12', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: { 0: 2 } },
      winner: 0, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(12)
    expect(r.parts).toEqual([
      { key: 'participation', amount: 2 },
      { key: 'win', amount: 10 },
    ])
  })

  it('FFA: I won AND got center → participation + win + center = 15', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: { 0: 0 } },
      winner: 0, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(15)
    expect(r.parts.map(p => p.key)).toEqual(['participation', 'win', 'center'])
  })

  it('FFA: I lost but captured center → participation + center = 5', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: { 0: 0 } },
      winner: 2, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(5)
  })

  it('FFA: I lost, no center → participation only = 2', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: { 0: 2 } },
      winner: 2, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(2)
    expect(r.parts).toEqual([{ key: 'participation', amount: 2 }])
  })

  it('FFA: draw (winner=-1) → participation only', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: { 0: 3 } },
      winner: -1, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(2)
  })
})

describe('computeMyReward — 2v2 team winner', () => {
  const teams = [[0, 2], [1, 3]]

  it('2v2: my team (0+2) won → participation + win = 12', () => {
    const r = computeMyReward({
      state: { mode: '2v2', teams, closed: {} },
      winner: 0, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(12)
  })

  it('2v2: my teammate (slot 2, same team) won → I also get win bonus', () => {
    const r = computeMyReward({
      state: { mode: '2v2', teams, closed: {} },
      winner: 0, yourSlot: 2, rewards: REWARDS,
    })
    expect(r.total).toBe(12)
  })

  it('2v2: other team won → participation only', () => {
    const r = computeMyReward({
      state: { mode: '2v2', teams, closed: {} },
      winner: 1, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(2)
  })

  it('2v2: draw (winner=-1) → participation only, no win bonus even for team', () => {
    const r = computeMyReward({
      state: { mode: '2v2', teams, closed: {} },
      winner: -1, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(2)
  })

  it('2v2: I captured center (closed[0]=my slot) → +center even if team lost', () => {
    const r = computeMyReward({
      state: { mode: '2v2', teams, closed: { 0: 0 } },
      winner: 1, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(5) // participation + center
  })
})

describe('computeMyReward — resign behaviour', () => {
  it('I resigned → zero reward, parts empty, resigned=true', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: {} },
      winner: 1, resignedBy: 0, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(0)
    expect(r.parts).toEqual([])
    expect(r.resigned).toBe(true)
  })

  it('Someone else resigned → I still get participation + possibly win', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: {} },
      winner: 0, resignedBy: 1, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.resigned).toBe(false)
    expect(r.total).toBe(12)
  })

  it('I resigned but also hold center in closed → no center bonus (rule: resigned = 0)', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: { 0: 0 } },
      winner: 1, resignedBy: 0, yourSlot: 0, rewards: REWARDS,
    })
    expect(r.total).toBe(0)
  })
})

describe('computeMyReward — partial rewards object', () => {
  it('missing participation defaults to 0', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: {} },
      winner: 0, yourSlot: 0, rewards: { win: 10, centerCapture: 3 },
    })
    expect(r.total).toBe(10)
    expect(r.parts.some(p => p.key === 'participation')).toBe(false)
  })

  it('all fields zero → total 0 but parts include participation (key present, amount 0)', () => {
    const r = computeMyReward({
      state: { mode: 'ffa', closed: {} },
      winner: 1, yourSlot: 0,
      rewards: { participation: 0, win: 0, centerCapture: 0 },
    })
    expect(r.total).toBe(0)
    expect(r.parts).toEqual([{ key: 'participation', amount: 0 }])
  })
})
