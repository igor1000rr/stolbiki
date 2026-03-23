import { useState, useEffect } from 'react'
import Game from './components/Game'
import Dashboard from './components/Dashboard'
import Replay from './components/Replay'
import Simulator from './components/Simulator'
import Rules from './components/Rules'
import Profile from './components/Profile'
import './app.css'

const ADMIN_NAMES = ['admin', 'Admin', 'igor', 'Igor', 'Александр']

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
  const [isAdmin, setIsAdmin] = useState(getIsAdmin)

  // Слушаем изменения профиля
  useEffect(() => {
    const check = () => setIsAdmin(getIsAdmin())
    window.stolbikiCheckAdmin = check
    // Проверяем каждую секунду (для смены профиля)
    const interval = setInterval(check, 1000)
    return () => { clearInterval(interval); delete window.stolbikiCheckAdmin }
  }, [])

  // Если был на админ-вкладке и вышел из профиля
  useEffect(() => {
    if (!isAdmin && ['sim', 'dash', 'replay'].includes(tab)) setTab('game')
  }, [isAdmin, tab])

  const tabs = isAdmin ? TABS_ADMIN : TABS_PUBLIC

  return (
    <div className="app">
      <header className="header">
        <h1>Стойки</h1>
        <p>Настольная игра — играйте, анализируйте, соревнуйтесь</p>
      </header>

      <nav className="nav">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
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

      <footer style={{ textAlign: 'center', padding: '24px 0 12px', fontSize: 10, color: '#444', marginTop: 24 }}>
        <div>Стойки v2.0 • Баланс подтверждён на 229K+ партиях</div>
        <div style={{ marginTop: 4 }}>
          <a href="https://github.com/igor1000rr/stolbiki" target="_blank" rel="noopener" style={{ color: '#555', textDecoration: 'none' }}>
            GitHub
          </a>
          {isAdmin && (
            <>
              {' • '}
              <a href="https://github.com/igor1000rr/stolbiki/blob/main/analysis/report.pdf" target="_blank" rel="noopener" style={{ color: '#555', textDecoration: 'none' }}>
                PDF Отчёт
              </a>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
