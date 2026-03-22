import { useState } from 'react'
import Game from './components/Game'
import Dashboard from './components/Dashboard'
import Replay from './components/Replay'
import './app.css'

const TABS = [
  { id: 'game', label: 'Играть' },
  { id: 'dash', label: 'Аналитика' },
  { id: 'replay', label: 'Разбор партий' },
]

export default function App() {
  const [tab, setTab] = useState('game')

  return (
    <div className="app">
      <header className="header">
        <h1>Стойки</h1>
        <p>Настольная игра — играйте, анализируйте, изучайте</p>
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
      {tab === 'dash' && <Dashboard />}
      {tab === 'replay' && <Replay />}
    </div>
  )
}
