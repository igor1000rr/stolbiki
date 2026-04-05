/**
 * Тесты валидации входящих WS-сообщений.
 * Покрывает: validateMessage, parseRaw, sanitizeChat, sanitizeEmoji, sanitizeRoomId, sanitizeTimer.
 */

import { describe, it, expect } from 'vitest'
import {
  validateMessage, parseRaw,
  sanitizeChat, sanitizeEmoji, sanitizeRoomId, sanitizeTimer,
  KNOWN_TYPES, ALLOWED_EMOJI,
} from '../server/ws-messages.js'

describe('validateMessage', () => {
  it('принимает известные типы', () => {
    for (const type of KNOWN_TYPES) {
      expect(validateMessage({ type }).ok).toBe(true)
    }
  })

  it('отклоняет неизвестный type', () => {
    expect(validateMessage({ type: 'hackMe' }).ok).toBe(false)
    expect(validateMessage({ type: 'admin' }).ok).toBe(false)
  })

  it('отклоняет отсутствующий type', () => {
    expect(validateMessage({}).ok).toBe(false)
    expect(validateMessage({ foo: 'bar' }).ok).toBe(false)
  })

  it('отклоняет не-объекты', () => {
    expect(validateMessage(null).ok).toBe(false)
    expect(validateMessage('string').ok).toBe(false)
    expect(validateMessage(123).ok).toBe(false)
  })
})

describe('parseRaw', () => {
  it('парсит валидный JSON с известным типом', () => {
    const r = parseRaw('{"type":"move","action":{}}')
    expect(r.ok).toBe(true)
    expect(r.msg.type).toBe('move')
  })

  it('отклоняет невалидный JSON', () => {
    expect(parseRaw('not json').ok).toBe(false)
    expect(parseRaw('{broken').ok).toBe(false)
  })

  it('отклоняет валидный JSON с неизвестным type', () => {
    expect(parseRaw('{"type":"shutdown"}').ok).toBe(false)
  })
})

describe('sanitizeChat', () => {
  it('обрезает до 50 символов', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeChat(long).length).toBe(50)
  })

  it('удаляет HTML теги', () => {
    expect(sanitizeChat('<script>alert(1)</script>hi')).toBe('alert(1)hi')
    expect(sanitizeChat('<b>bold</b>')).toBe('bold')
  })

  it('возвращает null для пустой или не-строки', () => {
    expect(sanitizeChat('')).toBe(null)
    expect(sanitizeChat('   ')).toBe(null)
    expect(sanitizeChat(null)).toBe(null)
    expect(sanitizeChat(123)).toBe(null)
  })

  it('тримит пробелы', () => {
    expect(sanitizeChat('  hi  ')).toBe('hi')
  })
})

describe('sanitizeEmoji', () => {
  it('пропускает только whitelist', () => {
    for (const e of ALLOWED_EMOJI) {
      expect(sanitizeEmoji(e)).toBe(e)
    }
  })

  it('отклоняет левые эмоджи', () => {
    expect(sanitizeEmoji('💀')).toBe(null)
    expect(sanitizeEmoji('🤡')).toBe(null)
    expect(sanitizeEmoji('not-emoji')).toBe(null)
    expect(sanitizeEmoji('')).toBe(null)
    expect(sanitizeEmoji(null)).toBe(null)
  })
})

describe('sanitizeRoomId', () => {
  it('принимает 6 символов A-Z0-9', () => {
    expect(sanitizeRoomId('ABC123')).toBe('ABC123')
    expect(sanitizeRoomId('abc123')).toBe('ABC123') // приводит к upper
    expect(sanitizeRoomId('XYZ789')).toBe('XYZ789')
  })

  it('отклоняет длину != 6', () => {
    expect(sanitizeRoomId('ABC12')).toBe(null)
    expect(sanitizeRoomId('ABC1234')).toBe(null)
    expect(sanitizeRoomId('')).toBe(null)
  })

  it('отклоняет недопустимые символы', () => {
    expect(sanitizeRoomId('ABC-12')).toBe(null)
    expect(sanitizeRoomId("ABC'12")).toBe(null)
    expect(sanitizeRoomId('ABC 12')).toBe(null)
    expect(sanitizeRoomId(null)).toBe(null)
  })
})

describe('sanitizeTimer', () => {
  it('принимает 1-30 минут', () => {
    expect(sanitizeTimer(5)).toBe(5)
    expect(sanitizeTimer(30)).toBe(30)
    expect(sanitizeTimer(1)).toBe(1)
    expect(sanitizeTimer('10')).toBe(10)
  })

  it('отклоняет вне диапазона', () => {
    expect(sanitizeTimer(0)).toBe(null)
    expect(sanitizeTimer(31)).toBe(null)
    expect(sanitizeTimer(-5)).toBe(null)
    expect(sanitizeTimer(9999)).toBe(null)
  })

  it('отклоняет не-числа и спецзначения', () => {
    expect(sanitizeTimer('abc')).toBe(null)
    expect(sanitizeTimer(null)).toBe(null)
    expect(sanitizeTimer(Infinity)).toBe(null)
    expect(sanitizeTimer(NaN)).toBe(null)
  })

  it('приводит к целому', () => {
    expect(sanitizeTimer(5.9)).toBe(5)
    expect(sanitizeTimer(10.1)).toBe(10)
  })
})
