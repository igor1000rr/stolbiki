/**
 * Sentry — error monitoring (опционально).
 *
 * Активируется только если задан VITE_SENTRY_DSN в env. Без DSN — noop:
 * приложение работает обычно, ошибки пишутся в наш /api/error-report.
 *
 * ВАЖНО: @sentry/react импортируется ДИНАМИЧЕСКИ — если пакет не установлен
 * (забыли npm install после моего коммита), init просто не сработает,
 * а приложение не развалится на старте. Это критично для native билда,
 * где отсутствие dep в dist = белый экран в WebView.
 *
 * Зачем: Sentry даёт desymbolicated stack traces (с source maps),
 * breadcrumbs, replay при ошибке, release tracking — всё то чего
 * нет в error_reports table. Наш самодельный report остаётся как fallback.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN
let initialized = false
let SentryRef = null // Держим ссылку на модуль для captureException/setUser

export async function initSentry() {
  if (initialized) return
  if (!DSN) return // Без DSN — не инициализируем, ничего не шлём.

  try {
    // Dynamic import: если @sentry/react не установлен — catch ниже
    // съест ошибку, приложение продолжит работу без Sentry.
    const Sentry = await import('@sentry/react')
    SentryRef = Sentry

    Sentry.init({
      dsn: DSN,
      release: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
      environment: import.meta.env.PROD ? 'production' : 'development',

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

      sendDefaultPii: false,

      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        /Loading chunk \d+ failed/,
        /ChunkLoadError/,
      ],

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
    Sentry.setTag('native', !!window.Capacitor?.isNativePlatform?.())
    Sentry.setTag('platform', window.Capacitor?.getPlatform?.() || 'web')
  } catch (e) {
    // Модуль не установлен, CDN блокирован, или init упал — не критично.
    // eslint-disable-next-line no-console
    console.warn('[sentry] init skipped:', e?.message || e)
  }
}

export function setSentryUser(user) {
  if (!initialized || !SentryRef) return
  try {
    if (user) {
      SentryRef.setUser({ id: String(user.id), username: user.username })
    } else {
      SentryRef.setUser(null)
    }
  } catch {}
}

export function captureException(error, context) {
  if (!initialized || !SentryRef) return
  try { SentryRef.captureException(error, context ? { extra: context } : undefined) } catch {}
}
