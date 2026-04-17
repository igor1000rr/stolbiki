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

// ─── filterText v2 ───
// SECURITY-ФИКС: раньше простой .replace(BAD_WORD) тривиально обходился:
//   хyй (y-латинская), х.у.й, х\u200bу\u200bй (zero-width), мудaк (a-латинская)
// Теперь:
//   1) NFKC-нормализация
//   2) удаление zero-width символов
//   3) маппинг латинских confusables в кириллицу
//   4) stem-based matching (ловит склонения: хуевый, пиздатый, ебать, ...)
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u180E\u2060-\u206F]/g
const HOMOGLYPH_MAP = {
  'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'y': 'у', 'x': 'х',
  'b': 'в', 'h': 'н', 'k': 'к', 'm': 'м', 't': 'т', 'i': 'і',
  '0': 'о', '3': 'з', '4': 'ч', '6': 'б',
}
const BAD_STEMS = [
  'мудак', 'мудил',
  'пидор', 'пидар', 'пидрил',
  'бляд', 'блядс',
  'ублюд',
  'сука',
  'хуй', 'хуе', 'хуё', 'хуи', 'хуя', 'хуит',
  'пизд',
  'еба', 'ёба', 'ебат', 'ёбат', 'ебан', 'ёбан',
  'гандон', 'гондон',
  'nigger', 'faggot', 'fuck', 'shit', 'cunt',
]

function normalizeForFilter(text) {
  return text
    .normalize('NFKC')
    .replace(ZERO_WIDTH_RE, '')
    .toLowerCase()
    .split('')
    .map(c => HOMOGLYPH_MAP[c] || c)
    .join('')
}

function filterText(text) {
  const original = String(text || '').trim()
  if (!original) return original
  const normalized = normalizeForFilter(original)

  // Проверка на наличие любого стема — если есть, возвращаем нормализованную
  // версию с заменёнными бранными словами. Оригинальные индексы символов могут
  // не совпадать с нормализованными (NFKC разворачивает лигатуры), поэтому
  // проще работать с нормализованной строкой целиком.
  let needsFilter = false
  for (const stem of BAD_STEMS) {
    if (normalized.includes(stem)) { needsFilter = true; break }
  }
  if (!needsFilter) return original

  let out = normalized
  for (const stem of BAD_STEMS) {
    // Расширяем до границы слова (любые буквы/цифры после стема)
    const re = new RegExp(stem + '[\\p{L}\\p{N}]*', 'gu')
    out = out.replace(re, m => '*'.repeat(m.length))
  }
  return out
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
