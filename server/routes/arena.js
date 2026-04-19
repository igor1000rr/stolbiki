import { Router } from 'express'
import { db } from '../db.js'
import { auth, rateLimit } from '../middleware.js'
import { addXP } from '../helpers.js'

const router = Router()

// Fisher-Yates shuffle — в отличие от `arr.sort(() => Math.random() - 0.5)`
// даёт равномерное распределение (comparator с random'ом в Array.sort смещает
// порядок в V8: первые элементы чаще оказываются в начале).
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

router.get('/current', (req, res) => {
  try {
    let t = db.prepare("SELECT * FROM arena_tournaments WHERE status IN ('waiting','playing') ORDER BY created_at DESC LIMIT 1").get()
    if (!t) {
      db.prepare("INSERT INTO arena_tournaments (status, rounds, max_players) VALUES ('waiting', 4, 16)").run()
      t = db.prepare("SELECT * FROM arena_tournaments WHERE status='waiting' ORDER BY id DESC LIMIT 1").get()
    }
    const participants = db.prepare('SELECT ap.*, u.rating, u.avatar FROM arena_participants ap JOIN users u ON u.id=ap.user_id WHERE ap.tournament_id=? ORDER BY ap.score DESC, ap.buchholz DESC').all(t.id)
    const matches = db.prepare('SELECT * FROM arena_matches WHERE tournament_id=? ORDER BY round, id').all(t.id)
    res.json({ tournament: t, participants, matches })
  } catch (e) { res.status(500).json({ error: e.message }) }
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

  // БАГ-ФИКС: Fisher-Yates вместо некорректного comparator sort
  const shuffled = shuffleInPlace([...parts])
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

// SECURITY-фиксы (предыдущий аудит):
//   1. req.user.id должен быть одним из участников матча (player1 или player2).
//   2. winner_id должен быть один из этих двух игроков (или null = ничья).
//   3. result нормализуется: допустимо только 'win', 'draw', пустое ('').
//      'bye' оставляем только для автоматической пары (set-via-code в /start и ниже).
//
// БАГ-ФИКС (race, эта итерация):
//   4. Раньше: SELECT match → check winner_id=null → UPDATE. При одновременных запросах
//      от player1 и player2 оба проходили check и инкрементировали score/wins/losses
//      → рейтинг считался дважды. Теперь атомарный UPDATE ... WHERE winner_id IS NULL
//      и проверка .changes — только один запрос фактически применяется, второй получает 409.
//   5. Раньше: проверка allDone + SELECT next participants + INSERT next round шли без
//      защиты. Если 2 параллельных /result закрывали последние матчи, оба могли начать
//      генерацию next round → дубли. Теперь advance-guard через
//      UPDATE arena_tournaments SET current_round=? WHERE id=? AND current_round=?
//      — только один запрос продвинет турнир.
router.post('/result', auth, rateLimit(60000, 30), (req, res) => {
  const { match_id, winner_id, result } = req.body
  const mid = parseInt(match_id, 10)
  if (!mid) return res.status(400).json({ error: 'match_id required' })

  const match = db.prepare('SELECT * FROM arena_matches WHERE id=?').get(mid)
  if (!match) return res.status(404).json({ error: 'match not found' })
  if (match.winner_id || match.result) return res.status(409).json({ error: 'already recorded' })

  // SECURITY: только участники могут зафиксировать результат
  const isParticipant = req.user.id === match.player1_id || req.user.id === match.player2_id
  if (!isParticipant && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Вы не участник этого матча' })
  }

  // SECURITY: winner_id должен быть одним из игроков или null (ничья)
  let normalizedWinnerId = null
  if (winner_id !== null && winner_id !== undefined) {
    const wid = parseInt(winner_id, 10)
    if (wid !== match.player1_id && wid !== match.player2_id) {
      return res.status(400).json({ error: 'winner_id должен быть одним из игроков или null' })
    }
    normalizedWinnerId = wid
  }

  // SECURITY: result нормализуется в whitelist. 'bye' запрещён — его ставит только код.
  const resultWhitelist = ['win', 'draw', '']
  const normalizedResult = resultWhitelist.includes(result) ? result : (normalizedWinnerId ? 'win' : 'draw')

  // АТОМАРНЫЙ UPDATE: только если матч ещё не был зафиксирован. Защита от параллельных
  // /result от обоих игроков — второй получит changes=0 и 409 без побочных эффектов
  // на arena_participants (иначе score/wins/losses инкрементируются дважды).
  const upd = db.prepare(
    "UPDATE arena_matches SET winner_id=?, result=? WHERE id=? AND winner_id IS NULL AND (result IS NULL OR result='')"
  ).run(normalizedWinnerId, normalizedResult, mid)

  if (upd.changes === 0) {
    return res.status(409).json({ error: 'already recorded' })
  }

  // Только тот, кто фактически зафиксировал результат, инкрементирует score/wins/losses.
  if (normalizedWinnerId === match.player1_id) {
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player1_id)
    db.prepare('UPDATE arena_participants SET losses=losses+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player2_id)
  } else if (normalizedWinnerId === match.player2_id) {
    db.prepare('UPDATE arena_participants SET score=score+1, wins=wins+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player2_id)
    db.prepare('UPDATE arena_participants SET losses=losses+1 WHERE tournament_id=? AND user_id=?').run(match.tournament_id, match.player1_id)
  } else {
    // Ничья — оба игрока получают по 0.5
    db.prepare('UPDATE arena_participants SET score=score+0.5, draws=draws+1 WHERE tournament_id=? AND user_id IN (?,?)').run(match.tournament_id, match.player1_id, match.player2_id)
  }

  const t = db.prepare('SELECT * FROM arena_tournaments WHERE id=?').get(match.tournament_id)
  const roundMatches = db.prepare('SELECT * FROM arena_matches WHERE tournament_id=? AND round=?').all(t.id, t.current_round)
  const allDone = roundMatches.every(m => m.winner_id || m.result === 'bye' || m.result === 'draw')

  if (allDone && t.current_round < t.rounds) {
    const nextRound = t.current_round + 1

    // АТОМАРНЫЙ ADVANCE: только один запрос продвинет раунд. Если другой параллельный
    // /result успел раньше — changes=0, просто вернём ok без генерации дублей.
    const advance = db.prepare(
      'UPDATE arena_tournaments SET current_round=? WHERE id=? AND current_round=?'
    ).run(nextRound, t.id, t.current_round)

    if (advance.changes > 0) {
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
    }
  } else if (allDone && t.current_round >= t.rounds) {
    // АТОМАРНЫЙ FINISH: guard через status='playing' — только один запрос закроет турнир
    // и начислит XP top-3 (иначе XP начислялся бы дважды).
    const finish = db.prepare(
      "UPDATE arena_tournaments SET status='finished', finished_at=datetime('now') WHERE id=? AND status='playing'"
    ).run(t.id)

    if (finish.changes > 0) {
      const final = db.prepare('SELECT user_id FROM arena_participants WHERE tournament_id=? ORDER BY score DESC LIMIT 3').all(t.id)
      if (final[0]) addXP(final[0].user_id, 200)
      if (final[1]) addXP(final[1].user_id, 100)
      if (final[2]) addXP(final[2].user_id, 50)
    }
  }

  res.json({ ok: true, allRoundDone: allDone })
})

router.get('/history', (req, res) => {
  const tournaments = db.prepare("SELECT * FROM arena_tournaments WHERE status='finished' ORDER BY finished_at DESC LIMIT 10").all()
  res.json(tournaments)
})

export default router
