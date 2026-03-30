import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { I18nContext, useI18nProvider, LANGS } from './engine/i18n'
import * as API from './engine/api'
import Icon from './components/Icon'
import { getSettings, applySettings } from './engine/settings'
import './app.css'

// Lazy-loaded components (не нужны при первой загрузке)
const Game = lazy(() => import('./components/Game'))
const Online = lazy(() => import('./components/Online'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const Replay = lazy(() => import('./components/Replay'))
const Simulator = lazy(() => import('./components/Simulator'))
const Rules = lazy(() => import('./components/Rules'))
const Profile = lazy(() => import('./components/Profile'))
const Puzzles = lazy(() => import('./components/Puzzles'))
const Openings = lazy(() => import('./components/Openings'))
const Landing = lazy(() => import('./components/Landing'))
const Tutorial = lazy(() => import('./components/Tutorial'))
const Blog = lazy(() => import('./components/Blog'))
const Settings = lazy(() => import('./components/Settings'))
const Admin = lazy(() => import('./components/Admin'))
const Changelog = lazy(() => import('./components/Changelog'))

function LazyFallback() {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink3)' }}>
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {[0, 0.15, 0.3].map((d, i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 0.8s ease ${d}s infinite` }} />
      ))}
    </div>
  </div>
}

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
    if (params.get('room')) return 'online'
    const hash = location.hash.replace('#', '')
    if (hash.startsWith('blog')) return 'blog' // handles #blog and #blog/slug
    if (hash && ['game','online','puzzles','openings','profile','settings','rules','sim','dash','replay','admin','changelog'].includes(hash)) return hash
    return 'landing'
  })
  const [isAdmin, setIsAdmin] = useState(getIsAdmin)
  const [theme, setTheme] = useState(() => localStorage.getItem('stolbiki_theme') || 'default')
  const [showTutorial, setShowTutorial] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [viewProfile, setViewProfile] = useState(null) // username для публичного профиля

  // Ленивый mount для Game/Online — грузятся только при первом посещении таба

  // Auth state — synced with localStorage
  const [authUser, setAuthUser] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('stolbiki_profile')); return p?.name ? p : null } catch { return null }
  })
  const [authOpen, setAuthOpen] = useState(false)
  const [authName, setAuthName] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const authRef = useRef(null)

  useEffect(() => {
    const check = () => { try { const p = JSON.parse(localStorage.getItem('stolbiki_profile')); setAuthUser(p?.name ? p : null) } catch { setAuthUser(null) } }
    const iv = setInterval(check, 2000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!authOpen) return
    const close = (e) => { if (authRef.current && !authRef.current.contains(e.target)) setAuthOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [authOpen])

  async function doAuth() {
    if (!authName.trim()) return
    setAuthLoading(true); setAuthError('')
    try {
      await (authMode === 'login' ? API.login : API.register)(authName.trim(), authPass)
      const profile = await API.getProfile()
      const merged = { ...profile, name: profile.username || authName.trim() }
      localStorage.setItem('stolbiki_profile', JSON.stringify(merged))
      setAuthUser(merged); setAuthOpen(false); setAuthName(''); setAuthPass('')
    } catch (e) {
      if (!authPass) {
        const local = { name: authName.trim(), rating: 1000, gamesPlayed: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0, goldenClosed: 0, comebacks: 0, perfectWins: 0, achievements: [], history: [] }
        localStorage.setItem('stolbiki_profile', JSON.stringify(local))
        setAuthUser(local); setAuthOpen(false)
      } else { setAuthError(e.message || 'Error') }
    }
    setAuthLoading(false)
  }

  function doLogout() {
    localStorage.removeItem('stolbiki_profile'); localStorage.removeItem('stolbiki_token')
    setAuthUser(null); setAuthOpen(false)
    if (typeof window.stolbikiCheckAdmin === 'function') window.stolbikiCheckAdmin()
  }

  // Sync hash with tab
  useEffect(() => {
    if (tab === 'landing') history.replaceState(null, '', location.pathname + location.search)
    else history.replaceState(null, '', '#' + tab)
  }, [tab])

  // Listen for back/forward
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '')
      if (h.startsWith('blog')) { if (tab !== 'blog') setTab('blog') }
      else if (h && h !== tab) setTab(h)
      else if (!h) setTab('landing')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [tab])

  useEffect(() => {
    if (theme === 'default') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('stolbiki_theme', theme)
  }, [theme])

  // Применяем сохранённые настройки кастомизации при загрузке
  useEffect(() => { applySettings(getSettings()) }, [])

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
    const backToLobby = () => { setTab('online'); setMobileMenu(false) }
    window.addEventListener('stolbiki-back-to-lobby', backToLobby)
    const viewProfileHandler = (e) => { setViewProfile(e.detail?.username || null); setTab('profile'); setMobileMenu(false) }
    window.addEventListener('stolbiki-view-profile', viewProfileHandler)
    return () => {
      window.removeEventListener('stolbiki-online-start', handler)
      window.removeEventListener('stolbiki-daily-start', handler)
      window.removeEventListener('stolbiki-back-to-lobby', backToLobby)
      window.removeEventListener('stolbiki-view-profile', viewProfileHandler)
    }
  }, [])

  useEffect(() => {
    // Не редиректим сразу — даём время залогиниться (1.5 сек)
    if (!isAdmin && ['sim', 'dash', 'replay', 'admin'].includes(tab)) {
      const timer = setTimeout(() => {
        if (!getIsAdmin()) setTab('game')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isAdmin, tab])

  function go(id) { setTab(id); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const [publicStats, setPublicStats] = useState(null)
  useEffect(() => { fetch('/api/stats').then(r => r.json()).then(setPublicStats).catch(() => {}) }, [])

  // Основные 4 пункта навигации
  const en = lang === 'en'
  const primaryNav = [
    { id: 'rules', icon: 'rules', label: en ? 'Rules' : 'Правила' },
    { id: 'game', icon: 'play', label: en ? 'Play' : 'Играть' },
    { id: 'online', icon: 'online', label: en ? 'Online' : 'Онлайн' },
    { id: 'puzzles', icon: 'puzzle', label: en ? 'Puzzles' : 'Задачи' },
  ]

  // Дополнительные — в выпадашке
  const secondaryNav = [
    { id: 'settings', icon: 'theme', label: en ? 'Settings' : 'Настройки' },
    { id: 'profile', icon: 'profile', label: en ? 'Profile' : 'Профиль' },
    { id: 'openings', icon: 'chart', label: en ? 'Analytics' : 'Аналитика' },
    { id: 'blog', icon: 'blog', label: en ? 'Blog' : 'Блог' },
    { id: 'changelog', icon: 'star', label: 'Changelog' },
  ]
  if (isAdmin) {
    secondaryNav.push(
      { id: 'admin', icon: 'shield', label: en ? 'Admin Panel' : 'Админка' },
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
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="site-header" role="banner">
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
          <nav className="site-nav-desktop" aria-label="Main navigation">
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
                <div>
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
            </div>
          </nav>

          {/* Auth + Lang + burger */}
          <div className="site-actions">
            {/* Auth indicator */}
            <div className="header-auth" ref={authRef}>
              {authUser ? (
                <button className="header-auth-user" onClick={(e) => { e.stopPropagation(); setAuthOpen(v => !v) }}>
                  <div className="header-avatar">{
                    authUser.avatar && authUser.avatar !== 'default'
                      ? { cat:'🐱',dog:'🐶',fox:'🦊',bear:'🐻',owl:'🦉',robot:'🤖',crown:'👑',fire:'🔥',star:'⭐',diamond:'💎',ghost:'👻' }[authUser.avatar] || authUser.name.charAt(0).toUpperCase()
                      : authUser.name.charAt(0).toUpperCase()
                  }</div>
                  <span className="header-username">{authUser.name}</span>
                  {authUser.rating > 0 && <span className="header-rating">{authUser.rating}</span>}
                </button>
              ) : (
                <button className="header-login-btn" onClick={(e) => { e.stopPropagation(); setAuthOpen(v => !v) }}>
                  <Icon name="profile" size={14} />
                  <span>{en ? 'Login' : 'Войти'}</span>
                </button>
              )}
              {authOpen && (
                <div className="header-auth-dropdown">
                  {authUser ? (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface2)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{authUser.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                          {en ? 'Rating' : 'Рейтинг'}: {authUser.rating || 1000} · {en ? 'Games' : 'Партий'}: {authUser.gamesPlayed || 0}
                        </div>
                      </div>
                      <button onClick={() => { go('profile'); setAuthOpen(false) }} className="header-auth-item">
                        <Icon name="profile" size={14} style={{ opacity: 0.5 }} />{en ? 'Profile' : 'Профиль'}
                      </button>
                      <button onClick={() => { go('settings'); setAuthOpen(false) }} className="header-auth-item">
                        <Icon name="theme" size={14} style={{ opacity: 0.5 }} />{en ? 'Settings' : 'Настройки'}
                      </button>
                      <div className="nav-more-divider" />
                      <button onClick={doLogout} className="header-auth-item" style={{ color: '#ff6066' }}>
                        {en ? 'Logout' : 'Выйти'}
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        {authMode === 'login' ? (en ? 'Login' : 'Вход') : (en ? 'Register' : 'Регистрация')}
                      </div>
                      {authError && <div style={{ fontSize: 11, color: '#ff6066', marginBottom: 8 }}>{authError}</div>}
                      <input type="text" placeholder={en ? 'Username' : 'Никнейм'} value={authName}
                        onChange={e => setAuthName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAuth()}
                        className="header-auth-input" autoFocus />
                      <input type="password" placeholder={en ? 'Password' : 'Пароль'} value={authPass}
                        onChange={e => setAuthPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAuth()}
                        className="header-auth-input" />
                      <button className="btn primary" onClick={doAuth} disabled={authLoading}
                        style={{ width: '100%', fontSize: 12, padding: '8px 0' }}>
                        {authLoading ? '...' : authMode === 'login' ? (en ? 'Login' : 'Войти') : (en ? 'Register' : 'Создать')}
                      </button>
                      <button onClick={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthError('') }}
                        style={{ width: '100%', background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 11, padding: '8px 0', cursor: 'pointer' }}>
                        {authMode === 'login' ? (en ? 'No account? Register' : 'Нет аккаунта? Регистрация') : (en ? 'Have account? Login' : 'Есть аккаунт? Войти')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                aria-label={`Switch to ${l.code === 'ru' ? 'Russian' : 'English'}`} aria-pressed={lang === l.code}>
                {l.label}
              </button>
            ))}
            <button className="mobile-burger" onClick={() => setMobileMenu(m => !m)} aria-label={mobileMenu ? 'Close menu' : 'Open menu'}>
              <Icon name={mobileMenu ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileMenu && (
          <nav className="site-nav-mobile" aria-label="Mobile navigation">
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

      <main className="site-content" id="main-content" role="main">
        <Suspense fallback={<LazyFallback />}>
          {tab === 'landing' && <Landing onPlay={() => go('game')} onTutorial={() => setShowTutorial(true)} publicStats={publicStats} />}
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          <div style={{ display: tab === 'game' ? 'block' : 'none' }}><Game /></div>
          <div style={{ display: tab === 'online' ? 'block' : 'none' }}><Online /></div>
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          {tab === 'puzzles' && <Puzzles />}
          {tab === 'openings' && <Openings />}
          {tab === 'blog' && <Blog />}
          {tab === 'settings' && <Settings />}
          {tab === 'profile' && <Profile viewUsername={viewProfile} onClose={viewProfile ? () => setViewProfile(null) : null} />}
          {tab === 'sim' && isAdmin && <Simulator />}
          {tab === 'dash' && isAdmin && <Dashboard />}
          {tab === 'replay' && isAdmin && <Replay />}
          {tab === 'admin' && isAdmin && <Admin />}
          {tab === 'changelog' && <Changelog />}
          {tab === 'rules' && <Rules />}
        </Suspense>
      </main>

      {showTutorial && <Suspense fallback={<LazyFallback />}><Tutorial onClose={() => { setShowTutorial(false); go('game') }} /></Suspense>}

      <footer className="site-footer" role="contentinfo">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <span style={{ opacity: 0.6 }}>Snatch Highrise</span>
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
            <a href="#changelog" onClick={(e) => { e.preventDefault(); go('changelog') }} style={{ cursor: 'pointer' }}>Changelog</a>
            <span className="site-footer-divider" />
            <a href="#rules" onClick={(e) => { e.preventDefault(); go('rules') }} style={{ cursor: 'pointer' }}>{lang === 'en' ? 'Rules' : 'Правила'}</a>
            <span className="site-footer-divider" />
            <a href="/print-and-play.pdf" target="_blank" rel="noopener">Print & Play</a>
          </div>
        </div>
      </footer>
    </div>
    </I18nContext.Provider>
  )
}
