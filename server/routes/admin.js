import { Router } from 'express'
import { db, bcrypt } from '../db.js'
import { auth, adminOnly, rateLimits } from '../middleware.js'
import { formatUser } from '../helpers.js'
import { muteUser, unmuteUser, listMuted } from '../chat-limits.js'
import { logAdminAction, getRecentAudit } from '../admin-audit.js'
import { grRooms, grMatchQueue, getGoldenRushStats } from '../golden-rush-ws.js'

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
    const grStats = getGoldenRushStats()
    res.json({
      users: { total: totalUsers, active7d: activeUsers, today: todayUsers },
      games: { total: totalGames, today: todayGames, week: weekGames, online: onlineGames },
      rating: { avg: avgRating, max: maxRating }, training: totalTraining,
      puzzles: { total: totalPuzzles, solved: solvedPuzzles }, blog: blogPosts,
      achievements: totalAchievements, rooms: rooms.size, matchQueue: matchQueue.length,
      goldenRush: grStats,
      uptime: process.uptime(), memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      errors: db.prepare('SELECT COUNT(*) as c FROM error_reports').get()?.c || 0,
      replays: db.prepare('SELECT COUNT(*) as c FROM replays').get()?.c || 0,
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

  router.put('/users/:id', auth, adminOnly, async (req, res) => {
    try {
      const { rating, is_admin, username, reset_password, revoke_tokens } = req.body
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
      if (!user) return res.status(404).json({ error: 'Не найден' })
      const changes = {}

      if (rating !== undefined) {
        const clamped = Math.max(100, Math.min(2500, +rating))
        db.prepare('UPDATE users SET rating=? WHERE id=?').run(clamped, user.id)
        changes.rating = { from: user.rating, to: clamped }
      }
      if (is_admin !== undefined) {
        const v = is_admin ? 1 : 0
        db.prepare('UPDATE users SET is_admin=? WHERE id=?').run(v, user.id)
        changes.is_admin = { from: !!user.is_admin, to: !!v }
      }
      if (username) {
        const clean = String(username).trim().slice(0, 20).replace(/[<>&"']/g, '')
        if (clean.length >= 2) {
          try {
            db.prepare('UPDATE users SET username=? WHERE id=?').run(clean, user.id)
            changes.username = { from: user.username, to: clean }
          } catch (e) {
            return res.status(409).json({ error: 'Username занят' })
          }
        }
      }
      if (reset_password) {
        const hash = await bcrypt.hash(String(reset_password), 10)
        db.prepare('UPDATE users SET password_hash=?, token_version = COALESCE(token_version, 0) + 1 WHERE id=?').run(hash, user.id)
        changes.password_reset = true
      }
      if (revoke_tokens) {
        db.prepare('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id=?').run(user.id)
        changes.tokens_revoked = true
      }

      logAdminAction(req, 'user_update', {
        targetType: 'user', targetId: user.id,
        metadata: { username: user.username, changes },
      })
      res.json({ ok: true })
    } catch (e) {
      console.error('[admin] PUT /users/:id error:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  })

  router.delete('/users/:id', auth, adminOnly, (req, res) => {
    const id = +req.params.id
    if (id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' })
    const targetUser = db.prepare('SELECT id, username, rating FROM users WHERE id=?').get(id)
    if (!targetUser) return res.status(404).json({ error: 'Не найден' })

    const tablesWithUserId = [
      'achievements', 'games', 'friends', 'training_data', 'rating_history',
      'season_ratings', 'daily_results', 'puzzle_results',
      'daily_missions', 'daily_logins', 'replays', 'push_tokens',
      'puzzle_rush_scores', 'arena_participants', 'chat_messages', 'analytics_events',
      'season_rewards',
    ]

    const tx = db.transaction(() => {
      for (const t of tablesWithUserId) {
        try { db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id) } catch {}
      }
      try { db.prepare('DELETE FROM friends WHERE friend_id=?').run(id) } catch {}
      try { db.prepare('DELETE FROM referrals WHERE referrer_id=? OR referred_id=?').run(id, id) } catch {}
      try { db.prepare('DELETE FROM challenges WHERE from_id=? OR to_id=?').run(id, id) } catch {}
      try { db.prepare('DELETE FROM brick_transactions WHERE user_id=?').run(id) } catch {}
      try { db.prepare('DELETE FROM user_skins WHERE user_id=?').run(id) } catch {}
      try { db.prepare('UPDATE arena_matches SET winner_id=NULL WHERE winner_id=?').run(id) } catch {}
      try { db.prepare('UPDATE error_reports SET user_id=NULL WHERE user_id=?').run(id) } catch {}
      db.prepare('DELETE FROM users WHERE id=?').run(id)
    })
    tx()
    logAdminAction(req, 'user_delete', {
      targetType: 'user', targetId: id,
      metadata: { username: targetUser.username, rating: targetUser.rating },
    })
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
  router.delete('/blog/:slug', auth, adminOnly, (req, res) => {
    const slug = req.params.slug
    const post = db.prepare('SELECT id, title FROM blog_posts WHERE slug=?').get(slug)
    db.prepare('DELETE FROM blog_posts WHERE slug=?').run(slug)
    logAdminAction(req, 'blog_delete', { targetType: 'blog_post', metadata: { slug, title: post?.title } })
    res.json({ ok: true })
  })

  router.get('/seasons', auth, adminOnly, (req, res) => { res.json(db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all()) })
  router.put('/seasons/:id', auth, adminOnly, (req, res) => {
    const { active, name } = req.body
    const changes = {}
    if (active !== undefined) {
      db.prepare('UPDATE seasons SET active=? WHERE id=?').run(active ? 1 : 0, req.params.id)
      changes.active = !!active
    }
    if (name) {
      db.prepare('UPDATE seasons SET name=? WHERE id=?').run(name, req.params.id)
      changes.name = name
    }
    logAdminAction(req, 'season_update', { targetType: 'season', targetId: req.params.id, metadata: changes })
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
    const result = db.prepare('DELETE FROM training_data WHERE created_at < ?').run(cutoff).changes
    logAdminAction(req, 'training_cleanup', { metadata: { olderThanDays: days, deleted: result } })
    res.json({ deleted: result })
  })

  router.get('/training/export-gpu', auth, adminOnly, (req, res) => {
    const limit = Math.min(+req.query.limit || 5000, 50000)
    const minMoves = +req.query.minMoves || 5
    const maxBytesReq = +req.query.maxBytes || 50 * 1024 * 1024
    const MAX_BYTES = Math.min(200 * 1024 * 1024, Math.max(1 * 1024 * 1024, maxBytesReq))

    const rows = db.prepare('SELECT game_data, winner, mode, difficulty FROM training_data WHERE total_moves >= ? ORDER BY created_at DESC LIMIT ?').all(minMoves, limit)
    const games = []
    let bytes = 0
    let truncated = false
    for (const row of rows) {
      try {
        const data = JSON.parse(row.game_data)
        if (!data.moves || row.winner < 0) continue
        const entry = { moves: data.moves, winner: row.winner, mode: row.mode, difficulty: row.difficulty }
        const entryBytes = JSON.stringify(entry).length + 2
        if (bytes + entryBytes > MAX_BYTES) { truncated = true; break }
        games.push(entry)
        bytes += entryBytes
      } catch {}
    }
    logAdminAction(req, 'training_export', { metadata: { total: games.length, bytes, truncated, limit, minMoves } })
    res.json({ total: games.length, bytes, truncated, maxBytes: MAX_BYTES, format: 'raw_moves', games })
  })

  router.get('/rooms', auth, adminOnly, (req, res) => {
    const active = []
    for (const [id, room] of rooms) {
      active.push({ id, mode: room.mode, state: room.state, players: room.players.map(p => p.name), scores: room.scores, currentGame: room.currentGame, totalGames: room.totalGames, ageMin: Math.round((Date.now() - room.created) / 60000) })
    }
    res.json({ rooms: active, queueLength: matchQueue.length })
  })

  // ═══ Golden Rush admin: список активных комнат и очередь ═══
  router.get('/golden-rush', auth, adminOnly, (req, res) => {
    const roomList = []
    for (const [id, room] of grRooms) {
      roomList.push({
        id,
        mode: room.mode,
        turn: room.state?.turn || 0,
        currentPlayer: room.state?.currentPlayer,
        gameOver: !!room.state?.gameOver,
        winner: room.state?.winner,
        scores: room.state?.scores,
        ageMin: Math.round((Date.now() - room.created) / 60000),
        lastActivityMin: Math.round((Date.now() - (room.lastActivity || room.created)) / 60000),
        players: room.players.map(p => ({
          slot: p.slot,
          name: p.name,
          rating: p.rating,
          online: p.ws?.readyState === 1,
          disconnectedAt: p.disconnectedAt,
        })),
      })
    }
    const queue = grMatchQueue.map((q, i) => ({
      position: i + 1,
      name: q.name,
      mode: q.mode,
      rating: q.rating,
      waitMin: Math.round((Date.now() - q.joinedAt) / 60000),
    }))
    res.json({ rooms: roomList, queue, stats: getGoldenRushStats() })
  })

  router.get('/server', auth, adminOnly, (req, res) => {
    const mem = process.memoryUsage()
    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get()
    res.json({
      nodeVersion: process.version, platform: process.platform, uptime: process.uptime(),
      memory: { heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024), heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024), rssMB: Math.round(mem.rss / 1024 / 1024) },
      db: { sizeMB: Math.round((dbSize?.size || 0) / 1024 / 1024 * 100) / 100, walMode: db.pragma('journal_mode')[0]?.journal_mode },
      rooms: rooms.size, matchQueue: matchQueue.length,
      goldenRush: getGoldenRushStats(),
      rateLimitEntries: rateLimits.size, pid: process.pid,
    })
  })

  // ═══ Content CMS ═══
  router.get('/content', auth, adminOnly, (req, res) => { res.json(db.prepare('SELECT * FROM site_content ORDER BY section, key').all()) })
  router.put('/content/:key', auth, adminOnly, (req, res) => {
    const { value_ru, value_en } = req.body
    if (!db.prepare('SELECT key FROM site_content WHERE key=?').get(req.params.key)) return res.status(404).json({ error: 'Ключ не найден' })
    db.prepare("UPDATE site_content SET value_ru=?, value_en=?, updated_at=datetime('now') WHERE key=?").run(value_ru ?? '', value_en ?? '', req.params.key)
    logAdminAction(req, 'content_update', { targetType: 'content', metadata: { key: req.params.key } })
    res.json({ ok: true })
  })
  router.post('/content', auth, adminOnly, (req, res) => {
    const { key, section, value_ru, value_en, label } = req.body
    if (!key) return res.status(400).json({ error: 'key обязателен' })
    try {
      db.prepare('INSERT INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)').run(key, section || 'general', value_ru || '', value_en || '', label || '')
      logAdminAction(req, 'content_create', { targetType: 'content', metadata: { key, section } })
      res.json({ ok: true })
    } catch (e) { res.status(409).json({ error: 'Ключ уже существует' }) }
  })
  router.delete('/content/:key', auth, adminOnly, (req, res) => {
    db.prepare('DELETE FROM site_content WHERE key=?').run(req.params.key)
    logAdminAction(req, 'content_delete', { targetType: 'content', metadata: { key: req.params.key } })
    res.json({ ok: true })
  })
  router.post('/content/bulk', auth, adminOnly, (req, res) => {
    const { items } = req.body
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items обязателен' })
    const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
    let added = 0
    for (const item of items) { const r = ins.run(item.key, item.section || 'i18n', item.value_ru || '', item.value_en || '', item.label || ''); if (r.changes > 0) added++ }
    logAdminAction(req, 'content_bulk', { metadata: { total: items.length, added } })
    res.json({ ok: true, added, total: items.length })
  })

  router.get('/errors', auth, adminOnly, (req, res) => {
    const errors = db.prepare(`
      SELECT e.*, u.username FROM error_reports e
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC LIMIT 100
    `).all()
    res.json(errors)
  })

  router.delete('/errors', auth, adminOnly, (req, res) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM error_reports').get()?.c || 0
    db.prepare('DELETE FROM error_reports').run()
    logAdminAction(req, 'errors_clear', { metadata: { deleted: count } })
    res.json({ ok: true })
  })

  router.get('/referrals', auth, adminOnly, (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM referrals').get()?.c || 0
    const totalXP = db.prepare('SELECT SUM(xp_rewarded) as s FROM referrals').get()?.s || 0
    const byDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM referrals WHERE created_at > datetime('now', '-30 days')
      GROUP BY day ORDER BY day
    `).all()
    const topReferrers = db.prepare(`
      SELECT u.username, u.rating, COUNT(r.id) as referral_count, SUM(r.xp_rewarded) as total_xp
      FROM referrals r JOIN users u ON u.id = r.referrer_id
      GROUP BY r.referrer_id ORDER BY referral_count DESC LIMIT 20
    `).all()
    const recent = db.prepare(`
      SELECT r.created_at, u1.username as referrer, u2.username as referred, r.xp_rewarded
      FROM referrals r JOIN users u1 ON u1.id = r.referrer_id JOIN users u2 ON u2.id = r.referred_id
      ORDER BY r.created_at DESC LIMIT 50
    `).all()
    res.json({ total, totalXP, byDay, topReferrers, recent })
  })

  router.get('/challenges', auth, adminOnly, (req, res) => {
    try {
      const total = db.prepare('SELECT COUNT(*) as c FROM challenges').get()?.c || 0
      const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM challenges GROUP BY status').all()
      const byDay = db.prepare(`
        SELECT date(created_at) as day, COUNT(*) as count
        FROM challenges WHERE created_at > datetime('now', '-30 days')
        GROUP BY day ORDER BY day
      `).all()
      const recent = db.prepare(`
        SELECT c.status, c.room_id, c.created_at, u1.username as from_user, u2.username as to_user
        FROM challenges c JOIN users u1 ON u1.id = c.from_id JOIN users u2 ON u2.id = c.to_id
        ORDER BY c.created_at DESC LIMIT 50
      `).all()
      res.json({ total, byStatus, byDay, recent })
    } catch {
      res.json({ total: 0, byStatus: [], byDay: [], recent: [] })
    }
  })

  router.get('/analytics', auth, adminOnly, (req, res) => {
    const days = Math.min(+req.query.days || 7, 90)
    const sinceParam = `-${days} days`

    const pageViews = db.prepare(`
      SELECT page, COUNT(*) as views, COUNT(DISTINCT session_id) as sessions
      FROM analytics_events WHERE event='pageview' AND created_at > datetime('now', ?)
      GROUP BY page ORDER BY views DESC
    `).all(sinceParam)

    const topEvents = db.prepare(`
      SELECT event, COUNT(*) as count, COUNT(DISTINCT session_id) as sessions
      FROM analytics_events WHERE created_at > datetime('now', ?)
      GROUP BY event ORDER BY count DESC LIMIT 20
    `).all(sinceParam)

    const byDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as events, COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT user_id) as users
      FROM analytics_events WHERE created_at > datetime('now', ?)
      GROUP BY day ORDER BY day
    `).all(sinceParam)

    const activeUsers = db.prepare(`
      SELECT u.username, u.rating, COUNT(e.id) as events, MAX(e.created_at) as last_seen
      FROM analytics_events e JOIN users u ON u.id = e.user_id
      WHERE e.created_at > datetime('now', ?) AND e.user_id IS NOT NULL
      GROUP BY e.user_id ORDER BY events DESC LIMIT 30
    `).all(sinceParam)

    const devices = db.prepare(`
      SELECT
        CASE
          WHEN ua LIKE '%Mobile%' OR ua LIKE '%Android%' OR ua LIKE '%iPhone%' THEN 'Mobile'
          WHEN ua LIKE '%Tablet%' OR ua LIKE '%iPad%' THEN 'Tablet'
          ELSE 'Desktop'
        END as device,
        COUNT(DISTINCT session_id) as sessions
      FROM analytics_events WHERE created_at > datetime('now', ?)
      GROUP BY device ORDER BY sessions DESC
    `).all(sinceParam)

    const avgSession = db.prepare(`
      SELECT session_id, MIN(created_at) as first_event, MAX(created_at) as last_event,
        COUNT(*) as event_count
      FROM analytics_events WHERE created_at > datetime('now', ?) AND session_id != ''
      GROUP BY session_id HAVING event_count > 1
      ORDER BY first_event DESC LIMIT 100
    `).all(sinceParam)

    const totalEvents = db.prepare(`SELECT COUNT(*) as c FROM analytics_events WHERE created_at > datetime('now', ?)`).get(sinceParam)?.c || 0
    const totalSessions = db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM analytics_events WHERE created_at > datetime('now', ?) AND session_id != ''`).get(sinceParam)?.c || 0

    res.json({ pageViews, topEvents, byDay, activeUsers, devices, avgSession, totalEvents, totalSessions, days })
  })

  router.post('/chat/mute', auth, adminOnly, (req, res) => {
    const userId = +req.body.user_id
    const minutes = +req.body.minutes || 60
    if (!userId) return res.status(400).json({ error: 'user_id обязателен' })
    if (userId === req.user.id) return res.status(400).json({ error: 'Нельзя замутить себя' })
    const user = db.prepare('SELECT id, username FROM users WHERE id=?').get(userId)
    if (!user) return res.status(404).json({ error: 'Не найден' })
    const until = muteUser(userId, minutes)
    logAdminAction(req, 'chat_mute', {
      targetType: 'user', targetId: userId,
      metadata: { username: user.username, minutes, until },
    })
    res.json({ ok: true, user_id: userId, username: user.username, until })
  })

  router.post('/chat/unmute', auth, adminOnly, (req, res) => {
    const userId = +req.body.user_id
    if (!userId) return res.status(400).json({ error: 'user_id обязателен' })
    unmuteUser(userId)
    logAdminAction(req, 'chat_unmute', { targetType: 'user', targetId: userId })
    res.json({ ok: true })
  })

  router.get('/chat/muted', auth, adminOnly, (req, res) => {
    res.json({ muted: listMuted() })
  })

  router.get('/audit', auth, adminOnly, (req, res) => {
    const { limit, offset, action, adminId } = req.query
    const data = getRecentAudit({ limit, offset, action, adminId })
    res.json(data)
  })

  return router
}
