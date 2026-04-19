import { describe, it, expect } from 'vitest'
import {
  pieceColor, pieceEmissive, getDiffLabel,
  easeOutCubic, lerp, towerMatchesFilter, uniqueWinsInTower,
  getSeason,
  SKIN_HEX, SKIN_EMISSIVE,
  TIME_PRESETS, WEATHER_PARAMS,
  TOWER_HEIGHT, MAX_SAVED_VIEWS,
} from './victoryCityHelpers.js'

describe('pieceColor / pieceEmissive', () => {
  it('pieceColor returns classic blue for unknown skin (fallback)', () => {
    expect(pieceColor({ skin_id: 'unknown_skin' })).toBe(SKIN_HEX.blocks_classic[0])
  })
  it('pieceColor returns mapped color for known skin', () => {
    expect(pieceColor({ skin_id: 'blocks_neon' })).toBe(SKIN_HEX.blocks_neon[0])
  })
  it('pieceEmissive returns 0 for skin without emissive', () => {
    expect(pieceEmissive({ skin_id: 'blocks_classic' })).toBe(0)
  })
  it('pieceEmissive returns mapped value for neon/glow/glass', () => {
    expect(pieceEmissive({ skin_id: 'blocks_neon' })).toBe(SKIN_EMISSIVE.blocks_neon)
    expect(pieceEmissive({ skin_id: 'blocks_glow' })).toBe(SKIN_EMISSIVE.blocks_glow)
    expect(pieceEmissive({ skin_id: 'blocks_glass' })).toBe(SKIN_EMISSIVE.blocks_glass)
  })
})

describe('getDiffLabel', () => {
  it('returns null for falsy difficulty', () => {
    expect(getDiffLabel(null)).toBe(null)
    expect(getDiffLabel(0)).toBe(null)
    expect(getDiffLabel(undefined)).toBe(null)
    expect(getDiffLabel('')).toBe(null)
  })
  it('RU labels by difficulty tier', () => {
    expect(getDiffLabel(100, false)).toBe('Лёгкая')
    expect(getDiffLabel(200, false)).toBe('Средняя')
    expect(getDiffLabel(500, false)).toBe('Сложно')
    expect(getDiffLabel(900, false)).toBe('Экстрим')
    expect(getDiffLabel(1500, false)).toBe('Невозможно')
    expect(getDiffLabel(3000, false)).toBe('Невозможно')
  })
  it('EN labels mirror RU', () => {
    expect(getDiffLabel(100, true)).toBe('Easy')
    expect(getDiffLabel(200, true)).toBe('Medium')
    expect(getDiffLabel(500, true)).toBe('Hard')
    expect(getDiffLabel(900, true)).toBe('Extreme')
    expect(getDiffLabel(1500, true)).toBe('Impossible')
  })
  it('accepts numeric string difficulty', () => {
    expect(getDiffLabel('400')).toBe('Сложно')
    expect(getDiffLabel('1500')).toBe('Невозможно')
  })
  it('returns null for non-numeric string', () => {
    expect(getDiffLabel('not-a-number')).toBe(null)
    expect(getDiffLabel('abc123')).toBe(null)  // parseInt → NaN
  })
  it('boundary exactness: 150 = Medium, 149 = Easy, 400 = Hard, 399 = Medium', () => {
    expect(getDiffLabel(149)).toBe('Лёгкая')
    expect(getDiffLabel(150)).toBe('Средняя')
    expect(getDiffLabel(399)).toBe('Средняя')
    expect(getDiffLabel(400)).toBe('Сложно')
    expect(getDiffLabel(799)).toBe('Сложно')
    expect(getDiffLabel(800)).toBe('Экстрим')
  })
})

describe('easeOutCubic / lerp', () => {
  it('easeOutCubic endpoints', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })
  it('easeOutCubic is monotonic between 0 and 1', () => {
    let prev = 0
    for (let i = 1; i <= 10; i++) {
      const t = i / 10
      const v = easeOutCubic(t)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('lerp endpoints and midpoint', () => {
    expect(lerp(0, 100, 0)).toBe(0)
    expect(lerp(0, 100, 1)).toBe(100)
    expect(lerp(0, 100, 0.5)).toBe(50)
    expect(lerp(-10, 10, 0.25)).toBe(-5)
  })
})

describe('towerMatchesFilter', () => {
  const piece = (overrides = {}) => ({
    source_id: 1, opponent: 'bot', date: Date.now() / 1000, is_ai: 1,
    ai_difficulty: 400, golden: 0, ...overrides,
  })
  const tower = (opts = {}) => ({
    is_closed: true, golden_top: false, pieces: [piece()], ...opts,
  })

  it('"all" filter accepts any tower', () => {
    expect(towerMatchesFilter(tower(), 'all')).toBe(true)
    expect(towerMatchesFilter(tower({ is_closed: false }), 'all')).toBe(true)
  })

  it('"golden" requires is_closed && golden_top', () => {
    expect(towerMatchesFilter(tower({ golden_top: true }), 'golden')).toBe(true)
    expect(towerMatchesFilter(tower({ is_closed: false, golden_top: true }), 'golden')).toBe(false)
    expect(towerMatchesFilter(tower(), 'golden')).toBe(false)
  })

  it('"impossible" matches if any piece is AI ≥1500 difficulty', () => {
    expect(towerMatchesFilter(tower({ pieces: [piece({ ai_difficulty: 1500 })] }), 'impossible')).toBe(true)
    expect(towerMatchesFilter(tower({ pieces: [piece({ ai_difficulty: 400 })] }), 'impossible')).toBe(false)
  })

  it('"impossible" handles non-AI pieces gracefully', () => {
    expect(towerMatchesFilter(tower({ pieces: [piece({ is_ai: 0, ai_difficulty: null })] }), 'impossible')).toBe(false)
  })

  it('"week" matches if any piece is within 7 days', () => {
    const now = Date.now() / 1000
    expect(towerMatchesFilter(tower({ pieces: [piece({ date: now - 3 * 86400 })] }), 'week')).toBe(true)
    expect(towerMatchesFilter(tower({ pieces: [piece({ date: now - 10 * 86400 })] }), 'week')).toBe(false)
  })

  it('unknown filter defaults to true (permissive)', () => {
    expect(towerMatchesFilter(tower(), 'unknown_filter')).toBe(true)
  })
})

describe('uniqueWinsInTower', () => {
  it('collapses duplicate source_id pieces, counts bricks', () => {
    const tower = {
      pieces: [
        { source_id: 1, opponent: 'Alice', date: 100, is_ai: 0, ai_difficulty: null, golden: 0 },
        { source_id: 1, opponent: 'Alice', date: 100, is_ai: 0, ai_difficulty: null, golden: 0 },
        { source_id: 1, opponent: 'Alice', date: 100, is_ai: 0, ai_difficulty: null, golden: 0 },
        { source_id: 2, opponent: 'Bob', date: 200, is_ai: 1, ai_difficulty: 400, golden: 1 },
      ],
    }
    const out = uniqueWinsInTower(tower)
    expect(out.length).toBe(2)
    expect(out[0].bricks).toBe(3)
    expect(out[0].opponent).toBe('Alice')
    expect(out[1].bricks).toBe(1)
    expect(out[1].golden).toBe(1)
  })

  it('empty tower returns empty list', () => {
    expect(uniqueWinsInTower({ pieces: [] })).toEqual([])
  })
})

describe('getSeason', () => {
  it('returns one of the 4 seasons', () => {
    const s = getSeason()
    expect(['winter', 'spring', 'summer', 'autumn']).toContain(s)
  })
})

describe('constants sanity check', () => {
  it('TOWER_HEIGHT matches game rule (11 blocks)', () => {
    expect(TOWER_HEIGHT).toBe(11)
  })
  it('MAX_SAVED_VIEWS is a reasonable small number', () => {
    expect(MAX_SAVED_VIEWS).toBeGreaterThanOrEqual(3)
    expect(MAX_SAVED_VIEWS).toBeLessThanOrEqual(20)
  })
  it('TIME_PRESETS has 4 named presets', () => {
    expect(Object.keys(TIME_PRESETS).sort()).toEqual(['day', 'morning', 'night', 'sunset'])
  })
  it('WEATHER_PARAMS.summer is null (no particles)', () => {
    expect(WEATHER_PARAMS.summer).toBe(null)
  })
  it('each non-summer season has color/size/fallSpeed/opacity', () => {
    for (const season of ['winter', 'spring', 'autumn']) {
      const w = WEATHER_PARAMS[season]
      expect(typeof w.color).toBe('number')
      expect(w.size).toBeGreaterThan(0)
      expect(w.fallSpeed).toBeGreaterThan(0)
      expect(w.opacity).toBeGreaterThan(0)
      expect(w.opacity).toBeLessThanOrEqual(1)
    }
  })
})
