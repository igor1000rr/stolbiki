/**
 * Middleware — авторизация, rate limiting, admin check
 */

import jwt from 'jsonwebtoken'
import { db, JWT_SECRET } from './db.js'

// ═══ Rate Limiting (in-memory) ═══
export const rateLimits = new Map()
const gameSubmitLimits = new Map()
export { gameSubmitLimits }

// В CI/тестах rate-limit мешает: 20 юзеров регистрируются параллельно →
// 11-й получает 429 и тест падает. На проде лимит защищает от brute-force,
// но в изолированном E2E окружении это только помеха.
// Активируется через NODE_ENV=test (ставится в e2e.yml workflow).
const RATE_LIMIT_DISABLED = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

export function rateLimit(windowMs = 60000, max = 60) {
  return (req, res, next) => {
    if (RATE_LIMIT_DISABLED) return next()
    const key = req.ip + ':' + req.path
    const now = Date.now()
    const entry = rateLimits.get(key)
    if (!entry || now - entry.start > windowMs) {
      rateLimits.set(key, { start: now, count: 1 })
      res.setHeader('X-RateLimit-Limit', max)
      res.setHeader('X-RateLimit-Remaining', max - 1)
      return next()
    }
    entry.count++
    const remaining = Math.max(0, max - entry.count)
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', remaining)
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({ error: 'Слишком много запросов', retryAfter })
    }
    next()
  }
}

// ═══ JWT Auth ═══
// lastSeenCache содержит два типа значений:
//   - число (timestamp) — для last_seen (ключ: userId, число)
//   - объект { at, tv } — для token_version (ключ: 'tv:<userId>')
const lastSeenCache = new Map()
const LAST_SEEN_INTERVAL = 300000 // 5 минут

// Очистка устаревших записей каждые 5 мин (memory leak prevention)
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimits) { if (now - v.start > 120000) rateLimits.delete(k) }
  for (const [k, v] of gameSubmitLimits) { if (now - v > 60000) gameSubmitLimits.delete(k) }
  for (const [k, v] of lastSeenCache) {
    const t = typeof v === 'number' ? v : v?.at
    if (typeof t === 'number' && now - t > 600000) lastSeenCache.delete(k)
  }
  // LRU для rateLimits: если всё ещё много — удаляем самые старые
  if (rateLimits.size > 50000) {
    const entries = [...rateLimits.entries()].sort((a, b) => a[1].start - b[1].start)
    const toDelete = entries.slice(0, entries.length - 40000)
    for (const [k] of toDelete) rateLimits.delete(k)
  }
  // LRU для lastSeenCache: на случай всплеска уникальных юзеров
  if (lastSeenCache.size > 20000) {
    const entries = [...lastSeenCache.entries()].sort((a, b) => {
      const ta = typeof a[1] === 'number' ? a[1] : (a[1]?.at || 0)
      const tb = typeof b[1] === 'number' ? b[1] : (b[1]?.at || 0)
      return ta - tb
    })
    const toDelete = entries.slice(0, entries.length - 15000)
    for (const [k] of toDelete) lastSeenCache.delete(k)
  }
}, 300000)

export function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // Token revocation: проверяем token_version раз в 5 мин (кеш снижает нагрузку на SQLite).
    // Edge case: если у юзера в DB token_version > 0 (кто-то отзывал токены), но в токене нет `tv`
    // (старый токен до миграции 7) — тоже отклоняем. Закрывает дыру grace period'а.
    const now = Date.now()
    const cacheKey = `tv:${req.user.id}`
    const cached = lastSeenCache.get(cacheKey)
    let dbTv
    if (!cached || now - cached.at > LAST_SEEN_INTERVAL) {
      const row = db.prepare('SELECT token_version FROM users WHERE id = ?').get(req.user.id)
      dbTv = row?.token_version || 0
      lastSeenCache.set(cacheKey, { at: now, tv: dbTv })
    } else {
      dbTv = cached.tv
    }
    const userTv = req.user.tv
    // Отклоняем если:
    //   - tv есть в токене и не совпадает с DB
    //   - tv НЕТ в токене, но в DB token_version > 0 (значит кто-то отзывал)
    if ((userTv !== undefined && userTv !== dbTv) || (userTv === undefined && dbTv > 0)) {
      return res.status(401).json({ error: 'Токен отозван', expired: true })
    }
    // Обновляем last_seen не чаще раза в 5 минут — снижаем нагрузку на SQLite
    const lastUpdate = lastSeenCache.get(req.user.id)
    if (!lastUpdate || now - lastUpdate > LAST_SEEN_INTERVAL) {
      db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`).run(req.user.id)
      lastSeenCache.set(req.user.id, now)
    }
    next()
  } catch (authErr) {
    if (authErr.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк', expired: true })
    }
    res.status(401).json({ error: 'Неверный токен' })
  }
}

// ═══ Admin Only ═══
export function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Нужен админ-доступ' })
  next()
}
