// @ts-check
/**
 * Pino logger — единая точка для серверных структурированных логов.
 *
 * Использование:
 *   import { child } from './logger.js'
 *   const log = child('auth')
 *   log.info({ userId, refCode }, 'user registered')
 *   log.error({ err: e }, 'register failed')
 *
 * Уровни: trace/debug/info/warn/error/fatal
 * Тесты (process.env.VITEST): silent — не засоряем test output.
 * Прод: PM2 пишет stdout в /opt/stolbiki-api/logs/, JSON читается через
 * `pm2 logs | jq` или `cat logs/api-out-*.log | jq 'select(.level >= 50)'`.
 *
 * Sentry отдельно ловит uncaught/unhandled — pino даёт grep-абельные
 * структурированные логи рядом, чтобы можно было дебажить без UI.
 */
import pino from 'pino'

const isTest = !!process.env.VITEST

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  base: { app: 'highrise-heist' },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Создаёт child-логгер с фиксированным scope (модулем).
 * @param {string} scope
 */
export function child(scope) {
  return logger.child({ scope })
}
