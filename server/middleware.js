/**
 * Middleware — авторизация, rate limiting, admin check
 */

import jwt from 'jsonwebtoken'
import { db, JWT_SECRET } from './db.js'

// ═══ Rate Limiting (in-memory) ═══
export const rateLimits = new Map()
const gameSubmitLimits = new Map()
export { gameSubmitLimits }

export function rateLimit(windowMs = 60000, max = 60) {
  return (req, res, next) => {
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
const lastSeenCache = new Map() // userId → timestamp последнего UPDATE
const LAST_SEEN_INTERVAL = 300000 // 5 минут

// Очистка устаревших записей каждые 5 мин (memory leak prevention)
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimits) { if (now - v.start > 120000) rateLimits.delete(k) }
  for (const [k, v] of gameSubmitLimits) { if (now - v > 60000) gameSubmitLimits.delete(k) }
  for (const [k, v] of lastSeenCache) { if (now - v > 600000) lastSeenCache.delete(k) }
  if (rateLimits.size > 50000) rateLimits.clear()
}, 300000)

export function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // Обновляем last_seen не чаще раза в 5 минут — снижаем нагрузку на SQLite
    const now = Date.now()
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
