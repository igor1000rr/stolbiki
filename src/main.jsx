import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Error Boundary
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#e8e6f2', background: '#0c0c12', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20, maxWidth: 400 }}>{this.state.error?.message || 'Unknown error'}</p>
          <button onClick={() => { this.setState({ error: null }); location.reload() }}
            style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #333', background: '#1a1a2a', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Capacitor: native платформа ───
const isNative = !!window.Capacitor?.isNativePlatform?.()

if (isNative) {
  const SERVER = import.meta.env.VITE_SERVER_URL || 'https://snatch-highrise.com'

  // Класс на body для CSS оптимизаций
  document.body.classList.add('native-body')

  // Fetch interceptor: /api/ → сервер
  const _fetch = window.fetch.bind(window)
  window.fetch = (url, opts) => {
    if (typeof url === 'string' && url.startsWith('/api')) url = SERVER + url
    return _fetch(url, opts)
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
    // Deep links: snatch-highrise.com?room=XXX
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

  console.log('Capacitor native: API →', SERVER)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// PWA Service Worker (только в браузере, не в native app)
if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
