import { describe, it, expect } from 'vitest'
import { checkAchievements } from './db.js'
import { db } from './db.js'

function mkUser(overrides = {}) {
  const uname = `achtest_${Math.random().toString(36).slice(2, 10)}`
  const info = db.prepare(`
    INSERT INTO users (username, password_hash, rating, games_played, wins, losses, win_streak, best_streak, golden_closed, comebacks, perfect_wins, beat_hard_ai, fast_wins, online_wins, puzzles_solved, xp, level, bricks)
    VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uname,
    overrides.rating ?? 1000,
    overrides.games_played ?? 0,
    overrides.wins ?? 0,
    overrides.losses ?? 0,
    overrides.win_streak ?? 0,
    overrides.best_streak ?? 0,
    overrides.golden_closed ?? 0,
    overrides.comebacks ?? 0,
    overrides.perfect_wins ?? 0,
    overrides.beat_hard_ai ?? 0,
    overrides.fast_wins ?? 0,
    overrides.online_wins ?? 0,
    overrides.puzzles_solved ?? 0,
    overrides.xp ?? 0,
    overrides.level ?? 1,
    overrides.bricks ?? 0,
  )
  return info.lastInsertRowid
}

describe('checkAchievements — basic unlocks', () => {
  it('user with 1 win unlocks first_win', () => {
    const id = mkUser({ wins: 1 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('first_win')
  })

  it('user with best_streak 3 unlocks streak_3', () => {
    const id = mkUser({ best_streak: 3 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('streak_3')
  })

  it('user with best_streak 10 unlocks all streak achievements', () => {
    const id = mkUser({ best_streak: 10 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('streak_3')
    expect(newAch).toContain('streak_5')
    expect(newAch).toContain('streak_10')
    expect(newAch).not.toContain('streak_20') // ещё не достиг
  })

  it('user with 500 games_played unlocks all games achievements', () => {
    const id = mkUser({ games_played: 500 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('games_10')
    expect(newAch).toContain('games_50')
    expect(newAch).toContain('games_100')
    expect(newAch).toContain('games_500')
  })

  it('user with rating 2000 unlocks all rating achievements', () => {
    const id = mkUser({ rating: 2000 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('rating_1200')
    expect(newAch).toContain('rating_1500')
    expect(newAch).toContain('rating_1800')
    expect(newAch).toContain('rating_2000')
  })

  it('user with golden_closed 50 unlocks golden_1, golden_10, golden_50', () => {
    const id = mkUser({ golden_closed: 50 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('golden_1')
    expect(newAch).toContain('golden_10')
    expect(newAch).toContain('golden_50')
  })

  it('beat_hard_ai = 1 unlocks beat_hard', () => {
    const id = mkUser({ beat_hard_ai: 1 })
    expect(checkAchievements(id)).toContain('beat_hard')
  })

  it('fast_wins = 5 unlocks fast_win AND fast_win_5', () => {
    const id = mkUser({ fast_wins: 5 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('fast_win')
    expect(newAch).toContain('fast_win_5')
  })

  it('online_wins = 10 unlocks online_win + online_10', () => {
    const id = mkUser({ online_wins: 10 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('online_win')
    expect(newAch).toContain('online_10')
  })

  it('level 20 unlocks all level achievements', () => {
    const id = mkUser({ level: 20 })
    const newAch = checkAchievements(id)
    expect(newAch).toContain('level_5')
    expect(newAch).toContain('level_10')
    expect(newAch).toContain('level_20')
  })
})

describe('checkAchievements — idempotency', () => {
  it('calling twice with same state — second call returns empty array', () => {
    const id = mkUser({ wins: 10, best_streak: 5, games_played: 50 })
    const first = checkAchievements(id)
    expect(first.length).toBeGreaterThan(0)
    const second = checkAchievements(id)
    expect(second).toEqual([])
  })

  it('achievements table gets populated on unlock', () => {
    const id = mkUser({ wins: 1 })
    checkAchievements(id)
    const rows = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(id)
    expect(rows.some(r => r.achievement_id === 'first_win')).toBe(true)
  })
})

describe('checkAchievements — guards', () => {
  it('non-existent user returns empty array', () => {
    expect(checkAchievements(99999999)).toEqual([])
  })

  it('user with zero everything unlocks nothing', () => {
    const id = mkUser()
    expect(checkAchievements(id)).toEqual([])
  })
})

describe('checkAchievements — cross-table (puzzle_rush)', () => {
  it('rush_5 unlocks when user has puzzle_rush_score >= 5', () => {
    const id = mkUser()
    db.prepare('INSERT INTO puzzle_rush_scores (user_id, score) VALUES (?, ?)').run(id, 7)
    const newAch = checkAchievements(id)
    expect(newAch).toContain('rush_5')
    expect(newAch).not.toContain('rush_15') // не достиг
  })

  it('rush_15 unlocks both rush_5 and rush_15', () => {
    const id = mkUser()
    db.prepare('INSERT INTO puzzle_rush_scores (user_id, score) VALUES (?, ?)').run(id, 20)
    const newAch = checkAchievements(id)
    expect(newAch).toContain('rush_5')
    expect(newAch).toContain('rush_15')
  })

  it('arena_join unlocks after participating in any tournament', () => {
    const id = mkUser()
    // Сначала турнир — arena_participants требует tournament_id существующего
    const t = db.prepare("INSERT INTO arena_tournaments (status) VALUES ('waiting')").run()
    const tid = t.lastInsertRowid
    db.prepare('INSERT INTO arena_participants (tournament_id, user_id, username) VALUES (?, ?, ?)').run(tid, id, `u${id}`)
    const newAch = checkAchievements(id)
    expect(newAch).toContain('arena_join')
  })
})
