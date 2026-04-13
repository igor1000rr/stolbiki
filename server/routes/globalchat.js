/**
 * Глобальный чат — REST API
 * Issue #6: Социальный слой
 *
 * Таблица chat_messages создаётся здесь при импорте.
 * WS-рассылка реализована в ws.js (chatSubscribers).
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { canChatNow } from '../chat-limits.js'

const router = Router()

// ─── Миграция БД ───
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    channel   TEXT    NOT NULL DEFAULT 'global',
    user_id   INTEGER,
    username  TEXT    NOT NULL,
    text      TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_channel
    ON chat_messages(channel, created_at DESC);
`)

// Банлист: плохие слова (упрощённый вариант, расширяется в adminka)
const BAD_WORDS = ['мудак', 'пидор', 'блядь', 'ублюдок', 'сука', 'хуй', 'пизда', 'ёбаный', 'nigger', 'faggot']
function filterText(text) {
  let t = text.trim()
  for (const w of BAD_WORDS) {
    t = t.replace(new RegExp(w, 'gi'), m => '*'.repeat(m.length))
  }
  return t
}

/**
 * GET /api/chat?channel=global&before=<id>&limit=50
 * Возвращает до 50 сообщений, опционально постранично (cursor by id)
 */
router.get('/', (req, res) => {
  const channel = (req.query.channel || 'global').slice(0, 20)
  const limit = Math.min(50, parseInt(req.query.limit) || 50)
  const before = parseInt(req.query.before) || null

  let rows
  if (before) {
    rows = db.prepare(
      'SELECT id, username, text, created_at FROM chat_messages WHERE channel=? AND id<? ORDER BY id DESC LIMIT ?'
    ).all(channel, before, limit)
  } else {
    rows = db.prepare(
      'SELECT id, username, text, created_at FROM chat_messages WHERE channel=? ORDER BY id DESC LIMIT ?'
    ).all(channel, limit)
  }

  res.set('Cache-Control', 'no-store')
  res.json(rows.reverse())
})

/**
 * POST /api/chat   { channel, text }
 * Сохраняет сообщение в БД (WS-рассылка делается через ws.js)
 * Используется как fallback если WS недоступен.
 *
 * Rate limit: 1 сообщение / 3 секунды на юзера.
 * Mute check: если users.chat_muted_until > now → 403.
 */
router.post('/', auth, (req, res) => {
  const channel = (req.body.channel || 'global').slice(0, 20)
  const rawText = (req.body.text || '').slice(0, 300)
  if (!rawText.trim()) return res.status(400).json({ error: 'text required' })

  const check = canChatNow(req.user.id)
  if (!check.allowed) {
    if (check.reason === 'muted') {
      return res.status(403).json({ error: 'Вы замучены', muted: true, until: check.until })
    }
    return res.status(429).json({ error: 'Слишком часто', retryAfterMs: check.retryAfterMs })
  }

  const text = filterText(rawText)
  const ts = Date.now()

  const result = db.prepare(
    'INSERT INTO chat_messages (channel, user_id, username, text, created_at) VALUES (?,?,?,?,?)'
  ).run(channel, req.user.id, req.user.username, text, ts)

  res.json({ ok: true, id: result.lastInsertRowid, text, username: req.user.username, created_at: ts })
})

export { filterText }
export default router
