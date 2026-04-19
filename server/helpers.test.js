/**
 * Тесты helpers.js — formatUser, formatPublicUser, seededRandom, addXP, ensureCurrentSeason.
 * DB: in-memory sqlite (включается автоматически когда process.env.VITEST стоит).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { formatUser, formatPublicUser, seededRandom, getDailySeed, addXP, ensureCurrentSeason } from './helpers.js'
import { db } from './db.js'

const BASE_USER = {
  id: 1, username: 'igor', email: 'i@t.ru',
  rating: 1234, games_played: 10, wins: 6, losses: 4,
  win_streak: 2, best_streak: 5, golden_closed: 1,
  comebacks: 0, perfect_wins: 1, beat_hard_ai: 1,
  fast_wins: 2, online_wins: 3, puzzles_solved: 7,
  avatar: 'ninja', xp: 50, level: 2, bricks: 100,
  referral_code: 'ABC123', is_admin: 1,
  created_at: '2026-01-01 00:00:00', last_seen: '2026-04-01 12:00:00',
}

describe('formatUser', () => {
  it('maps snake_case DB row → camelCase API', () => {
    const out = formatUser(BASE_USER)
    expect(out.id).toBe(1)
    expect(out.gamesPlayed).toBe(10)
    expect(out.winStreak).toBe(2)
    expect(out.bestStreak).toBe(5)
    expect(out.goldenClosed).toBe(1)
    expect(out.perfectWins).toBe(1)
    expect(out.puzzlesSolved).toBe(7)
    expect(out.referralCode).toBe('ABC123')
    expect(out.isAdmin).toBe(true)
    expect(out.beatHardAi).toBe(true)
  })

  it('handles missing optional fields with sensible defaults', () => {
    const minimal = { id: 2, username: 'x', rating: 1000 }
    const out = formatUser(minimal)
    expect(out.fastWins).toBe(0)
    expect(out.onlineWins).toBe(0)
    expect(out.puzzlesSolved).toBe(0)
    expect(out.avatar).toBe('default')
    expect(out.xp).toBe(0)
    expect(out.level).toBe(1)
    expect(out.bricks).toBe(0)
    expect(out.referralCode).toBe(null)
    expect(out.isAdmin).toBe(false)
    expect(out.beatHardAi).toBe(false)
  })

  it('bricks=null → 0 (via ??)', () => {
    const out = formatUser({ ...BASE_USER, bricks: null })
    expect(out.bricks).toBe(0)
  })

  it('bricks=0 stays 0 (not defaulted to null-fallback)', () => {
    const out = formatUser({ ...BASE_USER, bricks: 0 })
    expect(out.bricks).toBe(0)
  })
})

describe('formatPublicUser', () => {
  it('does NOT expose email, referralCode, isAdmin', () => {
    const out = formatPublicUser(BASE_USER)
    expect(out.email).toBeUndefined()
    expect(out.referralCode).toBeUndefined()
    expect(out.isAdmin).toBeUndefined()
  })

  it('does NOT expose bricks (private economy)', () => {
    const out = formatPublicUser(BASE_USER)
    expect(out.bricks).toBeUndefined()
  })

  it('DOES expose username, rating, stats', () => {
    const out = formatPublicUser(BASE_USER)
    expect(out.username).toBe('igor')
    expect(out.rating).toBe(1234)
    expect(out.gamesPlayed).toBe(10)
    expect(out.wins).toBe(6)
    expect(out.goldenClosed).toBe(1)
  })
})

describe('seededRandom', () => {
  it('same seed → same sequence (reproducibility)', () => {
    const a = seededRandom('abc')
    const b = seededRandom('abc')
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('different seeds → different sequences', () => {
    const a = seededRandom('abc')
    const b = seededRandom('xyz')
    expect(a()).not.toBe(b())
  })

  it('output is in [0, 1)', () => {
    const rng = seededRandom('test')
    for (let i = 0; i < 50; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('getDailySeed', () => {
  it('returns string with current UTC date', () => {
    const seed = getDailySeed()
    expect(typeof seed).toBe('string')
    const d = new Date()
    // Формат "YYYY-M-D" (без ведущих нулей)
    expect(seed).toContain(String(d.getUTCFullYear()))
  })

  it('is stable during a single day call (reproducibility)', () => {
    const a = getDailySeed()
    const b = getDailySeed()
    expect(a).toBe(b)
  })
})

describe('addXP — level-up logic', () => {
  let userId

  beforeEach(() => {
    // Уникальные usernames на каждый тест чтобы не конфликтовать
    const uname = `xptest_${Math.random().toString(36).slice(2, 10)}`
    const info = db.prepare(`
      INSERT INTO users (username, password_hash, xp, level)
      VALUES (?, '', 0, 1)
    `).run(uname)
    userId = info.lastInsertRowid
  })

  it('single level up: +100 XP on level 1 → level 2, xp 0', () => {
    addXP(userId, 100)
    const u = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
    expect(u.level).toBe(2)
    expect(u.xp).toBe(0)
  })

  it('multi-level up (regression): +500 XP on level 1 → reaches level 4+', () => {
    // level 1 → 2 (100 XP), level 2 → 3 (200 XP), level 3 → 4 (300 XP)
    // После +500: level 1 (0) → level 2 (400 остаток 100) → wait
    // XP+500 затем level-up:
    //   xp=500, level=1: 500 >= 100 → level=2, xp=400
    //   xp=400, level=2: 400 >= 200 → level=3, xp=200
    //   xp=200, level=3: 200 < 300 → stop.
    addXP(userId, 500)
    const u = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
    expect(u.level).toBe(3)
    expect(u.xp).toBe(200)
  })

  it('does not level up when XP below threshold', () => {
    addXP(userId, 50)
    const u = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
    expect(u.level).toBe(1)
    expect(u.xp).toBe(50)
  })

  it('safety loop bound: huge XP injection doesn\'t hang', () => {
    addXP(userId, 1000000) // очень много, но цикл ограничен 20 итерациями
    const u = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
    expect(u.level).toBeLessThanOrEqual(21) // защита от infinite loop
    expect(u.level).toBeGreaterThan(1)
  })

  it('non-existent user: no throw', () => {
    expect(() => addXP(999999, 100)).not.toThrow()
  })
})

describe('ensureCurrentSeason', () => {
  it('creates or returns a season for current UTC month', () => {
    const s = ensureCurrentSeason()
    expect(s).toBeDefined()
    expect(s.name).toMatch(/^\d{4}-\d{2}$/)
    expect(s.active).toBe(1)
  })

  it('calling twice returns same season', () => {
    const s1 = ensureCurrentSeason()
    const s2 = ensureCurrentSeason()
    expect(s1.id).toBe(s2.id)
    expect(s1.name).toBe(s2.name)
  })

  it('season name matches current UTC YYYY-MM', () => {
    const s = ensureCurrentSeason()
    const now = new Date()
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    expect(s.name).toBe(expected)
  })
})
