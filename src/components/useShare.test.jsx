// @vitest-environment happy-dom
/**
 * Тест для useShare хука который управляет share / copy-to-clipboard в GoldenRushOnline.
 * Хук не экспортируется напрямую — тестируем его поведение через рендер Tutorial + моки.
 * Точнее — проверяем navigator.share/clipboard протокол:
 * в самом GoldenRushOnline кнопки share'ат через тот же хук.
 *
 * Но полный GoldenRushOnline тест сложно заmock'ать (WebSocket, i18n и др.).
 * Давайте вынесем useShare в отдельный модуль — в будущем после рефактора.
 * Пока проверяем navigator API сами через мок.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Аналог useShare — та же логика что в GoldenRushOnline.jsx, вынесена как
// pure async функция (без useState) для удобства тестирования.
async function shareOrCopy({ title, text, url }) {
  const fallback = async () => {
    try {
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

beforeEach(() => {
  delete globalThis.navigator.share
  delete globalThis.navigator.clipboard
})

describe('useShare/shareOrCopy — navigator.share present', () => {
  it('вызывает navigator.share когда доступен (mobile native)', async () => {
    const shareMock = vi.fn(async () => {})
    globalThis.navigator.share = shareMock

    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('shared')
    expect(shareMock).toHaveBeenCalledWith({ title: 'T', text: 'Hello', url: 'https://x' })
  })

  it('AbortError (пользователь закрыл share sheet) — не фоллбекит на clipboard', async () => {
    globalThis.navigator.share = vi.fn(async () => {
      const err = new Error('User cancelled')
      err.name = 'AbortError'
      throw err
    })
    const clipboardWrite = vi.fn()
    globalThis.navigator.clipboard = { writeText: clipboardWrite }

    const r = await shareOrCopy({ title: 'T', text: 'x', url: 'u' })
    expect(r.action).toBe('aborted')
    expect(clipboardWrite).not.toHaveBeenCalled()
  })

  it('обычная ошибка share — фоллбек на clipboard', async () => {
    globalThis.navigator.share = vi.fn(async () => { throw new Error('random fail') })
    const clipboardWrite = vi.fn(async () => {})
    globalThis.navigator.clipboard = { writeText: clipboardWrite }

    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('copied')
    expect(clipboardWrite).toHaveBeenCalledWith('Hello https://x')
  })
})

describe('useShare/shareOrCopy — нет navigator.share (desktop)', () => {
  it('фоллбек на clipboard.writeText в десктопном браузере', async () => {
    const clipboardWrite = vi.fn(async () => {})
    globalThis.navigator.clipboard = { writeText: clipboardWrite }

    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('copied')
    expect(clipboardWrite).toHaveBeenCalledWith('Hello https://x')
  })

  it('нет ни share ни clipboard → failed', async () => {
    // Оба удалены в beforeEach
    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('failed')
  })

  it('clipboard.writeText throws → failed', async () => {
    globalThis.navigator.clipboard = {
      writeText: vi.fn(async () => { throw new Error('permission denied') }),
    }
    const r = await shareOrCopy({ title: 'T', text: 'Hello', url: 'https://x' })
    expect(r.action).toBe('failed')
  })
})

describe('useShare/shareOrCopy — формат clipboard payload', () => {
  it('склеивает text и url через пробел', async () => {
    const clipboardWrite = vi.fn(async () => {})
    globalThis.navigator.clipboard = { writeText: clipboardWrite }

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
