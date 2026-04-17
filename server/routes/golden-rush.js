import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

const router = Router()

/**
 * GET /api/gr/recent — последние N матчей (публично).
 * Query: ?limit=20&mode=ffa|2v2
 */
router.get('/recent', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
  const mode = req.query.mode === 'ffa' || req.query.mode === '2v2' ? req.query.mode : null

  const sql = mode
    ? 'SELECT id, room_id, mode, players, teams, winner, scores, turns, duration_sec, resigned_by, created_at FROM gr_matches WHERE mode = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT id, room_id, mode, players, teams, winner, scores, turns, duration_sec, resigned_by, created_at FROM gr_matches ORDER BY created_at DESC LIMIT ?'
  const rows = mode ? db.prepare(sql).all(mode, limit) : db.prepare(sql).all(limit)

  // Парсим JSON поля
  const matches = rows.map(r => ({
    id: r.id,
    roomId: r.room_id,
    mode: r.mode,
    players: JSON.parse(r.players),
    teams: r.teams ? JSON.parse(r.teams) : null,
    winner: r.winner,
    scores: JSON.parse(r.scores),
    turns: r.turns,
    durationSec: r.duration_sec,
    resignedBy: r.resigned_by,
    createdAt: r.created_at,
  }))

  res.set('Cache-Control', 'public, max-age=10')
  res.json({ matches })
})

/**
 * GET /api/gr/leaderboard — топ игроков по GR.
 * Query: ?metric=wins|games|centers&limit=20
 */
router.get('/leaderboard', (req, res) => {
  const metric = ['wins', 'games', 'centers'].includes(req.query.metric) ? req.query.metric : 'wins'
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)

  const columnMap = {
    wins: 'gr_wins',
    games: 'gr_games',
    centers: 'gr_center_captures',
  }
  const col = columnMap[metric]

  const rows = db.prepare(`
    SELECT id, username, rating, gr_games, gr_wins, gr_center_captures
    FROM users
    WHERE COALESCE(${col}, 0) > 0
    ORDER BY ${col} DESC, rating DESC
    LIMIT ?
  `).all(limit)

  res.set('Cache-Control', 'public, max-age=30')
  res.json({ metric, players: rows })
})

/**
 * GET /api/gr/my — моя статистика + последние матчи (authenticated).
 */
router.get('/my', auth, (req, res) => {
  const user = db.prepare(
    'SELECT gr_games, gr_wins, gr_center_captures FROM users WHERE id = ?'
  ).get(req.user.id)

  // Мои матчи: ищем строки где в players JSON есть наш userId
  // SQLite без JSON1 extension — фильтруем в JS (не критично, лимит 50)
  const allRecent = db.prepare(`
    SELECT id, room_id, mode, players, teams, winner, scores, turns, duration_sec, resigned_by, created_at
    FROM gr_matches
    WHERE players LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(`%"userId":${req.user.id}%`)

  const matches = allRecent.map(r => {
    const players = JSON.parse(r.players)
    const mySlot = players.find(p => p.userId === req.user.id)?.slot
    const teams = r.teams ? JSON.parse(r.teams) : null
    const scores = JSON.parse(r.scores)
    // Победил ли я?
    let won = false
    if (r.winner !== null && r.winner >= 0 && mySlot !== undefined) {
      if (r.mode === 'ffa') won = r.winner === mySlot
      else if (r.mode === '2v2' && teams) won = teams[r.winner].includes(mySlot)
    }
    return {
      id: r.id,
      roomId: r.room_id,
      mode: r.mode,
      mySlot,
      won,
      myScore: mySlot !== undefined ? scores[mySlot] : null,
      winner: r.winner,
      scores,
      turns: r.turns,
      durationSec: r.duration_sec,
      resignedBy: r.resigned_by,
      players: players.map(p => ({ slot: p.slot, name: p.name })),
      createdAt: r.created_at,
    }
  })

  const winRate = user?.gr_games > 0 ? Math.round((user.gr_wins || 0) / user.gr_games * 100) : 0

  res.json({
    stats: {
      games: user?.gr_games || 0,
      wins: user?.gr_wins || 0,
      centers: user?.gr_center_captures || 0,
      winRate,
    },
    matches,
  })
})

export default router
