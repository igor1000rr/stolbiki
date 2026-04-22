/**
 * Sentry — error monitoring (опционально).
 *
 * Активируется только если задан VITE_SENTRY_DSN в env. Без DSN — noop:
 * приложение работает обычно, ошибки пишутся в наш /api/error-report.
 *
 * Зачем: Sentry даёт desymbolicated stack traces (с source maps),
 * breadcrumbs, replay при ошибке, release tracking — всё то чего
 * нет в error_reports table. Наш самодельный report остаётся как fallback.
 *
 * CSP: sentry.io и *.ingest.sentry.io добавлены в connect-src в server.js
 * только когда VITE_SENTRY_DSN задан — нет, сейчас CSP у нас статический,
 * нужно отдельно расширить connectSrc когда будем конфигурировать сервер.
 */

import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN
let initialized = false

export function initSentry() {
  if (initialized) return
  if (!DSN) return // Без DSN — не инициализируем, ничего не шлём.

  try {
    Sentry.init({
      dsn: DSN,
      release: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
      environment: import.meta.env.PROD ? 'production' : 'development',

      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        // Replay: запись пользовательской сессии (DOM снапшоты + ввод).
        // На 0% всех сессий, 100% только на сессиях с ошибками — экономия квоты.
        Sentry.replayIntegration({
          maskAllText: false, // у нас нет PII в UI (только username и игра)
          blockAllMedia: false,
        }),
      ],

      // Performance sampling: 10% транзакций — достаточно чтобы
      // видеть деградации LCP/INP без выжирания квоты.
      tracesSampleRate: 0.1,

      // Session replay sampling
      replaysSessionSampleRate: 0,   // нормальные сессии не записываем
      replaysOnErrorSampleRate: 1.0, // 100% сессий с ошибкой

      // Telemetry opt-out — не шлём внутреннюю телеметрию SDK.
      sendDefaultPii: false,

      // Игнорируем известный браузерный шум.
      ignoreErrors: [
        // ResizeObserver — косметические warnings, не ломают ничего
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Рекламные блокеры блокируют Metrika
        'Non-Error promise rejection captured',
        /Loading chunk \d+ failed/, // после деплоя старые вкладки не находят чанки
        /ChunkLoadError/,
      ],

      // Фильтруем ошибки из браузерных расширений — их мы не контролируем.
      beforeSend(event) {
        const frames = event.exception?.values?.[0]?.stacktrace?.frames || []
        const isExtension = frames.some(f =>
          /chrome-extension:|moz-extension:|safari-extension:/.test(f.filename || '')
        )
        if (isExtension) return null
        return event
      },
    })

    initialized = true
    // Теги для быстрого фильтра в дашборде Sentry.
    Sentry.setTag('native', !!window.Capacitor?.isNativePlatform?.())
    Sentry.setTag('platform', window.Capacitor?.getPlatform?.() || 'web')
  } catch (e) {
    // SDK не должен ломать приложение
    console.warn('[sentry] init failed:', e?.message)
  }
}

/**
 * Дописываем юзера в scope когда знаем kто вошёл.
 * Вызывать из AuthContext при login/logout.
 */
export function setSentryUser(user) {
  if (!initialized) return
  try {
    if (user) {
      Sentry.setUser({ id: String(user.id), username: user.username })
    } else {
      Sentry.setUser(null)
    }
  } catch {}
}

/**
 * Ручной репорт из ErrorBoundary/catch блоков.
 * Старается не крашиться если Sentry не инициализирован.
 */
export function captureException(error, context) {
  if (!initialized) return
  try { Sentry.captureException(error, context ? { extra: context } : undefined) } catch {}
}

export { Sentry }
