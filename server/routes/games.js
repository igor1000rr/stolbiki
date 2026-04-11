import { Router } from 'express'
import { db, checkAchievements } from '../db.js'
import { auth, rateLimit } from '../middleware.js'
import { gameSubmitLimits } from '../middleware.js'
import { addXP, ensureCurrentSeason } from '../helpers.js'
import { verifyGameFromMoves, walkMoves } from '../anticheat.js'
import { awardBricks } from './bricks.js'
import { updateBPProgress } from './battlepass.js'

const router = Router()

router.post('/games', auth, (req, res) => {
  const { won, score, difficulty, closedGolden, isComeback, turns, duration, isOnline, moves } = req.body

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
  const safeDifficulty = Math.max(0, Math.min(1500, Math.floor(+difficulty || 150)))

  let verifiedWon = !!won
  let verifiedScore = score
  let verifiedTurns = safeTurns
  if (moves && Array.isArray(moves) && moves.length >= 5) {
    const v = verifyGameFromMoves(moves)
    if (!v.ok) return res.status(400).json({ error: 'Нелегальная последовательность ходов' })
    verifiedWon = v.winner === 0
    verifiedScore = v.scoreStr
    verifiedTurns = v.turns
    if (verifiedWon !== !!won) return res.status(400).json({ error: 'Результат не совпадает с ходами' })
  } else {
    if (!isOnline) return res.status(400).json({ error: 'Требуется история ходов для AI-игры' })
  }

  const now = Date.now()
  const lastSubmit = gameSubmitLimits.get(req.user.id)
  if (lastSubmit && now - lastSubmit < 10000) {
    return res.status(429).json({ error: 'Слишком быстро. Подождите 10 секунд' })
  }
  gameSubmitLimits.set(req.user.id, now)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })

  const ratingBefore = user.rating
  let ratingDelta = verifiedWon ? 25 : -15
  if (safeDifficulty >= 400) ratingDelta = verifiedWon ? 35 : -10
  else if (safeDifficulty <= 50) ratingDelta = verifiedWon ? 15 : -20

  const ratingAfter = Math.max(100, Math.min(2500, ratingBefore + ratingDelta))
  const newStreak = verifiedWon ? user.win_streak + 1 : 0
  const bestStreak = Math.max(user.best_streak, newStreak)
  const isFastWin = verifiedWon && verifiedTurns > 0 && verifiedTurns <= 10

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
    ratingAfter, verifiedWon ? 1 : 0, verifiedWon ? 0 : 1,
    newStreak, bestStreak,
    closedGolden ? 1 : 0, isComeback ? 1 : 0,
    verifiedScore === '6:0' && verifiedWon ? 1 : 0,
    safeDifficulty >= 400 && verifiedWon ? 1 : 0,
    isFastWin ? 1 : 0,
    isOnline && verifiedWon ? 1 : 0,
    req.user.id
  )

  const gameResult = db.prepare(`INSERT INTO games (user_id, won, score, rating_before, rating_after, rating_delta, difficulty, closed_golden, is_comeback, turns, duration, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, verifiedWon ? 1 : 0, verifiedScore, ratingBefore, ratingAfter, ratingDelta, safeDifficulty, closedGolden ? 1 : 0, isComeback ? 1 : 0, verifiedTurns, safeDuration, isOnline ? 1 : 0)

  db.prepare('INSERT INTO rating_history (user_id, rating, delta, game_id) VALUES (?, ?, ?, ?)').run(req.user.id, ratingAfter, ratingDelta, gameResult.lastInsertRowid)

  if (moves && Array.isArray(moves) && moves.length >= 5) {
    try {
      const gameData = JSON.stringify(moves)
      if (gameData.length < 500000) {
        db.prepare('INSERT INTO training_data (user_id, game_data, winner, total_moves, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.user.id, gameData, verifiedWon ? 0 : 1, moves.length, isOnline ? 'online' : 'ai', safeDifficulty)
      }
    } catch {}
  }

  // ─── Кирпичи за победу ───
  let bricksDelta = 0
  let bricksAfter = null
  if (verifiedWon) {
    bricksDelta = isOnline ? 5 : safeDifficulty >= 400 ? 3 : safeDifficulty >= 150 ? 2 : 1
    bricksAfter = awardBricks(req.user.id, bricksDelta, `win:${isOnline ? 'pvp' : `ai_${safeDifficulty}`}`, gameResult.lastInsertRowid)
  }

  // ─── Battle Pass прогресс ───
  // always: play_n (каждая партия)
  updateBPProgress(req.user.id, 'play', {})
  if (verifiedWon) {
    if (isOnline) {
      updateBPProgress(req.user.id, 'win_online', {})
    } else if (safeDifficulty >= 400) {
      updateBPProgress(req.user.id, 'win_ai_hard', {})
    } else {
      updateBPProgress(req.user.id, 'win', {})
    }
  }
  if (closedGolden) {
    updateBPProgress(req.user.id, 'close_golden', {})
  }

  const currentSeason = ensureCurrentSeason()
  if (currentSeason) {
    const sr = db.prepare('SELECT * FROM season_ratings WHERE user_id=? AND season_id=?').get(req.user.id, currentSeason.id)
    if (sr) {
      const newRating = Math.max(100, Math.min(2500, sr.rating + ratingDelta))
      db.prepare('UPDATE season_ratings SET rating=?, games=games+1, wins=wins+? WHERE id=?').run(newRating, verifiedWon ? 1 : 0, sr.id)
    } else {
      db.prepare('INSERT INTO season_ratings (user_id, season_id, rating, games, wins) VALUES (?, ?, ?, 1, ?)').run(req.user.id, currentSeason.id, ratingAfter, verifiedWon ? 1 : 0)
    }
  }

  const newAch = checkAchievements(req.user.id)
  const xpGain = verifiedWon ? 20 : 5
  addXP(req.user.id, xpGain)

  res.json({ ratingBefore, ratingAfter, ratingDelta, newAchievements: newAch, xpGain, bricksDelta, bricksAfter })
})

router.get('/games', auth, (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 50)
  const offset = Math.max(0, +req.query.offset || 0)
  const games = db.prepare('SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ? OFFSET ?').all(req.user.id, limit, offset)
  const total = db.prepare('SELECT COUNT(*) as c FROM games WHERE user_id = ?').get(req.user.id).c
  res.json({ games, total, limit, offset })
})

router.get('/games/stats', auth, (req, res) => {
  const stats = db.prepare(`
    SELECT difficulty,
      COUNT(*) as games,
      SUM(CASE WHEN won=1 THEN 1 ELSE 0 END) as wins,
      ROUND(AVG(turns), 1) as avgTurns,
      ROUND(AVG(duration), 0) as avgDuration
    FROM games WHERE user_id=? AND mode='ai'
    GROUP BY difficulty ORDER BY difficulty
  `).all(req.user.id)
  res.set('Cache-Control', 'private, max-age=10')
  res.json(stats)
})

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

router.get('/seasons/rewards', auth, (req, res) => {
  const pastSeasons = db.prepare("SELECT * FROM seasons WHERE active=0 AND end_date < date('now')").all()
  for (const season of pastSeasons) {
    const already = db.prepare('SELECT COUNT(*) as c FROM season_rewards WHERE season_id=?').get(season.id)
    if (already.c > 0) continue
    const top = db.prepare('SELECT user_id, rating FROM season_ratings WHERE season_id=? AND games >= 5 ORDER BY rating DESC LIMIT 10').all(season.id)
    const rewardMap = { 1: 'season_champion', 2: 'season_silver', 3: 'season_bronze' }
    const insert = db.prepare('INSERT OR IGNORE INTO season_rewards (user_id, season_id, placement, reward_type, reward_id) VALUES (?, ?, ?, ?, ?)')
    top.forEach((p, i) => { insert.run(p.user_id, season.id, i + 1, 'achievement', rewardMap[i + 1] || 'season_top10') })
  }
  const myRewards = db.prepare(`
    SELECT sr.placement, sr.reward_type, sr.reward_id, sr.claimed, s.name as season_name
    FROM season_rewards sr JOIN seasons s ON s.id = sr.season_id
    WHERE sr.user_id = ? ORDER BY s.start_date DESC
  `).all(req.user.id)
  res.json(myRewards)
})

router.get('/leaderboard', (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 100)
  const users = db.prepare('SELECT id, username, rating, games_played, wins, losses, best_streak, level, xp FROM users ORDER BY rating DESC LIMIT ?').all(limit)
  res.set('Cache-Control', 'public, max-age=15')
  res.json(users.map(u => ({ username: u.username, rating: u.rating, games: u.games_played, wins: u.wins, winRate: u.games_played > 0 ? +(u.wins / u.games_played * 100).toFixed(1) : 0, bestStreak: u.best_streak })))
})

router.post('/replays', auth, (req, res) => {
  const { moves, result, score, mode, turns } = req.body
  if (!moves || !Array.isArray(moves)) return res.status(400).json({ error: 'moves обязателен' })
  if (moves.length > 500) return res.status(400).json({ error: 'Слишком длинный реплей (макс 500 ходов)' })
  if (moves.some(m => !m || typeof m !== 'object')) return res.status(400).json({ error: 'Некорректный формат хода' })
  const v = walkMoves(moves)
  if (!v.ok) return res.status(400).json({ error: 'Нелегальная последовательность ходов в реплее' })
  const movesJson = JSON.stringify(moves)
  if (movesJson.length > 512000) return res.status(400).json({ error: 'Реплей слишком большой (макс 500KB)' })
  const count = db.prepare('SELECT COUNT(*) as c FROM replays WHERE user_id=?').get(req.user.id).c
  if (count >= 50) db.prepare('DELETE FROM replays WHERE id = (SELECT id FROM replays WHERE user_id=? ORDER BY created_at ASC LIMIT 1)').run(req.user.id)
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  try {
    db.prepare('INSERT INTO replays (id, user_id, moves, result, score, mode, turns) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, req.user.id, movesJson, result ?? null, score || null, mode || 'ai', turns || 0)
    res.json({ id, url: `/replay/${id}` })
  } catch { res.status(500).json({ error: 'Ошибка сохранения' }) }
})

router.get('/replays/:id', (req, res) => {
  const replay = db.prepare('SELECT r.*, u.username FROM replays r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?').get(req.params.id)
  if (!replay) return res.status(404).json({ error: 'Replay не найден' })
  res.json({ ...replay, moves: JSON.parse(replay.moves) })
})

router.post('/training', auth, rateLimit(3600000, 10), (req, res) => {
  const { moves, winner, mode, difficulty } = req.body
  if (!moves || !Array.isArray(moves) || moves.length < 5) return res.status(400).json({ error: 'Минимум 5 ходов' })
  if (moves.length > 500) return res.status(400).json({ error: 'Слишком длинная партия' })
  const v = walkMoves(moves)
  if (!v.ok) return res.status(400).json({ error: 'Нелегальная последовательность ходов' })
  const gameData = JSON.stringify(moves)
  if (gameData.length > 500000) return res.status(400).json({ error: 'Слишком большая партия' })
  try {
    db.prepare('INSERT INTO training_data (user_id, game_data, winner, total_moves, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, gameData, winner ?? -1, moves.length, mode || 'ai', difficulty || 0)
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'Ошибка записи' }) }
})

export default router
