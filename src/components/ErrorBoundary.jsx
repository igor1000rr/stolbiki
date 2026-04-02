/**
 * Error Boundary — ловит JS-краши, показывает fallback UI
 */
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
    // Отправляем ошибку на сервер (fire-and-forget)
    try {
      const token = localStorage.getItem('stolbiki_token')
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          message: error?.message || 'Unknown error',
          stack: (error?.stack || '').slice(0, 2000),
          component: (info?.componentStack || '').slice(0, 1000),
          url: location.href,
          ua: navigator.userAgent.slice(0, 200),
          ts: new Date().toISOString(),
        }),
      }).catch(() => {})
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 400, margin: '0 auto' }}>
          <img src="/mascot/shock.webp" alt="Ошибка" width={100} height={100} style={{ objectFit: 'contain', marginBottom: 16, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} />
          <h2 style={{ fontSize: 20, color: 'var(--ink)', margin: '0 0 8px' }}>Что-то пошло не так</h2>
          <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6, margin: '0 0 20px' }}>
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button className="btn primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/game' }} style={{ justifyContent: 'center' }}>
            Перезагрузить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
