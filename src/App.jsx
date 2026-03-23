import { useState } from 'react'
import Game from './components/Game'
import Dashboard from './components/Dashboard'
import Replay from './components/Replay'
import Simulator from './components/Simulator'
import Rules from './components/Rules'
import Profile from './components/Profile'
import './app.css'

const TABS = [
  { id: 'game', label: '🎮 Играть' },
  { id: 'profile', label: '👤 Профиль' },
  { id: 'sim', label: '🧪 Симулятор' },
  { id: 'dash', label: '📊 Аналитика' },
  { id: 'replay', label: '🎬 Реплеи' },
  { id: 'rules', label: '📖 Правила' },
]

export default function App() {
  const [tab, setTab] = useState('game')

  return (
    <div className="app">
      <header className="header">
        <h1>Стойки</h1>
        <p>Настольная игра — играйте, анализируйте, соревнуйтесь</p>
      </header>

      <nav className="nav">
        {TABS.map(t => (
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
      {tab === 'sim' && <Simulator />}
      {tab === 'dash' && <Dashboard />}
      {tab === 'replay' && <Replay />}
      {tab === 'rules' && <Rules />}
    </div>
  )
}
