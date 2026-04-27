/**
 * Структурированное логирование через pino.
 *
 * dev: pino-pretty (цветные уровни, читаемый вывод)
 * prod: JSON-строки на stdout (грепабельно через jq, съедается DataDog/Loki/Splunk)
 * test (VITEST=true): silent — иначе вывод тестов замусорен.
 *
 * Глобальный logger для startup/shutdown/migrations/fatal событий.
 * HTTP-логирование делает pino-http в server.js (см. httpLogger ниже).
 */

import pino from 'pino'
import pinoHttp from 'pino-http'
import { randomUUID } from 'node:crypto'

const isProd = process.env.NODE_ENV === 'production'
const isTest = !!process.env.VITEST

const level = isTest ? 'silent' : (process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'))

const transport = !isProd && !isTest
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
  : undefined

export const logger = pino({
  level,
  transport,
  base: { service: 'stolbiki-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * HTTP-middleware: проставляет req.id (UUID v4 или из X-Request-Id)
 * и логирует summary каждого запроса. Уровень зависит от status code.
 *
 * БОДИ НЕ ЛОГИРУЕМ — может содержать пароли, JWT, PII.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id']
    const existing = typeof incoming === 'string' && incoming.length > 0 && incoming.length < 100 ? incoming : null
    const id = existing || randomUUID()
    res.setHeader('X-Request-Id', id)
    return id
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.ip }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} ${err?.message || ''}`,
  // Обрезаем входящие X-Request-Id чтобы атакующий не запихивал в логи 1МБ строку.
})

/**
 * Обёртка над console.* для легаси-кода. Не использовать в новом коде — ребять logger.* напрямую.
 */
export function patchConsole() {
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error }
  console.log = (...args) => logger.info({ legacy: 'console.log' }, args.map(String).join(' '))
  console.info = (...args) => logger.info({ legacy: 'console.info' }, args.map(String).join(' '))
  console.warn = (...args) => logger.warn({ legacy: 'console.warn' }, args.map(String).join(' '))
  console.error = (...args) => logger.error({ legacy: 'console.error' }, args.map(String).join(' '))
  return () => { Object.assign(console, orig) }
}
