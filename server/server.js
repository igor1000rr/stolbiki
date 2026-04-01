/**
 * Snatch Highrise — серверный API
 * Роуты, middleware, старт
 */

import express from 'express'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import helmet from 'helmet'
import { db, JWT_SECRET, bcrypt, checkAchievements, PORT } from './db.js'
import { setupWebSocket } from './ws.js'


const app = express()
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://snatch-highrise.com', 'https://www.snatch-highrise.com', 'http://178.212.12.71', 'http://localhost:5173', 'capacitor://localhost', 'http://localhost']
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://mc.yandex.ru'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://mc.yandex.ru'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://mc.yandex.ru'],
    },
  },
}))
app.use(cors({ origin: (origin, cb) => {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true)
  else cb(null, true) // Пока разрешаем всё, но логируем
}}))
app.use(express.json({ limit: '5mb' }))

// Rate limiting (in-memory, простой)
const rateLimits = new Map()
function rateLimit(windowMs = 60000, max = 60) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path
    const now = Date.now()
    const entry = rateLimits.get(key)
    if (!entry || now - entry.start > windowMs) {
      rateLimits.set(key, { start: now, count: 1 })
      return next()
    }
    entry.count++
    if (entry.count > max) return res.status(429).json({ error: 'Слишком много запросов' })
    next()
  }
}
// Антиспам-лимит записи партий
const gameSubmitLimits = new Map()
// Чистка каждые 5 минут + лимит размера Map
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimits) { if (now - v.start > 120000) rateLimits.delete(k) }
  // Чистка антиспам-лимитов записи партий
  for (const [k, v] of gameSubmitLimits) { if (now - v > 60000) gameSubmitLimits.delete(k) }
  // Если Map разросся — полная очистка (защита от DDoS)
  if (rateLimits.size > 50000) rateLimits.clear()
}, 300000)

app.use('/api/auth', rateLimit(60000, 20))  // 20 auth/мин
app.use('/api/games', rateLimit(60000, 60)) // 60 games/мин
app.use('/api/', rateLimit(60000, 120))     // 120 req/мин общий

// JWT auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // Обновляем last_seen
    db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`).run(req.user.id)
    next()
  } catch (authErr) {
    console.error('AUTH ERROR:', authErr.message)
    res.status(401).json({ error: 'Неверный токен' })
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Нужен админ-доступ' })
  next()
}

// ═══ AUTH ═══
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const cleanName = String(username).trim().replace(/[<>&"']/g, '')
  if (cleanName.length < 2 || cleanName.length > 20) return res.status(400).json({ error: 'Username: 2-20 chars' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Password: min 6 chars' })

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanName)
  if (existing) return res.status(409).json({ error: 'Username taken' })

  const hash = bcrypt.hashSync(password, 10)
  const adminNames = ['admin']
  const isAdmin = adminNames.includes(cleanName) ? 1 : 0

  const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(cleanName, email || null, hash, isAdmin)
  const token = jwt.sign({ id: result.lastInsertRowid, username: cleanName, isAdmin: !!isAdmin }, JWT_SECRET, { expiresIn: '30d' })

  res.json({ token, user: { id: result.lastInsertRowid, username: cleanName, rating: 1000, isAdmin: !!isAdmin } })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: formatUser(user) })
})

// ═══ PROFILE ═══
app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?').all(req.user.id)
  // Puzzle Rush best
  const rushBest = db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(req.user.id)
  // Arena stats
  const arenaStats = db.prepare('SELECT COUNT(*) as tournaments, SUM(wins) as wins, SUM(losses) as losses FROM arena_participants WHERE user_id=?').get(req.user.id)
  let arenaTop3Count = 0
  try {
    const tournaments = db.prepare('SELECT DISTINCT tournament_id FROM arena_participants WHERE user_id=?').all(req.user.id)
    for (const t of tournaments) {
      const top = db.prepare('SELECT user_id FROM arena_participants WHERE tournament_id=? ORDER BY score DESC LIMIT 3').all(t.tournament_id)
      if (top.some(p => p.user_id === req.user.id)) arenaTop3Count++
    }
  } catch {}
  res.json({
    ...formatUser(user), achievements,
    rushBest: rushBest?.best || 0,
    arenaStats: { tournaments: arenaStats?.tournaments || 0, wins: arenaStats?.wins || 0, losses: arenaStats?.losses || 0, top3: arenaTop3Count },
  })
})

app.get('/api/profile/:username', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(user.id)
  res.json({ ...formatUser(user), achievements: achievements.map(a => a.achievement_id) })
})

function formatUser(u) {
  return {
    id: u.id, username: u.username, rating: u.rating,
    gamesPlayed: u.games_played, wins: u.wins, losses: u.losses,
    winStreak: u.win_streak, bestStreak: u.best_streak,
    goldenClosed: u.golden_closed, comebacks: u.comebacks,
    perfectWins: u.perfect_wins, beatHardAi: !!u.beat_hard_ai,
    fastWins: u.fast_wins || 0, onlineWins: u.online_wins || 0,
    puzzlesSolved: u.puzzles_solved || 0, avatar: u.avatar || 'default',
    xp: u.xp || 0, level: u.level || 1,
    isAdmin: !!u.is_admin, createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

// ═══ GAMES ═══

app.post('/api/games', auth, (req, res) => {
  const { won, score, difficulty, closedGolden, isComeback, turns, duration, isOnline } = req.body

  // ── Валидация формата score ──
  if (!score || typeof score !== 'string') return res.status(400).json({ error: 'Некорректный счёт' })
  const scoreParts = score.split(':')
  if (scoreParts.length !== 2) return res.status(400).json({ error: 'Формат счёта: X:Y' })
  const [s1, s2] = scoreParts.map(Number)
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 10 || s2 > 10) {
    return res.status(400).json({ error: 'Счёт вне диапазона 0-10' })
  }
  if (s1 + s2 > 10) return res.status(400).json({ error: 'Сумма счёта > 10' })

  // ── Валидация won vs score ──
  // Если won=true, игрок должен иметь больше стоек (s1 > s2 для P1)
  if (won && s1 <= s2 && s1 !== s2) {
    // Допускаем: золотая стойка могла решить при 5:5
  }
  if (!won && s1 > s2) {
    // Проиграл но счёт в его пользу — подозрительно, но допускаем (resign, таймаут)
  }

  // ── Валидация turns/duration ──
  const safeTurns = Math.max(0, Math.min(500, Math.floor(+turns || 0)))
  const safeDuration = Math.max(0, Math.min(7200, Math.floor(+duration || 0)))
  const safeDifficulty = Math.max(0, Math.min(400, Math.floor(+difficulty || 150)))

  // ── Антиспам: 1 партия / 10 сек ──
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

  // Обновляем пользователя
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

  // Записываем партию
  const gameResult = db.prepare(`INSERT INTO games (user_id, won, score, rating_before, rating_after, rating_delta, difficulty, closed_golden, is_comeback, turns, duration, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, won ? 1 : 0, score, ratingBefore, ratingAfter, ratingDelta, safeDifficulty, closedGolden ? 1 : 0, isComeback ? 1 : 0, safeTurns, safeDuration, isOnline ? 1 : 0)

  // Записываем историю рейтинга
  db.prepare('INSERT INTO rating_history (user_id, rating, delta, game_id) VALUES (?, ?, ?, ?)').run(req.user.id, ratingAfter, ratingDelta, gameResult.lastInsertRowid)

  // Обновляем сезонный рейтинг
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

  // Ачивки
  const newAch = checkAchievements(req.user.id)

  // XP за партию
  const xpGain = won ? 20 : 5
  addXP(req.user.id, xpGain)

  res.json({ ratingBefore, ratingAfter, ratingDelta, newAchievements: newAch, xpGain })
})

app.get('/api/games', auth, (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 50)
  const games = db.prepare('SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ?').all(req.user.id, limit)
  res.json(games)
})

// ═══ LEADERBOARD ═══

// Автоматическое создание сезонов (месячные)
function ensureCurrentSeason() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const start = new Date(y, m, 1).toISOString().slice(0, 10)
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  const name = `${y}-${String(m + 1).padStart(2, '0')}`

  let season = db.prepare('SELECT * FROM seasons WHERE name=?').get(name)
  if (!season) {
    // Деактивируем старые
    db.prepare('UPDATE seasons SET active=0 WHERE active=1').run()
    db.prepare('INSERT INTO seasons (name, start_date, end_date, active) VALUES (?, ?, ?, 1)').run(name, start, end)
    season = db.prepare('SELECT * FROM seasons WHERE name=?').get(name)
  }
  return season
}

app.get('/api/seasons/current', (req, res) => {
  const season = ensureCurrentSeason()
  if (!season) return res.json({ season: null })
  const top = db.prepare(`SELECT sr.rating, sr.games, sr.wins, u.username
    FROM season_ratings sr JOIN users u ON u.id = sr.user_id
    WHERE sr.season_id = ? ORDER BY sr.rating DESC LIMIT 20`).all(season.id)
  res.json({ season, leaderboard: top })
})

app.get('/api/seasons/history', (req, res) => {
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC LIMIT 12').all()
  res.json(seasons)
})

app.get('/api/profile/rating-history', auth, (req, res) => {
  const history = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  res.json(history)
})

app.get('/api/leaderboard', (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 100)
  const users = db.prepare('SELECT id, username, rating, games_played, wins, losses, best_streak, level, xp FROM users ORDER BY rating DESC LIMIT ?').all(limit)
  res.json(users.map(u => ({
    username: u.username, rating: u.rating,
    games: u.games_played, wins: u.wins,
    winRate: u.games_played > 0 ? +(u.wins / u.games_played * 100).toFixed(1) : 0,
    bestStreak: u.best_streak,
  })))
})

// ═══ FRIENDS ═══
app.post('/api/friends/request', auth, (req, res) => {
  const { username } = req.body
  const friend = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (!friend) return res.status(404).json({ error: 'Пользователь не найден' })
  if (friend.id === req.user.id) return res.status(400).json({ error: 'Нельзя добавить себя' })

  const existing = db.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?').get(req.user.id, friend.id)
  if (existing) return res.status(409).json({ error: 'Запрос уже отправлен' })

  db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, "pending")').run(req.user.id, friend.id)
  res.json({ ok: true })
})

app.post('/api/friends/accept', auth, (req, res) => {
  const { userId } = req.body
  db.prepare('UPDATE friends SET status = "accepted" WHERE user_id = ? AND friend_id = ?').run(userId, req.user.id)
  // Создаём обратную связь
  db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, "accepted")').run(req.user.id, userId)
  res.json({ ok: true })
})

app.get('/api/friends', auth, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.username, u.rating, u.last_seen, f.status
    FROM friends f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'accepted'
  `).all(req.user.id)

  const pending = db.prepare(`
    SELECT u.id, u.username, u.rating
    FROM friends f JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `).all(req.user.id)

  res.json({ friends, pending })
})

// ═══ TRAINING DATA ═══
app.post('/api/training', auth, (req, res) => {
  const { gameData, winner, totalMoves, mode, difficulty } = req.body
  db.prepare('INSERT INTO training_data (user_id, game_data, winner, total_moves, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, JSON.stringify(gameData), winner, totalMoves || 0, mode || 'ai', difficulty || 150)
  res.json({ ok: true })
})

app.get('/api/training/stats', auth, adminOnly, (req, res) => {
  const stats = db.prepare('SELECT COUNT(*) as games, SUM(total_moves) as moves FROM training_data').get()
  const byMode = db.prepare('SELECT mode, COUNT(*) as count FROM training_data GROUP BY mode').all()
  res.json({ ...stats, byMode })
})

app.get('/api/training/export', auth, adminOnly, (req, res) => {
  const data = db.prepare('SELECT game_data, winner FROM training_data ORDER BY created_at DESC LIMIT 500').all()
  res.json(data.map(d => ({ ...JSON.parse(d.game_data), winner: d.winner })))
})

// Экспорт позиций для GPU-доучивания (формат gpu_trainer.py)
app.get('/api/admin/training/export-gpu', auth, adminOnly, (req, res) => {
  const limit = Math.min(+req.query.limit || 5000, 50000)
  const minMoves = +req.query.minMoves || 5
  const rows = db.prepare('SELECT game_data, winner, mode, difficulty FROM training_data WHERE total_moves >= ? ORDER BY created_at DESC LIMIT ?').all(minMoves, limit)
  
  // Конвертируем в формат: [{ states: [[107 floats], ...], winner: 0|1 }]
  const games = []
  for (const row of rows) {
    try {
      const data = JSON.parse(row.game_data)
      if (!data.moves || row.winner < 0) continue
      games.push({
        moves: data.moves, // [{state: {stands, closed, turn, player}, action, player}]
        winner: row.winner,
        mode: row.mode,
        difficulty: row.difficulty,
      })
    } catch {}
  }
  
  res.json({
    total: games.length,
    format: 'raw_moves',
    note: 'Encode states client-side using encode_state(). winner: 0=P1, 1=P2',
    games,
  })
})

// ═══ SEARCH ═══
app.get('/api/users/search', auth, (req, res) => {
  const q = req.query.q
  if (!q || q.length < 2) return res.json([])
  const escaped = q.replace(/[%_]/g, '\\$&')
  const users = db.prepare("SELECT id, username, rating FROM users WHERE username LIKE ? ESCAPE '\\' AND id != ? LIMIT 10").all(`%${escaped}%`, req.user.id)
  res.json(users)
})

// ═══ DAILY MISSIONS ═══
const MISSION_POOL = [
  { id: 'play_3', target: 3, xp: 50, name_ru: 'Сыграй 3 партии', name_en: 'Play 3 games' },
  { id: 'win_1', target: 1, xp: 30, name_ru: 'Одержи победу', name_en: 'Win a game' },
  { id: 'win_ai_hard', target: 1, xp: 80, name_ru: 'Победи AI на Hard+', name_en: 'Beat AI on Hard+' },
  { id: 'solve_puzzle', target: 1, xp: 40, name_ru: 'Реши головоломку', name_en: 'Solve a puzzle' },
  { id: 'play_online', target: 1, xp: 60, name_ru: 'Сыграй онлайн', name_en: 'Play online' },
  { id: 'streak_3', target: 3, xp: 70, name_ru: 'Выиграй 3 подряд', name_en: 'Win 3 in a row' },
  { id: 'close_golden', target: 1, xp: 50, name_ru: 'Закрой золотую стойку', name_en: 'Close golden stand' },
  { id: 'play_5', target: 5, xp: 60, name_ru: 'Сыграй 5 партий', name_en: 'Play 5 games' },
]

function getTodayMissions(userId) {
  const today = new Date().toISOString().split('T')[0]
  const existing = db.prepare('SELECT mission_id, progress, target, completed, xp_reward FROM daily_missions WHERE user_id=? AND date=?').all(userId, today)
  if (existing.length >= 3) return existing

  // Генерируем 3 случайных миссии (seed по дате + userId для разнообразия)
  const seed = parseInt(today.replace(/-/g, '')) + userId
  const shuffled = [...MISSION_POOL].sort((a, b) => {
    const ha = (seed * 31 + a.id.charCodeAt(0)) % 100
    const hb = (seed * 31 + b.id.charCodeAt(0)) % 100
    return ha - hb
  })
  const picked = shuffled.slice(0, 3)
  const ins = db.prepare('INSERT OR IGNORE INTO daily_missions (user_id, date, mission_id, target, xp_reward) VALUES (?, ?, ?, ?, ?)')
  for (const m of picked) ins.run(userId, today, m.id, m.target, m.xp)
  return db.prepare('SELECT mission_id, progress, target, completed, xp_reward FROM daily_missions WHERE user_id=? AND date=?').all(userId, today)
}

function addXP(userId, amount) {
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId)
  const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(userId)
  if (!user) return
  // Level up: 100 * level XP needed
  const xpForNext = user.level * 100
  if (user.xp >= xpForNext) {
    db.prepare('UPDATE users SET level = level + 1, xp = xp - ? WHERE id = ?').run(xpForNext, userId)
  }
}

app.get('/api/missions', auth, (req, res) => {
  const missions = getTodayMissions(req.user.id)
  const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(req.user.id)
  const enriched = missions.map(m => {
    const def = MISSION_POOL.find(p => p.id === m.mission_id) || {}
    return { ...m, name_ru: def.name_ru, name_en: def.name_en }
  })
  const allDone = enriched.every(m => m.completed)
  res.json({ missions: enriched, allDone, xp: user?.xp || 0, level: user?.level || 1, xpForNext: (user?.level || 1) * 100 })
})

app.post('/api/missions/progress', auth, (req, res) => {
  const { mission_id, increment } = req.body
  if (!mission_id) return res.status(400).json({ error: 'mission_id required' })
  const today = new Date().toISOString().split('T')[0]
  getTodayMissions(req.user.id) // ensure generated

  const m = db.prepare('SELECT * FROM daily_missions WHERE user_id=? AND date=? AND mission_id=?').get(req.user.id, today, mission_id)
  if (!m || m.completed) return res.json({ ok: true, alreadyDone: true })

  const newProgress = Math.min(m.progress + (increment || 1), m.target)
  const completed = newProgress >= m.target ? 1 : 0
  db.prepare('UPDATE daily_missions SET progress=?, completed=? WHERE id=?').run(newProgress, completed, m.id)

  if (completed) {
    addXP(req.user.id, m.xp_reward)
    // Bonus: all 3 done?
    const allDone = db.prepare('SELECT COUNT(*) as c FROM daily_missions WHERE user_id=? AND date=? AND completed=1').get(req.user.id, today).c
    if (allDone >= 3) addXP(req.user.id, 100) // Bonus XP
  }

  const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(req.user.id)
  res.json({ ok: true, completed: !!completed, progress: newProgress, target: m.target, xp: user?.xp, level: user?.level })
})

// ═══ LOGIN STREAK ═══
app.post('/api/streak/checkin', auth, (req, res) => {
  const user = db.prepare('SELECT login_streak, best_login_streak, last_login_date, streak_freeze FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const today = new Date().toISOString().split('T')[0]
  if (user.last_login_date === today) {
    // Уже заходил сегодня
    const calendar = db.prepare('SELECT date FROM daily_logins WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.user.id)
    return res.json({ streak: user.login_streak, best: user.best_login_streak, today: true, freeze: user.streak_freeze, calendar: calendar.map(r => r.date) })
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  let streak = user.login_streak || 0
  let freeze = user.streak_freeze ?? 1

  if (user.last_login_date === yesterday) {
    streak += 1 // Продолжаем серию
  } else if (user.last_login_date && user.last_login_date < yesterday) {
    // Пропуск: проверяем streak freeze
    const daysBefore = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
    if (user.last_login_date === daysBefore && freeze > 0) {
      streak += 1 // Freeze спасает
      freeze -= 1
    } else {
      streak = 1 // Серия сброшена
    }
  } else {
    streak = 1 // Первый вход
  }

  const best = Math.max(streak, user.best_login_streak || 0)
  // Новый freeze каждый месяц
  const lastMonth = user.last_login_date ? user.last_login_date.slice(0, 7) : ''
  const thisMonth = today.slice(0, 7)
  if (lastMonth !== thisMonth) freeze = 1

  db.prepare('UPDATE users SET login_streak=?, best_login_streak=?, last_login_date=?, streak_freeze=? WHERE id=?')
    .run(streak, best, today, freeze, req.user.id)
  try { db.prepare('INSERT OR IGNORE INTO daily_logins (user_id, date) VALUES (?, ?)').run(req.user.id, today) } catch {}

  // XP за streak
  const streakXP = streak >= 30 ? 50 : streak >= 7 ? 20 : streak >= 3 ? 10 : 5
  addXP(req.user.id, streakXP)

  const calendar = db.prepare('SELECT date FROM daily_logins WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.user.id)
  res.json({ streak, best, today: false, isNew: true, freeze, streakXP, calendar: calendar.map(r => r.date) })
})

app.get('/api/streak', auth, (req, res) => {
  const user = db.prepare('SELECT login_streak, best_login_streak, last_login_date, streak_freeze FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.json({ streak: 0, best: 0, calendar: [] })
  const calendar = db.prepare('SELECT date FROM daily_logins WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.user.id)
  res.json({ streak: user.login_streak || 0, best: user.best_login_streak || 0, freeze: user.streak_freeze ?? 1, calendar: calendar.map(r => r.date) })
})

// ═══ PUSH NOTIFICATIONS ═══
app.post('/api/push/register', auth, (req, res) => {
  const { token, platform } = req.body
  if (!token) return res.status(400).json({ error: 'token required' })
  try {
    db.prepare('INSERT OR REPLACE INTO push_tokens (user_id, token, platform) VALUES (?, ?, ?)').run(req.user.id, token, platform || 'android')
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/push/unregister', auth, (req, res) => {
  const { token } = req.body
  if (token) db.prepare('DELETE FROM push_tokens WHERE token=?').run(token)
  else db.prepare('DELETE FROM push_tokens WHERE user_id=?').run(req.user.id)
  res.json({ ok: true })
})

// ═══ LIVE ARENA ═══

// Получить текущий/ближайший турнир
app.get('/api/arena/current', (req, res) => {
  let t = db.prepare("SELECT * FROM arena_tournaments WHERE status IN ('waiting','playing') ORDER BY created_at DESC LIMIT 1").get()
  if (!t) {
    // Автоматически создаём новый турнир каждую субботу или если нет активных
    db.prepare("INSERT INTO arena_tournaments (status, rounds, max_players) VALUES ('waiting', 4, 16)").run()
    t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  }
  const participants = db.prepare('SELECT ap.*, u.rating, u.avatar FROM arena_participants ap JOIN users u ON u.id=ap.user_id WHERE ap.tournament_id=? ORDER BY ap.score DESC, ap.buchholz DESC').all(t.id)
  const matches = db.prepare('SELECT * FROM arena_matches WHERE tournament_id=? ORDER BY round, id').all(t.id)
  res.json({ tournament: t, participants, matches })
})

// Присоединиться
app.post('/api/arena/join', auth, (req, res) => {
  const t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  if (!t) return res.status(404).json({ error: 'No tournament available' })
  if (db.prepare('SELECT id FROM arena_participants WHERE tournament_id=? AND user_id=?').get(t.id, req.user.id)) {
    return res.json({ ok: true, already: true })
  }
  const count = db.prepare('SELECT COUNT(*) as c FROM arena_participants WHERE tournament_id=?').get(t.id).c
  if (count >= t.max_players) return res.status(400).json({ error: 'Tournament full' })
  db.prepare('INSERT INTO arena_participants (tournament_id, user_id, username) VALUES (?, ?, ?)').run(t.id, req.user.id, req.user.username)
  res.json({ ok: true })
})

// Покинуть (до старта)
app.post('/api/arena/leave', auth, (req, res) => {
  const t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  if (t) db.prepare('DELETE FROM arena_participants WHERE tournament_id=? AND user_id=?').run(t.id, req.user.id)
  res.json({ ok: true })
})

// Старт турнира (admin или авто при 4+ участниках)
app.post('/api/arena/start', auth, rateLimit(60000, 5), (req, res) => {
  const t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  if (!t) return res.status(404).json({ error: 'No waiting tournament' })
  const parts = db.prepare('SELECT * FROM arena_participants WHERE tournament_id=?').all(t.id)
  if (parts.length < 2) return res.status(400).json({ error: 'Need 2+ players' })

  db.prepare("UPDATE arena_tournaments SET status='playing', started_at=datetime('now'), current_round=1 WHERE id=?").run(t.id)

  // Swiss pairing: round 1 — случайный порядок
  const shuffled = parts.sort(() => Math.random() - 0.5)
  const ins = db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id) VALUES (?, 1, ?, ?)')
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    ins.run(t.id, shuffled[i].user_id, shuffled[i + 1].user_id)
  }
  // Нечётный игрок получает bye
  if (shuffled.length % 2 === 1) {
    db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id, winner_id, result) VALUES (?, 1, ?, NULL, ?, ?)')
      .run(t.id, shuffled[shuffled.length - 1].user_id, shuffled[shuffled.length - 1].user_id, 'bye')
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?')
      .run(t.id, shuffled[shuffled.length - 1].user_id)
  }

  res.json({ ok: true, round: 1, matches: shuffled.length >> 1 })
})

// Записать результат матча
app.post('/api/arena/result', auth, rateLimit(60000, 30), (req, res) => {
  const { match_id, winner_id, result } = req.body
  if (!match_id) return res.status(400).json({ error: 'match_id required' })
  const match = db.prepare('SELECT * FROM arena_matches WHERE id=?').get(match_id)
  if (!match || match.winner_id) return res.status(400).json({ error: 'Invalid match or already recorded' })

  db.prepare('UPDATE arena_matches SET winner_id=?, result=? WHERE id=?').run(winner_id, result || '', match_id)

  // Обновляем score
  if (winner_id === match.player1_id) {
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player1_id)
    db.prepare('UPDATE arena_participants SET losses=losses+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player2_id)
  } else if (winner_id === match.player2_id) {
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player2_id)
    db.prepare('UPDATE arena_participants SET losses=losses+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player1_id)
  } else {
    // Ничья
    db.prepare('UPDATE arena_participants SET score=score+0.5, draws=draws+1 WHERE tournament_id=? AND user_id IN (?,?)').run(match.tournament_id, match.player1_id, match.player2_id)
  }

  // Проверяем все матчи текущего раунда завершены → следующий раунд
  const t = db.prepare('SELECT * FROM arena_tournaments WHERE id=?').get(match.tournament_id)
  const roundMatches = db.prepare('SELECT * FROM arena_matches WHERE tournament_id=? AND round=?').all(t.id, t.current_round)
  const allDone = roundMatches.every(m => m.winner_id || m.result === 'bye')

  if (allDone && t.current_round < t.rounds) {
    // Следующий раунд — Swiss pairing по score
    const nextRound = t.current_round + 1
    db.prepare('UPDATE arena_tournaments SET current_round=? WHERE id=?').run(nextRound, t.id)
    const parts = db.prepare('SELECT * FROM arena_participants WHERE tournament_id=? ORDER BY score DESC, buchholz DESC').all(t.id)
    const paired = new Set()
    const ins2 = db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id) VALUES (?, ?, ?, ?)')
    for (let i = 0; i < parts.length; i++) {
      if (paired.has(parts[i].user_id)) continue
      for (let j = i + 1; j < parts.length; j++) {
        if (paired.has(parts[j].user_id)) continue
        // Проверяем не играли ли уже друг с другом
        const played = db.prepare('SELECT id FROM arena_matches WHERE tournament_id=? AND ((player1_id=? AND player2_id=?) OR (player1_id=? AND player2_id=?))').get(t.id, parts[i].user_id, parts[j].user_id, parts[j].user_id, parts[i].user_id)
        if (!played) {
          ins2.run(t.id, nextRound, parts[i].user_id, parts[j].user_id)
          paired.add(parts[i].user_id); paired.add(parts[j].user_id)
          break
        }
      }
    }
    // Bye для непарного
    for (const p of parts) {
      if (!paired.has(p.user_id)) {
        db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id, winner_id, result) VALUES (?, ?, ?, NULL, ?, ?)')
          .run(t.id, nextRound, p.user_id, p.user_id, 'bye')
        db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(t.id, p.user_id)
      }
    }
  } else if (allDone && t.current_round >= t.rounds) {
    // Турнир завершён
    db.prepare("UPDATE arena_tournaments SET status='finished', finished_at=datetime('now') WHERE id=?").run(t.id)
    // XP для топ-3
    const final = db.prepare('SELECT user_id FROM arena_participants WHERE tournament_id=? ORDER BY score DESC LIMIT 3').all(t.id)
    if (final[0]) addXP(final[0].user_id, 200) // 1 место
    if (final[1]) addXP(final[1].user_id, 100) // 2 место
    if (final[2]) addXP(final[2].user_id, 50)  // 3 место
  }

  res.json({ ok: true, allRoundDone: allDone })
})

// История турниров
app.get('/api/arena/history', (req, res) => {
  const tournaments = db.prepare("SELECT * FROM arena_tournaments WHERE status='finished' ORDER BY finished_at DESC LIMIT 10").all()
  res.json(tournaments)
})

// ═══ STATS (public) ═══
app.get('/api/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  const totalGames = db.prepare('SELECT COUNT(*) as c FROM games').get().c
  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM users WHERE games_played > 0').get().avg || 1000
  res.json({ totalUsers, totalGames, avgRating: Math.round(avgRating) })
})

// ═══ Health ═══
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), users: db.prepare('SELECT COUNT(*) as c FROM users').get().c, rooms: rooms.size })
})

// ═══ DAILY CHALLENGE ═══
function getDailySeed() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
}

function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}

app.get('/api/daily', (req, res) => {
  const seed = getDailySeed()
  const rng = seededRandom(seed)
  // Генерируем стартовую позицию: первый ход P1 (1 фишка) + ответ P2 (1-3 фишки на макс 2 стойки)
  const firstStand = Math.floor(rng() * 10)
  const p2count = 1 + Math.floor(rng() * 3) // 1-3 фишки
  // Выбираем 1 или 2 стойки
  const numStands = p2count === 1 ? 1 : (1 + Math.floor(rng() * 2)) // 1-2 стойки
  const standA = Math.floor(rng() * 10)
  let standB = standA
  if (numStands === 2) {
    standB = Math.floor(rng() * 10)
    while (standB === standA) standB = Math.floor(rng() * 10)
  }
  const p2stands = []
  for (let i = 0; i < p2count; i++) {
    p2stands.push(i === 0 || numStands === 1 ? standA : standB)
  }
  res.json({ seed, date: seed, firstMove: { stand: firstStand }, secondMove: { stands: p2stands }, swapped: rng() > 0.5 })
})

app.get('/api/daily/leaderboard', (req, res) => {
  const seed = getDailySeed()
  const rows = db.prepare(`SELECT username, turns, duration FROM daily_results
    WHERE seed = ? ORDER BY turns ASC, duration ASC LIMIT 20`).all(seed)
  res.json({ seed, results: rows })
})

app.post('/api/daily/submit', auth, (req, res) => {
  const { turns, duration, won } = req.body
  const seed = getDailySeed()
  const existing = db.prepare('SELECT id FROM daily_results WHERE user_id = ? AND seed = ?').get(req.user.id, seed)
  if (existing) return res.status(409).json({ error: 'Уже отправлено сегодня' })
  db.prepare('INSERT INTO daily_results (user_id, username, seed, turns, duration, won) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, req.user.username, seed, turns, duration || 0, won ? 1 : 0)
  res.json({ ok: true })
})

// ═══ Генератор головоломок ═══
// Шаблоны — описание позиций (stands, closed, goal)
const PUZZLE_TEMPLATES = [
  // ─── Лёгкие (1 ход) — перенос закрывает стойку ───
  { difficulty: 1, maxMoves: 1, title_ru: 'Закрой стойку', title_en: 'Close a stand',
    gen: (rng) => {
      const s = Math.floor(rng() * 9) + 1
      const d = (s + 3) % 10 || 1
      const stands = Array.from({length:10}, () => [])
      // Стойка s: 8 своих наверху → перенос 3 с d закроет (8+3=11)
      stands[s] = [...Array(2).fill(1), ...Array(6 + Math.floor(rng() * 2)).fill(0)]
      stands[d] = Array(11 - stands[s].length).fill(0)
      return { stands, goal: { closedByPlayer: { [s]: 0 }, maxMoves: 1 },
        desc_ru: `Закройте стойку ${s} переносом`, desc_en: `Close stand ${s} by transfer` }
    }
  },
  { difficulty: 1, maxMoves: 1, title_ru: 'Золотая', title_en: 'Golden',
    gen: (rng) => {
      const stands = Array.from({length:10}, () => [])
      // Золотая: 8 своих сверху, перенос с src закроет
      stands[0] = [...Array(2).fill(1), ...Array(6).fill(0)]
      const src = 1 + Math.floor(rng() * 9)
      stands[src] = Array(3).fill(0)
      return { stands, goal: { closedByPlayer: { 0: 0 }, maxMoves: 1 },
        desc_ru: 'Закройте золотую стойку ★', desc_en: 'Close golden stand ★' }
    }
  },
  // ─── Средние (2 хода) ───
  { difficulty: 2, maxMoves: 2, title_ru: 'Двойное закрытие', title_en: 'Double close',
    gen: (rng) => {
      const a = 1 + Math.floor(rng() * 4)
      const b = 5 + Math.floor(rng() * 4)
      const stands = Array.from({length:10}, () => [])
      stands[a] = Array(8).fill(0)
      stands[b] = Array(8).fill(0)
      // Два источника по 3 — гарантировано не пересекаются
      const used = new Set([a, b])
      const srcs = []
      for (let i = 0; i < 10 && srcs.length < 2; i++) {
        if (!used.has(i)) { srcs.push(i); used.add(i) }
      }
      stands[srcs[0]] = Array(3).fill(0)
      stands[srcs[1]] = Array(3).fill(0)
      return { stands, goal: { minClosed: 2, maxMoves: 2 },
        desc_ru: 'Закройте 2 стойки за 2 хода', desc_en: 'Close 2 stands in 2 moves' }
    }
  },
  { difficulty: 2, maxMoves: 2, title_ru: 'Захват', title_en: 'Capture',
    gen: (rng) => {
      const target = 1 + Math.floor(rng() * 9)
      const src = (target + 3) % 10 || 1
      const stands = Array.from({length:10}, () => [])
      // Стойка с чужими внизу, нашими сверху — перенос закроет за нас
      stands[target] = [...Array(5).fill(1), ...Array(3).fill(0)]
      stands[src] = Array(3 + Math.floor(rng() * 2)).fill(0)
      return { stands, goal: { closedByPlayer: { [target]: 0 }, maxMoves: 2 },
        desc_ru: `Перехватите стойку ${target}`, desc_en: `Capture stand ${target}` }
    }
  },
  // ─── Сложные (3 хода) ───
  { difficulty: 3, maxMoves: 3, title_ru: 'Тройной удар', title_en: 'Triple strike',
    gen: (rng) => {
      const s1 = 1 + Math.floor(rng() * 3)
      const s2 = 4 + Math.floor(rng() * 3)
      const s3 = 7 + Math.floor(rng() * 2)
      const stands = Array.from({length:10}, () => [])
      // Три стойки по 8, три источника по 3 — каждый ход = перенос + закрытие
      stands[s1] = Array(8).fill(0)
      stands[s2] = Array(8).fill(0)
      stands[s3] = Array(8).fill(0)
      // Три разных источника
      const used = new Set([s1, s2, s3])
      const srcs = []
      for (let i = 0; i < 10 && srcs.length < 3; i++) {
        if (!used.has(i)) { srcs.push(i); used.add(i) }
      }
      srcs.forEach(s => { stands[s] = Array(3).fill(0) })
      return { stands, goal: { minClosed: 3, maxMoves: 3 },
        desc_ru: 'Закройте 3 стойки за 3 хода', desc_en: 'Close 3 stands in 3 moves' }
    }
  },
  { difficulty: 3, maxMoves: 3, title_ru: 'Цепная реакция', title_en: 'Chain reaction',
    gen: (rng) => {
      const a = Math.floor(rng() * 5)
      const b = 5 + Math.floor(rng() * 5)
      const stands = Array.from({length:10}, () => [])
      // a: чужие внизу + наши сверху, b: смешанные с нашими сверху
      stands[a] = [...Array(6).fill(1), ...Array(3).fill(0)]
      stands[b] = [...Array(4).fill(1), ...Array(4).fill(0)]
      const src = (a + 2) % 10 === b ? (a + 3) % 10 : (a + 2) % 10
      stands[src] = Array(4).fill(0)
      return { stands, goal: { minClosed: 2, maxMoves: 3 },
        desc_ru: 'Разберите позицию и закройте 2 стойки', desc_en: 'Untangle and close 2 stands' }
    }
  },
  // ─── Дополнительные шаблоны ───
  { difficulty: 1, maxMoves: 1, title_ru: 'Точный перенос', title_en: 'Precise transfer',
    gen: (rng) => {
      const s = 1 + Math.floor(rng() * 8)
      const stands = Array.from({length:10}, () => [])
      stands[s] = [...Array(3).fill(1), ...Array(5).fill(0)]
      const src = (s + 1 + Math.floor(rng() * 4)) % 10
      stands[src] = Array(3).fill(0)
      return { stands, goal: { closedByPlayer: { [s]: 0 }, maxMoves: 1 },
        desc_ru: `Закройте стойку ${s} одним переносом`, desc_en: `Close stand ${s} in one transfer` }
    }
  },
  { difficulty: 2, maxMoves: 2, title_ru: 'Золото и стойка', title_en: 'Gold and stand',
    gen: (rng) => {
      const s = 1 + Math.floor(rng() * 9)
      const stands = Array.from({length:10}, () => [])
      stands[0] = [...Array(2).fill(1), ...Array(6).fill(0)]
      stands[s] = Array(8).fill(0)
      const src1 = s === 1 ? 2 : 1
      const src2 = s === 3 ? 4 : 3
      stands[src1] = Array(3).fill(0)
      stands[src2] = Array(3).fill(0)
      return { stands, goal: { minClosed: 2, maxMoves: 2 },
        desc_ru: 'Закройте золотую ★ и ещё одну стойку', desc_en: 'Close golden ★ and one more stand' }
    }
  },
  { difficulty: 2, maxMoves: 2, title_ru: 'Перехват врага', title_en: 'Enemy takeover',
    gen: (rng) => {
      const s = 1 + Math.floor(rng() * 9)
      const stands = Array.from({length:10}, () => [])
      stands[s] = [...Array(7).fill(1), ...Array(1).fill(0)]
      const src = (s + 2 + Math.floor(rng() * 3)) % 10
      stands[src] = Array(3).fill(0)
      return { stands, goal: { closedByPlayer: { [s]: 0 }, maxMoves: 2 },
        desc_ru: `Перехватите стойку ${s} у противника`, desc_en: `Take over stand ${s} from opponent` }
    }
  },
  { difficulty: 3, maxMoves: 3, title_ru: 'Золотой удар', title_en: 'Golden strike',
    gen: (rng) => {
      const s = 3 + Math.floor(rng() * 6)
      const stands = Array.from({length:10}, () => [])
      stands[0] = [...Array(4).fill(1), ...Array(4).fill(0)]
      stands[s] = [...Array(5).fill(1), ...Array(3).fill(0)]
      const used = new Set([0, s])
      const srcs = []
      for (let i = 1; i < 10 && srcs.length < 2; i++) if (!used.has(i)) { srcs.push(i); used.add(i) }
      stands[srcs[0]] = Array(3).fill(0)
      stands[srcs[1]] = Array(3).fill(0)
      return { stands, goal: { closedByPlayer: { 0: 0 }, minClosed: 2, maxMoves: 3 },
        desc_ru: 'Закройте золотую ★ и перехватите стойку', desc_en: 'Close golden ★ and capture a stand' }
    }
  },
]

function puzzleSeededRandom(seed) {
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}

function generatePuzzle(seed, difficultyFilter) {
  const rng = puzzleSeededRandom(seed)
  const templates = difficultyFilter
    ? PUZZLE_TEMPLATES.filter(t => t.difficulty === difficultyFilter)
    : PUZZLE_TEMPLATES
  const tmpl = templates[Math.floor(rng() * templates.length)]
  const puzzle = tmpl.gen(rng)
  return {
    id: String(seed),
    difficulty: tmpl.difficulty,
    maxMoves: tmpl.maxMoves,
    title_ru: tmpl.title_ru,
    title_en: tmpl.title_en,
    ...puzzle,
    turn: 6 + Math.floor(rng() * 4) * 2, // чётный ход
  }
}

// ─── Daily puzzle (новая каждый день) ───
app.get('/api/puzzles/daily', (req, res) => {
  const d = new Date()
  const seed = `daily-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
  const puzzle = generatePuzzle(seed, 2)
  puzzle.type = 'daily'
  // Сколько решило
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('daily', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  // Лидерборд
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('daily', seed)
  res.json(puzzle)
})

// ─── Weekly puzzle (новая каждую неделю, пн-вс, сложнее) ───
app.get('/api/puzzles/weekly', (req, res) => {
  const d = new Date()
  // ISO week number (пн=1, вс=7)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d - jan1) / 86400000) + 1
  const weekDay = d.getDay() || 7 // пн=1..вс=7
  const weekNum = Math.floor((dayOfYear - weekDay + 10) / 7)
  const seed = `weekly-${d.getFullYear()}-W${weekNum}`
  const puzzle = generatePuzzle(seed, 3)
  puzzle.type = 'weekly'
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('weekly', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('weekly', seed)
  res.json(puzzle)
})

// ─── Puzzle Rush ───
app.get('/api/puzzles/rush', (req, res) => {
  // 30 случайных головоломок с нарастающей сложностью
  const puzzles = []
  for (let i = 0; i < 30; i++) {
    const diff = i < 8 ? 1 : i < 20 ? 2 : 3
    const seed = `rush-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
    const p = generatePuzzle(seed, diff)
    p.rushIndex = i + 1
    p.difficulty = diff
    puzzles.push(p)
  }
  res.json({ puzzles })
})

app.get('/api/puzzles/rush/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.avatar, pr.score, pr.created_at
    FROM puzzle_rush_scores pr JOIN users u ON u.id = pr.user_id
    ORDER BY pr.score DESC LIMIT 20
  `).all()
  res.json(rows)
})

app.post('/api/puzzles/rush/submit', auth, (req, res) => {
  const { score, solved, time } = req.body
  if (!score && score !== 0) return res.status(400).json({ error: 'score required' })
  db.prepare('INSERT INTO puzzle_rush_scores (user_id, score, solved, time_ms) VALUES (?, ?, ?, ?)')
    .run(req.user.id, score, solved || 0, time || 180000)
  // XP за puzzle rush
  const xp = Math.min(score * 5, 200)
  if (xp > 0) addXP(req.user.id, xp)
  // Mission progress
  if (solved > 0) {
    const today = new Date().toISOString().split('T')[0]
    getTodayMissions(req.user.id)
    const m = db.prepare('SELECT * FROM daily_missions WHERE user_id=? AND date=? AND mission_id=? AND completed=0')
      .get(req.user.id, today, 'solve_puzzle')
    if (m) {
      const np = Math.min(m.progress + solved, m.target)
      db.prepare('UPDATE daily_missions SET progress=?, completed=? WHERE id=?').run(np, np >= m.target ? 1 : 0, m.id)
      if (np >= m.target) addXP(req.user.id, m.xp_reward)
    }
  }
  res.json({ ok: true, xp })
})

app.get('/api/puzzles/bank', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 12
  const diff = parseInt(req.query.difficulty) || 0
  
  const puzzles = []
  const total = 200
  const start = (page - 1) * perPage
  
  for (let i = start; i < Math.min(start + perPage, total); i++) {
    const seed = `bank-${i}`
    const difficulty = i < 50 ? 1 : i < 130 ? 2 : 3
    if (diff && difficulty !== diff) continue
    const p = generatePuzzle(seed, difficulty)
    p.type = 'bank'
    p.bankIndex = i + 1
    // Статы решения
    const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('bank', seed)
    p.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
    puzzles.push(p)
  }
  
  res.json({ puzzles, total, page, perPage, pages: Math.ceil(total / perPage) })
})

// ─── Отдельная головоломка ───
app.get('/api/puzzles/:type/:id', (req, res) => {
  const { type, id } = req.params
  if (!['daily', 'weekly', 'bank'].includes(type)) return res.status(400).json({ error: 'Invalid type' })
  const seed = type === 'bank' ? `bank-${id}` : id
  const difficulty = type === 'weekly' ? 3 : type === 'daily' ? 2 : (parseInt(id) < 50 ? 1 : parseInt(id) < 130 ? 2 : 3)
  const puzzle = generatePuzzle(seed, difficulty)
  puzzle.type = type
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get(type, seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  res.json(puzzle)
})

// ─── Отправка результата ───
app.post('/api/puzzles/submit', auth, (req, res) => {
  const { type, puzzleId, solved, movesUsed, duration } = req.body
  if (!type || !puzzleId) return res.status(400).json({ error: 'Missing fields' })
  
  const existing = db.prepare('SELECT id, solved FROM puzzle_results WHERE user_id=? AND puzzle_type=? AND puzzle_id=?').get(req.user.id, type, puzzleId)
  let newSolve = false
  if (existing) {
    if (solved && (!existing.solved || movesUsed < existing.moves_used)) {
      db.prepare('UPDATE puzzle_results SET solved=1, moves_used=?, duration=? WHERE id=?').run(movesUsed, duration, existing.id)
      if (!existing.solved) newSolve = true
    }
  } else {
    db.prepare('INSERT INTO puzzle_results (user_id, username, puzzle_type, puzzle_id, solved, moves_used, duration) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.user.id, req.user.username, type, puzzleId, solved ? 1 : 0, movesUsed, duration)
    if (solved) newSolve = true
  }
  // Инкремент счётчика решённых и проверка ачивок
  if (newSolve) {
    db.prepare('UPDATE users SET puzzles_solved = puzzles_solved + 1 WHERE id = ?').run(req.user.id)
    checkAchievements(req.user.id)
  }
  res.json({ ok: true })
})

// ─── Статистика пользователя по головоломкам ───
app.get('/api/puzzles/user/stats', auth, (req, res) => {
  const daily = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE user_id=? AND puzzle_type=?').get(req.user.id, 'daily')
  const weekly = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE user_id=? AND puzzle_type=?').get(req.user.id, 'weekly')
  const bank = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE user_id=? AND puzzle_type=?').get(req.user.id, 'bank')
  res.json({
    daily: { attempts: daily?.total || 0, solved: daily?.solved || 0 },
    weekly: { attempts: weekly?.total || 0, solved: weekly?.solved || 0 },
    bank: { attempts: bank?.total || 0, solved: bank?.solved || 0 },
    totalSolved: (daily?.solved || 0) + (weekly?.solved || 0) + (bank?.solved || 0),
  })
})

// ═══ БЛОГ / НОВОСТИ ═══

// Сид начальных постов (только если пусто)
const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
if (blogCount === 0) {
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Snatch Highrise выходит в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\nЧто уже работает:\n- Игра против AI (3 уровня сложности)\n- Онлайн мультиплеер по ссылке\n- Ежедневные и еженедельные головоломки\n- Режим «Тренер» с оценкой каждого хода\n- 4 цветовые темы\n- Print & Play PDF\n\nМы активно собираем обратную связь.',
    'Snatch Highrise enters open beta! An original strategy board game with an AlphaZero-based AI opponent.\n\nWhat\'s already working:\n- Play vs AI (3 difficulty levels)\n- Online multiplayer via link\n- Daily and weekly puzzles\n- Trainer mode with move evaluation\n- 4 color themes\n- Print & Play PDF\n\nWe\'re actively collecting feedback.',
    'release', 0, '2026-02-15 10:00:00')
}

// Добавление постов с датой (если ещё нет)
const addPost = (slug, tru, ten, bru, ben, tag, date) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?,?,?,?,?,?,0,?)').run(slug, tru, ten, bru, ben, tag, date)
}

// ═══ Хронологический порядок (от старых к новым) ═══

addPost('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
  'Нейросеть AI прошла 3 прогона GPU-обучения:\n\n- 1146 итераций self-play\n- Loss снизился до 0.098\n- Винрейт лучшей модели: 97%\n- Баланс P1/P2: 50% / 50%\n\nAI стал заметно сильнее в эндшпиле и лучше оценивает позицию золотой стойки.',
  'The AI neural network completed 3 GPU training runs:\n\n- 1146 self-play iterations\n- Loss dropped to 0.098\n- Best model win rate: 97%\n- P1/P2 balance: 50% / 50%\n\nAI is notably stronger in endgame and better at evaluating the golden stand.',
  'ai', '2026-02-20 14:00:00')

addPost('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
  'Добавлены тактические головоломки!\n\n- Головоломка дня — обновляется каждый день\n- Задача недели — сложнее, обновляется по понедельникам\n- Банк из 50 головоломок с 3 уровнями сложности\n- Лидерборды и статистика решений\n\nЦель — закрыть нужные стойки за ограниченное число ходов.',
  'Tactical puzzles are here!\n\n- Daily puzzle — refreshes every day\n- Weekly challenge — harder, refreshes on Mondays\n- Bank of 50 puzzles with 3 difficulty levels\n- Leaderboards and solve stats\n\nGoal: close the required stands in limited moves.',
  'feature', '2026-03-01 12:00:00')

addPost('update-march-2026', 'v3.0: Масштабное обновление', 'v3.0: Major update',
  '26 ачивок, рейтинговые сезоны, 14 настроек и полная мультиязычность.\n\n**Ачивки** — 26 вместо 14. Бронза, серебро, золото, алмаз.\n**Рейтинговые сезоны** — каждый месяц новый сезон с лидербордом топ-20.\n**14 настроек** — таймер, стиль фишек, доступность.\n**Мультиязычность** — полный перевод RU/EN.',
  '26 achievements, ranked seasons, 14 settings, and full English translation.\n\n**Achievements** — 26 with bronze/silver/gold/diamond tiers.\n**Ranked Seasons** — monthly seasons with top-20 leaderboard.\n**14 Settings** — timer, chip style, accessibility.\n**Multilingual** — full RU/EN translation.',
  'release', '2026-03-15 10:00:00')

addPost('online-v2', 'Онлайн v2: resign, ничья, чат', 'Online v2: resign, draw, chat',
  'Онлайн-режим стал полноценным:\n\n**Сдача партии** — кнопка «Сдаться» через WebSocket.\n**Предложение ничьей** — баннер с «Принять» / «Отклонить».\n**Быстрый чат** — 5 кнопок (gg, gl, nice, wp, !) + свободный текст.\n**Уведомления** — мигающий заголовок когда ваш ход.',
  'Online mode is now fully featured:\n\n**Resign** — instant win for opponent via WebSocket.\n**Draw offer** — banner with Accept/Decline.\n**Quick chat** — 5 preset buttons + free text.\n**Notifications** — blinking title when it\'s your turn.',
  'feature', '2026-03-18 10:00:00')

addPost('admin-panel', 'Админ-панель и безопасность', 'Admin panel & security',
  'Полноценная админ-панель с 9 разделами: обзор с метриками, пользователи, партии, блог, комнаты.\n\nБезопасность: WebSocket аутентификация, серверная валидация, антиспам, CSP.',
  'Full admin panel with 9 sections: overview with metrics, users, games, blog, rooms.\n\nSecurity: WebSocket auth, server validation, anti-spam, CSP.',
  'update', '2026-03-20 10:00:00')

addPost('design-v3', 'Дизайн v3: лендинг и SEO', 'Design v3: landing & SEO',
  'Лендинг с 8 секциями и scroll-анимациями. Шапка с 4 пунктами + «Ещё». Авторизация в хедере.\n\nSEO: OG-теги, JSON-LD, sitemap, robots.txt, PWA-иконки.',
  'Landing with 8 sections and scroll animations. Header with 4 items + "More". Auth in header.\n\nSEO: OG tags, JSON-LD, sitemap, robots.txt, PWA icons.',
  'update', '2026-03-22 10:00:00')

addPost('v3-3-update', 'v3.3: Адаптивка и тема Wood', 'v3.3: Responsive & Wood theme',
  '8 брейкпоинтов вместо 4 — корректно от 340px до 1024px. Тема Wood с текстурой дерева. Три интерактивные схемы правил. Страница Changelog.',
  '8 breakpoints instead of 4 — correct from 340px to 1024px. Wood theme with grain texture. Three interactive rule diagrams. Changelog page.',
  'update', '2026-03-24 10:00:00')

addPost('v3-4-ux', 'v3.4: UX по результатам тестирования', 'v3.4: UX from playtesting',
  'Первое тестирование с реальными игроками:\n\n**Правила** переписаны с нуля (SVG-схемы вместо демо).\n**Стойки перевёрнуты** — фишки растут снизу вверх.\n**Счётчик фишек** — всегда виден, красный при 9+.\n**Призрачный перенос** — видно откуда/куда.\n**Онлайн-баги** исправлены.',
  'First playtest with real users:\n\n**Rules** rewritten from scratch (SVG diagrams).\n**Stands flipped** — chips grow bottom-up.\n**Chip counter** — always visible, red at 9+.\n**Ghost transfer** — visual source/destination.\n**Online bugs** fixed.',
  'release', '2026-03-27 10:00:00')

addPost('v35-gpu', 'v3.5: GPU-нейросеть в браузере', 'v3.5: GPU neural network in browser',
  'ResNet 840K параметров загружается в браузер. Сложность «Экстрим» — 1500 GPU-симуляций. Спектатор-режим. Рематч онлайн. Публичные профили. 200 головоломок. Серверная валидация ходов.',
  'ResNet 840K parameters loads in browser. Extreme difficulty — 1500 GPU simulations. Spectator mode. Online rematch. Public profiles. 200 puzzles. Server-side move validation.',
  'release', '2026-03-30 10:00:00')

addPost('v37-mobile-app', 'v3.7: Мобильное приложение!', 'v3.7: Mobile app is here!',
  'Snatch Highrise теперь на Android!\n\n**Полная адаптация UI** — доска на весь экран, tab bar.\n**Haptic feedback** — вибрация при каждом действии.\n**Offline mode** — AI без интернета.\n**Onboarding** — 4 экрана при первом запуске.\n**Новые логотипы**, Privacy Policy, Share & Rate.',
  'Snatch Highrise is now on Android!\n\n**Full UI adaptation** — board fills screen, tab bar.\n**Haptic feedback** — vibration on every action.\n**Offline mode** — AI without internet.\n**Onboarding** — 4 intro screens.\n**New logos**, Privacy Policy, Share & Rate.',
  'release', '2026-03-31 10:00:00')

addPost('roadmap-2026', 'Планы на 2026', 'Roadmap 2026',
  '✅ Android-приложение\n✅ Haptic + Offline\n✅ GPU-нейросеть 840K\n✅ 200+ головоломок\n✅ 26 ачивок\n\nДалее:\n→ Google Play\n→ Обучение AI на RTX 5090\n→ Push-уведомления\n→ iOS\n→ Турниры',
  '✅ Android app\n✅ Haptic + Offline\n✅ GPU neural net 840K\n✅ 200+ puzzles\n✅ 26 achievements\n\nNext:\n→ Google Play\n→ AI training on RTX 5090\n→ Push notifications\n→ iOS\n→ Tournaments',
  'roadmap', '2026-03-31 18:00:00')

addPost('v38-audit', 'v3.8: Аудит, безопасность, retention', 'v3.8: Audit, security, retention',
  'Полный аудит проекта + новые механики удержания:\n\n**Безопасность**: XSS chat strip, WS rate limit 15/sec, 401 auto-logout, username sanitization.\n**WebP**: все изображения -80% трафика.\n**i18n**: полный перевод Game, Online, Profile, 26 ачивок.\n**AI auto-difficulty**: после 3 поражений подряд — предложение понизить сложность.\n**First Win**: специальное celebration при первой победе.\n**ELO дельта**: +12/-8 отображается после каждой партии.\n**PvP Undo**: кнопка отмены хода.\n**Яндекс.Метрика**: вебвизор + карта кликов.',
  'Full project audit + new retention mechanics:\n\n**Security**: XSS chat strip, WS rate limit 15/sec, 401 auto-logout, username sanitization.\n**WebP**: all images -80% traffic.\n**i18n**: full translation Game, Online, Profile, 26 achievements.\n**AI auto-difficulty**: after 3 losses in a row — suggest easier level.\n**First Win**: special celebration on first victory.\n**ELO delta**: +12/-8 shown after each game.\n**PvP Undo**: undo move button.\n**Yandex Metrika**: webvisor + click map.',
  'release', '2026-03-31 22:00:00')

addPost('v39-retention', 'v3.9: Стрики, миссии, XP, уровни', 'v3.9: Streaks, missions, XP, levels',
  'Пять новых систем удержания:\n\n**Login streak** — серия ежедневных входов с календарём 30 дней. Streak freeze 1 раз в месяц. XP за каждый день (5-50).\n**Daily missions** — 3 задания в день из пула 8 (сыграй, победи, реши). XP за каждое + бонус 100 XP за все три.\n**XP / Level** — уровни 1-50. Прогресс-бар в профиле. XP за победы (20), поражения (5), миссии, стрики.\n**AI auto-difficulty** — после 3 поражений кнопка «Попробовать полегче?».\n**First Win** — celebration при первой победе в жизни.\n\nLayout расширен до 1200px для больших мониторов.',
  'Five new retention systems:\n\n**Login streak** — daily login streak with 30-day calendar. Streak freeze 1/month. XP for each day (5-50).\n**Daily missions** — 3 per day from pool of 8 (play, win, solve). XP each + 100 XP bonus for all three.\n**XP / Level** — levels 1-50. Progress bar in profile. XP for wins (20), losses (5), missions, streaks.\n**AI auto-difficulty** — after 3 losses suggests easier level.\n**First Win** — celebration on first ever victory.\n\nLayout widened to 1200px for large monitors.',
  'release', '2026-03-31 23:00:00')

addPost('v40-platform', 'v4.0: Competitive Platform', 'v4.0: Competitive Platform',
  'Пять новых режимов превращают Snatch Highrise в полноценную игровую платформу:\n\n**AI Game Review** — после каждой партии AI анализирует все ходы: отличный / хороший / ошибка / грубая ошибка. Итоговая accuracy % и replay с цветовой подсветкой.\n**Puzzle Rush** — 3 минуты, максимум головоломок. +10 сек за правильную, -15 за ошибку. Leaderboard.\n**Live Arena** — турниры Swiss system: 4 раунда, автоматический pairing по очкам, live таблица, XP для топ-3.\n**5 интерактивных уроков** — от основ до стратегии. Интерактивная доска, XP за каждый пройденный.\n**Animated board** — screen shake при закрытии, 3D perspective, золотая пульсация.',
  'Five new modes turn Snatch Highrise into a full competitive platform:\n\n**AI Game Review** — after every game, AI analyzes each move: excellent / good / mistake / blunder. Accuracy % and color-coded replay.\n**Puzzle Rush** — 3 minutes, max puzzles. +10 sec correct, -15 wrong. Leaderboard.\n**Live Arena** — Swiss system tournaments: 4 rounds, auto-pairing by score, live standings, XP for top 3.\n**5 interactive lessons** — from basics to strategy. Interactive board, XP for each completed.\n**Animated board** — screen shake on close, 3D perspective, golden pulse.',
  'release', '2026-04-01 00:00:00')

// Удаляем устаревший roadmap и дубли
db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()

// Закрепляем только v4.0 наверху
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v40-platform'").run()
// Удаляем дубли старых постов
db.prepare("DELETE FROM blog_posts WHERE slug='v3-5-gpu-neural-extreme'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v3-4-security-spectator'").run()

// Принудительное обновление всех постов (даты, заголовки, тексты)
const updatePost = (slug, tru, ten, bru, ben, tag, date) => {
  const existing = db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug)
  if (existing) {
    db.prepare('UPDATE blog_posts SET title_ru=?, title_en=?, body_ru=?, body_en=?, tag=?, created_at=?, updated_at=datetime(?) WHERE slug=?')
      .run(tru, ten, bru, ben, tag, date, date, slug)
  }
}
updatePost('launch', 'Запуск открытой беты', 'Open beta launch',
  'Snatch Highrise выходит в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\n- Игра против AI (3 уровня)\n- Онлайн мультиплеер\n- Головоломки дня/недели\n- Режим «Тренер»\n- 4 темы\n- Print & Play PDF',
  'Snatch Highrise enters open beta! Original strategy board game with AlphaZero AI.\n\n- Play vs AI (3 levels)\n- Online multiplayer\n- Daily/weekly puzzles\n- Trainer mode\n- 4 themes\n- Print & Play PDF',
  'release', '2026-02-15 10:00:00')
updatePost('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
  'Нейросеть прошла 3 прогона GPU-обучения:\n\n- 1146 итераций self-play\n- Loss: 0.098\n- Winrate: 97%\n- Баланс P1/P2: 50/50',
  'Neural network completed 3 GPU training runs:\n\n- 1146 self-play iterations\n- Loss: 0.098\n- Win rate: 97%\n- P1/P2 balance: 50/50',
  'ai', '2026-02-20 14:00:00')
updatePost('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
  'Тактические головоломки:\n\n- Головоломка дня\n- Задача недели\n- Банк из 50 задач\n- Лидерборды',
  'Tactical puzzles:\n\n- Daily puzzle\n- Weekly challenge\n- 50 puzzle bank\n- Leaderboards',
  'feature', '2026-03-01 12:00:00')
updatePost('v40-platform', 'v4.0: Competitive Platform', 'v4.0: Competitive Platform',
  'Snatch Highrise v4.0 — полноценная игровая платформа:\n\n**AI Game Review** — анализ каждого хода. Accuracy %, replay с подсветкой.\n**Puzzle Rush** — 3 минуты, +10/-15 сек. Leaderboard.\n**Live Arena** — Swiss турниры, 4 раунда, XP для топ-3.\n**5 уроков** — от основ до стратегии.\n**Магазин скинов** — popup с live preview, level-locked.\n**11 тем** — Dark, Ocean, Sunset, Forest, Royal, Sakura, Neon, Wood, Arctic, Retro, Light.\n**8 скинов фишек** — Classic, Flat, Round, Glass, Metal, Candy, Pixel, Glow.\n**9 скинов стоек** — Classic, Marble, Concrete, Bamboo, Obsidian, Crystal, Rust, Void, Ice.\n**Анимации** — screen shake, 3D perspective, golden pulse.',
  'Snatch Highrise v4.0 — full competitive platform:\n\n**AI Game Review** — analyze every move. Accuracy %, color-coded replay.\n**Puzzle Rush** — 3 min, +10/-15 sec. Leaderboard.\n**Live Arena** — Swiss tournaments, 4 rounds, XP for top 3.\n**5 lessons** — basics to strategy.\n**Skin Shop** — popup with live preview, level-locked.\n**11 themes** — Dark, Ocean, Sunset, Forest, Royal, Sakura, Neon, Wood, Arctic, Retro, Light.\n**8 chip skins** — Classic, Flat, Round, Glass, Metal, Candy, Pixel, Glow.\n**9 stand skins** — Classic, Marble, Concrete, Bamboo, Obsidian, Crystal, Rust, Void, Ice.\n**Animations** — screen shake, 3D perspective, golden pulse.',
  'release', '2026-04-01 00:00:00')
updatePost('v41-polish', 'v4.1: UI Polish & 11 тем', 'v4.1: UI Polish & 11 themes',
  'Визуальная полировка всего интерфейса:\n\n**2 новые темы** — Sakura (вишнёвая) и Retro (CRT терминал). Arctic переписана как тёмно-ледяная.\n**Визуальный SkinShop** — мини-доска для превью тем, стопки фишек и текстурированные стойки.\n**Профиль** — градиентный header, level badge, XP bar с glow, SVG checkmarks.\n**Скины** — обновлённые текстуры: Glass с border+backdrop, Metal 5-stop chrome, Candy 3D, Glow triple layer.\n**Формы** — стилизованные input/select с focus-ring, кастомный scrollbar.\n**Все цвета** → CSS vars. Все 11 тем полностью theme-aware.',
  'Visual polish of the entire interface:\n\n**2 new themes** — Sakura (cherry blossom) and Retro (CRT terminal). Arctic rewritten as dark icy.\n**Visual SkinShop** — mini-board for theme preview, chip stacks, textured stands.\n**Profile** — gradient header, level badge, XP bar with glow, SVG checkmarks.\n**Skins** — updated textures: Glass with border+backdrop, Metal 5-stop chrome, Candy 3D, Glow triple layer.\n**Forms** — styled input/select with focus-ring, custom scrollbar.\n**All colors** → CSS vars. All 11 themes fully theme-aware.',
  'release', '2026-04-01 12:00:00')

// Pin только v4.1
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v41-polish'").run()

updatePost('roadmap-2026', 'Планы на 2026', 'Roadmap 2026',
  '✅ Android-приложение\n✅ GPU-нейросеть 840K\n✅ AI Game Review\n✅ Puzzle Rush\n✅ Live Arena\n✅ 5 уроков\n✅ 11 тем + 8 скинов фишек + 9 скинов стоек\n✅ Магазин скинов с level-unlock\n✅ Login streak + missions + XP\n✅ 33 ачивки\n✅ i18n RU/EN\n\nДалее:\n→ Google Play\n→ Push-уведомления\n→ AI v4 (RTX 5090)\n→ iOS',
  '✅ Android app\n✅ GPU neural net 840K\n✅ AI Game Review\n✅ Puzzle Rush\n✅ Live Arena\n✅ 5 lessons\n✅ 11 themes + 8 chip skins + 9 stand skins\n✅ Skin Shop with level-unlock\n✅ Login streak + missions + XP\n✅ 33 achievements\n✅ i18n RU/EN\n\nNext:\n→ Google Play\n→ Push notifications\n→ AI v4 (RTX 5090)\n→ iOS',
  'roadmap', '2026-04-01 01:00:00')

// Получить посты
app.get('/api/blog', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 10
  const offset = (page - 1) * perPage
  const posts = db.prepare('SELECT id, slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at FROM blog_posts WHERE published=1 ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?').all(perPage, offset)
  const total = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE published=1').get().c
  res.json({ posts, total, page, pages: Math.ceil(total / perPage) })
})

// Отдельный пост
app.get('/api/blog/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug=? AND published=1').get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Пост не найден' })
  res.json(post)
})

// Создание поста (только админ)
app.post('/api/blog', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { slug, title_ru, title_en, body_ru, body_en, tag, pinned } = req.body
  if (!slug || !title_ru || !body_ru) return res.status(400).json({ error: 'slug, title_ru, body_ru обязательны' })
  try {
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(slug, title_ru, title_en || '', body_ru, body_en || '', tag || 'update', pinned ? 1 : 0)
    res.json({ ok: true })
  } catch (e) { res.status(409).json({ error: 'Slug уже существует' }) }
})

// Обновление поста (только админ)
app.put('/api/blog/:slug', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { title_ru, title_en, body_ru, body_en, tag, pinned, published } = req.body
  db.prepare('UPDATE blog_posts SET title_ru=COALESCE(?,title_ru), title_en=COALESCE(?,title_en), body_ru=COALESCE(?,body_ru), body_en=COALESCE(?,body_en), tag=COALESCE(?,tag), pinned=COALESCE(?,pinned), published=COALESCE(?,published), updated_at=datetime(\'now\') WHERE slug=?')
    .run(title_ru, title_en, body_ru, body_en, tag, pinned, published, req.params.slug)
  res.json({ ok: true })
})

// ═══ ROOMS (REST API для создания) ═══
const rooms = new Map()
const matchQueue = [] // [{ ws, name }]

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

app.post('/api/rooms', rateLimit(60000, 10), (req, res) => {
  const { name, mode } = req.body // mode: 'single' | 'tournament3' | 'tournament5'
  let id = generateRoomId()
  while (rooms.has(id)) id = generateRoomId()
  rooms.set(id, {
    id, created: Date.now(), mode: mode || 'single',
    totalGames: mode === 'tournament5' ? 5 : mode === 'tournament3' ? 3 : 1,
    currentGame: 0, scores: [0, 0],
    players: [], state: 'waiting', game: null,
  })
  // Автоудаление через 30 мин
  setTimeout(() => rooms.delete(id), 30 * 60 * 1000)
  res.json({ roomId: id })
})

// Список активных комнат (для спектатора)
app.get('/api/rooms/active', (req, res) => {
  const active = []
  for (const [id, room] of rooms) {
    if (room.state === 'playing' && room.players.length === 2) {
      active.push({
        id: room.id,
        players: room.players.map(p => p.name),
        scores: room.scores,
        turn: room.gameState?.turn || 0,
        spectators: (room.spectators || []).filter(s => s.readyState === 1).length,
      })
    }
  }
  res.json(active)
})

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Комната не найдена' })
  res.json({ id: room.id, mode: room.mode, players: room.players.map(p => p.name), state: room.state, scores: room.scores, totalGames: room.totalGames, currentGame: room.currentGame })
})

// ═══ WebSocket (модуль ws.js) ═══
const { server } = setupWebSocket(app, { JWT_SECRET, rooms, matchQueue })

// ═══ AVATARS ═══
app.put('/api/profile/avatar', auth, (req, res) => {
  const { avatar } = req.body
  const valid = ['default','cat','dog','fox','bear','owl','robot','crown','fire','star','diamond','ghost']
  if (!valid.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' })
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, req.user.id)
  res.json({ avatar })
})

// ═══ OPENING STATS (какой первый ход чаще побеждает) ═══
app.get('/api/profile/opening-stats', auth, (req, res) => {
  const games = db.prepare('SELECT game_data FROM training_data WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  // Простая статистика: сколько раз каждая стойка использовалась первым ходом
  const standCounts = {}
  const standWins = {}
  for (const g of games) {
    try {
      const data = JSON.parse(g.game_data)
      if (data.moves && data.moves[0]) {
        const firstStand = data.moves[0].stand ?? data.moves[0].placement?.[0]
        if (firstStand !== undefined) {
          standCounts[firstStand] = (standCounts[firstStand] || 0) + 1
          if (data.winner === 0) standWins[firstStand] = (standWins[firstStand] || 0) + 1
        }
      }
    } catch {}
  }
  res.json({ total: games.length, standCounts, standWins })
})

// ═══ ADMIN API ═══

// Обзор — живые данные из БД
app.get('/api/admin/overview', auth, adminOnly, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE last_seen > datetime('now', '-7 days')").get().c
  const todayUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE last_seen > datetime('now', '-1 day')").get().c
  const totalGames = db.prepare('SELECT COUNT(*) as c FROM games').get().c
  const todayGames = db.prepare("SELECT COUNT(*) as c FROM games WHERE played_at > datetime('now', '-1 day')").get().c
  const weekGames = db.prepare("SELECT COUNT(*) as c FROM games WHERE played_at > datetime('now', '-7 days')").get().c
  const onlineGames = db.prepare('SELECT COUNT(*) as c FROM games WHERE is_online=1').get().c
  const avgRating = Math.round(db.prepare('SELECT AVG(rating) as a FROM users WHERE games_played > 0').get().a || 1000)
  const maxRating = db.prepare('SELECT MAX(rating) as m FROM users').get().m || 1000
  const totalTraining = db.prepare('SELECT COUNT(*) as c FROM training_data').get().c
  const totalPuzzles = db.prepare('SELECT COUNT(*) as c FROM puzzle_results').get().c
  const solvedPuzzles = db.prepare('SELECT COUNT(*) as c FROM puzzle_results WHERE solved=1').get().c
  const blogPosts = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
  const totalAchievements = db.prepare('SELECT COUNT(*) as c FROM achievements').get().c

  // Регистрации по дням (30 дней)
  const regByDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count 
    FROM users WHERE created_at > datetime('now', '-30 days') 
    GROUP BY day ORDER BY day
  `).all()

  // Партии по дням (30 дней)
  const gamesByDay = db.prepare(`
    SELECT date(played_at) as day, COUNT(*) as count 
    FROM games WHERE played_at > datetime('now', '-30 days') 
    GROUP BY day ORDER BY day
  `).all()

  // Топ-5 рейтинг
  const topPlayers = db.prepare('SELECT username, rating, games_played, wins FROM users ORDER BY rating DESC LIMIT 5').all()

  res.json({
    users: { total: totalUsers, active7d: activeUsers, today: todayUsers },
    games: { total: totalGames, today: todayGames, week: weekGames, online: onlineGames },
    rating: { avg: avgRating, max: maxRating },
    training: totalTraining,
    puzzles: { total: totalPuzzles, solved: solvedPuzzles },
    blog: blogPosts,
    achievements: totalAchievements,
    rooms: rooms.size,
    matchQueue: matchQueue.length,
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    charts: { regByDay, gamesByDay },
    topPlayers,
  })
})

// Пользователи — список с пагинацией и поиском
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const page = Math.max(1, +req.query.page || 1)
  const limit = Math.min(+req.query.limit || 30, 100)
  const offset = (page - 1) * limit
  const search = req.query.q || ''
  const sort = ['rating', 'games_played', 'created_at', 'last_seen', 'username'].includes(req.query.sort) ? req.query.sort : 'created_at'
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC'

  let where = '1=1'
  const params = []
  if (search) {
    where = "username LIKE ? ESCAPE '\\'"
    params.push(`%${search.replace(/[%_]/g, '\\$&')}%`)
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c
  const users = db.prepare(`SELECT id, username, email, rating, games_played, wins, losses, 
    win_streak, best_streak, golden_closed, comebacks, perfect_wins, beat_hard_ai,
    fast_wins, online_wins, puzzles_solved, avatar, is_admin, created_at, last_seen
    FROM users WHERE ${where} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`).all(...params, limit, offset)

  res.json({ users, total, page, pages: Math.ceil(total / limit) })
})

// Пользователь — детали
app.get('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Не найден' })
  const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=?').all(user.id)
  const recentGames = db.prepare('SELECT * FROM games WHERE user_id=? ORDER BY played_at DESC LIMIT 20').all(user.id)
  const ratingHistory = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(user.id)
  res.json({ user: formatUser(user), achievements, recentGames, ratingHistory })
})

// Пользователь — редактирование
app.put('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const { rating, is_admin, username, reset_password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Не найден' })

  if (rating !== undefined) db.prepare('UPDATE users SET rating=? WHERE id=?').run(Math.max(100, Math.min(2500, +rating)), user.id)
  if (is_admin !== undefined) db.prepare('UPDATE users SET is_admin=? WHERE id=?').run(is_admin ? 1 : 0, user.id)
  if (username) db.prepare('UPDATE users SET username=? WHERE id=?').run(username, user.id)
  if (reset_password) {
    const hash = bcrypt.hashSync(reset_password, 10)
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id)
  }

  res.json({ ok: true })
})

// Пользователь — удаление
app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const id = +req.params.id
  if (id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' })
  db.prepare('DELETE FROM achievements WHERE user_id=?').run(id)
  db.prepare('DELETE FROM games WHERE user_id=?').run(id)
  db.prepare('DELETE FROM friends WHERE user_id=? OR friend_id=?').run(id, id)
  db.prepare('DELETE FROM training_data WHERE user_id=?').run(id)
  db.prepare('DELETE FROM rating_history WHERE user_id=?').run(id)
  db.prepare('DELETE FROM season_ratings WHERE user_id=?').run(id)
  db.prepare('DELETE FROM daily_results WHERE user_id=?').run(id)
  db.prepare('DELETE FROM puzzle_results WHERE user_id=?').run(id)
  db.prepare('DELETE FROM users WHERE id=?').run(id)
  res.json({ ok: true })
})

// Партии — список
app.get('/api/admin/games', auth, adminOnly, (req, res) => {
  const page = Math.max(1, +req.query.page || 1)
  const limit = Math.min(+req.query.limit || 30, 100)
  const offset = (page - 1) * limit
  const mode = req.query.mode || ''

  let where = '1=1'
  const params = []
  if (mode) { where += ' AND g.mode=?'; params.push(mode) }

  const total = db.prepare(`SELECT COUNT(*) as c FROM games g WHERE ${where}`).get(...params).c
  const games = db.prepare(`SELECT g.*, u.username FROM games g JOIN users u ON u.id=g.user_id 
    WHERE ${where} ORDER BY g.played_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)

  res.json({ games, total, page, pages: Math.ceil(total / limit) })
})

// Блог — полный список (включая неопубликованные)
app.get('/api/admin/blog', auth, adminOnly, (req, res) => {
  const posts = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all()
  res.json(posts)
})

// Блог — удаление
app.delete('/api/admin/blog/:slug', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE slug=?').run(req.params.slug)
  res.json({ ok: true })
})

// Сезоны — управление
app.get('/api/admin/seasons', auth, adminOnly, (req, res) => {
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all()
  res.json(seasons)
})

app.put('/api/admin/seasons/:id', auth, adminOnly, (req, res) => {
  const { active, name } = req.body
  if (active !== undefined) db.prepare('UPDATE seasons SET active=? WHERE id=?').run(active ? 1 : 0, req.params.id)
  if (name) db.prepare('UPDATE seasons SET name=? WHERE id=?').run(name, req.params.id)
  res.json({ ok: true })
})

// Ачивки — статистика
app.get('/api/admin/achievements', auth, adminOnly, (req, res) => {
  const stats = db.prepare(`
    SELECT achievement_id, COUNT(*) as count,
    MIN(unlocked_at) as first_unlock, MAX(unlocked_at) as last_unlock
    FROM achievements GROUP BY achievement_id ORDER BY count DESC
  `).all()
  res.json(stats)
})

// Обучающие данные — статистика и управление
app.get('/api/admin/training', auth, adminOnly, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM training_data').get().c
  const byMode = db.prepare('SELECT mode, COUNT(*) as count, AVG(total_moves) as avgMoves FROM training_data GROUP BY mode').all()
  const byDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM training_data WHERE created_at > datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all()
  const sizeMB = db.prepare("SELECT SUM(LENGTH(game_data)) as s FROM training_data").get().s
  res.json({ total, byMode, byDay, sizeMB: Math.round((sizeMB || 0) / 1024 / 1024 * 100) / 100 })
})

// Обучающие данные — очистка старых
app.delete('/api/admin/training', auth, adminOnly, (req, res) => {
  const days = Math.max(1, Math.min(365, Math.floor(+req.query.olderThan || 90)))
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const result = db.prepare('DELETE FROM training_data WHERE created_at < ?').run(cutoff)
  res.json({ deleted: result.changes })
})

// Активные комнаты и очередь
app.get('/api/admin/rooms', auth, adminOnly, (req, res) => {
  const active = []
  for (const [id, room] of rooms) {
    active.push({
      id, mode: room.mode, state: room.state,
      players: room.players.map(p => p.name),
      scores: room.scores, currentGame: room.currentGame,
      totalGames: room.totalGames,
      ageMin: Math.round((Date.now() - room.created) / 60000),
    })
  }
  res.json({ rooms: active, queueLength: matchQueue.length })
})

// Серверные логи/инфо
app.get('/api/admin/server', auth, adminOnly, (req, res) => {
  const mem = process.memoryUsage()
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get()
  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    db: {
      sizeMB: Math.round((dbSize?.size || 0) / 1024 / 1024 * 100) / 100,
      walMode: db.pragma('journal_mode')[0]?.journal_mode,
    },
    rooms: rooms.size,
    matchQueue: matchQueue.length,
    rateLimitEntries: rateLimits.size,
    pid: process.pid,
  })
})

// ═══ КОНТЕНТ (CMS) ═══

// Получить весь контент (публичный, кешируется)
app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, section, value_ru, value_en FROM site_content ORDER BY section, key').all()
  const content = {}
  for (const row of rows) {
    content[row.key] = { ru: row.value_ru, en: row.value_en }
  }
  res.set('Cache-Control', 'public, max-age=60')
  res.json(content)
})

// Админ: получить весь контент с метаданными
app.get('/api/admin/content', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM site_content ORDER BY section, key').all()
  res.json(rows)
})

// Админ: обновить один ключ
app.put('/api/admin/content/:key', auth, adminOnly, (req, res) => {
  const { value_ru, value_en } = req.body
  const existing = db.prepare('SELECT key FROM site_content WHERE key=?').get(req.params.key)
  if (!existing) return res.status(404).json({ error: 'Ключ не найден' })
  db.prepare("UPDATE site_content SET value_ru=?, value_en=?, updated_at=datetime('now') WHERE key=?")
    .run(value_ru ?? '', value_en ?? '', req.params.key)
  res.json({ ok: true })
})

// Админ: добавить новый ключ
app.post('/api/admin/content', auth, adminOnly, (req, res) => {
  const { key, section, value_ru, value_en, label } = req.body
  if (!key) return res.status(400).json({ error: 'key обязателен' })
  try {
    db.prepare('INSERT INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
      .run(key, section || 'general', value_ru || '', value_en || '', label || '')
    res.json({ ok: true })
  } catch (e) { res.status(409).json({ error: 'Ключ уже существует' }) }
})

// Админ: удалить ключ
app.delete('/api/admin/content/:key', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM site_content WHERE key=?').run(req.params.key)
  res.json({ ok: true })
})

// Админ: массовый импорт (i18n ключей)
app.post('/api/admin/content/bulk', auth, adminOnly, (req, res) => {
  const { items } = req.body // [{ key, section, value_ru, value_en, label }]
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items обязателен' })
  const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
  let added = 0
  for (const item of items) {
    const r = ins.run(item.key, item.section || 'i18n', item.value_ru || '', item.value_en || '', item.label || '')
    if (r.changes > 0) added++
  }
  res.json({ ok: true, added, total: items.length })
})

// ═══ Старт ═══
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Snatch Highrise API + WS: http://0.0.0.0:${PORT}`)
  console.log(`   WebSocket: ws://0.0.0.0:${PORT}/ws`)
  console.log(`   Health: http://0.0.0.0:${PORT}/api/health`)
})
