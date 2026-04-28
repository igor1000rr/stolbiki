/**
 * Простые unit-тесты для logger.js — публичных helpers (child, genReqId).
 * pino в VITEST режиме silent, это ок — проверяем API контракт, не вывод.
 */

import { describe, it, expect } from 'vitest'
import { logger, child, genReqId } from './logger.js'

describe('logger', () => {
  it('экспортирует logger с стандартными методами pino', () => {
    expect(logger).toBeTruthy()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.fatal).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.trace).toBe('function')
    expect(typeof logger.child).toBe('function')
  })

  it('в VITEST level=silent (логи не засоряют test output)', () => {
    expect(logger.level).toBe('silent')
  })

  it('вызов любого уровня не кидает', () => {
    expect(() => logger.info('test')).not.toThrow()
    expect(() => logger.error({ err: new Error('x') }, 'msg')).not.toThrow()
    expect(() => logger.fatal({ x: 1 }, 'crash')).not.toThrow()
  })
})

describe('child(name)', () => {
  it('возвращает child logger с обязательными методами', () => {
    const log = child('migrations')
    expect(log).toBeTruthy()
    expect(typeof log.info).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.child).toBe('function')
  })

  it('разные имена → разные инстансы', () => {
    const a = child('db')
    const b = child('ws')
    expect(a).not.toBe(b)
  })

  it('вызовы не кидают', () => {
    const log = child('test')
    expect(() => log.info({ userId: 42 }, 'hi')).not.toThrow()
    expect(() => log.warn('warn msg')).not.toThrow()
  })
})

describe('genReqId(req)', () => {
  it('берёт X-Request-Id из заголовков если есть', () => {
    const req = { headers: { 'x-request-id': 'abc-123-def' } }
    expect(genReqId(req)).toBe('abc-123-def')
  })

  it('игнорирует не-string X-Request-Id', () => {
    const req = { headers: { 'x-request-id': 12345 } }
    const id = genReqId(req)
    expect(typeof id).toBe('string')
    expect(id).not.toBe(12345)
    expect(id.length).toBeGreaterThan(0)
  })

  it('игнорирует слишком длинный X-Request-Id (>64 символов)', () => {
    const long = 'a'.repeat(100)
    const req = { headers: { 'x-request-id': long } }
    const id = genReqId(req)
    expect(id).not.toBe(long)
    expect(id.length).toBeLessThanOrEqual(8)
  })

  it('генерит фолбек если заголовка нет', () => {
    const req = { headers: {} }
    const id = genReqId(req)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(id.length).toBeLessThanOrEqual(8)
  })

  it('разные вызовы → высоковероятно разные id', () => {
    const req = { headers: {} }
    const ids = new Set()
    for (let i = 0; i < 100; i++) ids.add(genReqId(req))
    // 100 вызовов Math.random().toString(36) дают почти всегда 90+ уникальных
    expect(ids.size).toBeGreaterThan(90)
  })

  it('обрабатывает пустую строку в заголовке', () => {
    const req = { headers: { 'x-request-id': '' } }
    const id = genReqId(req)
    // Пустая строка falsy — идём в fallback
    expect(id.length).toBeGreaterThan(0)
  })
})
