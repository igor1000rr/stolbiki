import { Router } from 'express'
import { db, checkAchievements } from '../db.js'
import { auth } from '../middleware.js'
import { addXP } from '../helpers.js'
import { getTodayMissions } from './missions.js'

const router = Router()

// ═══ Puzzle Templates + Generator ═══
const PUZZLE_TEMPLATES = [
  // ─── Лёгкие (1 ход) — перенос закрывает стойку ───
  { difficulty: 1, maxMoves: 1, title_ru: 'Достройте высотку', title_en: 'Complete a highrise',
    gen: (rng) => {
      const s = Math.floor(rng() * 9) + 1
      const d = (s + 3) % 10 || 1
      const stands = Array.from({length:10}, () => [])
      // Стойка s: 8 своих наверху → перенос 3 с d закроет (8+3=11)
      stands[s] = [...Array(2).fill(1), ...Array(6 + Math.floor(rng() * 2)).fill(0)]
      stands[d] = Array(11 - stands[s].length).fill(0)
      return { stands, goal: { closedByPlayer: { [s]: 0 }, maxMoves: 1 },
        desc_ru: `Достройте высотку ${s} переносом`, desc_en: `Complete highrise ${s} by transfer` }
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
        desc_ru: 'Достройте золотую высотку ★', desc_en: 'Complete golden highrise ★' }
    }
  },
  // ─── Средние (2 хода) ───
  { difficulty: 2, maxMoves: 2, title_ru: 'Двойная достройка', title_en: 'Double complete',
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
        desc_ru: 'Достройте 2 высотки за 2 хода', desc_en: 'Complete 2 highrises in 2 moves' }
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
        desc_ru: `Перехватите высотку ${target}`, desc_en: `Capture highrise ${target}` }
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
        desc_ru: 'Достройте 3 высотки за 3 хода', desc_en: 'Complete 3 highrises in 3 moves' }
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
        desc_ru: 'Разберите позицию и достройте 2 высотки', desc_en: 'Untangle and complete 2 highrises' }
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
        desc_ru: `Достройте высотку ${s} одним переносом`, desc_en: `Complete highrise ${s} in one transfer` }
    }
  },
  { difficulty: 2, maxMoves: 2, title_ru: 'Золото и высотка', title_en: 'Gold and highrise',
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
        desc_ru: 'Достройте золотую ★ и ещё одну высотку', desc_en: 'Complete golden ★ and one more highrise' }
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
        desc_ru: `Перехватите высотку ${s} у противника`, desc_en: `Take over highrise ${s} from opponent` }
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
        desc_ru: 'Достройте золотую ★ и перехватите высотку', desc_en: 'Complete golden ★ and capture a highrise' }
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
    turn: 6 + Math.floor(rng() * 4) * 2,
  }
}

// ═══ Puzzle Endpoints ═══

router.get('/daily', (req, res) => {
  const d = new Date()
  const seed = `daily-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
  const puzzle = generatePuzzle(seed, 2)
  puzzle.type = 'daily'
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('daily', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('daily', seed)
  res.json(puzzle)
})

router.get('/weekly', (req, res) => {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d - jan1) / 86400000) + 1
  const weekDay = d.getDay() || 7
  const weekNum = Math.floor((dayOfYear - weekDay + 10) / 7)
  const seed = `weekly-${d.getFullYear()}-W${weekNum}`
  const puzzle = generatePuzzle(seed, 3)
  puzzle.type = 'weekly'
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('weekly', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('weekly', seed)
  res.json(puzzle)
})

router.get('/rush', (req, res) => {
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

router.get('/rush/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.avatar, pr.score, pr.created_at
    FROM puzzle_rush_scores pr JOIN users u ON u.id = pr.user_id
    ORDER BY pr.score DESC LIMIT 20
  `).all()
  res.set('Cache-Control', 'public, max-age=15')
  res.json(rows)
})

router.post('/rush/submit', auth, (req, res) => {
  const { score, solved, time } = req.body
  if (!score && score !== 0) return res.status(400).json({ error: 'score required' })
  db.prepare('INSERT INTO puzzle_rush_scores (user_id, score, solved, time_ms) VALUES (?, ?, ?, ?)')
    .run(req.user.id, score, solved || 0, time || 180000)
  const xp = Math.min(score * 5, 200)
  if (xp > 0) addXP(req.user.id, xp)
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

router.get('/bank', (req, res) => {
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
    const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('bank', seed)
    p.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
    puzzles.push(p)
  }
  res.json({ puzzles, total, page, perPage, pages: Math.ceil(total / perPage) })
})

router.get('/:type/:id', (req, res) => {
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

router.post('/submit', auth, (req, res) => {
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
  if (newSolve) {
    db.prepare('UPDATE users SET puzzles_solved = puzzles_solved + 1 WHERE id = ?').run(req.user.id)
    checkAchievements(req.user.id)
  }
  res.json({ ok: true })
})

router.get('/user/stats', auth, (req, res) => {
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

export default router
