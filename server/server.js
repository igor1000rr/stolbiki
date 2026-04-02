/**
 * Snatch Highrise — серверный API
 * Entry point: middleware, монтирование роутов, старт
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { db, JWT_SECRET, PORT } from './db.js'
import { rateLimit, auth } from './middleware.js'
import { setupWebSocket } from './ws.js'

// ═══ Route imports ═══
import authRouter from './routes/auth.js'
import profileRouter from './routes/profile.js'
import gamesRouter from './routes/games.js'
import socialRouter from './routes/social.js'
import missionsRouter from './routes/missions.js'
import arenaRouter from './routes/arena.js'
import puzzlesRouter from './routes/puzzles.js'
import blogRouter from './routes/blog.js'
import createAdminRouter from './routes/admin.js'

const app = express()

// За Nginx — доверяем X-Forwarded-For для корректного req.ip
app.set('trust proxy', 1)

// ═══ Security ═══
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
  else cb(new Error(`CORS: origin ${origin} не разрешён`))
}}))
app.use(express.json({ limit: '5mb' }))
// Обработка невалидного JSON в теле запроса (400 вместо 500)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' })
  next(err)
})

// ═══ API Stats + Response Time ═══
const apiStats = { requests: 0, errors: 0, startedAt: Date.now() }
app.use('/api/', (req, res, next) => {
  apiStats.requests++
  const start = Date.now()
  const origEnd = res.end
  res.end = function(...args) {
    if (res.statusCode >= 400) apiStats.errors++
    res.setHeader('X-Response-Time', `${Date.now() - start}ms`)
    origEnd.apply(this, args)
  }
  next()
})

// ═══ Global Rate Limits ═══
app.use('/api/auth', rateLimit(60000, 20))
app.use('/api/games', rateLimit(60000, 60))
app.use('/api/', rateLimit(60000, 120))

// ═══ Rooms + WebSocket ═══
const rooms = new Map()
const matchQueue = []

// Периодическая чистка: мёртвые комнаты и matchQueue (каждые 2 мин)
setInterval(() => {
  const now = Date.now()
  // Комнаты старше 30 мин без активных игроков
  for (const [id, room] of rooms) {
    if (now - (room.created || 0) > 30 * 60 * 1000) {
      const hasAlive = room.players.some(p => p.ws?.readyState === 1)
      if (!hasAlive) rooms.delete(id)
    }
  }
  // matchQueue: мёртвые WS соединения
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    if (matchQueue[i].ws.readyState !== 1) matchQueue.splice(i, 1)
  }
}, 120000)

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

app.post('/api/rooms', rateLimit(60000, 10), (req, res) => {
  const { name, mode } = req.body
  let id = generateRoomId()
  while (rooms.has(id)) id = generateRoomId()
  rooms.set(id, { id, created: Date.now(), mode: mode || 'single', totalGames: mode === 'tournament5' ? 5 : mode === 'tournament3' ? 3 : 1, currentGame: 0, scores: [0, 0], players: [], state: 'waiting', game: null })
  setTimeout(() => rooms.delete(id), 30 * 60 * 1000)
  res.json({ roomId: id })
})

app.get('/api/rooms/active', (req, res) => {
  const active = []
  for (const [id, room] of rooms) {
    if (room.state === 'playing' && room.players.length === 2) {
      active.push({ id: room.id, players: room.players.map(p => p.name), scores: room.scores, turn: room.gameState?.turn || 0, spectators: (room.spectators || []).filter(s => s.readyState === 1).length })
    }
  }
  res.json(active)
})

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Комната не найдена' })
  res.json({ id: room.id, mode: room.mode, players: room.players.map(p => p.name), state: room.state, scores: room.scores, totalGames: room.totalGames, currentGame: room.currentGame })
})

const { server } = setupWebSocket(app, { JWT_SECRET, rooms, matchQueue, db })

// ═══ Public endpoints ═══
app.get('/api/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  const totalGames = db.prepare('SELECT COUNT(*) as c FROM games').get().c
  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM users WHERE games_played > 0').get().avg || 1000
  const activeRooms = [...rooms.values()].filter(r => r.state === 'playing' && r.players.length === 2).length
  res.set('Cache-Control', 'public, max-age=30')
  res.json({ totalUsers, totalGames, avgRating: Math.round(avgRating), activeRooms, matchQueue: matchQueue.length })
})

app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage()
  res.json({
    status: 'ok',
    version: '4.4.19',
    uptime: Math.round(process.uptime()),
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    rooms: rooms.size,
    matchQueue: matchQueue.length,
    memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
    schemaVersion: db.prepare('SELECT MAX(version) as v FROM schema_version').get()?.v || 0,
    api: { requests: apiStats.requests, errors: apiStats.errors, uptimeHours: Math.round((Date.now() - apiStats.startedAt) / 3600000 * 10) / 10 },
  })
})

// ═══ Client error reporting ═══
db.exec(`CREATE TABLE IF NOT EXISTS error_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  message TEXT, stack TEXT, component TEXT, url TEXT, ua TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`)

app.post('/api/error-report', rateLimit(60000, 5), (req, res) => {
  const { message, stack, component, url, ua } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })
  let userId = null
  try {
    const authHeader = req.headers.authorization
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const decoded = jwt.verify(token, JWT_SECRET)
      userId = decoded.id
    }
  } catch {}
  try {
    db.prepare('INSERT INTO error_reports (user_id, message, stack, component, url, ua) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, String(message).slice(0, 500), String(stack || '').slice(0, 2000), String(component || '').slice(0, 1000), String(url || '').slice(0, 500), String(ua || '').slice(0, 200))
  } catch {}
  res.json({ ok: true })
})

app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, section, value_ru, value_en FROM site_content ORDER BY section, key').all()
  const content = {}
  for (const row of rows) content[row.key] = { ru: row.value_ru, en: row.value_en }
  res.set('Cache-Control', 'public, max-age=60')
  res.json(content)
})

// ═══ Daily Challenge (отдельно от puzzles — другой prefix) ═══
import { getDailySeed, seededRandom } from './helpers.js'

app.get('/api/daily', (req, res) => {
  const seed = getDailySeed()
  const rng = seededRandom(seed)
  const firstStand = Math.floor(rng() * 10)
  const p2count = 1 + Math.floor(rng() * 3)
  const numStands = p2count === 1 ? 1 : (1 + Math.floor(rng() * 2))
  const standA = Math.floor(rng() * 10)
  let standB = standA
  if (numStands === 2) { standB = Math.floor(rng() * 10); while (standB === standA) standB = Math.floor(rng() * 10) }
  const p2stands = []
  for (let i = 0; i < p2count; i++) p2stands.push(i === 0 || numStands === 1 ? standA : standB)
  res.json({ seed, date: seed, firstMove: { stand: firstStand }, secondMove: { stands: p2stands }, swapped: rng() > 0.5 })
})

app.get('/api/daily/leaderboard', (req, res) => {
  const seed = getDailySeed()
  const rows = db.prepare('SELECT username, turns, duration FROM daily_results WHERE seed = ? ORDER BY turns ASC, duration ASC LIMIT 20').all(seed)
  res.json({ seed, results: rows })
})

app.post('/api/daily/submit', auth, (req, res) => {
  const { turns, duration, won } = req.body
  const seed = getDailySeed()
  const existing = db.prepare('SELECT id FROM daily_results WHERE user_id = ? AND seed = ?').get(req.user.id, seed)
  if (existing) return res.status(409).json({ error: 'Уже отправлено сегодня' })
  db.prepare('INSERT INTO daily_results (user_id, username, seed, turns, duration, won) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, req.user.username, seed, turns, duration || 0, won ? 1 : 0)
  res.json({ ok: true })
})

// ═══ Mount Routes ═══
app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api', gamesRouter)
app.use('/api', socialRouter)
app.use('/api', missionsRouter)
app.use('/api/arena', arenaRouter)
app.use('/api/puzzles', puzzlesRouter)
app.use('/api/blog', blogRouter)
app.use('/api/admin', createAdminRouter(rooms, matchQueue))

// ═══ API 404 — неизвестные эндпоинты ═══
app.use('/api/', (req, res) => {
  res.status(404).json({ error: `Endpoint не найден: ${req.method} ${req.path}` })
})

// ═══ Обработка ошибок ═══
app.use((err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message || err)
  if (err.message?.startsWith('CORS:')) return res.status(403).json({ error: err.message })
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

process.on('uncaughtException', (err) => {
  console.error(`[FATAL] uncaughtException:`, err)
  setTimeout(() => process.exit(1), 3000)
})

process.on('unhandledRejection', (reason) => {
  console.error(`[ERROR] unhandledRejection:`, reason)
})

// Graceful shutdown: уведомляем игроков, закрываем DB
function gracefulShutdown(signal) {
  console.log(`\n⏳ ${signal} — graceful shutdown...`)
  // Уведомляем всех подключённых игроков
  for (const [id, room] of rooms) {
    const msg = JSON.stringify({ type: 'serverShutdown' })
    room.players.forEach(p => { try { p.ws?.readyState === 1 && p.ws.send(msg) } catch {} })
  }
  server.close(() => {
    console.log('✅ HTTP/WS сервер закрыт')
    db.close()
    console.log('✅ SQLite закрыт')
    process.exit(0)
  })
  // Если не закрылся за 5 сек — force
  setTimeout(() => { console.error('⚠ Force exit'); process.exit(1) }, 5000)
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ═══ Глобальный error handler (ловит все необработанные ошибки Express) ═══
app.use((err, req, res, _next) => {
  console.error(`[EXPRESS ERROR] ${req.method} ${req.path}:`, err.message)
  try {
    db.prepare('INSERT INTO error_reports (message, stack, url, ua) VALUES (?, ?, ?, ?)')
      .run(`[SERVER] ${err.message}`.slice(0, 500), (err.stack || '').slice(0, 2000), req.originalUrl?.slice(0, 500), (req.headers['user-agent'] || '').slice(0, 200))
  } catch {}
  if (!res.headersSent) res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

// ═══ Старт ═══
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Snatch Highrise API + WS: http://0.0.0.0:${PORT}`)
  console.log(`   WebSocket: ws://0.0.0.0:${PORT}/ws`)
  console.log(`   Health: http://0.0.0.0:${PORT}/api/health`)
})

// ═══ Ежедневное обслуживание БД (каждые 24ч) ═══
function dbMaintenance() {
  try {
    // Удаляем ошибки старше 30 дней
    db.prepare("DELETE FROM error_reports WHERE created_at < datetime('now', '-30 days')").run()
    // Удаляем пустые training_data старше 90 дней
    db.prepare("DELETE FROM training_data WHERE created_at < datetime('now', '-90 days') AND moves IS NULL").run()
    // WAL checkpoint для уменьшения размера WAL файла
    db.pragma('wal_checkpoint(TRUNCATE)')
    console.log(`🔧 DB maintenance done: ${new Date().toISOString()}`)
  } catch (e) { console.error('DB maintenance error:', e.message) }
}
// Первый запуск через 5 мин после старта, потом каждые 24ч
setTimeout(dbMaintenance, 5 * 60000)
setInterval(dbMaintenance, 24 * 3600000)
