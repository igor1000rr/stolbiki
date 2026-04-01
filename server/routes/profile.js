import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { formatUser } from '../helpers.js'

const router = Router()

router.get('/', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?').all(req.user.id)
  const rushBest = db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(req.user.id)
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

router.put('/avatar', auth, (req, res) => {
  const { avatar } = req.body
  if (!avatar) return res.status(400).json({ error: 'avatar required' })
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, req.user.id)
  res.json({ ok: true })
})

router.get('/rating-history', auth, (req, res) => {
  const history = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  res.json(history)
})

router.get('/opening-stats', auth, (req, res) => {
  const games = db.prepare('SELECT game_data FROM training_data WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
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

// ВАЖНО: /:username должен быть ПОСЛЕДНИМ — иначе перехватит /avatar, /rating-history и т.д.
router.get('/:username', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(user.id)
  res.json({ ...formatUser(user), achievements: achievements.map(a => a.achievement_id) })
})

export default router
