import { useState, useEffect } from 'react'
import { I18nContext, useI18nProvider, LANGS } from './engine/i18n'
import Icon from './components/Icon'
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
import Blog from './components/Blog'
import './app.css'

const ADMIN_NAMES = ['admin']
const THEMES = [
  { id: 'default', label: 'Dark' },
  { id: 'neon', label: 'Neon' },
  { id: 'wood', label: 'Wood' },
  { id: 'minimal', label: 'Light' },
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

  // Основные 4 пункта навигации
  const primaryNav = [
    { id: 'game', icon: 'play', label: lang === 'en' ? 'Play' : 'Играть' },
    { id: 'online', icon: 'online', label: lang === 'en' ? 'Online' : 'Онлайн' },
    { id: 'puzzles', icon: 'puzzle', label: lang === 'en' ? 'Puzzles' : 'Задачи' },
    { id: 'blog', icon: 'blog', label: lang === 'en' ? 'Blog' : 'Блог' },
  ]

  // Дополнительные — в выпадашке
  const secondaryNav = [
    { id: 'openings', icon: 'chart', label: lang === 'en' ? 'Analytics' : 'Аналитика' },
    { id: 'profile', icon: 'profile', label: lang === 'en' ? 'Profile' : 'Профиль' },
    { id: 'rules', icon: 'rules', label: lang === 'en' ? 'Rules' : 'Правила' },
  ]
  if (isAdmin) {
    secondaryNav.push(
      { id: 'sim', icon: 'sim', label: 'Simulator' },
      { id: 'dash', icon: 'analytics', label: 'Dashboard' },
      { id: 'replay', icon: 'replay', label: 'Replays' },
    )
  }

  const allNav = [...primaryNav, ...secondaryNav]
  const isSecondaryActive = secondaryNav.some(n => n.id === tab)

  return (
    <I18nContext.Provider value={i18n}>
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          {/* Лого */}
          <div className="site-logo" onClick={() => go('landing')}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="6" width="6" height="18" rx="2" fill="var(--gold)" opacity="0.9"/>
              <rect x="11" y="10" width="6" height="14" rx="2" fill="var(--p1)" opacity="0.7"/>
              <rect x="20" y="8" width="6" height="16" rx="2" fill="var(--p2)" opacity="0.7"/>
            </svg>
            <span className="site-logo-text">{t('header.title')}</span>
            <span className="beta-badge">beta</span>
          </div>

          {/* 4 основных пункта */}
          <nav className="site-nav-desktop">
            {primaryNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                {n.label}
              </button>
            ))}
            {/* More dropdown — по hover */}
            <div className="nav-more">
              <button className={isSecondaryActive ? 'active' : ''}>
                {lang === 'en' ? 'More' : 'Ещё'}
                <Icon name="chevron" size={14} style={{ marginLeft: 3 }} />
              </button>
              <div className="nav-more-menu">
                {secondaryNav.map(n => (
                  <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                    <Icon name={n.icon} size={15} style={{ marginRight: 8, opacity: 0.5 }} />
                    {n.label}
                  </button>
                ))}
                <div className="nav-more-divider" />
                <div className="nav-more-row">
                  <span style={{ fontSize: 10, color: 'var(--ink3)', marginRight: 8 }}>Theme</span>
                  {THEMES.map(th => (
                    <button key={th.id} onClick={() => setTheme(th.id)}
                      className={`nav-more-theme ${theme === th.id ? 'active' : ''}`}>
                      {th.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Lang + burger */}
          <div className="site-actions">
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} className={`lang-btn ${lang === l.code ? 'active' : ''}`}>
                {l.label}
              </button>
            ))}
            <button className="mobile-burger" onClick={() => setMobileMenu(m => !m)}>
              <Icon name={mobileMenu ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileMenu && (
          <nav className="site-nav-mobile">
            {allNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                <Icon name={n.icon} size={16} style={{ marginRight: 10, opacity: 0.5 }} />
                {n.label}
              </button>
            ))}
            <div className="nav-more-divider" />
            <div style={{ display: 'flex', gap: 4, padding: '8px 16px' }}>
              {THEMES.map(th => (
                <button key={th.id} onClick={() => { setTheme(th.id); setMobileMenu(false) }}
                  className={`nav-more-theme ${theme === th.id ? 'active' : ''}`}>
                  {th.label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="site-content">
        {tab === 'landing' && <Landing onPlay={() => go('game')} onTutorial={() => setShowTutorial(true)} publicStats={publicStats} />}
        <div style={{ display: tab === 'game' ? 'block' : 'none' }}><Game /></div>
        <div style={{ display: tab === 'online' ? 'block' : 'none' }}><Online /></div>
        {tab === 'puzzles' && <Puzzles />}
        {tab === 'openings' && <Openings />}
        {tab === 'blog' && <Blog />}
        {tab === 'profile' && <Profile />}
        {tab === 'sim' && isAdmin && <Simulator />}
        {tab === 'dash' && isAdmin && <Dashboard />}
        {tab === 'replay' && isAdmin && <Replay />}
        {tab === 'rules' && <Rules />}
      </main>

      {showTutorial && <Tutorial onClose={() => { setShowTutorial(false); go('game') }} />}

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <span style={{ opacity: 0.6 }}>Stacks</span>
            <span className="beta-badge">beta</span>
            <span className="site-footer-divider" />
            <span style={{ opacity: 0.4, fontSize: 10 }}>
              {lang === 'en' ? 'Board games meet AI research' : 'Настольные игры и AI-исследования'}
            </span>
          </div>
          <div className="site-footer-links">
            <span className="status-dot" style={{ background: publicStats ? 'var(--green)' : 'var(--p2)' }} />
            <span>{publicStats ? t('common.online') : t('common.offline')}</span>
            <span className="site-footer-divider" />
            <a href="https://github.com/igor1000rr/stolbiki" target="_blank" rel="noopener">GitHub</a>
            <span className="site-footer-divider" />
            <a href="/print-and-play.pdf" target="_blank" rel="noopener">Print & Play</a>
          </div>
        </div>
      </footer>
    </div>
    </I18nContext.Provider>
  )
}
