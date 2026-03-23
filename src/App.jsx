import { useState, useEffect } from 'react'
import Game from './components/Game'
import Dashboard from './components/Dashboard'
import Replay from './components/Replay'
import Simulator from './components/Simulator'
import Rules from './components/Rules'
import Profile from './components/Profile'
import Online from './components/Online'
import './app.css'

const ADMIN_NAMES = ['admin']

function getIsAdmin() {
  try {
    const raw = localStorage.getItem('stolbiki_profile')
    if (!raw) return false
    const p = JSON.parse(raw)
    return p?.isAdmin === true || ADMIN_NAMES.includes(p?.name)
  } catch { return false }
}

const TABS_PUBLIC = [
  { id: 'game', label: '🎮 Играть' },
  { id: 'online', label: '🌐 Онлайн' },
  { id: 'profile', label: '👤 Профиль' },
  { id: 'rules', label: '📖 Правила' },
]

const TABS_ADMIN = [
  { id: 'game', label: '🎮 Играть' },
  { id: 'online', label: '🌐 Онлайн' },
  { id: 'profile', label: '👤 Профиль' },
  { id: 'sim', label: '🧪 Симулятор' },
  { id: 'dash', label: '📊 Аналитика' },
  { id: 'replay', label: '🎬 Реплеи' },
  { id: 'rules', label: '📖 Правила' },
]

export default function App() {
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('room') ? 'online' : 'game'
  })
  const [isAdmin, setIsAdmin] = useState(getIsAdmin)

  // Слушаем изменения профиля
  useEffect(() => {
    const check = () => setIsAdmin(getIsAdmin())
    window.stolbikiCheckAdmin = check
    const interval = setInterval(check, 1000)
    return () => { clearInterval(interval); delete window.stolbikiCheckAdmin }
  }, [])

  // Автопереключение на вкладку "Играть" при старте онлайн-матча
  useEffect(() => {
    const handler = () => setTab('game')
    window.addEventListener('stolbiki-online-start', handler)
    return () => window.removeEventListener('stolbiki-online-start', handler)
  }, [])

  // Если был на админ-вкладке и вышел из профиля
  useEffect(() => {
    if (!isAdmin && ['sim', 'dash', 'replay'].includes(tab)) setTab('game')
  }, [isAdmin, tab])

  const tabs = isAdmin ? TABS_ADMIN : TABS_PUBLIC

  const [publicStats, setPublicStats] = useState(null)
  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setPublicStats).catch(() => {})
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>Стойки</h1>
        <p>Настольная игра — играйте, анализируйте, соревнуйтесь</p>
        {publicStats && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            {[
              { v: publicStats.totalUsers, l: 'игроков' },
              { v: publicStats.totalGames, l: 'партий' },
              { v: publicStats.avgRating, l: 'ср. рейтинг' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{s.v}</span>
                <span style={{ fontSize: 9, color: '#555', marginLeft: 3 }}>{s.l}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      <nav className="nav">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        <div style={{ display: tab === 'game' ? 'block' : 'none' }}><Game /></div>
        <div style={{ display: tab === 'online' ? 'block' : 'none' }}><Online /></div>
        {tab === 'profile' && <Profile />}
        {tab === 'sim' && isAdmin && <Simulator />}
        {tab === 'dash' && isAdmin && <Dashboard />}
        {tab === 'replay' && isAdmin && <Replay />}
        {tab === 'rules' && <Rules />}
      </div>

      <footer style={{ textAlign: 'center', padding: '24px 0 12px', fontSize: 10, color: '#444', marginTop: 24 }}>
        <div>Стойки v2.1 • Баланс подтверждён на 239K+ партиях</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%',
              background: publicStats ? '#3dd68c' : '#ff6066',
              boxShadow: publicStats ? '0 0 6px rgba(61,214,140,0.5)' : '0 0 6px rgba(255,96,102,0.3)' }} />
            {publicStats ? 'Онлайн' : 'Оффлайн'}
          </span>
          <span>•</span>
          <a href="https://github.com/igor1000rr/stolbiki" target="_blank" rel="noopener" style={{ color: '#555', textDecoration: 'none' }}>
            GitHub
          </a>
          {isAdmin && (
            <>
              <span>•</span>
              <a href="/report.pdf" target="_blank" rel="noopener" style={{ color: '#555', textDecoration: 'none' }}>
                PDF
              </a>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
