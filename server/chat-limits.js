/**
 * Chat rate limiting + admin mute
 *
 * Используется в:
 *  - POST /api/chat (REST fallback)
 *  - WS обработчик 'globalChat'
 *
 * Колонка users.chat_muted_until добавляется здесь idempotent ALTER'ом,
 * чтобы не трогать основную миграционную систему db.js.
 */

import { db } from './db.js'

try { db.exec('ALTER TABLE users ADD COLUMN chat_muted_until INTEGER NOT NULL DEFAULT 0') } catch {}

// Per-user rate limit: одно сообщение в RATE_WINDOW_MS
const RATE_WINDOW_MS = 3000
const lastSent = new Map() // userId → ts

// Очистка старых записей раз в 5 минут (memory leak prevention)
setInterval(() => {
  const cutoff = Date.now() - 600000
  for (const [k, v] of lastSent) if (v < cutoff) lastSent.delete(k)
}, 300000).unref?.()

const getMutedUntilStmt = db.prepare('SELECT chat_muted_until FROM users WHERE id = ?')

/**
 * Можно ли userId сейчас отправить сообщение в чат.
 * @returns {{allowed: boolean, reason?: 'muted'|'rate_limit'|'no_user', until?: number, retryAfterMs?: number}}
 */
export function canChatNow(userId) {
  if (!userId) return { allowed: false, reason: 'no_user' }
  const now = Date.now()

  const row = getMutedUntilStmt.get(userId)
  const mutedUntil = row?.chat_muted_until || 0
  if (mutedUntil > now) {
    return { allowed: false, reason: 'muted', until: mutedUntil }
  }

  const last = lastSent.get(userId) || 0
  if (now - last < RATE_WINDOW_MS) {
    return { allowed: false, reason: 'rate_limit', retryAfterMs: RATE_WINDOW_MS - (now - last) }
  }

  lastSent.set(userId, now)
  return { allowed: true }
}

const muteStmt = db.prepare('UPDATE users SET chat_muted_until = ? WHERE id = ?')

/**
 * Замутить юзера на N минут. Если minutes<=0 → ~100 лет (по сути перманент).
 * @returns {number} timestamp до которого юзер замучен
 */
export function muteUser(userId, minutes) {
  const ms = minutes > 0 ? minutes * 60000 : 100 * 365 * 86400000
  const until = Date.now() + ms
  muteStmt.run(until, userId)
  lastSent.delete(userId)
  return until
}

export function unmuteUser(userId) {
  muteStmt.run(0, userId)
}

const listMutedStmt = db.prepare(`
  SELECT id, username, chat_muted_until
  FROM users
  WHERE chat_muted_until > ?
  ORDER BY chat_muted_until DESC
`)

export function listMuted() {
  return listMutedStmt.all(Date.now())
}

export const RATE_LIMIT_WINDOW_MS = RATE_WINDOW_MS
