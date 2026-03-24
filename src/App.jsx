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
  { id: 'default', label: '🌙' },
  { id: 'neon', label: '💜' },
  { id: 'wood', label: '🪵' },
  { id: 'minimal', label: '⬜' },
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
    const handler = () => setTab('game')
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

  const TABS_PUBLIC = [
    { id: 'landing', label: '🏠' },
    { id: 'game', label: t('nav.play') },
    { id: 'online', label: t('nav.online') },
    { id: 'puzzles', label: t('nav.puzzles') },
    { id: 'profile', label: t('nav.profile') },
    { id: 'openings', label: '📊' },
    { id: 'rules', label: t('nav.rules') },
  ]

  const TABS_ADMIN = [
    ...TABS_PUBLIC,
    { id: 'sim', label: t('nav.simulator') },
    { id: 'dash', label: t('nav.analytics') },
    { id: 'replay', label: t('nav.replays') },
  ]

  const tabs = isAdmin ? TABS_ADMIN : TABS_PUBLIC

  const [publicStats, setPublicStats] = useState(null)
  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setPublicStats).catch(() => {})
  }, [])

  return (
    <I18nContext.Provider value={i18n}>
    <div className="app">
      <header className="header">
        <h1>{t('header.title')}</h1>
        <p>{t('header.subtitle')}</p>
        {publicStats && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            {[
              { v: publicStats.totalUsers, l: t('header.players') },
              { v: publicStats.totalGames, l: t('header.games') },
              { v: publicStats.avgRating, l: t('header.avgRating') },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{s.v}</span>
                <span style={{ fontSize: 9, color: 'var(--ink3)', marginLeft: 3 }}>{s.l}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              style={{ padding: '2px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer', border: 'none',
                background: lang === l.code ? 'var(--accent)' : 'var(--surface2)',
                color: lang === l.code ? '#fff' : 'var(--ink3)', fontWeight: lang === l.code ? 700 : 400 }}>
              {l.label}
            </button>
          ))}
          <span style={{ color: 'var(--surface3)', margin: '0 2px' }}>|</span>
          {THEMES.map(th => (
            <button key={th.id} onClick={() => setTheme(th.id)}
              style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, cursor: 'pointer', border: 'none',
                background: theme === th.id ? 'var(--accent)' : 'var(--surface2)', opacity: theme === th.id ? 1 : 0.6 }}>
              {th.label}
            </button>
          ))}
        </div>
      </header>

      <nav className="nav">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === 'landing' && <Landing onPlay={() => setTab('game')} onTutorial={() => setShowTutorial(true)} />}
        <div style={{ display: tab === 'game' ? 'block' : 'none' }}><Game /></div>
        <div style={{ display: tab === 'online' ? 'block' : 'none' }}><Online /></div>
        {tab === 'puzzles' && <Puzzles />}
        {tab === 'openings' && <Openings />}
        {tab === 'profile' && <Profile />}
        {tab === 'sim' && isAdmin && <Simulator />}
        {tab === 'dash' && isAdmin && <Dashboard />}
        {tab === 'replay' && isAdmin && <Replay />}
        {tab === 'rules' && <Rules />}
      </div>

      {showTutorial && <Tutorial onClose={() => { setShowTutorial(false); setTab('game') }} />}

      <footer style={{ textAlign: 'center', padding: '24px 0 12px', fontSize: 10, color: 'var(--ink3)', marginTop: 24 }}>
        <div>Стойки v2.2 • {lang === 'en' ? 'Balance confirmed on 239K+ games' : 'Баланс подтверждён на 239K+ партиях'}</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%',
              background: publicStats ? 'var(--green)' : 'var(--p2)',
              boxShadow: publicStats ? '0 0 6px var(--green-glow)' : '0 0 6px var(--p2-glow)' }} />
            {publicStats ? t('common.online') : t('common.offline')}
          </span>
          <span>•</span>
          <a href="https://github.com/igor1000rr/stolbiki" target="_blank" rel="noopener" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>GitHub</a>
          <span>•</span>
          <a href="/print-and-play.pdf" target="_blank" rel="noopener" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>Print&Play</a>
          {isAdmin && (
            <>
              <span>•</span>
              <a href="/report.pdf" target="_blank" rel="noopener" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>PDF</a>
            </>
          )}
        </div>
      </footer>
    </div>
    </I18nContext.Provider>
  )
}
