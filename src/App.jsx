import { useState, useEffect } from 'react'
import Game from './components/Game'
import Dashboard from './components/Dashboard'
import Replay from './components/Replay'
import Simulator from './components/Simulator'
import Rules from './components/Rules'
import Profile from './components/Profile'
import './app.css'

const ADMIN_CODE = 'stolbiki2024'

const TABS_PUBLIC = [
  { id: 'game', label: '🎮 Играть' },
  { id: 'profile', label: '👤 Профиль' },
  { id: 'rules', label: '📖 Правила' },
]

const TABS_ADMIN = [
  { id: 'game', label: '🎮 Играть' },
  { id: 'profile', label: '👤 Профиль' },
  { id: 'sim', label: '🧪 Симулятор' },
  { id: 'dash', label: '📊 Аналитика' },
  { id: 'replay', label: '🎬 Реплеи' },
  { id: 'rules', label: '📖 Правила' },
]

export default function App() {
  const [tab, setTab] = useState('game')
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('stolbiki_admin') === '1')
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminInput, setAdminInput] = useState('')
  const [titleClicks, setTitleClicks] = useState(0)

  // 5 кликов по заголовку → админ-промпт
  useEffect(() => {
    if (titleClicks >= 5) {
      setShowAdminPrompt(true)
      setTitleClicks(0)
    }
    if (titleClicks > 0) {
      const t = setTimeout(() => setTitleClicks(0), 2000)
      return () => clearTimeout(t)
    }
  }, [titleClicks])

  function tryAdmin() {
    if (adminInput === ADMIN_CODE) {
      setIsAdmin(true)
      localStorage.setItem('stolbiki_admin', '1')
      setShowAdminPrompt(false)
      setAdminInput('')
    } else {
      setAdminInput('')
    }
  }

  function logoutAdmin() {
    setIsAdmin(false)
    localStorage.removeItem('stolbiki_admin')
    if (['sim', 'dash', 'replay'].includes(tab)) setTab('game')
  }

  const tabs = isAdmin ? TABS_ADMIN : TABS_PUBLIC

  return (
    <div className="app">
      <header className="header">
        <h1 onClick={() => setTitleClicks(c => c + 1)} style={{ cursor: 'default', userSelect: 'none' }}>
          Стойки
        </h1>
        <p>Настольная игра — играйте, анализируйте, соревнуйтесь</p>
        {isAdmin && (
          <div style={{ fontSize: 10, color: '#f0654a', marginTop: 2, cursor: 'pointer' }}
            onClick={logoutAdmin}>
            🔧 Режим администратора
          </div>
        )}
      </header>

      <nav className="nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'game' && <Game />}
      {tab === 'profile' && <Profile />}
      {tab === 'sim' && isAdmin && <Simulator />}
      {tab === 'dash' && isAdmin && <Dashboard />}
      {tab === 'replay' && isAdmin && <Replay />}
      {tab === 'rules' && <Rules />}

      {/* Админ промпт */}
      {showAdminPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowAdminPrompt(false)}>
          <div style={{ background: '#1e1e28', borderRadius: 14, padding: 24, width: 300,
            border: '1px solid #36364a' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e6f0', marginBottom: 12 }}>🔐 Доступ администратора</div>
            <input type="password" placeholder="Код доступа" value={adminInput}
              onChange={e => setAdminInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && tryAdmin()}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #36364a',
                background: '#15151d', color: '#e8e6f0', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
              autoFocus />
            <button className="btn primary" onClick={tryAdmin} style={{ width: '100%' }}>Войти</button>
          </div>
        </div>
      )}
    </div>
  )
}
