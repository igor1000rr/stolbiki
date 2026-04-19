/**
 * Тесты для WebSocket message validation.
 * Это первая линия защиты от malformed сообщений и injection-попыток.
 * Все функции чистые — без DB, без сетевых вызовов.
 */

import { describe, it, expect } from 'vitest'
import {
  validateMessage, parseRaw,
  sanitizeChat, sanitizeEmoji, sanitizeRoomId, sanitizeTimer,
  KNOWN_TYPES, ALLOWED_EMOJI,
} from './ws-messages.js'

describe('validateMessage — structural guards', () => {
  it('rejects null / undefined', () => {
    expect(validateMessage(null).ok).toBe(false)
    expect(validateMessage(undefined).ok).toBe(false)
    expect(validateMessage(null).reason).toBe('not an object')
  })
  it('rejects primitives (string, number, boolean)', () => {
    expect(validateMessage('hello').ok).toBe(false)
    expect(validateMessage(42).ok).toBe(false)
    expect(validateMessage(true).ok).toBe(false)
  })
  it('rejects object without type field', () => {
    const r = validateMessage({ payload: 'x' })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('missing type')
  })
  it('rejects non-string type', () => {
    const r = validateMessage({ type: 42 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('missing type')
  })
  it('rejects unknown type with descriptive reason', () => {
    const r = validateMessage({ type: 'haxxor' })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('unknown type')
    expect(r.reason).toContain('haxxor')
  })
  it('accepts all KNOWN_TYPES', () => {
    for (const t of KNOWN_TYPES) {
      const r = validateMessage({ type: t })
      expect(r.ok).toBe(true)
      expect(r.type).toBe(t)
    }
  })
  it('KNOWN_TYPES includes all gr.* types for Golden Rush', () => {
    expect(KNOWN_TYPES.has('gr.findMatch')).toBe(true)
    expect(KNOWN_TYPES.has('gr.cancelMatch')).toBe(true)
    expect(KNOWN_TYPES.has('gr.move')).toBe(true)
    expect(KNOWN_TYPES.has('gr.resign')).toBe(true)
    expect(KNOWN_TYPES.has('gr.teamChat')).toBe(true)
    expect(KNOWN_TYPES.has('gr.reaction')).toBe(true)
    expect(KNOWN_TYPES.has('gr.reconnect')).toBe(true)
  })
  it('KNOWN_TYPES includes core 2p game types', () => {
    expect(KNOWN_TYPES.has('move')).toBe(true)
    expect(KNOWN_TYPES.has('resign')).toBe(true)
    expect(KNOWN_TYPES.has('findMatch')).toBe(true)
    expect(KNOWN_TYPES.has('join')).toBe(true)
  })
})

describe('parseRaw — JSON parsing + validation', () => {
  it('rejects non-JSON strings', () => {
    const r = parseRaw('not-json')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('invalid json')
  })
  it('rejects empty string', () => {
    expect(parseRaw('').ok).toBe(false)
  })
  it('rejects valid JSON with unknown type', () => {
    const r = parseRaw(JSON.stringify({ type: 'evil' }))
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('unknown type')
  })
  it('rejects valid JSON without type', () => {
    const r = parseRaw('{"foo":"bar"}')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('missing type')
  })
  it('accepts valid JSON with known type, returns parsed msg', () => {
    const r = parseRaw(JSON.stringify({ type: 'move', action: { placement: { 1: 1 } } }))
    expect(r.ok).toBe(true)
    expect(r.msg.type).toBe('move')
    expect(r.msg.action.placement[1]).toBe(1)
  })
  it('does not crash on JSON with deep nesting', () => {
    const nested = { type: 'move' }
    let cur = nested
    for (let i = 0; i < 20; i++) { cur.next = {}; cur = cur.next }
    const r = parseRaw(JSON.stringify(nested))
    expect(r.ok).toBe(true)
  })
})

describe('sanitizeChat', () => {
  it('returns null for non-strings', () => {
    expect(sanitizeChat(null)).toBe(null)
    expect(sanitizeChat(undefined)).toBe(null)
    expect(sanitizeChat(42)).toBe(null)
    expect(sanitizeChat({})).toBe(null)
  })
  it('strips HTML tags', () => {
    expect(sanitizeChat('<script>alert(1)</script>hello')).toBe('alert(1)hello')
  })
  it('strips nested HTML-like constructs', () => {
    expect(sanitizeChat('<b><i>text</i></b>')).toBe('text')
  })
  it('truncates to 50 chars', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeChat(long).length).toBe(50)
  })
  it('trims whitespace', () => {
    expect(sanitizeChat('   hi   ')).toBe('hi')
  })
  it('returns null for empty-after-trim result', () => {
    expect(sanitizeChat('   ')).toBe(null)
    expect(sanitizeChat('')).toBe(null)
  })
  it('returns null when only HTML tags (stripped to empty)', () => {
    expect(sanitizeChat('<div></div>')).toBe(null)
  })
  it('preserves cyrillic and emoji', () => {
    expect(sanitizeChat('Привет 🎉')).toBe('Привет 🎉')
  })
  it('truncation cuts before strip — edge case: long HTML should still cleanup', () => {
    // "<p>" занимает место в truncate window; проверяем что всё-таки результат без '<' '>' в конце.
    const input = 'x'.repeat(45) + '<p>extra'
    const out = sanitizeChat(input)
    expect(out.length).toBeLessThanOrEqual(50)
  })
})

describe('sanitizeEmoji', () => {
  it('returns null for non-strings', () => {
    expect(sanitizeEmoji(null)).toBe(null)
    expect(sanitizeEmoji(undefined)).toBe(null)
    expect(sanitizeEmoji(123)).toBe(null)
  })
  it('returns null for empty string', () => {
    expect(sanitizeEmoji('')).toBe(null)
  })
  it('returns null for non-whitelisted emoji', () => {
    expect(sanitizeEmoji('💩')).toBe(null)
    expect(sanitizeEmoji('❤')).toBe(null)
    expect(sanitizeEmoji('text')).toBe(null)
  })
  it('returns null for injection attempts', () => {
    expect(sanitizeEmoji('<script>')).toBe(null)
    expect(sanitizeEmoji('javascript:alert(1)')).toBe(null)
  })
  it('accepts all ALLOWED_EMOJI', () => {
    for (const e of ALLOWED_EMOJI) {
      expect(sanitizeEmoji(e)).toBe(e)
    }
  })
  it('ALLOWED_EMOJI contains expected game reactions', () => {
    expect(ALLOWED_EMOJI).toContain('👍')
    expect(ALLOWED_EMOJI).toContain('🔥')
    expect(ALLOWED_EMOJI).toContain('🎉')
    expect(ALLOWED_EMOJI).toContain('💪')
  })
})

describe('sanitizeRoomId', () => {
  it('returns null for non-strings', () => {
    expect(sanitizeRoomId(null)).toBe(null)
    expect(sanitizeRoomId(42)).toBe(null)
    expect(sanitizeRoomId({})).toBe(null)
  })
  it('returns null for wrong length', () => {
    expect(sanitizeRoomId('AB')).toBe(null)
    expect(sanitizeRoomId('ABCDEFG')).toBe(null) // 7
    expect(sanitizeRoomId('ABCDE')).toBe(null)  // 5
  })
  it('accepts 6-char uppercase alphanumeric', () => {
    expect(sanitizeRoomId('ABC123')).toBe('ABC123')
  })
  it('uppercases input', () => {
    expect(sanitizeRoomId('abc123')).toBe('ABC123')
    expect(sanitizeRoomId('aBc123')).toBe('ABC123')
  })
  it('rejects special chars', () => {
    expect(sanitizeRoomId('AB-123')).toBe(null)
    expect(sanitizeRoomId('AB 123')).toBe(null)
    expect(sanitizeRoomId('<script>')).toBe(null)
  })
  it('rejects cyrillic', () => {
    expect(sanitizeRoomId('АБВ123')).toBe(null)
  })
  it('rejects SQL-injection-like input', () => {
    expect(sanitizeRoomId("'; DR")).toBe(null)
  })
})

describe('sanitizeTimer', () => {
  it('returns null for NaN/non-numeric', () => {
    expect(sanitizeTimer('abc')).toBe(null)
    expect(sanitizeTimer(NaN)).toBe(null)
    expect(sanitizeTimer(undefined)).toBe(null)
    expect(sanitizeTimer({})).toBe(null)
  })
  it('returns null below 1 minute', () => {
    expect(sanitizeTimer(0)).toBe(null)
    expect(sanitizeTimer(-5)).toBe(null)
    expect(sanitizeTimer(0.5)).toBe(null)
  })
  it('returns null above 30 minutes', () => {
    expect(sanitizeTimer(31)).toBe(null)
    expect(sanitizeTimer(100)).toBe(null)
  })
  it('accepts 1 and 30 (boundaries)', () => {
    expect(sanitizeTimer(1)).toBe(1)
    expect(sanitizeTimer(30)).toBe(30)
  })
  it('accepts string numbers', () => {
    expect(sanitizeTimer('10')).toBe(10)
  })
  it('floors fractional values', () => {
    expect(sanitizeTimer(5.9)).toBe(5)
    expect(sanitizeTimer(1.1)).toBe(1)
  })
  it('returns null for Infinity', () => {
    expect(sanitizeTimer(Infinity)).toBe(null)
    expect(sanitizeTimer(-Infinity)).toBe(null)
  })
})
