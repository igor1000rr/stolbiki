import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { addXP } from '../helpers.js'

const router = Router()

// ═══ Mission Pool ═══
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

export function getTodayMissions(userId) {
  const today = new Date().toISOString().split('T')[0]
  const existing = db.prepare('SELECT mission_id, progress, target, completed, xp_reward FROM daily_missions WHERE user_id=? AND date=?').all(userId, today)
  if (existing.length >= 3) return existing

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

router.get('/missions', auth, (req, res) => {
  const missions = getTodayMissions(req.user.id)
  const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(req.user.id)
  const enriched = missions.map(m => {
    const def = MISSION_POOL.find(p => p.id === m.mission_id) || {}
    return { ...m, name_ru: def.name_ru, name_en: def.name_en }
  })
  const allDone = enriched.every(m => m.completed)
  res.json({ missions: enriched, allDone, xp: user?.xp || 0, level: user?.level || 1, xpForNext: (user?.level || 1) * 100 })
})

router.post('/missions/progress', auth, (req, res) => {
  const { mission_id, increment } = req.body
  if (!mission_id) return res.status(400).json({ error: 'mission_id required' })
  const today = new Date().toISOString().split('T')[0]
  getTodayMissions(req.user.id)

  const m = db.prepare('SELECT * FROM daily_missions WHERE user_id=? AND date=? AND mission_id=?').get(req.user.id, today, mission_id)
  if (!m || m.completed) return res.json({ ok: true, alreadyDone: true })

  const newProgress = Math.min(m.progress + (increment || 1), m.target)
  const completed = newProgress >= m.target ? 1 : 0
  db.prepare('UPDATE daily_missions SET progress=?, completed=? WHERE id=?').run(newProgress, completed, m.id)

  if (completed) {
    addXP(req.user.id, m.xp_reward)
    const allDone = db.prepare('SELECT COUNT(*) as c FROM daily_missions WHERE user_id=? AND date=? AND completed=1').get(req.user.id, today).c
    if (allDone >= 3) addXP(req.user.id, 100)
  }

  const user = db.prepare('SELECT xp, level FROM users WHERE id=?').get(req.user.id)
  res.json({ ok: true, completed: !!completed, progress: newProgress, target: m.target, xp: user?.xp, level: user?.level })
})

// ═══ Login Streak ═══
router.post('/streak/checkin', auth, (req, res) => {
  const user = db.prepare('SELECT login_streak, best_login_streak, last_login_date, streak_freeze FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const today = new Date().toISOString().split('T')[0]
  if (user.last_login_date === today) {
    const calendar = db.prepare('SELECT date FROM daily_logins WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.user.id)
    return res.json({ streak: user.login_streak, best: user.best_login_streak, today: true, freeze: user.streak_freeze, calendar: calendar.map(r => r.date) })
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  let streak = user.login_streak || 0
  let freeze = user.streak_freeze ?? 1

  if (user.last_login_date === yesterday) {
    streak += 1
  } else if (user.last_login_date && user.last_login_date < yesterday) {
    const daysBefore = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
    if (user.last_login_date === daysBefore && freeze > 0) {
      streak += 1
      freeze -= 1
    } else {
      streak = 1
    }
  } else {
    streak = 1
  }

  const best = Math.max(streak, user.best_login_streak || 0)
  const lastMonth = user.last_login_date ? user.last_login_date.slice(0, 7) : ''
  const thisMonth = today.slice(0, 7)
  if (lastMonth !== thisMonth) freeze = 1

  db.prepare('UPDATE users SET login_streak=?, best_login_streak=?, last_login_date=?, streak_freeze=? WHERE id=?')
    .run(streak, best, today, freeze, req.user.id)
  try { db.prepare('INSERT OR IGNORE INTO daily_logins (user_id, date) VALUES (?, ?)').run(req.user.id, today) } catch {}

  const streakXP = streak >= 30 ? 50 : streak >= 7 ? 20 : streak >= 3 ? 10 : 5
  addXP(req.user.id, streakXP)

  const calendar = db.prepare('SELECT date FROM daily_logins WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.user.id)
  res.json({ streak, best, today: false, isNew: true, freeze, streakXP, calendar: calendar.map(r => r.date) })
})

router.get('/streak', auth, (req, res) => {
  const user = db.prepare('SELECT login_streak, best_login_streak, last_login_date, streak_freeze FROM users WHERE id=?').get(req.user.id)
  if (!user) return res.json({ streak: 0, best: 0, calendar: [] })
  const calendar = db.prepare('SELECT date FROM daily_logins WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.user.id)
  res.json({ streak: user.login_streak || 0, best: user.best_login_streak || 0, freeze: user.streak_freeze ?? 1, calendar: calendar.map(r => r.date) })
})

// ═══ Push Notifications ═══
router.post('/push/register', auth, (req, res) => {
  const { token, platform } = req.body
  if (!token) return res.status(400).json({ error: 'token required' })
  try {
    db.prepare('INSERT OR REPLACE INTO push_tokens (user_id, token, platform) VALUES (?, ?, ?)').run(req.user.id, token, platform || 'android')
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/push/unregister', auth, (req, res) => {
  const { token } = req.body
  if (token) db.prepare('DELETE FROM push_tokens WHERE token=?').run(token)
  else db.prepare('DELETE FROM push_tokens WHERE user_id=?').run(req.user.id)
  res.json({ ok: true })
})

export default router
