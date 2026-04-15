/**
 * Маршруты Города побед.
 *
 * Концепция: 1 победа = N кирпичей (brickValue). Кирпичи укладываются
 * хронологически в стойки по 11 — как в самой игре Highrise Heist.
 * Закрытая стойка (11 кирпичей) = небоскрёб.
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { invalidateOgCache } from './embed.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS victory_buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_id INTEGER,
    opponent_name TEXT,
    is_ai INTEGER DEFAULT 0,
    ai_difficulty TEXT,
    stands_snapshot TEXT NOT NULL,
    player_skin_id TEXT,
    background_id TEXT,
    result TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_victory_buildings_user
    ON victory_buildings(user_id, created_at DESC);
`)

const TOWER_HEIGHT = 11

function brickValue(b) {
  let v = 1
  if (b.is_ai && b.ai_difficulty) {
    const d = parseInt(b.ai_difficulty, 10) || 0
    if (d >= 1500) v += 3
    else if (d >= 800) v += 2
    else if (d >= 400) v += 1
  }
  if (!b.is_ai) v += 1
  if (b.result === 'draw_won') v += 1
  return v
}

function isSpecialWin(b) {
  if (b.result === 'draw_won') return true
  if (b.is_ai && b.ai_difficulty) {
    const d = parseInt(b.ai_difficulty, 10) || 0
    if (d >= 1500) return true
  }
  return false
}

function compileCity(userId) {
  const rows = db.prepare(`
    SELECT id, opponent_name, is_ai, ai_difficulty, player_skin_id, result, created_at
    FROM victory_buildings
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).all(userId)

  const pieces = []
  for (const b of rows) {
    const v = brickValue(b)
    const special = isSpecialWin(b)
    for (let i = 0; i < v; i++) {
      pieces.push({
        skin_id: b.player_skin_id || 'blocks_classic',
        source_id: b.id,
        opponent: b.opponent_name || (b.is_ai ? 'Snappy' : null),
        date: b.created_at,
        golden: b.result === 'draw_won',
        is_ai: !!b.is_ai,
        ai_difficulty: b.ai_difficulty,
        special: i === v - 1 && special,
      })
    }
  }

  const towers = []
  for (let i = 0; i < pieces.length; i += TOWER_HEIGHT) {
    const towerPieces = pieces.slice(i, i + TOWER_HEIGHT)
    const isClosed = towerPieces.length === TOWER_HEIGHT
    const topPiece = towerPieces[towerPieces.length - 1]
    const sourceIds = [...new Set(towerPieces.map(p => p.source_id))]
    towers.push({
      idx: towers.length,
      pieces: towerPieces,
      height: towerPieces.length,
      is_closed: isClosed,
      golden_top: isClosed && topPiece.special,
      period_from: towerPieces[0].date,
      period_to: topPiece.date,
      source_wins: sourceIds.length,
    })
  }

  return {
    towers,
    total_bricks: pieces.length,
    total_wins: rows.length,
    next_tower_progress: pieces.length % TOWER_HEIGHT,
  }
}

function getUserBrief(userId) {
  try {
    return db.prepare('SELECT id, name, avatar_url FROM users WHERE id = ?').get(userId) || null
  } catch {
    // На случай если в users нет колонки avatar_url — фолбэк
    try {
      return db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) || null
    } catch { return null }
  }
}

const router = Router()

// ─── POST /api/buildings ───
router.post('/', auth, (req, res) => {
  try {
    const {
      stands_snapshot, result,
      game_id = null, opponent_name = null,
      is_ai = false, ai_difficulty = null,
      player_skin_id = null, background_id = null,
    } = req.body || {}

    if (!Array.isArray(stands_snapshot) || stands_snapshot.length === 0) {
      return res.status(400).json({ error: 'stands_snapshot обязателен (массив)' })
    }
    if (!['win', 'draw_won'].includes(result)) {
      return res.status(400).json({ error: "result должен быть 'win' или 'draw_won'" })
    }

    const snapshotJson = JSON.stringify(stands_snapshot).slice(0, 4000)
    const oppName = opponent_name ? String(opponent_name).slice(0, 50) : null
    const aiDiff = ai_difficulty ? String(ai_difficulty).slice(0, 20) : null
    const skin = player_skin_id ? String(player_skin_id).slice(0, 50) : null
    const bg = background_id ? String(background_id).slice(0, 50) : null

    const info = db.prepare(`
      INSERT INTO victory_buildings
        (user_id, game_id, opponent_name, is_ai, ai_difficulty,
         stands_snapshot, player_skin_id, background_id, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
    `).run(
      req.user.id, game_id || null, oppName,
      is_ai ? 1 : 0, aiDiff, snapshotJson, skin, bg, result
    )
    // Сбрасываем OG-кэш — на следующем шаринге игрок увидит обновлённую картинку
    try { invalidateOgCache(req.user.id) } catch {}
    res.json({ ok: true, id: info.lastInsertRowid })
  } catch (e) {
    console.error('POST /buildings error:', e)
    res.status(500).json({ error: 'Не удалось сохранить здание' })
  }
})

// ─── GET /api/buildings/stats/:userId ───
router.get('/stats/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10)
  if (!userId) return res.status(400).json({ error: 'invalid userId' })
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_ai=1 THEN 1 ELSE 0 END) as vs_ai,
      SUM(CASE WHEN is_ai=0 THEN 1 ELSE 0 END) as vs_human,
      SUM(CASE WHEN result='draw_won' THEN 1 ELSE 0 END) as golden_wins
    FROM victory_buildings WHERE user_id = ?
  `).get(userId)
  res.json({
    total: row?.total || 0,
    vs_ai: row?.vs_ai || 0,
    vs_human: row?.vs_human || 0,
    golden_wins: row?.golden_wins || 0,
  })
})

// ─── GET /api/buildings/city/:userId — собранный город + инфа об игроке ───
router.get('/city/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10)
  if (!userId) return res.status(400).json({ error: 'invalid userId' })
  try {
    const city = compileCity(userId)
    const user = getUserBrief(userId)
    res.json({ ...city, user })
  } catch (e) {
    console.error('GET /buildings/city error:', e)
    res.status(500).json({ error: 'Не удалось собрать город' })
  }
})

// ─── GET /api/buildings/:userId — DEPRECATED legacy список ───
router.get('/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10)
  if (!userId) return res.status(400).json({ error: 'invalid userId' })
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
  const rows = db.prepare(`
    SELECT id, game_id, opponent_name, is_ai, ai_difficulty,
           stands_snapshot, player_skin_id, background_id, result, created_at
    FROM victory_buildings
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset)
  const buildings = rows.map(r => ({
    ...r,
    is_ai: !!r.is_ai,
    stands_snapshot: (() => { try { return JSON.parse(r.stands_snapshot) } catch { return [] } })(),
  }))
  res.json({ buildings, limit, offset })
})

// ─── DELETE /api/buildings/:id ───
router.delete('/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: 'invalid id' })
  const row = db.prepare('SELECT user_id FROM victory_buildings WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'not found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  db.prepare('DELETE FROM victory_buildings WHERE id = ?').run(id)
  try { invalidateOgCache(req.user.id) } catch {}
  res.json({ ok: true })
})

export default router
