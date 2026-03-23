import express from 'express'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import helmet from 'helmet'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// ═══ Загрузка .env ═══
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim()
  }
}

// ═══ Конфиг ═══
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'stolbiki_dev_secret'
const DB_PATH = process.env.DB_PATH || './data/stolbiki.db'

// Создаём директорию для БД
const dbDir = dirname(resolve(DB_PATH))
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

// ═══ База данных ═══
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    rating INTEGER DEFAULT 1000,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    golden_closed INTEGER DEFAULT 0,
    comebacks INTEGER DEFAULT 0,
    perfect_wins INTEGER DEFAULT 0,
    beat_hard_ai INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, achievement_id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    won INTEGER NOT NULL,
    score TEXT NOT NULL,
    rating_before INTEGER,
    rating_after INTEGER,
    rating_delta INTEGER,
    difficulty INTEGER,
    closed_golden INTEGER DEFAULT 0,
    is_comeback INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'ai',
    turns INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    played_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    game_data TEXT NOT NULL,
    winner INTEGER,
    total_moves INTEGER,
    mode TEXT,
    difficulty INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id, played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
`)

console.log('База данных готова:', DB_PATH)

// ═══ Ачивки ═══
const ALL_ACHIEVEMENTS = [
  { id: 'first_win', check: u => u.wins >= 1 },
  { id: 'streak_3', check: u => u.best_streak >= 3 },
  { id: 'streak_5', check: u => u.best_streak >= 5 },
  { id: 'streak_10', check: u => u.best_streak >= 10 },
  { id: 'golden_1', check: u => u.golden_closed >= 1 },
  { id: 'golden_10', check: u => u.golden_closed >= 10 },
  { id: 'comeback', check: u => u.comebacks >= 1 },
  { id: 'games_10', check: u => u.games_played >= 10 },
  { id: 'games_50', check: u => u.games_played >= 50 },
  { id: 'games_100', check: u => u.games_played >= 100 },
  { id: 'rating_1200', check: u => u.rating >= 1200 },
  { id: 'rating_1500', check: u => u.rating >= 1500 },
  { id: 'beat_hard', check: u => u.beat_hard_ai },
  { id: 'perfect', check: u => u.perfect_wins >= 1 },
]

function checkAchievements(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return []
  const existing = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(userId).map(a => a.achievement_id)
  const newAch = []
  const insert = db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)')
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!existing.includes(ach.id) && ach.check(user)) {
      insert.run(userId, ach.id)
      newAch.push(ach.id)
    }
  }
  return newAch
}

// ═══ Middleware ═══
const app = express()
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '5mb' }))

// JWT auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // Обновляем last_seen
    db.prepare('UPDATE users SET last_seen = datetime("now") WHERE id = ?').run(req.user.id)
    next()
  } catch {
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
  if (!username || !password) return res.status(400).json({ error: 'Нужны username и password' })
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'Ник: 2-20 символов' })
  if (password.length < 4) return res.status(400).json({ error: 'Пароль: мин 4 символа' })

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return res.status(409).json({ error: 'Ник занят' })

  const hash = bcrypt.hashSync(password, 10)
  const adminNames = ['admin']
  const isAdmin = adminNames.includes(username) ? 1 : 0

  const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(username, email || null, hash, isAdmin)
  const token = jwt.sign({ id: result.lastInsertRowid, username, isAdmin: !!isAdmin }, JWT_SECRET, { expiresIn: '30d' })

  res.json({ token, user: { id: result.lastInsertRowid, username, rating: 1000, isAdmin: !!isAdmin } })
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
  res.json({ ...formatUser(user), achievements })
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
    isAdmin: !!u.is_admin, createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

// ═══ GAMES ═══
app.post('/api/games', auth, (req, res) => {
  const { won, score, difficulty, closedGolden, isComeback, turns, duration } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })

  const ratingBefore = user.rating
  let ratingDelta = won ? 25 : -15
  // Сложность влияет на рейтинг
  if (difficulty >= 100) ratingDelta = won ? 35 : -10
  else if (difficulty <= 20) ratingDelta = won ? 15 : -20

  const ratingAfter = Math.max(100, Math.min(2500, ratingBefore + ratingDelta))
  const newStreak = won ? user.win_streak + 1 : 0
  const bestStreak = Math.max(user.best_streak, newStreak)

  // Обновляем пользователя
  db.prepare(`UPDATE users SET
    rating = ?, games_played = games_played + 1,
    wins = wins + ?, losses = losses + ?,
    win_streak = ?, best_streak = ?,
    golden_closed = golden_closed + ?,
    comebacks = comebacks + ?,
    perfect_wins = perfect_wins + ?,
    beat_hard_ai = CASE WHEN ? THEN 1 ELSE beat_hard_ai END
    WHERE id = ?`
  ).run(
    ratingAfter, won ? 1 : 0, won ? 0 : 1,
    newStreak, bestStreak,
    closedGolden ? 1 : 0, isComeback ? 1 : 0,
    score === '6:0' && won ? 1 : 0,
    difficulty >= 100 && won ? 1 : 0,
    req.user.id
  )

  // Записываем партию
  db.prepare(`INSERT INTO games (user_id, won, score, rating_before, rating_after, rating_delta, difficulty, closed_golden, is_comeback, turns, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, won ? 1 : 0, score, ratingBefore, ratingAfter, ratingDelta, difficulty || 50, closedGolden ? 1 : 0, isComeback ? 1 : 0, turns || 0, duration || 0)

  // Ачивки
  const newAch = checkAchievements(req.user.id)

  res.json({ ratingBefore, ratingAfter, ratingDelta, newAchievements: newAch })
})

app.get('/api/games', auth, (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 50)
  const games = db.prepare('SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ?').all(req.user.id, limit)
  res.json(games)
})

// ═══ LEADERBOARD ═══
app.get('/api/leaderboard', (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 100)
  const users = db.prepare('SELECT id, username, rating, games_played, wins, losses, best_streak FROM users ORDER BY rating DESC LIMIT ?').all(limit)
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
    .run(req.user.id, JSON.stringify(gameData), winner, totalMoves || 0, mode || 'ai', difficulty || 50)
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

// ═══ SEARCH ═══
app.get('/api/users/search', auth, (req, res) => {
  const q = req.query.q
  if (!q || q.length < 2) return res.json([])
  const users = db.prepare('SELECT id, username, rating FROM users WHERE username LIKE ? AND id != ? LIMIT 10').all(`%${q}%`, req.user.id)
  res.json(users)
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
  res.json({ status: 'ok', uptime: process.uptime(), users: db.prepare('SELECT COUNT(*) as c FROM users').get().c })
})

// ═══ Старт ═══
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Стойки API: http://0.0.0.0:${PORT}`)
  console.log(`   Health: http://0.0.0.0:${PORT}/api/health`)
  console.log(`   JWT_SECRET: ${JWT_SECRET.substring(0, 10)}...`)
})
