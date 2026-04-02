import { Router } from 'express'
import { db, bcrypt } from '../db.js'
import { auth, adminOnly, rateLimits } from '../middleware.js'
import { formatUser } from '../helpers.js'

export default function createAdminRouter(rooms, matchQueue) {
  const router = Router()

  router.get('/overview', auth, adminOnly, (req, res) => {
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
    const regByDay = db.prepare(`SELECT date(created_at) as day, COUNT(*) as count FROM users WHERE created_at > datetime('now', '-30 days') GROUP BY day ORDER BY day`).all()
    const gamesByDay = db.prepare(`SELECT date(played_at) as day, COUNT(*) as count FROM games WHERE played_at > datetime('now', '-30 days') GROUP BY day ORDER BY day`).all()
    const topPlayers = db.prepare('SELECT username, rating, games_played, wins FROM users ORDER BY rating DESC LIMIT 5').all()
    res.json({
      users: { total: totalUsers, active7d: activeUsers, today: todayUsers },
      games: { total: totalGames, today: todayGames, week: weekGames, online: onlineGames },
      rating: { avg: avgRating, max: maxRating }, training: totalTraining,
      puzzles: { total: totalPuzzles, solved: solvedPuzzles }, blog: blogPosts,
      achievements: totalAchievements, rooms: rooms.size, matchQueue: matchQueue.length,
      uptime: process.uptime(), memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      charts: { regByDay, gamesByDay }, topPlayers,
    })
  })

  router.get('/users', auth, adminOnly, (req, res) => {
    const page = Math.max(1, +req.query.page || 1)
    const limit = Math.min(+req.query.limit || 30, 100)
    const offset = (page - 1) * limit
    const search = req.query.q || ''
    const sort = ['rating', 'games_played', 'created_at', 'last_seen', 'username'].includes(req.query.sort) ? req.query.sort : 'created_at'
    const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC'
    let where = '1=1'
    const params = []
    if (search) { where = "username LIKE ? ESCAPE '\\'"; params.push(`%${search.replace(/[%_]/g, '\\$&')}%`) }
    const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c
    const users = db.prepare(`SELECT id, username, email, rating, games_played, wins, losses, win_streak, best_streak, golden_closed, comebacks, perfect_wins, beat_hard_ai, fast_wins, online_wins, puzzles_solved, avatar, is_admin, created_at, last_seen FROM users WHERE ${where} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`).all(...params, limit, offset)
    res.json({ users, total, page, pages: Math.ceil(total / limit) })
  })

  router.get('/users/:id', auth, adminOnly, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Не найден' })
    const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=?').all(user.id)
    const recentGames = db.prepare('SELECT * FROM games WHERE user_id=? ORDER BY played_at DESC LIMIT 20').all(user.id)
    const ratingHistory = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(user.id)
    res.json({ user: formatUser(user), achievements, recentGames, ratingHistory })
  })

  router.put('/users/:id', auth, adminOnly, (req, res) => {
    const { rating, is_admin, username, reset_password } = req.body
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
    if (!user) return res.status(404).json({ error: 'Не найден' })
    if (rating !== undefined) db.prepare('UPDATE users SET rating=? WHERE id=?').run(Math.max(100, Math.min(2500, +rating)), user.id)
    if (is_admin !== undefined) db.prepare('UPDATE users SET is_admin=? WHERE id=?').run(is_admin ? 1 : 0, user.id)
    if (username) db.prepare('UPDATE users SET username=? WHERE id=?').run(username, user.id)
    if (reset_password) { const hash = bcrypt.hashSync(reset_password, 10); db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id) }
    res.json({ ok: true })
  })

  router.delete('/users/:id', auth, adminOnly, (req, res) => {
    const id = +req.params.id
    if (id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' })
    for (const t of ['achievements','games','friends','training_data','rating_history','season_ratings','daily_results','puzzle_results']) {
      db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id)
    }
    db.prepare('DELETE FROM friends WHERE friend_id=?').run(id)
    db.prepare('DELETE FROM users WHERE id=?').run(id)
    res.json({ ok: true })
  })

  router.get('/games', auth, adminOnly, (req, res) => {
    const page = Math.max(1, +req.query.page || 1)
    const limit = Math.min(+req.query.limit || 30, 100)
    const offset = (page - 1) * limit
    const total = db.prepare('SELECT COUNT(*) as c FROM games').get().c
    const games = db.prepare('SELECT g.*, u.username FROM games g JOIN users u ON u.id=g.user_id ORDER BY g.played_at DESC LIMIT ? OFFSET ?').all(limit, offset)
    res.json({ games, total, page, pages: Math.ceil(total / limit) })
  })

  router.get('/blog', auth, adminOnly, (req, res) => { res.json(db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all()) })
  router.delete('/blog/:slug', auth, adminOnly, (req, res) => { db.prepare('DELETE FROM blog_posts WHERE slug=?').run(req.params.slug); res.json({ ok: true }) })

  router.get('/seasons', auth, adminOnly, (req, res) => { res.json(db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all()) })
  router.put('/seasons/:id', auth, adminOnly, (req, res) => {
    const { active, name } = req.body
    if (active !== undefined) db.prepare('UPDATE seasons SET active=? WHERE id=?').run(active ? 1 : 0, req.params.id)
    if (name) db.prepare('UPDATE seasons SET name=? WHERE id=?').run(name, req.params.id)
    res.json({ ok: true })
  })

  router.get('/achievements', auth, adminOnly, (req, res) => {
    res.json(db.prepare('SELECT achievement_id, COUNT(*) as count, MIN(unlocked_at) as first_unlock, MAX(unlocked_at) as last_unlock FROM achievements GROUP BY achievement_id ORDER BY count DESC').all())
  })

  router.get('/training', auth, adminOnly, (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM training_data').get().c
    const byMode = db.prepare('SELECT mode, COUNT(*) as count, AVG(total_moves) as avgMoves FROM training_data GROUP BY mode').all()
    const byDay = db.prepare(`SELECT date(created_at) as day, COUNT(*) as count FROM training_data WHERE created_at > datetime('now', '-30 days') GROUP BY day ORDER BY day`).all()
    const sizeMB = db.prepare("SELECT SUM(LENGTH(game_data)) as s FROM training_data").get().s
    res.json({ total, byMode, byDay, sizeMB: Math.round((sizeMB || 0) / 1024 / 1024 * 100) / 100 })
  })

  router.delete('/training', auth, adminOnly, (req, res) => {
    const days = Math.max(1, Math.min(365, Math.floor(+req.query.olderThan || 90)))
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    res.json({ deleted: db.prepare('DELETE FROM training_data WHERE created_at < ?').run(cutoff).changes })
  })

  router.get('/training/export-gpu', auth, adminOnly, (req, res) => {
    const limit = Math.min(+req.query.limit || 5000, 50000)
    const minMoves = +req.query.minMoves || 5
    const rows = db.prepare('SELECT game_data, winner, mode, difficulty FROM training_data WHERE total_moves >= ? ORDER BY created_at DESC LIMIT ?').all(minMoves, limit)
    const games = []
    for (const row of rows) {
      try { const data = JSON.parse(row.game_data); if (!data.moves || row.winner < 0) continue; games.push({ moves: data.moves, winner: row.winner, mode: row.mode, difficulty: row.difficulty }) } catch {}
    }
    res.json({ total: games.length, format: 'raw_moves', games })
  })

  router.get('/rooms', auth, adminOnly, (req, res) => {
    const active = []
    for (const [id, room] of rooms) {
      active.push({ id, mode: room.mode, state: room.state, players: room.players.map(p => p.name), scores: room.scores, currentGame: room.currentGame, totalGames: room.totalGames, ageMin: Math.round((Date.now() - room.created) / 60000) })
    }
    res.json({ rooms: active, queueLength: matchQueue.length })
  })

  router.get('/server', auth, adminOnly, (req, res) => {
    const mem = process.memoryUsage()
    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get()
    res.json({
      nodeVersion: process.version, platform: process.platform, uptime: process.uptime(),
      memory: { heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024), heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024), rssMB: Math.round(mem.rss / 1024 / 1024) },
      db: { sizeMB: Math.round((dbSize?.size || 0) / 1024 / 1024 * 100) / 100, walMode: db.pragma('journal_mode')[0]?.journal_mode },
      rooms: rooms.size, matchQueue: matchQueue.length, rateLimitEntries: rateLimits.size, pid: process.pid,
    })
  })

  // ═══ Content CMS ═══
  router.get('/content', auth, adminOnly, (req, res) => { res.json(db.prepare('SELECT * FROM site_content ORDER BY section, key').all()) })
  router.put('/content/:key', auth, adminOnly, (req, res) => {
    const { value_ru, value_en } = req.body
    if (!db.prepare('SELECT key FROM site_content WHERE key=?').get(req.params.key)) return res.status(404).json({ error: 'Ключ не найден' })
    db.prepare("UPDATE site_content SET value_ru=?, value_en=?, updated_at=datetime('now') WHERE key=?").run(value_ru ?? '', value_en ?? '', req.params.key)
    res.json({ ok: true })
  })
  router.post('/content', auth, adminOnly, (req, res) => {
    const { key, section, value_ru, value_en, label } = req.body
    if (!key) return res.status(400).json({ error: 'key обязателен' })
    try { db.prepare('INSERT INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)').run(key, section || 'general', value_ru || '', value_en || '', label || ''); res.json({ ok: true }) }
    catch (e) { res.status(409).json({ error: 'Ключ уже существует' }) }
  })
  router.delete('/content/:key', auth, adminOnly, (req, res) => { db.prepare('DELETE FROM site_content WHERE key=?').run(req.params.key); res.json({ ok: true }) })
  router.post('/content/bulk', auth, adminOnly, (req, res) => {
    const { items } = req.body
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items обязателен' })
    const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
    let added = 0
    for (const item of items) { const r = ins.run(item.key, item.section || 'i18n', item.value_ru || '', item.value_en || '', item.label || ''); if (r.changes > 0) added++ }
    res.json({ ok: true, added, total: items.length })
  })

  // ═══ Error reports ═══
  router.get('/errors', auth, adminOnly, (req, res) => {
    const errors = db.prepare(`
      SELECT e.*, u.username FROM error_reports e
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC LIMIT 100
    `).all()
    res.json(errors)
  })

  router.delete('/errors', auth, adminOnly, (req, res) => {
    db.prepare('DELETE FROM error_reports').run()
    res.json({ ok: true })
  })

  return router
}
