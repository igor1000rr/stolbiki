import { useState, useEffect } from 'react'
import { I18nContext, useI18nProvider, LANGS } from './engine/i18n'
import Game from './components/Game'
import Dashboard from './components/Dashboard'
import Replay from './components/Replay'
import Simulator from './components/Simulator'
import Rules from './components/Rules'
import Profile from './components/Profile'
import Online from './components/Online'
import Puzzles from './components/Puzzles'
import Openings from './components/Openings'
import Landing from './components/Landing'
import Tutorial from './components/Tutorial'
import './app.css'

const ADMIN_NAMES = ['admin']
const THEMES = [
  { id: 'default', label: '🌙 Dark' },
  { id: 'neon', label: '💜 Neon' },
  { id: 'wood', label: '🪵 Wood' },
  { id: 'minimal', label: '⬜ Light' },
]

function getIsAdmin() {
  try {
    const raw = localStorage.getItem('stolbiki_profile')
    if (!raw) return false
    const p = JSON.parse(raw)
    return p?.isAdmin === true || ADMIN_NAMES.includes(p?.name)
  } catch { return false }
}

export default function App() {
  const i18n = useI18nProvider()
  const { t, lang, setLang } = i18n

  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('room') ? 'online' : 'landing'
  })
  const [isAdmin, setIsAdmin] = useState(getIsAdmin)
  const [theme, setTheme] = useState(() => localStorage.getItem('stolbiki_theme') || 'default')
  const [showTutorial, setShowTutorial] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    if (theme === 'default') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('stolbiki_theme', theme)
  }, [theme])

  useEffect(() => {
    const check = () => setIsAdmin(getIsAdmin())
    window.stolbikiCheckAdmin = check
    const interval = setInterval(check, 1000)
    return () => { clearInterval(interval); delete window.stolbikiCheckAdmin }
  }, [])

  useEffect(() => {
    const handler = () => { setTab('game'); setMobileMenu(false) }
    window.addEventListener('stolbiki-online-start', handler)
    window.addEventListener('stolbiki-daily-start', handler)
    return () => {
      window.removeEventListener('stolbiki-online-start', handler)
      window.removeEventListener('stolbiki-daily-start', handler)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin && ['sim', 'dash', 'replay'].includes(tab)) setTab('game')
  }, [isAdmin, tab])

  function go(id) { setTab(id); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const [publicStats, setPublicStats] = useState(null)
  useEffect(() => { fetch('/api/stats').then(r => r.json()).then(setPublicStats).catch(() => {}) }, [])

  const mainNav = [
    { id: 'game', label: t('nav.play') },
    { id: 'online', label: t('nav.online') },
    { id: 'puzzles', label: t('nav.puzzles') },
    { id: 'openings', label: '📊' },
    { id: 'profile', label: t('nav.profile') },
    { id: 'rules', label: t('nav.rules') },
  ]
  if (isAdmin) {
    mainNav.push(
      { id: 'sim', label: '🧪' },
      { id: 'dash', label: '📈' },
      { id: 'replay', label: '🎬' },
    )
  }

  return (
    <I18nContext.Provider value={i18n}>
    <div className="app">
      {/* ═══ ШАПКА ═══ */}
      <header className="site-header">
        <div className="site-header-inner">
          {/* Лого */}
          <div className="site-logo" onClick={() => go('landing')}>
            <span className="site-logo-icon">♟</span>
            <span className="site-logo-text">{t('header.title')}</span>
          </div>

          {/* Десктоп навигация */}
          <nav className="site-nav-desktop">
            {mainNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>

          {/* Действия */}
          <div className="site-actions">
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`lang-btn ${lang === l.code ? 'active' : ''}`}>
                {l.label}
              </button>
            ))}
            <div className="theme-dropdown">
              <button className="theme-btn">🎨</button>
              <div className="theme-menu">
                {THEMES.map(th => (
                  <button key={th.id} onClick={() => setTheme(th.id)}
                    className={theme === th.id ? 'active' : ''}>
                    {th.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Бургер для мобилки */}
            <button className="mobile-burger" onClick={() => setMobileMenu(m => !m)}>
              {mobileMenu ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileMenu && (
          <nav className="site-nav-mobile">
            {mainNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ═══ КОНТЕНТ ═══ */}
      <main className="site-content">
        {tab === 'landing' && <Landing onPlay={() => go('game')} onTutorial={() => setShowTutorial(true)} publicStats={publicStats} />}
        <div style={{ display: tab === 'game' ? 'block' : 'none' }}><Game /></div>
        <div style={{ display: tab === 'online' ? 'block' : 'none' }}><Online /></div>
        {tab === 'puzzles' && <Puzzles />}
        {tab === 'openings' && <Openings />}
        {tab === 'profile' && <Profile />}
        {tab === 'sim' && isAdmin && <Simulator />}
        {tab === 'dash' && isAdmin && <Dashboard />}
        {tab === 'replay' && isAdmin && <Replay />}
        {tab === 'rules' && <Rules />}
      </main>

      {showTutorial && <Tutorial onClose={() => { setShowTutorial(false); go('game') }} />}

      {/* ═══ ПОДВАЛ ═══ */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>Стойки v2.2 · {lang === 'en' ? 'Balance: 239K+ games' : 'Баланс: 239K+ партий'}</div>
          <div className="site-footer-links">
            <span className="status-dot" style={{ background: publicStats ? 'var(--green)' : 'var(--p2)' }} />
            {publicStats ? t('common.online') : t('common.offline')}
            <span>·</span>
            <a href="https://github.com/igor1000rr/stolbiki" target="_blank" rel="noopener">GitHub</a>
            <span>·</span>
            <a href="/print-and-play.pdf" target="_blank" rel="noopener">Print&Play</a>
          </div>
        </div>
      </footer>
    </div>
    </I18nContext.Provider>
  )
}
