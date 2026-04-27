// @ts-check
/**
 * Structured logger без зависимостей.
 *
 * Pino-подобный API: logger.info(msg, fields), logger.error(msg, fields), .child().
 * - В prod (NODE_ENV=production): однострочный JSON в stdout (грепабельно
 *   через jq, парсится Loki/Datadog/Grafana без перенастроек).
 * - В dev: цветной pretty-вывод.
 * - В тестах (VITEST=true или NODE_ENV=test): silent — не засирает CI-output.
 *
 * Уровни: trace(10) debug(20) info(30) warn(40) error(50) fatal(60).
 * Фильтр через LOG_LEVEL env (default: info в prod, debug в dev).
 *
 * Без deps намеренно: pino добавил бы +200KB и потребовал бы lockfile-rebuild.
 * Этот файл ~80 LOC и закрывает 95% потребностей.
 */

import { randomUUID } from 'crypto'

/** @type {Record<string, number>} */
const LEVEL = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 }
const ENV_LEVEL = LEVEL[String(process.env.LOG_LEVEL || '').toLowerCase()]
const MIN_LEVEL = ENV_LEVEL ?? (process.env.NODE_ENV === 'production' ? LEVEL.info : LEVEL.debug)
const PRETTY = process.env.NODE_ENV !== 'production' && !process.env.VITEST
const SILENT = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'

/** @type {Record<string, number>} */
const COLORS = { trace: 90, debug: 36, info: 32, warn: 33, error: 31, fatal: 35 }

/**
 * @param {string} level
 * @param {string} msg
 * @param {Record<string, any>} [fields]
 */
function emit(level, msg, fields) {
  if (SILENT) return
  if (LEVEL[level] < MIN_LEVEL) return
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    pid: process.pid,
    ...(fields || {}),
  }
  if (PRETTY) {
    const c = COLORS[level] || 0
    const fieldStr = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : ''
    process.stdout.write(`\x1b[${c}m[${level.toUpperCase()}]\x1b[0m ${entry.time} ${msg}${fieldStr}\n`)
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n')
  }
}

/**
 * @typedef {Object} Logger
 * @property {(msg: string, fields?: Record<string, any>) => void} debug
 * @property {(msg: string, fields?: Record<string, any>) => void} info
 * @property {(msg: string, fields?: Record<string, any>) => void} warn
 * @property {(msg: string, fields?: Record<string, any>) => void} error
 * @property {(msg: string, fields?: Record<string, any>) => void} fatal
 * @property {(extra: Record<string, any>) => Logger} child
 */

/**
 * @param {Record<string, any>} [bound]
 * @returns {Logger}
 */
function makeLogger(bound) {
  /** @param {Record<string, any> | undefined} f */
  const merge = bound
    ? (f) => ({ ...bound, ...(f || {}) })
    : (f) => f
  return {
    debug: (msg, fields) => emit('debug', msg, merge(fields)),
    info: (msg, fields) => emit('info', msg, merge(fields)),
    warn: (msg, fields) => emit('warn', msg, merge(fields)),
    error: (msg, fields) => emit('error', msg, merge(fields)),
    fatal: (msg, fields) => emit('fatal', msg, merge(fields)),
    child: (extra) => makeLogger({ ...(bound || {}), ...extra }),
  }
}

export const logger = makeLogger()

/**
 * Express middleware: проставляет req.id (UUID) и заголовок X-Request-ID.
 * Если клиент прислал X-Request-ID — используем его (для трассировки через
 * прокси/балансировщик). Иначе генерируем новый.
 *
 * @param {import('express').Request & { id?: string }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id']
  req.id = (typeof incoming === 'string' && incoming.length > 0 && incoming.length < 100)
    ? incoming
    : randomUUID()
  res.setHeader('X-Request-ID', req.id)
  next()
}

/**
 * Express middleware: пишет 1 лог-строку на каждый ответ с
 * reqId/method/path/status/duration. Подключать после requestId().
 *
 * @param {import('express').Request & { id?: string }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function accessLog(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    emit(level, 'http', {
      reqId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ua: String(req.headers['user-agent'] || '').slice(0, 80),
      ip: req.ip,
    })
  })
  next()
}
