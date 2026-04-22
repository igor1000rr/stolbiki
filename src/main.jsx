import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { GameProvider } from './engine/GameContext'
import { AuthProvider } from './engine/AuthContext'
import { captureReferralCode } from './engine/api'
import { getEmbedComponent } from './components/EmbedRoot'
import App from './App'

// Ловим ?ref=XXX из URL до рендера
captureReferralCode()

// Error Boundary — ловит ошибки React-рендера, репортит на сервер,
// показывает локализованный fallback с кнопками Reload / Home
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, errorInfo) {
    // Репорт на сервер через глобальный reportError (определён ниже, но уже в scope)
    try {
      reportError(error?.message || 'React render error', (error?.stack || '') + '\n\nComponent stack:' + (errorInfo?.componentStack || ''))
    } catch {}
    // Yandex.Metrika goal
    try { window.ym && window.ym(108329078, 'reachGoal', 'error_boundary', { msg: String(error?.message || '').slice(0, 100) }) } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children

    const en = (document.documentElement.lang || 'ru') === 'en'
    const msg = this.state.error?.message || (en ? 'Unknown error' : 'Неизвестная ошибка')

    return (
      <div style={{
        padding: 40, textAlign: 'center', color: '#e8e6f2', background: '#0c0c12',
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.8 }}>💥</div>
        <h1 style={{ fontSize: 22, marginBottom: 8, fontWeight: 600 }}>
          {en ? 'Something went wrong' : 'Что-то пошло не так'}
        </h1>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 8, maxWidth: 460, lineHeight: 1.4 }}>
          {en
            ? 'We\'ve reported the issue automatically. Try reloading the page or go back home.'
            : 'Мы автоматически отправили отчёт. Попробуйте перезагрузить страницу или вернуться на главную.'}
        </p>
        <details style={{ fontSize: 11, color: '#555', marginBottom: 24, maxWidth: 460 }}>
          <summary style={{ cursor: 'pointer', color: '#888' }}>{en ? 'Technical details' : 'Технические детали'}</summary>
          <pre style={{ marginTop: 8, textAlign: 'left', overflow: 'auto', padding: 10, background: '#1a1a2a', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg}</pre>
        </details>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { this.setState({ error: null }); location.reload() }}
            style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #ffc145', background: '#ffc145', color: '#0c0c12', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            {en ? '↻ Reload' : '↻ Перезагрузить'}
          </button>
          <button onClick={() => { this.setState({ error: null }); location.href = '/' }}
            style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #333', background: '#1a1a2a', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
            {en ? '🏠 Home' : '🏠 Домой'}
          </button>
        </div>
      </div>
    )
  }
}

// ─── Capacitor: native платформа ───
const isNative = !!window.Capacitor?.isNativePlatform?.()

if (isNative) {
  // Финальный продовый домен — highriseheist.com. Fallback используется если
  // при билде не передали VITE_SERVER_URL (страховка на случай локальной сборки
  // без переменной окружения).
  const SERVER = import.meta.env.VITE_SERVER_URL || 'https://highriseheist.com'

  // Класс на body для CSS оптимизаций
  document.body.classList.add('native-body')

  // Fetch interceptor: /api/ → сервер. Поддерживает string, URL и Request.
  const _fetch = window.fetch.bind(window)
  window.fetch = (input, opts) => {
    try {
      if (typeof input === 'string' && input.startsWith('/api')) {
        return _fetch(SERVER + input, opts)
      }
      if (input instanceof URL && input.pathname.startsWith('/api')) {
        return _fetch(SERVER + input.pathname + input.search, opts)
      }
      if (typeof Request !== 'undefined' && input instanceof Request && new URL(input.url).pathname.startsWith('/api')) {
        const u = new URL(input.url)
        return _fetch(new Request(SERVER + u.pathname + u.search, input), opts)
      }
    } catch {}
    return _fetch(input, opts)
  }

  // WS base для multiplayer.js
  window.__SH_WS_BASE = SERVER.replace(/^http/, 'ws') + '/ws'

  // StatusBar + SplashScreen (async import — не ломает web)
  Promise.all([
    import('@capacitor/status-bar').catch(() => null),
    import('@capacitor/splash-screen').catch(() => null),
  ]).then(([sbMod, spMod]) => {
    if (sbMod?.StatusBar) {
      sbMod.StatusBar.setBackgroundColor({ color: '#0d0d14' }).catch(() => {})
      sbMod.StatusBar.setStyle({ style: 'DARK' }).catch(() => {})
    }
    if (spMod?.SplashScreen) {
      spMod.SplashScreen.hide().catch(() => {})
    }
  })

  // Android back button → навигация назад или выход
  import('@capacitor/app').then(({ App: CapApp }) => {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else CapApp.exitApp()
    })
    // Deep links: highriseheist.com?room=XXX
    CapApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const u = new URL(url)
        const room = u.searchParams.get('room')
        if (room) window.dispatchEvent(new CustomEvent('stolbiki-deeplink-room', { detail: { room } }))
      } catch {}
    })
  }).catch(() => {})

  // WS reconnect при возврате из фона
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      window.dispatchEvent(new CustomEvent('stolbiki-app-resume'))
    }
  })

  // Native mode
}

// РЕФАКТОР: embed/compare страницы рендерятся отдельной веткой ДО App.
// Раньше это был early-return блок в App.jsx до useI18nProvider() —
// нарушение rules of hooks. Provider-ы оставлены обёрнутыми вокруг embed
// тоже на случай если EmbedCity/CompareCities используют контексты.
const embedComponent = getEmbedComponent()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <GameProvider>
          {embedComponent ?? <App />}
        </GameProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
)

// PWA Service Worker (только в браузере, не в native app)
if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Находим ожидающий SW (новая версия) и просим его активироваться
      const promptUpdate = (waiting) => {
        if (!waiting) return
        // Тихо: посылаем SKIP_WAITING, SW активируется → controllerchange → reload
        waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      if (reg.waiting) promptUpdate(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(newWorker)
          }
        })
      })
      // Проверяем обновления каждые 60 сек
      setInterval(() => reg.update().catch(() => {}), 60000)
    }).catch(() => {})

    // Перезагрузка один раз при смене активного SW (новая версия стала контроллером)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      location.reload()
    })
  })
}

// Глобальный отлов ошибок → error-report (не пойманных ErrorBoundary)
function reportError(message, stack) {
  try {
    const token = localStorage.getItem('stolbiki_token')
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message: String(message).slice(0, 500), stack: String(stack || '').slice(0, 2000), url: location.href, ua: navigator.userAgent.slice(0, 200), ts: new Date().toISOString() }),
    }).catch(() => {})
  } catch {}
}
window.addEventListener('unhandledrejection', (e) => reportError(`Unhandled Promise: ${e.reason?.message || e.reason}`, e.reason?.stack))
window.addEventListener('error', (e) => { if (e.error) reportError(e.error.message, e.error.stack) })
