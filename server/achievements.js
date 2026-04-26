/**
 * Определения ачивок и логика разблокировки.
 *
 * Новая ачивка = одна запись в ALL_ACHIEVEMENTS или CROSS_TABLE_ACHIEVEMENTS.
 *
 * checkAchievements использует init pattern (initAchievements(db) вызывается из db.js)
 * чтобы избежать кольцевого импорта db.js ↔ achievements.js. Signature вызова
 * checkAchievements(userId) осталась прежней — все callsite-ы работают без изменений.
 */

let _db = null
export function initAchievements(db) { _db = db }

const ALL_ACHIEVEMENTS = [
  { id: 'first_win',   check: u => u.wins >= 1 },
  { id: 'streak_3',    check: u => u.best_streak >= 3 },
  { id: 'streak_5',    check: u => u.best_streak >= 5 },
  { id: 'streak_10',   check: u => u.best_streak >= 10 },
  { id: 'golden_1',    check: u => u.golden_closed >= 1 },
  { id: 'golden_10',   check: u => u.golden_closed >= 10 },
  { id: 'comeback',    check: u => u.comebacks >= 1 },
  { id: 'games_10',    check: u => u.games_played >= 10 },
  { id: 'games_50',    check: u => u.games_played >= 50 },
  { id: 'games_100',   check: u => u.games_played >= 100 },
  { id: 'rating_1200', check: u => u.rating >= 1200 },
  { id: 'rating_1500', check: u => u.rating >= 1500 },
  { id: 'beat_hard',   check: u => u.beat_hard_ai },
  { id: 'perfect',     check: u => u.perfect_wins >= 1 },
  { id: 'streak_20',   check: u => u.best_streak >= 20 },
  { id: 'games_500',   check: u => u.games_played >= 500 },
  { id: 'golden_50',   check: u => u.golden_closed >= 50 },
  { id: 'comeback_5',  check: u => u.comebacks >= 5 },
  { id: 'perfect_3',   check: u => u.perfect_wins >= 3 },
  { id: 'rating_1800', check: u => u.rating >= 1800 },
  { id: 'rating_2000', check: u => u.rating >= 2000 },
  { id: 'fast_win',    check: u => (u.fast_wins || 0) >= 1 },
  { id: 'fast_win_5',  check: u => (u.fast_wins || 0) >= 5 },
  { id: 'online_win',  check: u => (u.online_wins || 0) >= 1 },
  { id: 'online_10',   check: u => (u.online_wins || 0) >= 10 },
  { id: 'puzzle_10',   check: u => (u.puzzles_solved || 0) >= 10 },
  { id: 'level_5',     check: u => (u.level || 1) >= 5 },
  { id: 'level_10',    check: u => (u.level || 1) >= 10 },
  { id: 'level_20',    check: u => (u.level || 1) >= 20 },
  // Style Twin — игрок получил матч в онлайне с одинаковыми блоками
  // (см. server/ws.js detectSkinCollision + awardStyleTwin). Колонка
  // style_twin_count добавлена миграцией 15.
  { id: 'style_twin',  check: u => (u.style_twin_count || 0) >= 1 },
]

const CROSS_TABLE_ACHIEVEMENTS = [
  { id: 'rush_5',  check: userId => { const r = _db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(userId); return (r?.best || 0) >= 5 } },
  { id: 'rush_15', check: userId => { const r = _db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(userId); return (r?.best || 0) >= 15 } },
  { id: 'arena_join', check: userId => { const r = _db.prepare('SELECT COUNT(*) as c FROM arena_participants WHERE user_id=?').get(userId); return (r?.c || 0) >= 1 } },
  { id: 'arena_top3', check: userId => {
    try {
      const ts = _db.prepare('SELECT DISTINCT tournament_id FROM arena_participants WHERE user_id=?').all(userId)
      for (const t of ts) {
        const top = _db.prepare('SELECT user_id FROM arena_participants WHERE tournament_id=? ORDER BY score DESC LIMIT 3').all(t.tournament_id)
        if (top.some(p => p.user_id === userId)) return true
      }
    } catch {}
    return false
  } },
]

export function checkAchievements(userId) {
  if (!_db) throw new Error('achievements not initialized')
  const user = _db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return []
  const existing = _db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(userId).map(a => a.achievement_id)
  const newAch = []
  const insert = _db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)')
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!existing.includes(ach.id) && ach.check(user)) { insert.run(userId, ach.id); newAch.push(ach.id) }
  }
  for (const ach of CROSS_TABLE_ACHIEVEMENTS) {
    if (!existing.includes(ach.id) && ach.check(userId)) { insert.run(userId, ach.id); newAch.push(ach.id) }
  }
  return newAch
}
