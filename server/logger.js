/**
 * Structured logger через pino. Точка интеграции в server.js + любые модули
 * которым нужно логировать с уровнями.
 *
 * Уровни (от низшего к высшему): trace, debug, info, warn, error, fatal.
 * По умолчанию: info на проде, debug в dev, silent в VITEST.
 *
 * Формат:
 *   - Production: JSON в stdout (pm2 пишет в logs/, можно грепать через jq).
 *     Каждая запись имеет: time (ISO), level, msg, name, pid + custom fields.
 *   - Development: pino-pretty с цветами и человечески читаемым временем.
 *   - Test (VITEST): silent — иначе логи засоряют test output.
 *
 * Usage:
 *   import { logger } from './logger.js'
 *   logger.info({ userId: 42, action: 'login' }, 'user logged in')
 *   logger.error({ err }, 'failed to do thing')
 *
 * Child logger для контекста (например, на каждый WS connection):
 *   const wsLog = logger.child({ component: 'ws', connId })
 *   wsLog.info({ msgType: 'move' }, 'received')
 */

import pino from 'pino'

const isTest = !!process.env.VITEST
const isProd = process.env.NODE_ENV === 'production'

// В тестах гасим логи (silent level). На проде JSON. В dev — pino-pretty
// если установлен, иначе fallback на JSON.
const baseConfig = {
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')),
  base: { name: 'stolbiki-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Сериализаторы: err → структурированная ошибка с stack, req → метод+url.
  // Это рекомендованные defaults pino — без них Error попадает в лог как {}.
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Не логируем содержимое cookie/authorization — секреты не должны попадать
  // в логи. pino делает redact на этих ключах автоматически (выводит '[Redacted]').
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'password_hash',
      'token',
      'jwt',
      '*.password',
      '*.password_hash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
}

// pino-pretty доступен только в dev. В prod не пытаемся загружать — экономит
// время старта и не падает если pretty не установлен (он в devDependencies).
let transport
if (!isProd && !isTest) {
  try {
    transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,name',
        singleLine: false,
      },
    })
  } catch {
    // pino-pretty не установлен — продолжаем с JSON в stdout
  }
}

export const logger = transport
  ? pino(baseConfig, transport)
  : pino(baseConfig)

// Helper для http-логирования. Используется в pino-http middleware.
// Генерирует короткий req-id для корреляции записей одного запроса.
export function genReqId(req) {
  // Приоритет: X-Request-Id из заголовков (для распределённой трассировки),
  // иначе генерируем сами. 8 символов hex достаточно для не-конфликта внутри
  // одной минуты на одной машине.
  const fromHeader = req.headers['x-request-id']
  if (fromHeader && typeof fromHeader === 'string' && fromHeader.length <= 64) {
    return fromHeader
  }
  return Math.random().toString(36).slice(2, 10)
}
