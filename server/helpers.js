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
    bricks: u.bricks ?? 0,
    styleTwinCount: u.style_twin_count || 0,
    referralCode: u.referral_code || null,
    isAdmin: !!u.is_admin, createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

/**
 * Публичный профиль — без приватных полей (referralCode, email, isAdmin).
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
    styleTwinCount: u.style_twin_count || 0,
    createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

// ═══ XP и Level Up ═══
// БАГ-ФИКС: раньше if → делал только один level-up за вызов. При +500 XP на level=1
// игрок должен стать level=3+ (100+200 → 2, потом +200 на level=2 → 3, и т.д.),
// но код поднимал только до level=2 и оставлял лишний XP. Теперь в цикле.
export function addXP(userId, amount) {
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId)
  // Safety: max 20 уровней за один вызов — защита от infinite loop если данные битые
  for (let i = 0; i < 20; i++) {
    const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
    if (!user) return
    const xpForNext = user.level * 100
    if (user.xp < xpForNext) return
    db.prepare('UPDATE users SET level = level + 1, xp = xp - ? WHERE id = ?').run(xpForNext, userId)
  }
}

// ═══ Сезоны (месячные, автосоздание) ═══
// SECURITY-ФИКС: используем UTC вместо локальной TZ сервера — раньше на VPS с
// TZ=Europe/Minsk смена сезона происходила в 00:00 местного, а клиенты в других
// часовых поясах видели "старый" сезон. Теперь сезон = календарный месяц UTC.
export function ensureCurrentSeason() {
  const now = new Date()
  const y = now.getUTCFullYear(), m = now.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
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
// SECURITY-ФИКС: UTC-дата — иначе клиент и сервер в разных TZ получают разные
// daily-сиды в полночь UTC (у клиента уже "завтра", у сервера ещё "сегодня").
export function getDailySeed() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`
}

export function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}
