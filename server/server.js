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

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_ru TEXT NOT NULL,
    title_en TEXT,
    body_ru TEXT NOT NULL,
    body_en TEXT,
    tag TEXT DEFAULT 'update',
    pinned INTEGER DEFAULT 0,
    published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id, played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, created_at DESC);

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS season_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    rating INTEGER DEFAULT 1000,
    games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    UNIQUE(user_id, season_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id)
  );

  CREATE TABLE IF NOT EXISTS rating_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    game_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

console.log('База данных готова:', DB_PATH)

// ═══ Ачивки ═══
const ALL_ACHIEVEMENTS = [
  // Оригинальные 14
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
  // Новые 12
  { id: 'streak_20', check: u => u.best_streak >= 20 },
  { id: 'games_500', check: u => u.games_played >= 500 },
  { id: 'golden_50', check: u => u.golden_closed >= 50 },
  { id: 'comeback_5', check: u => u.comebacks >= 5 },
  { id: 'perfect_3', check: u => u.perfect_wins >= 3 },
  { id: 'rating_1800', check: u => u.rating >= 1800 },
  { id: 'rating_2000', check: u => u.rating >= 2000 },
  { id: 'fast_win', check: u => (u.fast_wins || 0) >= 1 },
  { id: 'fast_win_5', check: u => (u.fast_wins || 0) >= 5 },
  { id: 'online_win', check: u => (u.online_wins || 0) >= 1 },
  { id: 'online_10', check: u => (u.online_wins || 0) >= 10 },
  { id: 'puzzle_10', check: u => (u.puzzles_solved || 0) >= 10 },
]

// Добавляем новые колонки (безопасно — если уже есть, не упадёт)
try { db.exec('ALTER TABLE users ADD COLUMN fast_wins INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN online_wins INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN puzzles_solved INTEGER DEFAULT 0') } catch {}

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
// Чистка каждые 5 минут
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimits) { if (now - v.start > 120000) rateLimits.delete(k) }
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
    fastWins: u.fast_wins || 0, onlineWins: u.online_wins || 0,
    puzzlesSolved: u.puzzles_solved || 0,
    isAdmin: !!u.is_admin, createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

// ═══ GAMES ═══
app.post('/api/games', auth, (req, res) => {
  const { won, score, difficulty, closedGolden, isComeback, turns, duration, isOnline } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })

  const ratingBefore = user.rating
  let ratingDelta = won ? 25 : -15
  if (difficulty >= 100) ratingDelta = won ? 35 : -10
  else if (difficulty <= 20) ratingDelta = won ? 15 : -20

  const ratingAfter = Math.max(100, Math.min(2500, ratingBefore + ratingDelta))
  const newStreak = won ? user.win_streak + 1 : 0
  const bestStreak = Math.max(user.best_streak, newStreak)
  const isFastWin = won && turns && turns <= 10

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
    difficulty >= 100 && won ? 1 : 0,
    isFastWin ? 1 : 0,
    isOnline && won ? 1 : 0,
    req.user.id
  )

  // Записываем партию
  const gameResult = db.prepare(`INSERT INTO games (user_id, won, score, rating_before, rating_after, rating_delta, difficulty, closed_golden, is_comeback, turns, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, won ? 1 : 0, score, ratingBefore, ratingAfter, ratingDelta, difficulty || 50, closedGolden ? 1 : 0, isComeback ? 1 : 0, turns || 0, duration || 0)

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

  res.json({ ratingBefore, ratingAfter, ratingDelta, newAchievements: newAch })
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

// Таблица daily
db.exec(`CREATE TABLE IF NOT EXISTS daily_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, username TEXT, seed TEXT,
  turns INTEGER, duration INTEGER, won INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, seed)
)`)

// ═══ Таблицы головоломок ═══
db.exec(`
  CREATE TABLE IF NOT EXISTS puzzle_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, username TEXT,
    puzzle_type TEXT NOT NULL,
    puzzle_id TEXT NOT NULL,
    solved INTEGER DEFAULT 0,
    moves_used INTEGER,
    duration INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, puzzle_type, puzzle_id)
  )
`)

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

// ─── Weekly puzzle (новая каждую неделю, сложнее) ───
app.get('/api/puzzles/weekly', (req, res) => {
  const d = new Date()
  const weekNum = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000)
  const seed = `weekly-${d.getFullYear()}-W${weekNum}`
  const puzzle = generatePuzzle(seed, 3)
  puzzle.type = 'weekly'
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('weekly', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('weekly', seed)
  res.json(puzzle)
})

// ─── Банк головоломок (50 штук, статичные) ───
app.get('/api/puzzles/bank', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 12
  const diff = parseInt(req.query.difficulty) || 0
  
  const puzzles = []
  const total = 50
  const start = (page - 1) * perPage
  
  for (let i = start; i < Math.min(start + perPage, total); i++) {
    const seed = `bank-${i}`
    const difficulty = i < 15 ? 1 : i < 35 ? 2 : 3
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
  const difficulty = type === 'weekly' ? 3 : type === 'daily' ? 2 : (parseInt(id) < 15 ? 1 : parseInt(id) < 35 ? 2 : 3)
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
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Стойки выходят в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\nЧто уже работает:\n- Игра против AI (3 уровня сложности)\n- Онлайн мультиплеер по ссылке\n- Ежедневные и еженедельные головоломки\n- Режим «Тренер» с оценкой каждого хода\n- 4 цветовые темы\n- Print & Play PDF\n\nМы активно собираем обратную связь. Нашли баг или есть идея? Пишите в профиле.',
    'Stacks enters open beta! An original strategy board game with an AlphaZero-based AI opponent.\n\nWhat\'s already working:\n- Play vs AI (3 difficulty levels)\n- Online multiplayer via link\n- Daily and weekly puzzles\n- Trainer mode with move evaluation\n- 4 color themes\n- Print & Play PDF\n\nWe\'re actively collecting feedback. Found a bug or have an idea? Let us know via your profile.',
    'release', 1)
  seed.run('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
    'Нейросеть AI прошла 3 прогона GPU-обучения. Результаты:\n\n- 1146 итераций self-play\n- Loss снизился до 0.098\n- Винрейт лучшей модели: 97%\n- Баланс P1/P2: 52% / 48%\n\nAI стал заметно сильнее в эндшпиле и лучше оценивает позицию золотой стойки.',
    'The AI neural network completed 3 GPU training runs:\n\n- 1146 self-play iterations\n- Loss dropped to 0.098\n- Best model win rate: 97%\n- P1/P2 balance: 52% / 48%\n\nAI is notably stronger in endgame and better at evaluating the golden stand.',
    'ai', 0)
  seed.run('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
    'Добавлены тактические головоломки!\n\n- Головоломка дня — обновляется каждый день\n- Задача недели — сложнее, обновляется по понедельникам\n- Банк из 50 головоломок с 3 уровнями сложности\n- Лидерборды и статистика решений\n\nЦель — закрыть нужные стойки за ограниченное число ходов. Тренирует тактическое мышление.',
    'Tactical puzzles are here!\n\n- Daily puzzle — refreshes every day\n- Weekly challenge — harder, refreshes on Mondays\n- Bank of 50 puzzles with 3 difficulty levels\n- Leaderboards and solve stats\n\nGoal: close the required stands in limited moves. Trains tactical thinking.',
    'feature', 0)
  seed.run('roadmap', 'Что дальше: планы развития', 'What\'s next: roadmap',
    'Стойки — исследовательский проект на стыке настольных игр и AI. Вот что в планах:\n\nБлижайшее:\n- Рейтинговые сезоны\n- Push-уведомления\n- Расширенная книга дебютов\n\nБудущее:\n- Мобильное приложение (iOS/Android)\n- Турниры с призами\n- Физическое издание игры\n- Открытый API для разработчиков\n\nСледите за обновлениями в этом блоге.',
    'Stacks is a research project at the intersection of board games and AI. Here\'s what\'s planned:\n\nComing soon:\n- Ranked seasons\n- Push notifications\n- Extended opening book\n\nFuture:\n- Mobile app (iOS/Android)\n- Tournaments with prizes\n- Physical game edition\n- Open API for developers\n\nStay tuned via this blog.',
    'roadmap', 0)
}

// Новые посты (добавляются если ещё нет)
const addPost = (slug, tru, ten, bru, ben, tag) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?,?,?,?,?,?,0)').run(slug, tru, ten, bru, ben, tag)
}

addPost('update-march-2026', 'Март 2026: масштабное обновление', 'March 2026: Major update',
  '26 ачивок, рейтинговые сезоны, 14 настроек и полная мультиязычность — вот главные изменения за март.\n\n' +
  'Ачивки\nТеперь их 26 вместо 14. Новые: Бессмертный (20 побед подряд), Гроссмейстер (рейтинг 1800), Молния (5 быстрых побед), Решатель (10 головоломок) и другие. Каждая ачивка теперь с цветовой категорией: бронза, серебро, золото, алмаз.\n\n' +
  'Рейтинговые сезоны\nКаждый месяц — новый сезон. Отдельный рейтинг, лидерборд топ-20, график истории ELO прямо в профиле.\n\n' +
  'Настройки\n14 параметров: таймер (блиц/рапид/30м), стиль фишек, плотность доски, скорость анимаций, режим для дальтоников, крупный текст, высокий контраст. Всё сохраняется и применяется мгновенно.\n\n' +
  'Мультиязычность\nВесь интерфейс полностью переведён на английский. Переключатель RU/EN в шапке.',
  '26 achievements, ranked seasons, 14 settings, and full English translation — here are the main changes for March.\n\n' +
  'Achievements\nNow 26 instead of 14. New ones: Immortal (20 wins in a row), Grandmaster (1800 rating), Lightning (5 fast wins), Solver (10 puzzles), and more. Each achievement now has a color tier: bronze, silver, gold, diamond.\n\n' +
  'Ranked Seasons\nEvery month is a new season with separate rating, top-20 leaderboard, and ELO history chart right in your profile.\n\n' +
  'Settings\n14 parameters: timer (blitz/rapid/30m), chip style, board density, animation speed, colorblind mode, large text, high contrast. Everything saves and applies instantly.\n\n' +
  'Multilingual\nThe entire interface is now fully translated to English. RU/EN switch in the header.',
  'release')

addPost('online-v2', 'Онлайн v2: resign, ничья, чат', 'Online v2: resign, draw, chat',
  'Онлайн-режим стал полноценным. Что нового:\n\n' +
  'Сдача партии\nКнопка «Сдаться» — противник мгновенно получает победу. Работает через WebSocket.\n\n' +
  'Предложение ничьей\nКнопка «Ничья» отправляет предложение противнику. Он видит баннер с кнопками «Принять» и «Отклонить».\n\n' +
  'Быстрый чат\nПять кнопок быстрых сообщений: gg, gl, nice, wp, ! — плюс ввод произвольного текста.\n\n' +
  'Уведомления\nКогда противник сделал ход и вкладка в фоне — заголовок мигает красной точкой. Вы не пропустите свой ход.',
  'Online mode is now fully featured. What\'s new:\n\n' +
  'Resign\nA "Resign" button — your opponent instantly gets the win. Works via WebSocket.\n\n' +
  'Draw offer\nA "Draw" button sends an offer. Opponent sees a banner with "Accept" and "Decline".\n\n' +
  'Quick chat\nFive quick message buttons: gg, gl, nice, wp, ! — plus free text input.\n\n' +
  'Notifications\nWhen opponent moves and your tab is in the background, the title blinks with a red dot. You won\'t miss your turn.',
  'feature')

addPost('design-v3', 'Дизайн v3: лендинг, шапка, авторизация', 'Design v3: landing, header, auth',
  'Полная переработка визуала:\n\n' +
  'Лендинг\n8 секций, каждая с уникальной архитектурой. Scroll-анимации (IntersectionObserver), animated counters, AI-баннер с метриками, gradient Print&Play баннер, нумерованный FAQ.\n\n' +
  'Шапка\n4 основных пункта + выпадающее «Ещё». Авторизация вынесена в хедер — аватар с рейтингом или кнопка «Войти» с dropdown формой.\n\n' +
  'SEO\nOG-теги, twitter:card, JSON-LD structured data, robots.txt, sitemap.xml, PWA-иконки 192+512.\n\n' +
  'Код\n11 lazy-loaded компонентов (React.lazy + Suspense). Hash-роутинг: #game, #blog, #puzzles — back/forward работает. Error Boundary для безопасности.',
  'Complete visual overhaul:\n\n' +
  'Landing\n8 sections, each with unique architecture. Scroll animations (IntersectionObserver), animated counters, AI banner with metrics, gradient Print&Play banner, numbered FAQ.\n\n' +
  'Header\n4 main items + "More" dropdown. Auth moved to header — avatar with rating or "Login" button with dropdown form.\n\n' +
  'SEO\nOG tags, twitter:card, JSON-LD structured data, robots.txt, sitemap.xml, PWA icons 192+512.\n\n' +
  'Code\n11 lazy-loaded components (React.lazy + Suspense). Hash routing: #game, #blog, #puzzles — back/forward works. Error Boundary for safety.',
  'update')

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
  if (!req.user.is_admin) return res.status(403).json({ error: 'Только администратор' })
  const { slug, title_ru, title_en, body_ru, body_en, tag, pinned } = req.body
  if (!slug || !title_ru || !body_ru) return res.status(400).json({ error: 'slug, title_ru, body_ru обязательны' })
  try {
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(slug, title_ru, title_en || '', body_ru, body_en || '', tag || 'update', pinned ? 1 : 0)
    res.json({ ok: true })
  } catch (e) { res.status(409).json({ error: 'Slug уже существует' }) }
})

// Обновление поста (только админ)
app.put('/api/blog/:slug', auth, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Только администратор' })
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

app.post('/api/rooms', (req, res) => {
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

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Комната не найдена' })
  res.json({ id: room.id, mode: room.mode, players: room.players.map(p => p.name), state: room.state, scores: room.scores, totalGames: room.totalGames, currentGame: room.currentGame })
})

// ═══ WebSocket ═══
import { WebSocketServer } from 'ws'
import { createServer } from 'http'

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  let playerRoom = null
  let playerIdx = -1

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    // ─── JOIN ───
    // ─── MATCHMAKING ───
    if (msg.type === 'findMatch') {
      const name = msg.name || 'Player'
      // Remove stale entries
      for (let i = matchQueue.length - 1; i >= 0; i--) {
        if (matchQueue[i].ws.readyState !== 1) matchQueue.splice(i, 1)
      }
      // Check if already in queue
      if (matchQueue.some(q => q.ws === ws)) return
      matchQueue.push({ ws, name })

      if (matchQueue.length >= 2) {
        const p1 = matchQueue.shift()
        const p2 = matchQueue.shift()
        // Create room
        const roomId = Math.random().toString(36).slice(2, 8).toUpperCase()
        const room = { id: roomId, players: [{ ws: p1.ws, name: p1.name }, { ws: p2.ws, name: p2.name }],
          mode: 'single', totalGames: 1, currentGame: 1, scores: [0, 0] }
        rooms.set(roomId, room)
        // Notify both
        p1.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 0 }))
        p2.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 1 }))
        // Start game
        const startMsg = JSON.stringify({ type: 'start', players: [p1.name, p2.name], firstPlayer: 0, scores: [0, 0], currentGame: 1 })
        p1.ws.send(startMsg); p2.ws.send(startMsg)
      } else {
        ws.send(JSON.stringify({ type: 'queued', position: matchQueue.length }))
      }
      return
    }

    if (msg.type === 'cancelMatch') {
      const idx = matchQueue.findIndex(q => q.ws === ws)
      if (idx !== -1) matchQueue.splice(idx, 1)
      ws.send(JSON.stringify({ type: 'matchCancelled' }))
      return
    }

    if (msg.type === 'join') {
      const roomId = (msg.roomId || '').toUpperCase()
      const room = rooms.get(roomId)
      if (!room) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната не найдена' }))
      if (room.players.length >= 2) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната полна' }))

      playerIdx = room.players.length
      room.players.push({ ws, name: msg.name || `Игрок ${playerIdx + 1}` })
      playerRoom = room

      ws.send(JSON.stringify({ type: 'joined', roomId, playerIdx, mode: room.mode, totalGames: room.totalGames }))

      // Второй игрок — стартуем
      if (room.players.length === 2) {
        room.state = 'playing'
        room.currentGame = 1
        const startMsg = JSON.stringify({
          type: 'start',
          players: room.players.map(p => p.name),
          currentGame: 1, totalGames: room.totalGames, scores: [0, 0],
          // Первая партия: P1 = игрок 0
          firstPlayer: 0,
        })
        room.players.forEach(p => p.ws.send(startMsg))
      } else {
        ws.send(JSON.stringify({ type: 'waiting', players: room.players.map(p => p.name) }))
      }
    }

    // ─── MOVE ───
    if (msg.type === 'move' && playerRoom) {
      const opponentIdx = 1 - playerIdx
      const opponent = playerRoom.players[opponentIdx]
      if (opponent?.ws?.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'move', action: msg.action, from: playerIdx }))
      }
    }

    // ─── RESIGN ───
    if (msg.type === 'resign' && playerRoom) {
      const opponent = playerRoom.players[1 - playerIdx]
      if (opponent?.ws?.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'resign', from: playerIdx }))
      }
    }

    // ─── CHAT (quick messages) ───
    if (msg.type === 'chat' && playerRoom && msg.text) {
      const text = String(msg.text).slice(0, 50)
      playerRoom.players.forEach((p, i) => {
        if (i !== playerIdx && p.ws?.readyState === 1) {
          p.ws.send(JSON.stringify({ type: 'chat', text, from: playerIdx }))
        }
      })
    }

    // ─── DRAW OFFER ───
    if (msg.type === 'drawOffer' && playerRoom) {
      const opponent = playerRoom.players[1 - playerIdx]
      if (opponent?.ws?.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'drawOffer', from: playerIdx }))
      }
    }

    if (msg.type === 'drawResponse' && playerRoom) {
      const opponent = playerRoom.players[1 - playerIdx]
      if (opponent?.ws?.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'drawResponse', accepted: msg.accepted, from: playerIdx }))
      }
    }

    // ─── GAME OVER ───
    if (msg.type === 'gameOver' && playerRoom) {
      const room = playerRoom
      if (msg.winner === 0) room.scores[0]++
      else if (msg.winner === 1) room.scores[1]++

      // Турнир — следующая партия?
      if (room.currentGame < room.totalGames) {
        room.currentGame++
        const nextMsg = JSON.stringify({
          type: 'nextGame',
          currentGame: room.currentGame, totalGames: room.totalGames,
          scores: room.scores,
          // Меняем стороны каждую партию
          firstPlayer: room.currentGame % 2 === 1 ? 0 : 1,
        })
        room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(nextMsg))
      } else {
        // Турнир завершён
        const finalMsg = JSON.stringify({
          type: 'tournamentOver',
          scores: room.scores,
          winner: room.scores[0] > room.scores[1] ? 0 : room.scores[1] > room.scores[0] ? 1 : -1,
        })
        room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(finalMsg))
      }
    }

    // ─── CHAT ───
    if (msg.type === 'chat' && playerRoom) {
      const chatMsg = JSON.stringify({ type: 'chat', from: playerIdx, text: (msg.text || '').slice(0, 200) })
      playerRoom.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(chatMsg))
    }
  })

  ws.on('close', () => {
    if (playerRoom) {
      const room = playerRoom
      const dcMsg = JSON.stringify({ type: 'disconnected', playerIdx })
      room.players.forEach((p, i) => {
        if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(dcMsg)
      })
      // Удаляем комнату через 60 сек если не переподключился
      setTimeout(() => {
        if (room.players.some(p => p.ws?.readyState !== 1)) rooms.delete(room.id)
      }, 60000)
    }
  })
})

// ═══ Старт ═══
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Стойки API + WS: http://0.0.0.0:${PORT}`)
  console.log(`   WebSocket: ws://0.0.0.0:${PORT}/ws`)
  console.log(`   Health: http://0.0.0.0:${PORT}/api/health`)
})
