/**
 * Глобальный чат — REST API
 * Issue #6: Социальный слой
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { canChatNow } from '../chat-limits.js'

const router = Router()

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

// ═══ filterText v2 ═══
// Наивный blacklist + нормализация — закрывает простейшие обходы:
//   - homoglyph substitution (а→a, е→e, о→o, х→x, р→p, у→y)
//   - zero-width & control characters
//   - combining diacritics (NFKC раскладывает)
//   - whitespace/пунктуация между буквами (х_у_й, х.у.й)
// Для игрового чата этого достаточно. "Умные" обходы всё равно
// ловятся user-report + admin /api/admin/chat/mute.

const HOMOGLYPH_MAP = {
  'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к',
  'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у',
  '0': 'о', '3': 'з', '6': 'б',
}

function normalizeForMatch(text) {
  let t = text.normalize('NFKC').toLowerCase()
  // U+200B..U+200D (ZWSP, ZWNJ, ZWJ), U+FEFF (BOM), U+180E (MVS)
  // U+2060..U+206F (word joiners, invisible ops)
  t = t.replace(/[\u200B-\u200D\uFEFF\u180E\u2060-\u206F]/g, '')
  t = t.replace(/[^\p{L}]/gu, c => HOMOGLYPH_MAP[c] || '')
  t = t.split('').map(c => HOMOGLYPH_MAP[c] || c).join('')
  return t
}

const BAD_WORDS = ['мудак', 'пидор', 'блядь', 'ублюдок', 'сука', 'хуй', 'пизда', 'ебаный', 'nigger', 'faggot']
const BAD_STEMS = ['хуй', 'пизд', 'ебан', 'ебал', 'ебат', 'пидор', 'мудак', 'сук', 'блядь']

function filterText(text) {
  if (!text) return ''
  const normalized = normalizeForMatch(text)

  let hasBad = false
  for (const stem of BAD_STEMS) {
    if (normalized.includes(stem)) { hasBad = true; break }
  }
  if (!hasBad) return text.trim()

  let t = text.trim()
  for (const w of BAD_WORDS) {
    t = t.replace(new RegExp(w, 'gi'), m => '*'.repeat(m.length))
  }
  t = t.split(/(\s+)/).map(word => {
    if (!word.trim()) return word
    const normWord = normalizeForMatch(word)
    for (const stem of BAD_STEMS) {
      if (normWord.includes(stem)) return '*'.repeat(Math.min(word.length, 10))
    }
    return word
  }).join('')

  return t
}

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
