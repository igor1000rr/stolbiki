/**
 * Структурированный логгер на pino + pino-http.
 *
 * - prod: JSON (1 строка = 1 событие, grep-абельно через jq, готово для loki/datadog)
 * - dev:  pretty-print через pino-pretty (в devDependencies, на проде не устанавливается)
 *
 * Раньше всё было через console.log/error — нет уровней, нет request-id, не агрегируется.
 * Sentry закрывает только runtime errors, операционные события (миграции, auth-failures,
 * graceful shutdown, csp-init) терялись.
 *
 * Способ использования:
 *   import { logger } from './logger.js'
 *   logger.info({ userId: 42 }, 'user logged in')
 *   logger.error({ err, reqId: req.id }, 'падение в X')
 *
 * Каждый обработчик Express получает req.log = child logger с reqId — логи внутри
 * одного запроса автоматом тегаются и связываются через grep по reqId.
 */
import pino from 'pino'
import pinoHttp from 'pino-http'
import { randomBytes } from 'crypto'

const isDev = process.env.NODE_ENV !== 'production'
const isTest = !!process.env.VITEST

// pino-pretty используется через worker thread транспорт. На проде (--omit=dev)
// пакета нет — поэтому выключаем transport. Сырой JSON-вывод это и нужно
// для агрегаторов типа loki/datadog/grafana cloud.
const transport = (isDev && !isTest) ? {
  target: 'pino-pretty',
  options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service' },
} : undefined

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : (isDev ? 'debug' : 'info')),
  base: { service: 'highrise-heist-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport,
})

// pino-http: автоматическое логирование каждого запроса с request-id
// и временем ответа. req.log = child logger с reqId, method, url — все
// логи внутри обработчиков автоматом тегаются.
export const httpLogger = pinoHttp({
  logger,
  // Принимаем X-Request-ID от клиента/proxy если задан (для distributed tracing),
  // иначе генерим короткий hex. Отдаём в ответе — клиент может логать у себя.
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id']
    const id = (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64)
      ? incoming
      : randomBytes(8).toString('hex')
    res.setHeader('X-Request-ID', id)
    return id
  },
  // Шумные эндпоинты (поллинг health-checkа, аналитика с клиентов) в логи не пишем —
  // иначе реальные события тонут в мусоре и папка логов раздувается.
  autoLogging: {
    ignore: (req) => {
      const url = req.url || ''
      if (url.startsWith('/api/health')) return true
      if (url.startsWith('/api/track')) return true
      if (url.startsWith('/api/stats')) return true
      return false
    },
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  // Скрываем чувствительные данные из автоматических логов.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-jwt"]',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
})

export default logger
