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
      return next()
    }
    entry.count++
    if (entry.count > max) return res.status(429).json({ error: 'Слишком много запросов' })
    next()
  }
}

// Чистка каждые 5 минут
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimits) { if (now - v.start > 120000) rateLimits.delete(k) }
  for (const [k, v] of gameSubmitLimits) { if (now - v > 60000) gameSubmitLimits.delete(k) }
  if (rateLimits.size > 50000) rateLimits.clear()
}, 300000)

// ═══ JWT Auth ═══
export function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`).run(req.user.id)
    next()
  } catch (authErr) {
    console.error('AUTH ERROR:', authErr.message)
    res.status(401).json({ error: 'Неверный токен' })
  }
}

// ═══ Admin Only ═══
export function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Нужен админ-доступ' })
  next()
}
