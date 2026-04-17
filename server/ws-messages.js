/**
 * Валидация входящих WebSocket сообщений.
 * Каждый handler возвращает { ok, reason? } или { ok: true, data }.
 * Вынесено из ws.js для удобства тестирования и чтобы не пускать мусор в игровую логику.
 */

const KNOWN_TYPES = new Set([
  'auth', 'join', 'spectate', 'findMatch', 'cancelMatch', 'reconnect',
  'move', 'resign', 'chat', 'reaction',
  'drawOffer', 'drawResponse', 'gameOver',
  'rematchOffer', 'rematchResponse',
  // Глобальный чат (обрабатываются в ws.js)
  'globalChat', 'joinGlobalChat', 'leaveGlobalChat',
  // Golden Rush online 2v2 (отдельный пространств имён)
  'gr.findMatch', 'gr.cancelMatch', 'gr.move', 'gr.resign',
  'gr.teamChat', 'gr.reaction', 'gr.reconnect',
])

const ALLOWED_EMOJI = ['👍', '🔥', '😮', '😂', '💪', '🎉']

/**
 * Проверяет базовую структуру входящего сообщения.
 * @returns {{ok: boolean, reason?: string, type?: string}}
 */
export function validateMessage(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' }
  if (typeof raw.type !== 'string') return { ok: false, reason: 'missing type' }
  if (!KNOWN_TYPES.has(raw.type)) return { ok: false, reason: `unknown type: ${raw.type}` }
  return { ok: true, type: raw.type }
}

/**
 * Валидация JSON. Возвращает { ok, msg? | reason? }.
 */
export function parseRaw(raw) {
  let msg
  try { msg = JSON.parse(raw) } catch { return { ok: false, reason: 'invalid json' } }
  const v = validateMessage(msg)
  if (!v.ok) return { ok: false, reason: v.reason }
  return { ok: true, msg }
}

/**
 * Валидация chat: text → очищенная строка ≤50 chars или null.
 */
export function sanitizeChat(text) {
  if (typeof text !== 'string') return null
  const clean = text.replace(/<[^>]*>/g, '').slice(0, 50).trim()
  return clean || null
}

/**
 * Валидация reaction: эмоджи из whitelist или null.
 */
export function sanitizeEmoji(emoji) {
  if (typeof emoji !== 'string') return null
  return ALLOWED_EMOJI.includes(emoji) ? emoji : null
}

/**
 * Валидация roomId: 6 символов, A-Z0-9.
 */
export function sanitizeRoomId(id) {
  if (typeof id !== 'string') return null
  const clean = id.toUpperCase()
  return /^[A-Z0-9]{6}$/.test(clean) ? clean : null
}

/**
 * Валидация таймера (минуты): 1-30.
 */
export function sanitizeTimer(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  if (n < 1 || n > 30) return null
  return Math.floor(n)
}

export { KNOWN_TYPES, ALLOWED_EMOJI }
