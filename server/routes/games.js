import { Router } from 'express'
import { db, checkAchievements } from '../db.js'
import { auth } from '../middleware.js'
import { gameSubmitLimits } from '../middleware.js'
import { addXP, ensureCurrentSeason } from '../helpers.js'

const router = Router()

router.post('/games', auth, (req, res) => {
  const { won, score, difficulty, closedGolden, isComeback, turns, duration, isOnline } = req.body

  if (!score || typeof score !== 'string') return res.status(400).json({ error: 'Некорректный счёт' })
  const scoreParts = score.split(':')
  if (scoreParts.length !== 2) return res.status(400).json({ error: 'Формат счёта: X:Y' })
  const [s1, s2] = scoreParts.map(Number)
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 10 || s2 > 10) {
    return res.status(400).json({ error: 'Счёт вне диапазона 0-10' })
  }
  if (s1 + s2 > 10) return res.status(400).json({ error: 'Сумма счёта > 10' })

  const safeTurns = Math.max(0, Math.min(500, Math.floor(+turns || 0)))
  const safeDuration = Math.max(0, Math.min(7200, Math.floor(+duration || 0)))
  const safeDifficulty = Math.max(0, Math.min(400, Math.floor(+difficulty || 150)))

  const now = Date.now()
  const lastSubmit = gameSubmitLimits.get(req.user.id)
  if (lastSubmit && now - lastSubmit < 10000) {
    return res.status(429).json({ error: 'Слишком быстро. Подождите 10 секунд' })
  }
  gameSubmitLimits.set(req.user.id, now)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })

  const ratingBefore = user.rating
  let ratingDelta = won ? 25 : -15
  if (safeDifficulty >= 400) ratingDelta = won ? 35 : -10
  else if (safeDifficulty <= 50) ratingDelta = won ? 15 : -20

  const ratingAfter = Math.max(100, Math.min(2500, ratingBefore + ratingDelta))
  const newStreak = won ? user.win_streak + 1 : 0
  const bestStreak = Math.max(user.best_streak, newStreak)
  const isFastWin = won && safeTurns > 0 && safeTurns <= 10

  db.prepare(`UPDATE users SET
    rating = ?, games_played = games_played + 1,
    wins = wins + ?, losses = losses + ?,
    win_streak = ?, best_streak = ?,
    golden_closed = golden_closed + ?,
    comebacks = comebacks + ?,
    perfect_wins = perfect_wins + ?,
    beat_hard_ai = CASE WHEN ? THEN 1 ELSE beat_hard_ai END,
    fast_wins = fast_wins + ?,
    online_wins = online_wins + ?
    WHERE id = ?`
  ).run(
    ratingAfter, won ? 1 : 0, won ? 0 : 1,
    newStreak, bestStreak,
    closedGolden ? 1 : 0, isComeback ? 1 : 0,
    score === '6:0' && won ? 1 : 0,
    safeDifficulty >= 400 && won ? 1 : 0,
    isFastWin ? 1 : 0,
    isOnline && won ? 1 : 0,
    req.user.id
  )

  const gameResult = db.prepare(`INSERT INTO games (user_id, won, score, rating_before, rating_after, rating_delta, difficulty, closed_golden, is_comeback, turns, duration, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, won ? 1 : 0, score, ratingBefore, ratingAfter, ratingDelta, safeDifficulty, closedGolden ? 1 : 0, isComeback ? 1 : 0, safeTurns, safeDuration, isOnline ? 1 : 0)

  db.prepare('INSERT INTO rating_history (user_id, rating, delta, game_id) VALUES (?, ?, ?, ?)').run(req.user.id, ratingAfter, ratingDelta, gameResult.lastInsertRowid)

  const currentSeason = ensureCurrentSeason()
  if (currentSeason) {
    const sr = db.prepare('SELECT * FROM season_ratings WHERE user_id=? AND season_id=?').get(req.user.id, currentSeason.id)
    if (sr) {
      const newRating = Math.max(100, Math.min(2500, sr.rating + ratingDelta))
      db.prepare('UPDATE season_ratings SET rating=?, games=games+1, wins=wins+? WHERE id=?').run(newRating, won ? 1 : 0, sr.id)
    } else {
      db.prepare('INSERT INTO season_ratings (user_id, season_id, rating, games, wins) VALUES (?, ?, ?, 1, ?)').run(req.user.id, currentSeason.id, ratingAfter, won ? 1 : 0)
    }
  }

  const newAch = checkAchievements(req.user.id)
  const xpGain = won ? 20 : 5
  addXP(req.user.id, xpGain)

  res.json({ ratingBefore, ratingAfter, ratingDelta, newAchievements: newAch, xpGain })
})

router.get('/games', auth, (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 50)
  const games = db.prepare('SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ?').all(req.user.id, limit)
  res.json(games)
})

// ═══ Seasons / Leaderboard ═══

router.get('/seasons/current', (req, res) => {
  const season = ensureCurrentSeason()
  if (!season) return res.json({ season: null })
  const top = db.prepare(`SELECT sr.rating, sr.games, sr.wins, u.username
    FROM season_ratings sr JOIN users u ON u.id = sr.user_id
    WHERE sr.season_id = ? ORDER BY sr.rating DESC LIMIT 20`).all(season.id)
  res.json({ season, leaderboard: top })
})

router.get('/seasons/history', (req, res) => {
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC LIMIT 12').all()
  res.json(seasons)
})

router.get('/leaderboard', (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 100)
  const users = db.prepare('SELECT id, username, rating, games_played, wins, losses, best_streak, level, xp FROM users ORDER BY rating DESC LIMIT ?').all(limit)
  res.json(users.map(u => ({
    username: u.username, rating: u.rating,
    games: u.games_played, wins: u.wins,
    winRate: u.games_played > 0 ? +(u.wins / u.games_played * 100).toFixed(1) : 0,
    bestStreak: u.best_streak,
  })))
})

export default router
