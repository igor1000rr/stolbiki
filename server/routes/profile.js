import { Router } from 'express'
import { db, bcrypt } from '../db.js'
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
    // Один запрос вместо N+1: считаем турниры где юзер в top-3
    const result = db.prepare(`
      SELECT COUNT(*) as cnt FROM (
        SELECT ap.tournament_id, ap.user_id,
          RANK() OVER (PARTITION BY ap.tournament_id ORDER BY ap.score DESC) as pos
        FROM arena_participants ap
        WHERE ap.tournament_id IN (SELECT DISTINCT tournament_id FROM arena_participants WHERE user_id=?)
      ) ranked WHERE ranked.user_id=? AND ranked.pos <= 3
    `).get(req.user.id, req.user.id)
    arenaTop3Count = result?.cnt || 0
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

// ═══ Смена пароля ═══
router.put('/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Оба поля обязательны' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Минимум 6 символов' })
  if (newPassword.length > 100) return res.status(400).json({ error: 'Максимум 100 символов' })
  const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id)
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный текущий пароль' })
  }
  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user.id)
  res.json({ ok: true })
})

// ═══ Экспорт данных (GDPR) ═══
router.get('/export', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, rating, games_played, wins, losses, win_streak, best_streak, golden_closed, comebacks, perfect_wins, xp, level, created_at FROM users WHERE id=?').get(req.user.id)
  const games = db.prepare('SELECT won, score, difficulty, turns, duration, mode, played_at FROM games WHERE user_id=? ORDER BY played_at DESC').all(req.user.id)
  const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=?').all(req.user.id)
  const friends = db.prepare('SELECT u.username FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? AND f.status="accepted"').all(req.user.id)
  const replays = db.prepare('SELECT id, score, mode, turns, created_at FROM replays WHERE user_id=?').all(req.user.id)
  res.json({ user, games, achievements, friends: friends.map(f => f.username), replays, exportedAt: new Date().toISOString() })
})

// ═══ Удаление аккаунта ═══
router.delete('/account', auth, (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Пароль обязателен для подтверждения' })
  const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный пароль' })
  }
  const uid = req.user.id
  // Удаляем все связанные данные
  for (const t of ['achievements', 'games', 'friends', 'training_data', 'rating_history', 'season_ratings', 'daily_results', 'puzzle_results', 'puzzle_rush_scores', 'daily_missions', 'daily_logins', 'push_tokens', 'replays']) {
    try { db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid) } catch {}
  }
  db.prepare('DELETE FROM friends WHERE friend_id=?').run(uid)
  db.prepare('DELETE FROM users WHERE id=?').run(uid)
  res.json({ ok: true, message: 'Аккаунт удалён' })
})

router.get('/rating-history', auth, (req, res) => {
  const history = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  res.json(history)
})

// ═══ Глубокая аналитика ═══
router.get('/analytics', auth, (req, res) => {
  const uid = req.user.id
  // LIMIT 2000 — достаточно для аналитики, не перегружает память
  const games = db.prepare('SELECT won, score, difficulty, turns, duration, closed_golden, is_comeback, mode, played_at FROM games WHERE user_id=? ORDER BY played_at DESC LIMIT 2000').all(uid)
  const totalAllTime = db.prepare('SELECT COUNT(*) as c FROM games WHERE user_id=?').get(uid).c

  if (!games.length) return res.json({ empty: true })

  // W/L по сложности
  const byDiff = {}
  for (const g of games) {
    const d = g.difficulty <= 50 ? 'easy' : g.difficulty <= 150 ? 'medium' : g.difficulty <= 300 ? 'hard' : 'extreme'
    if (!byDiff[d]) byDiff[d] = { w: 0, l: 0 }
    g.won ? byDiff[d].w++ : byDiff[d].l++
  }

  // Распределение счёта
  const scores = {}
  for (const g of games) {
    if (g.score) { scores[g.score] = (scores[g.score] || 0) + 1 }
  }

  // Средние ходы и длительность
  const withTurns = games.filter(g => g.turns > 0)
  const withDur = games.filter(g => g.duration > 0)
  const avgTurns = withTurns.length ? Math.round(withTurns.reduce((s, g) => s + g.turns, 0) / withTurns.length) : 0
  const avgDuration = withDur.length ? Math.round(withDur.reduce((s, g) => s + g.duration, 0) / withDur.length) : 0
  const totalTime = games.reduce((s, g) => s + (g.duration || 0), 0)
  const longestGame = Math.max(...games.map(g => g.turns || 0))
  const shortestGame = Math.min(...withTurns.map(g => g.turns)) || 0

  // Golden stand rate & comeback rate
  const goldenRate = games.length ? Math.round(games.filter(g => g.closed_golden).length / games.length * 100) : 0
  const comebackRate = games.length ? Math.round(games.filter(g => g.is_comeback).length / games.length * 100) : 0

  // W/L последние 7 и 30 дней
  const now = Date.now()
  const d7 = games.filter(g => new Date(g.played_at).getTime() > now - 7 * 86400000)
  const d30 = games.filter(g => new Date(g.played_at).getTime() > now - 30 * 86400000)
  const last7 = { w: d7.filter(g => g.won).length, l: d7.filter(g => !g.won).length }
  const last30 = { w: d30.filter(g => g.won).length, l: d30.filter(g => !g.won).length }

  // Win rate тренд (скользящее среднее 10 игр)
  const wrTrend = []
  for (let i = 0; i < Math.min(games.length, 50); i++) {
    const window = games.slice(i, i + 10)
    if (window.length >= 5) wrTrend.push(Math.round(window.filter(g => g.won).length / window.length * 100))
  }

  // Активность по часам
  const byHour = Array(24).fill(0)
  for (const g of games) {
    const h = new Date(g.played_at).getHours()
    byHour[h]++
  }

  // Активность по дням недели
  const byDay = Array(7).fill(0)
  for (const g of games) {
    const d = new Date(g.played_at).getDay()
    byDay[d]++
  }

  // W/L по режиму (AI vs Online)
  const byMode = {}
  for (const g of games) {
    const m = g.mode || 'ai'
    if (!byMode[m]) byMode[m] = { w: 0, l: 0 }
    g.won ? byMode[m].w++ : byMode[m].l++
  }

  // Серия побед timeline (последние 30 игр)
  const streakLine = games.slice(0, 30).map(g => g.won ? 1 : 0).reverse()

  // Puzzle stats
  const puzzleStats = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN solved=1 THEN 1 ELSE 0 END) as correct FROM puzzle_results WHERE user_id=?').get(uid)
  const rushBest = db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(uid)

  res.json({
    total: games.length,
    totalAllTime,
    byDifficulty: byDiff,
    scores,
    avgTurns, avgDuration, totalTime,
    longestGame, shortestGame,
    goldenRate, comebackRate,
    last7, last30,
    wrTrend: wrTrend.reverse(),
    byHour, byDay, byMode,
    streakLine,
    puzzleAccuracy: puzzleStats?.total > 0 ? Math.round((puzzleStats.correct || 0) / puzzleStats.total * 100) : null,
    puzzleTotal: puzzleStats?.total || 0,
    rushBest: rushBest?.best || 0,
  })
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

// ═══ Реферальная система ═══
router.get('/referrals', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT referral_code FROM users WHERE id=?').get(req.user.id)
    const referrals = db.prepare(`
      SELECT r.created_at, u.username, r.xp_rewarded
      FROM referrals r JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = ? ORDER BY r.created_at DESC LIMIT 50
    `).all(req.user.id)
    const totalXP = referrals.reduce((s, r) => s + (r.xp_rewarded || 0), 0)
    res.json({
      code: user?.referral_code || null,
      link: `https://snatch-highrise.com?ref=${user?.referral_code || ''}`,
      count: referrals.length,
      totalXP,
      referrals: referrals.map(r => ({ username: r.username, xp: r.xp_rewarded, date: r.created_at })),
    })
  } catch (e) {
    res.json({ code: null, link: '', count: 0, totalXP: 0, referrals: [] })
  }
})

// ВАЖНО: /:username должен быть ПОСЛЕДНИМ — иначе перехватит /avatar, /rating-history и т.д.
router.get('/:username', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(user.id)
  res.json({ ...formatUser(user), achievements: achievements.map(a => a.achievement_id) })
})

export default router
