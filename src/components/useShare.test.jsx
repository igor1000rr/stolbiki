// @vitest-environment happy-dom
/**
 * Тест для useShare хука который управляет share / copy-to-clipboard в GoldenRushOnline.
 *
 * ВАЖНО: в happy-dom navigator.share и navigator.clipboard — GETTER-ONLY свойства,
 * поэтому `navigator.clipboard = {...}` бросает TypeError. Используем
 * Object.defineProperty с configurable: true, что переопределяет descriptor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Аналог useShare — та же логика что в GoldenRushOnline.jsx, вынесена как
// pure async функция (без useState) для удобства тестирования.
async function shareOrCopy({ title, text, url }) {
  const fallback = async () => {
    try {
      if (!navigator.clipboard) return { action: 'failed' }
      await navigator.clipboard.writeText(`${text} ${url}`)
      return { action: 'copied' }
    } catch {
      return { action: 'failed' }
    }
  }
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return { action: 'shared' }
    }
    return await fallback()
  } catch (e) {
    if (e?.name === 'AbortError') return { action: 'aborted' }
    return await fallback()
  }
}

// Хелперы: переопределяем navigator.share / navigator.clipboard через defineProperty
// (в happy-dom они могут быть getter-only, прямое присваивание кинет TypeError).
function setShare(value) {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true })
}
function setClipboard(value) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true })
}

beforeEach(() => {
  // Сбрасываем оба свойства в undefined перед каждым тестом.
  setShare(undefined)
  setClipboard(undefined)
})

describe('useShare/shareOrCopy — navigator.share present', () => {
  it('вызывает navigator.share когда доступен (mobile native)', async () => {
    const shareMock = vi.fn(async () => {})
    setShare(shareMock)

    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('shared')
    expect(shareMock).toHaveBeenCalledWith({ title: 'T', text: 'Hello', url: 'https://x' })
  })

  it('AbortError (пользователь закрыл share sheet) — не фоллбекит на clipboard', async () => {
    setShare(vi.fn(async () => {
      const err = new Error('User cancelled')
      err.name = 'AbortError'
      throw err
    }))
    const clipboardWrite = vi.fn()
    setClipboard({ writeText: clipboardWrite })

    const r = await shareOrCopy({ title: 'T', text: 'x', url: 'u' })
    expect(r.action).toBe('aborted')
    expect(clipboardWrite).not.toHaveBeenCalled()
  })

  it('обычная ошибка share — фоллбек на clipboard', async () => {
    setShare(vi.fn(async () => { throw new Error('random fail') }))
    const clipboardWrite = vi.fn(async () => {})
    setClipboard({ writeText: clipboardWrite })

    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('copied')
    expect(clipboardWrite).toHaveBeenCalledWith('Hello https://x')
  })
})

describe('useShare/shareOrCopy — нет navigator.share (desktop)', () => {
  it('фоллбек на clipboard.writeText в десктопном браузере', async () => {
    const clipboardWrite = vi.fn(async () => {})
    setClipboard({ writeText: clipboardWrite })

    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('copied')
    expect(clipboardWrite).toHaveBeenCalledWith('Hello https://x')
  })

  it('нет ни share ни clipboard → failed', async () => {
    // Оба undefined в beforeEach
    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('failed')
  })

  it('clipboard.writeText throws → failed', async () => {
    setClipboard({
      writeText: vi.fn(async () => { throw new Error('permission denied') }),
    })
    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('failed')
  })
})

describe('useShare/shareOrCopy — формат clipboard payload', () => {
  it('склеивает text и url через пробел', async () => {
    const clipboardWrite = vi.fn(async () => {})
    setClipboard({ writeText: clipboardWrite })

    await shareOrCopy({
      title: 'Golden Rush',
      text: 'Играю в стратегию',
      url: 'https://snatch-highrise.com/goldenrush-online',
    })
    expect(clipboardWrite).toHaveBeenCalledWith(
      'Играю в стратегию https://snatch-highrise.com/goldenrush-online'
    )
  })
})
