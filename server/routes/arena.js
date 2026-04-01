import { Router } from 'express'
import { db } from '../db.js'
import { auth, rateLimit } from '../middleware.js'
import { addXP } from '../helpers.js'

const router = Router()

router.get('/current', (req, res) => {
  let t = db.prepare("SELECT * FROM arena_tournaments WHERE status IN ('waiting','playing') ORDER BY created_at DESC LIMIT 1").get()
  if (!t) {
    db.prepare("INSERT INTO arena_tournaments (status, rounds, max_players) VALUES ('waiting', 4, 16)").run()
    t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  }
  const participants = db.prepare('SELECT ap.*, u.rating, u.avatar FROM arena_participants ap JOIN users u ON u.id=ap.user_id WHERE ap.tournament_id=? ORDER BY ap.score DESC, ap.buchholz DESC').all(t.id)
  const matches = db.prepare('SELECT * FROM arena_matches WHERE tournament_id=? ORDER BY round, id').all(t.id)
  res.json({ tournament: t, participants, matches })
})

router.post('/join', auth, (req, res) => {
  const t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  if (!t) return res.status(404).json({ error: 'No tournament available' })
  if (db.prepare('SELECT id FROM arena_participants WHERE tournament_id=? AND user_id=?').get(t.id, req.user.id)) {
    return res.json({ ok: true, already: true })
  }
  const count = db.prepare('SELECT COUNT(*) as c FROM arena_participants WHERE tournament_id=?').get(t.id).c
  if (count >= t.max_players) return res.status(400).json({ error: 'Tournament full' })
  db.prepare('INSERT INTO arena_participants (tournament_id, user_id, username) VALUES (?, ?, ?)').run(t.id, req.user.id, req.user.username)
  res.json({ ok: true })
})

router.post('/leave', auth, (req, res) => {
  const t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  if (t) db.prepare('DELETE FROM arena_participants WHERE tournament_id=? AND user_id=?').run(t.id, req.user.id)
  res.json({ ok: true })
})

router.post('/start', auth, rateLimit(60000, 5), (req, res) => {
  const t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
  if (!t) return res.status(404).json({ error: 'No waiting tournament' })
  const parts = db.prepare('SELECT * FROM arena_participants WHERE tournament_id=?').all(t.id)
  if (parts.length < 2) return res.status(400).json({ error: 'Need 2+ players' })

  db.prepare("UPDATE arena_tournaments SET status='playing', started_at=datetime('now'), current_round=1 WHERE id=?").run(t.id)

  const shuffled = parts.sort(() => Math.random() - 0.5)
  const ins = db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id) VALUES (?, 1, ?, ?)')
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    ins.run(t.id, shuffled[i].user_id, shuffled[i + 1].user_id)
  }
  if (shuffled.length % 2 === 1) {
    db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id, winner_id, result) VALUES (?, 1, ?, NULL, ?, ?)')
      .run(t.id, shuffled[shuffled.length - 1].user_id, shuffled[shuffled.length - 1].user_id, 'bye')
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?')
      .run(t.id, shuffled[shuffled.length - 1].user_id)
  }

  res.json({ ok: true, round: 1, matches: shuffled.length >> 1 })
})

router.post('/result', auth, rateLimit(60000, 30), (req, res) => {
  const { match_id, winner_id, result } = req.body
  if (!match_id) return res.status(400).json({ error: 'match_id required' })
  const match = db.prepare('SELECT * FROM arena_matches WHERE id=?').get(match_id)
  if (!match || match.winner_id) return res.status(400).json({ error: 'Invalid match or already recorded' })

  db.prepare('UPDATE arena_matches SET winner_id=?, result=? WHERE id=?').run(winner_id, result || '', match_id)

  if (winner_id === match.player1_id) {
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player1_id)
    db.prepare('UPDATE arena_participants SET losses=losses+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player2_id)
  } else if (winner_id === match.player2_id) {
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player2_id)
    db.prepare('UPDATE arena_participants SET losses=losses+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player1_id)
  } else {
    db.prepare('UPDATE arena_participants SET score=score+0.5, draws=draws+1 WHERE tournament_id=? AND user_id IN (?,?)').run(match.tournament_id, match.player1_id, match.player2_id)
  }

  const t = db.prepare('SELECT * FROM arena_tournaments WHERE id=?').get(match.tournament_id)
  const roundMatches = db.prepare('SELECT * FROM arena_matches WHERE tournament_id=? AND round=?').all(t.id, t.current_round)
  const allDone = roundMatches.every(m => m.winner_id || m.result === 'bye')

  if (allDone && t.current_round < t.rounds) {
    const nextRound = t.current_round + 1
    db.prepare('UPDATE arena_tournaments SET current_round=? WHERE id=?').run(nextRound, t.id)
    const parts2 = db.prepare('SELECT * FROM arena_participants WHERE tournament_id=? ORDER BY score DESC, buchholz DESC').all(t.id)
    const paired = new Set()
    const ins2 = db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id) VALUES (?, ?, ?, ?)')
    for (let i = 0; i < parts2.length; i++) {
      if (paired.has(parts2[i].user_id)) continue
      for (let j = i + 1; j < parts2.length; j++) {
        if (paired.has(parts2[j].user_id)) continue
        const played = db.prepare('SELECT id FROM arena_matches WHERE tournament_id=? AND ((player1_id=? AND player2_id=?) OR (player1_id=? AND player2_id=?))').get(t.id, parts2[i].user_id, parts2[j].user_id, parts2[j].user_id, parts2[i].user_id)
        if (!played) {
          ins2.run(t.id, nextRound, parts2[i].user_id, parts2[j].user_id)
          paired.add(parts2[i].user_id); paired.add(parts2[j].user_id)
          break
        }
      }
    }
    for (const p of parts2) {
      if (!paired.has(p.user_id)) {
        db.prepare('INSERT INTO arena_matches (tournament_id, round, player1_id, player2_id, winner_id, result) VALUES (?, ?, ?, NULL, ?, ?)')
          .run(t.id, nextRound, p.user_id, p.user_id, 'bye')
        db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(t.id, p.user_id)
      }
    }
  } else if (allDone && t.current_round >= t.rounds) {
    db.prepare("UPDATE arena_tournaments SET status='finished', finished_at=datetime('now') WHERE id=?").run(t.id)
    const final = db.prepare('SELECT user_id FROM arena_participants WHERE tournament_id=? ORDER BY score DESC LIMIT 3').all(t.id)
    if (final[0]) addXP(final[0].user_id, 200)
    if (final[1]) addXP(final[1].user_id, 100)
    if (final[2]) addXP(final[2].user_id, 50)
  }

  res.json({ ok: true, allRoundDone: allDone })
})

router.get('/history', (req, res) => {
  const tournaments = db.prepare("SELECT * FROM arena_tournaments WHERE status='finished' ORDER BY finished_at DESC LIMIT 10").all()
  res.json(tournaments)
})

export default router
