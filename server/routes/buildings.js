/**
 * Маршруты Города побед — снимки финальных раскладок после побед
 * См. issue #2
 *
 * Таблица victory_buildings создаётся при импорте модуля (CREATE TABLE IF NOT EXISTS).
 * Это позволяет деплоить роутер автономно, без правки миграций в db.js.
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

// ─── Bootstrap: таблица victory_buildings ───
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

const router = Router()

// ─── POST /api/buildings — сохранить здание после победы ───
router.post('/', auth, (req, res) => {
  try {
    const {
      stands_snapshot,
      result,
      game_id = null,
      opponent_name = null,
      is_ai = false,
      ai_difficulty = null,
      player_skin_id = null,
      background_id = null,
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
      req.user.id,
      game_id || null,
      oppName,
      is_ai ? 1 : 0,
      aiDiff,
      snapshotJson,
      skin,
      bg,
      result
    )
    res.json({ ok: true, id: info.lastInsertRowid })
  } catch (e) {
    console.error('POST /buildings error:', e)
    res.status(500).json({ error: 'Не удалось сохранить здание' })
  }
})

// ─── GET /api/buildings/stats/:userId — агрегаты ───
// ВАЖНО: stats должен быть выше /:userId, иначе перехватится
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

// ─── GET /api/buildings/:userId — список зданий ───
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

// ─── DELETE /api/buildings/:id — удалить (только владелец) ───
router.delete('/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: 'invalid id' })
  const row = db.prepare('SELECT user_id FROM victory_buildings WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'not found' })
  if (row.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' })
  db.prepare('DELETE FROM victory_buildings WHERE id = ?').run(id)
  res.json({ ok: true })
})

export default router
