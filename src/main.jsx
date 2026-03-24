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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
