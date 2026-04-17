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
  CREATE INDEX IF NOT EXISTS idx_victory_buildings_recent
    ON victory_buildings(created_at DESC);
`)

// SECURITY-ФИКС: UNIQUE индекс на game_id — одна победа = одно здание.
// Раньше клиент мог курлом создать сколько угодно зданий для одной partiji
// и накрутить Hall of Fame. NULL разрешён для legacy-записей без game_id.
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_victory_buildings_game_unique
           ON victory_buildings(game_id) WHERE game_id IS NOT NULL`)
} catch (e) {
  // Если уже были дубликаты в legacy-данных — индекс не создастся.
  // Не валим старт сервера, просто логируем.
  console.warn('[buildings] UNIQUE index on game_id not created:', e.message)
}

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
    try {
      return db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId) || null
    } catch { return null }
  }
}

function safeSelectUsers(ids) {
  if (!ids.length) return new Map()
  const placeholders = ids.map(() => '?').join(',')
  try {
    const rows = db.prepare(`SELECT id, name, avatar_url FROM users WHERE id IN (${placeholders})`).all(...ids)
    return new Map(rows.map(r => [r.id, r]))
  } catch {
    try {
      const rows = db.prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`).all(...ids)
      return new Map(rows.map(r => [r.id, r]))
    } catch { return new Map() }
  }
}

// ═══ Кэши ленты/топов ═══
let feedCache = null
let feedCacheAt = 0
const FEED_TTL_MS = 30 * 1000

let leaderboardCache = null
let leaderboardCacheAt = 0
const LEADERBOARD_TTL_MS = 5 * 60 * 1000

// Экспорт для games.js / ws.js — сбросить кэш после server-side создания здания
export function invalidateBuildingsCache() {
  feedCache = null
  leaderboardCache = null
}

/**
 * SECURITY-КРИТИЧНОЕ: создание здания ТОЛЬКО через верифицированную game row.
 * Вызывается из routes/games.js после verifyGameFromMoves + INSERT INTO games.
 *
 * @param {Object} opts
 * @param {number} opts.userId          — trusted server-side
 * @param {number} opts.gameId          — trusted server-side (lastInsertRowid)
 * @param {boolean} opts.isAi           — trusted (берётся из games.is_online)
 * @param {number|null} opts.aiDifficulty — trusted (games.difficulty)
 * @param {'win'|'draw_won'} opts.result — trusted (вычислен из games.won/closed_golden)
 * @param {string|null} opts.opponentName — cosmetic (до 50 символов)
 * @param {string|null} opts.playerSkinId — cosmetic
 * @param {string|null} opts.backgroundId — cosmetic
 * @param {Array} opts.standsSnapshot    — cosmetic (до 4000 байт JSON)
 * @returns {number|null} id созданной записи или null если уже есть (UNIQUE game_id)
 */
export function createBuildingFromGame(opts) {
  const {
    userId, gameId, isAi, aiDifficulty, result,
    opponentName = null, playerSkinId = null, backgroundId = null,
    standsSnapshot = [],
  } = opts
  if (!userId || !gameId) return null
  if (result !== 'win' && result !== 'draw_won') return null

  const snapshotJson = Array.isArray(standsSnapshot) ? JSON.stringify(standsSnapshot).slice(0, 4000) : '[]'
  const oppName = opponentName ? String(opponentName).slice(0, 50) : null
  const aiDiff = aiDifficulty !== null && aiDifficulty !== undefined ? String(aiDifficulty).slice(0, 20) : null
  const skin = playerSkinId ? String(playerSkinId).slice(0, 50) : null
  const bg = backgroundId ? String(backgroundId).slice(0, 50) : null

  try {
    const info = db.prepare(`
      INSERT INTO victory_buildings
        (user_id, game_id, opponent_name, is_ai, ai_difficulty,
         stands_snapshot, player_skin_id, background_id, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
    `).run(userId, gameId, oppName, isAi ? 1 : 0, aiDiff, snapshotJson, skin, bg, result)
    invalidateBuildingsCache()
    try { invalidateOgCache(userId) } catch {}
    return info.lastInsertRowid
  } catch (e) {
    // UNIQUE на game_id — значит уже создано (повторный вызов)
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE')) {
      const existing = db.prepare('SELECT id FROM victory_buildings WHERE game_id=?').get(gameId)
      return existing?.id || null
    }
    console.error('[buildings] createBuildingFromGame error:', e)
    return null
  }
}

const router = Router()

// ─── POST /api/buildings ───
// SECURITY-КРИТИЧНЫЙ ФИКС: раньше endpoint доверял клиенту в is_ai/ai_difficulty/
// result — любой curl создавал здание максимального веса и накручивал Hall of Fame.
//
// Теперь: сервер находит последнюю верифицированную победную партию юзера за
// последние 120 секунд (games row со стороны POST /api/games, которая прошла
// verifyGameFromMoves) и берёт trusted-значения ОТТУДА. От клиента принимаем
// только косметику: stands_snapshot, player_skin_id, background_id, opponent_name.
//
// Защита от дублей — UNIQUE INDEX на game_id: повторный POST возвращает
// existing building вместо ошибки.
router.post('/', auth, (req, res) => {
  try {
    const {
      stands_snapshot = [],
      opponent_name = null,
      player_skin_id = null,
      background_id = null,
    } = req.body || {}

    // Ищем последнюю победную партию юзера (won=1 ИЛИ closed_golden=1 для draw_won)
    // за последние 120 секунд — это window между gameOver на клиенте и POST /api/buildings.
    const recentGame = db.prepare(`
      SELECT id, is_online, difficulty, closed_golden, won
      FROM games
      WHERE user_id = ?
        AND played_at >= datetime('now', '-120 seconds')
        AND (won = 1 OR closed_golden = 1)
      ORDER BY played_at DESC
      LIMIT 1
    `).get(req.user.id)

    if (!recentGame) {
      return res.status(403).json({
        error: 'Недавней верифицированной победы не найдено. Сначала POST /api/games.',
      })
    }

    // Если здание для этой game уже создано — возвращаем existing
    const existing = db.prepare('SELECT id FROM victory_buildings WHERE game_id=?').get(recentGame.id)
    if (existing) {
      let city = null
      try { city = compileCity(req.user.id) } catch {}
      return res.json({ ok: true, id: existing.id, city, duplicate: true })
    }

    // Trusted server-side values из games row
    const isAi = !recentGame.is_online
    const aiDifficulty = isAi ? recentGame.difficulty : null
    const result = (recentGame.closed_golden && !recentGame.won) ? 'draw_won' : 'win'

    const buildingId = createBuildingFromGame({
      userId: req.user.id,
      gameId: recentGame.id,
      isAi,
      aiDifficulty,
      result,
      opponentName: opponent_name,
      playerSkinId: player_skin_id,
      backgroundId: background_id,
      standsSnapshot: stands_snapshot,
    })

    if (!buildingId) {
      return res.status(500).json({ error: 'Не удалось сохранить здание' })
    }

    let city = null
    try { city = compileCity(req.user.id) } catch (e) {
      console.error('POST /buildings compileCity error:', e)
    }

    res.json({ ok: true, id: buildingId, city })
  } catch (e) {
    console.error('POST /buildings error:', e)
    res.status(500).json({ error: 'Не удалось сохранить здание' })
  }
})

// ─── GET /api/buildings/leaderboard ───
router.get('/leaderboard', (req, res) => {
  const now = Date.now()
  if (leaderboardCache && (now - leaderboardCacheAt) < LEADERBOARD_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=120')
    return res.json({ ...leaderboardCache, cached_age_sec: Math.round((now - leaderboardCacheAt) / 1000) })
  }

  try {
    const candidates = db.prepare(`
      SELECT user_id, COUNT(*) as wins,
        SUM(
          1
          + CASE WHEN is_ai = 0 THEN 1 ELSE 0 END
          + CASE
              WHEN is_ai = 1 AND CAST(ai_difficulty AS INTEGER) >= 1500 THEN 3
              WHEN is_ai = 1 AND CAST(ai_difficulty AS INTEGER) >= 800  THEN 2
              WHEN is_ai = 1 AND CAST(ai_difficulty AS INTEGER) >= 400  THEN 1
              ELSE 0
            END
          + CASE WHEN result = 'draw_won' THEN 1 ELSE 0 END
        ) as bricks_raw
      FROM victory_buildings
      GROUP BY user_id
      ORDER BY bricks_raw DESC
      LIMIT 100
    `).all()

    if (!candidates.length) {
      const empty = {
        by_score: [], by_bricks: [], by_towers: [], by_crowned: [],
        total_players: 0, total_bricks_global: 0, total_towers_global: 0,
        cached_age_sec: 0,
      }
      leaderboardCache = empty
      leaderboardCacheAt = now
      return res.json(empty)
    }

    const userIds = candidates.map(c => c.user_id)
    const usersMap = safeSelectUsers(userIds)

    const entries = []
    for (const c of candidates) {
      const u = usersMap.get(c.user_id)
      if (!u) continue
      let city
      try { city = compileCity(c.user_id) } catch { continue }
      const closed = city.towers.filter(t => t.is_closed).length
      const crowned = city.towers.filter(t => t.golden_top).length
      const score = closed * 100 + crowned * 50 + city.total_bricks
      entries.push({
        user_id: c.user_id,
        name: u.name,
        avatar_url: u.avatar_url || null,
        total_wins: city.total_wins,
        total_bricks: city.total_bricks,
        closed_towers: closed,
        crowned_towers: crowned,
        score,
      })
    }

    const by_score = [...entries].sort((a, b) => b.score - a.score).slice(0, 20)
    const by_bricks = [...entries].sort((a, b) => b.total_bricks - a.total_bricks).slice(0, 20)
    const by_towers = [...entries].sort((a, b) => b.closed_towers - a.closed_towers || b.total_bricks - a.total_bricks).slice(0, 20)
    const by_crowned = [...entries].sort((a, b) => b.crowned_towers - a.crowned_towers || b.score - a.score).slice(0, 20)

    const totalPlayers = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM victory_buildings').get()?.c || 0
    const totalBricks = entries.reduce((s, e) => s + e.total_bricks, 0)
    const totalTowers = entries.reduce((s, e) => s + e.closed_towers, 0)

    const result = {
      by_score, by_bricks, by_towers, by_crowned,
      total_players: totalPlayers,
      total_bricks_global: totalBricks,
      total_towers_global: totalTowers,
      cached_age_sec: 0,
    }
    leaderboardCache = result
    leaderboardCacheAt = now
    res.set('Cache-Control', 'public, max-age=120')
    res.json(result)
  } catch (e) {
    console.error('GET /buildings/leaderboard error:', e)
    res.status(500).json({ error: 'Не удалось получить топ' })
  }
})

// ─── GET /api/buildings/feed/recent ───
router.get('/feed/recent', (req, res) => {
  const now = Date.now()
  if (feedCache && (now - feedCacheAt) < FEED_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=15')
    return res.json(feedCache)
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50)
    const oneDayAgo = Math.floor(now / 1000) - 24 * 3600

    const recent = db.prepare(`
      SELECT vb.id, vb.user_id, vb.opponent_name, vb.is_ai, vb.ai_difficulty,
             vb.player_skin_id, vb.result, vb.created_at,
             u.name as username
      FROM victory_buildings vb
      LEFT JOIN users u ON u.id = vb.user_id
      ORDER BY vb.created_at DESC
      LIMIT ?
    `).all(limit)

    const items = recent.map(r => ({
      id: r.id,
      user_id: r.user_id,
      username: r.username || `Player #${r.user_id}`,
      opponent: r.opponent_name || (r.is_ai ? 'Snappy' : null),
      is_ai: !!r.is_ai,
      ai_difficulty: r.ai_difficulty,
      skin_id: r.player_skin_id,
      golden: r.result === 'draw_won',
      bricks: brickValue({
        is_ai: !!r.is_ai,
        ai_difficulty: r.ai_difficulty,
        result: r.result,
      }),
      special: isSpecialWin({
        is_ai: !!r.is_ai,
        ai_difficulty: r.ai_difficulty,
        result: r.result,
      }),
      created_at: r.created_at,
    }))

    const day = db.prepare(`
      SELECT COUNT(*) as wins, COUNT(DISTINCT user_id) as players
      FROM victory_buildings
      WHERE created_at >= ?
    `).get(oneDayAgo)

    const all = db.prepare(`
      SELECT COUNT(*) as wins, COUNT(DISTINCT user_id) as players
      FROM victory_buildings
    `).get()

    const bricksRow = db.prepare(`
      SELECT SUM(
        1
        + CASE WHEN is_ai = 0 THEN 1 ELSE 0 END
        + CASE
            WHEN is_ai = 1 AND CAST(ai_difficulty AS INTEGER) >= 1500 THEN 3
            WHEN is_ai = 1 AND CAST(ai_difficulty AS INTEGER) >= 800  THEN 2
            WHEN is_ai = 1 AND CAST(ai_difficulty AS INTEGER) >= 400  THEN 1
            ELSE 0
          END
        + CASE WHEN result = 'draw_won' THEN 1 ELSE 0 END
      ) as total
      FROM victory_buildings
    `).get()

    const result = {
      items,
      stats: {
        wins_24h: day?.wins || 0,
        players_24h: day?.players || 0,
        wins_total: all?.wins || 0,
        players_total: all?.players || 0,
        bricks_total: bricksRow?.total || 0,
      },
      cached_at: now,
    }
    feedCache = result
    feedCacheAt = now
    res.set('Cache-Control', 'public, max-age=15')
    res.json(result)
  } catch (e) {
    console.error('GET /buildings/feed/recent error:', e)
    res.status(500).json({ error: 'Не удалось получить ленту' })
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

// ─── GET /api/buildings/city/:userId ───
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
  invalidateBuildingsCache()
  res.json({ ok: true })
})

export default router
