/**
 * Issue #6 — Achievement rarity
 * GET /api/achievements/rarity → { total, rarity: { [achievement_id]: { holders, percentage, tier } }, computedAt }
 *
 * База для процента — юзеры с games_played >= 1 (иначе "мёртвые" регистрации размывают %).
 *
 * Tier по порогам:
 *   legendary  < 1%
 *   epic       < 5%
 *   rare       < 20%
 *   common     >= 20%
 *
 * Кэш in-memory 5 минут. Один SQL group-by + COUNT — миллисекунды даже на 100k юзеров
 * благодаря индексу idx_achievements_user (unlocked_at не нужен).
 */

import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

let cache = { at: 0, data: null }
const CACHE_MS = 5 * 60 * 1000

function computeRarity() {
  const totalRow = db.prepare("SELECT COUNT(*) as c FROM users WHERE games_played >= 1").get()
  const total = totalRow?.c || 0

  // holders по каждой ачивке только среди активных игроков
  const rows = db.prepare(`
    SELECT a.achievement_id, COUNT(DISTINCT a.user_id) as holders
    FROM achievements a
    JOIN users u ON u.id = a.user_id
    WHERE u.games_played >= 1
    GROUP BY a.achievement_id
  `).all()

  const out = {}
  const denom = total || 1
  for (const r of rows) {
    const pct = (r.holders / denom) * 100
    let tier = 'common'
    if (pct < 1) tier = 'legendary'
    else if (pct < 5) tier = 'epic'
    else if (pct < 20) tier = 'rare'
    out[r.achievement_id] = {
      holders: r.holders,
      percentage: Math.round(pct * 10) / 10, // 1 знак после запятой
      tier,
    }
  }
  return { total, rarity: out, computedAt: Date.now() }
}

/** Сброс кэша — для админки/тестов */
export function invalidateRarityCache() { cache = { at: 0, data: null } }

router.get('/rarity', (req, res) => {
  const now = Date.now()
  if (!cache.data || now - cache.at > CACHE_MS) {
    cache.data = computeRarity()
    cache.at = now
  }
  // Клиенту тоже 5 минут — нет смысла бить по серверу чаще
  res.set('Cache-Control', 'public, max-age=300')
  res.json(cache.data)
})

/** GET /api/achievements/me — список ачивок текущего юзера с rarity merged */
import { auth } from '../middleware.js'
router.get('/me', auth, (req, res) => {
  const now = Date.now()
  if (!cache.data || now - cache.at > CACHE_MS) {
    cache.data = computeRarity()
    cache.at = now
  }
  const rows = db.prepare(
    'SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC'
  ).all(req.user.id)
  const enriched = rows.map(r => ({
    ...r,
    rarity: cache.data.rarity[r.achievement_id] || { holders: 0, percentage: 0, tier: 'legendary' },
  }))
  res.json({ achievements: enriched, total: cache.data.total })
})

export default router
