/**
 * Общие хелперы — formatUser, addXP, ensureCurrentSeason, seededRandom
 */

import { db } from './db.js'

// ═══ Форматирование пользователя для API ═══
export function formatUser(u) {
  return {
    id: u.id, username: u.username, rating: u.rating,
    gamesPlayed: u.games_played, wins: u.wins, losses: u.losses,
    winStreak: u.win_streak, bestStreak: u.best_streak,
    goldenClosed: u.golden_closed, comebacks: u.comebacks,
    perfectWins: u.perfect_wins, beatHardAi: !!u.beat_hard_ai,
    fastWins: u.fast_wins || 0, onlineWins: u.online_wins || 0,
    puzzlesSolved: u.puzzles_solved || 0, avatar: u.avatar || 'default',
    xp: u.xp || 0, level: u.level || 1,
    referralCode: u.referral_code || null,
    isAdmin: !!u.is_admin, createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

/**
 * Публичный профиль — без приватных полей (referralCode, email, isAdmin).
 * Используется для GET /api/profile/:username — любой посетитель может видеть.
 */
export function formatPublicUser(u) {
  return {
    username: u.username, rating: u.rating,
    gamesPlayed: u.games_played, wins: u.wins, losses: u.losses,
    winStreak: u.win_streak, bestStreak: u.best_streak,
    goldenClosed: u.golden_closed, comebacks: u.comebacks,
    perfectWins: u.perfect_wins, beatHardAi: !!u.beat_hard_ai,
    fastWins: u.fast_wins || 0, onlineWins: u.online_wins || 0,
    puzzlesSolved: u.puzzles_solved || 0, avatar: u.avatar || 'default',
    xp: u.xp || 0, level: u.level || 1,
    createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

// ═══ XP и Level Up ═══
export function addXP(userId, amount) {
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId)
  const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
  if (!user) return
  const xpForNext = user.level * 100
  if (user.xp >= xpForNext) {
    db.prepare('UPDATE users SET level = level + 1, xp = xp - ? WHERE id = ?').run(xpForNext, userId)
  }
}

// ═══ Сезоны (месячные, автосоздание) ═══
export function ensureCurrentSeason() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const start = new Date(y, m, 1).toISOString().slice(0, 10)
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  const name = `${y}-${String(m + 1).padStart(2, '0')}`

  let season = db.prepare('SELECT * FROM seasons WHERE name=?').get(name)
  if (!season) {
    db.prepare('UPDATE seasons SET active=0 WHERE active=1').run()
    db.prepare('INSERT INTO seasons (name, start_date, end_date, active) VALUES (?, ?, ?, 1)').run(name, start, end)
    season = db.prepare('SELECT * FROM seasons WHERE name=?').get(name)
  }
  return season
}

// ═══ Seeded Random ═══
export function getDailySeed() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
}

export function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}
