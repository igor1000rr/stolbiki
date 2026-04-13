/**
 * Web Push helper — VAPID, subscriptions table, sendPushTo()
 *
 * VAPID keys:
 *   - production: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY в .env (обязательно)
 *   - dev: автогенерация в server/.vapid (как .jwt-secret)
 *
 * Subject: VAPID_SUBJECT (mailto: или https://) — default https://snatch-highrise.com
 *
 * Если web-push не установлен (npm install не прогнан) — модуль работает в no-op режиме:
 * endpoints возвращают {configured: false}, sendPushTo молча возвращает 0.
 */

import { db } from './db.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Таблица subscriptions для web-push (отдельно от push_tokens которая для capacitor FCM/APNs)
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    endpoint    TEXT    NOT NULL UNIQUE,
    p256dh      TEXT    NOT NULL,
    auth        TEXT    NOT NULL,
    user_agent  TEXT,
    created_at  INTEGER NOT NULL,
    last_used   INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
`)

// ─── Динамический импорт web-push (graceful fallback если не установлен) ───
let webpush = null
try {
  const mod = await import('web-push')
  webpush = mod.default || mod
} catch {
  console.warn('[push] web-push не установлен — push в no-op режиме. Запустите: cd server && npm install')
}

// ─── VAPID keys ───
let VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
let VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'https://snatch-highrise.com'

if (webpush && (!VAPID_PUBLIC || !VAPID_PRIVATE)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы в проде — push отключён')
  } else {
    // Dev: автогенерация в .vapid файл
    const vapidPath = resolve(__dirname, '.vapid')
    if (existsSync(vapidPath)) {
      try {
        const j = JSON.parse(readFileSync(vapidPath, 'utf8'))
        VAPID_PUBLIC = j.publicKey
        VAPID_PRIVATE = j.privateKey
      } catch {}
    }
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      try {
        const keys = webpush.generateVAPIDKeys()
        VAPID_PUBLIC = keys.publicKey
        VAPID_PRIVATE = keys.privateKey
        writeFileSync(vapidPath, JSON.stringify(keys, null, 2), { mode: 0o600 })
        console.log('[push] VAPID keys сгенерированы → server/.vapid (для прода добавь в .env)')
      } catch (e) {
        console.error('[push] не удалось сгенерировать VAPID keys:', e.message)
      }
    }
  }
}

if (webpush && VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  } catch (e) {
    console.error('[push] setVapidDetails ошибка:', e.message)
  }
}

export function isPushConfigured() {
  return !!(webpush && VAPID_PUBLIC && VAPID_PRIVATE)
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC || null
}

const insertSubStmt = db.prepare(`
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(endpoint) DO UPDATE SET
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent
`)

export function saveSubscription(userId, subscription, userAgent) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error('invalid subscription')
  }
  insertSubStmt.run(
    userId,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    (userAgent || '').slice(0, 200),
    Date.now()
  )
}

const deleteSubByEndpointStmt = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
const deleteSubByUserStmt = db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
const getSubsByUserStmt = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?')
const updateLastUsedStmt = db.prepare('UPDATE push_subscriptions SET last_used = ? WHERE id = ?')

export function deleteSubscription(userId, endpoint) {
  if (!endpoint) return
  if (userId) deleteSubByUserStmt.run(userId, endpoint)
  else deleteSubByEndpointStmt.run(endpoint)
}

/**
 * Отправить push всем подпискам юзера.
 * @returns {Promise<{sent: number, removed: number}>}
 */
export async function sendPushTo(userId, payload) {
  if (!isPushConfigured() || !userId) return { sent: 0, removed: 0 }
  const subs = getSubsByUserStmt.all(userId)
  if (subs.length === 0) return { sent: 0, removed: 0 }

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const now = Date.now()
  let sent = 0
  let removed = 0

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 }
      )
      sent++
      try { updateLastUsedStmt.run(now, s.id) } catch {}
    } catch (err) {
      // 404/410 = subscription expired/unregistered, удаляем
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        try { deleteSubByEndpointStmt.run(s.endpoint) } catch {}
        removed++
      }
      // другие ошибки игнорируем (network etc)
    }
  }))

  return { sent, removed }
}
