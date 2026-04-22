/**
 * PuzzleRush — реши максимум головоломок за 3 минуты
 * +10 секунд за правильную, -15 за ошибку
 */
import { useState, useEffect, useRef } from 'react'
import { GameState, applyAction, getValidTransfers } from '../engine/game'
import Board from './Board'
import Mascot from './Mascot'
import { useI18n } from '../engine/i18n'
import * as API from '../engine/api'

const INITIAL_TIME = 180 // 3 минуты
const BONUS_TIME = 10
const PENALTY_TIME = 15

function PuzzleBoard({ puzzle, onSolved, onFailed }) {
  const [gs, setGs] = useState(null)
  const [phase, setPhase] = useState('place')
  const [placement, setPlacement] = useState({})
  const [transfer, setTransfer] = useState(null)
  const [selected, setSelected] = useState(null)
  const [movesUsed, setMovesUsed] = useState(0)

  useEffect(() => {
    if (!puzzle) return
    const state = new GameState()
    state.swapAvailable = false; state.currentPlayer = 0; state.turn = puzzle.turn || 6
    if (puzzle.stands) for (let i = 0; i < 10; i++) state.stands[i] = puzzle.stands[i] ? [...puzzle.stands[i]] : []
    if (puzzle.closed) state.closed = { ...puzzle.closed }
    setGs(state); setMovesUsed(0); setPhase('place')
    setPlacement({}); setTransfer(null); setSelected(null)
  }, [puzzle])

  if (!gs) return null

  function checkGoal(state) {
    if (!puzzle.goal) return false
    for (const [stand, player] of Object.entries(puzzle.goal)) {
      if (!(+stand in state.closed) || state.closed[+stand] !== player) return false
    }
    return true
  }

  function handleStandClick(i) {
    if (phase === 'transfer-target') {
      if (selected !== null && getValidTransfers(gs).some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i]); setSelected(null); setPhase('place')
      }
      return
    }
    const space = gs.standSpace(i)
    if (space <= 0 || (i in gs.closed)) return
    const maxTotal = gs.isFirstTurn() ? 1 : 3
    const currentTotal = Object.values(placement).reduce((a, b) => a + b, 0)
    if (i in placement) {
      const cur = placement[i]
      if (currentTotal < maxTotal && space - cur > 0) {
        setPlacement({ ...placement, [i]: cur + 1 })
      } else {
        const np = { ...placement }; delete np[i]; setPlacement(np)
      }
    } else {
      const numStands = Object.keys(placement).length
      if (numStands >= 2 || currentTotal >= maxTotal) return
      setPlacement({ ...placement, [i]: 1 })
    }
  }

  function confirm() {
    const action = { placement: { ...placement }, transfer: transfer || undefined, swap: false }
    const ns = applyAction(gs, action)
    const newMoves = movesUsed + 1
    setGs(ns); setMovesUsed(newMoves)
    setTransfer(null); setPlacement({}); setSelected(null); setPhase('place')
    if (checkGoal(ns)) { onSolved?.() }
    else if (newMoves >= puzzle.maxMoves) { onFailed?.() }
  }

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? 1 : 3
  const canConfirm = totalPlaced > 0 && totalPlaced <= maxTotal

  return (
    <div>
      <Board gs={gs} humanPlayer={0} placement={placement} transfer={transfer}
        onStandClick={handleStandClick} locked={false} selectedStand={selected} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        {phase === 'place' && (
          <button className="btn" onClick={() => { setPhase('transfer-target'); setSelected(null) }}
            style={{ fontSize: 11, padding: '6px 12px' }}>↗</button>
        )}
        <button className="btn primary" disabled={!canConfirm} onClick={confirm}
          style={{ fontSize: 12, padding: '8px 20px' }}>✓</button>
        <button className="btn" onClick={() => { setPlacement({}); setTransfer(null); setSelected(null); setPhase('place') }}
          style={{ fontSize: 11, padding: '6px 12px' }}>↺</button>
      </div>
    </div>
  )
}

export default function PuzzleRush({ onClose }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [phase, setPhase] = useState('ready') // ready | playing | done
  const [puzzles, setPuzzles] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)

  // Загружаем головоломки и лидерборд
  useEffect(() => {
    fetch('/api/puzzles/rush').then(r => r.json()).then(d => setPuzzles(d.puzzles || [])).catch(() => {})
    fetch('/api/puzzles/rush/leaderboard').then(r => r.json()).then(setLeaderboard).catch(() => {})
  }, [])

  function start() {
    setPhase('playing'); setScore(0); setCurrentIdx(0); setTimeLeft(INITIAL_TIME)
    setStreak(0); setBestStreak(0)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setPhase('done'); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function handleSolved() {
    setScore(s => s + 1)
    setTimeLeft(t => t + BONUS_TIME)
    setStreak(s => { const ns = s + 1; setBestStreak(b => Math.max(b, ns)); return ns })
    setCurrentIdx(i => i + 1)
  }

  function handleFailed() {
    setTimeLeft(t => Math.max(0, t - PENALTY_TIME))
    setStreak(0)
    setCurrentIdx(i => i + 1)
  }

  // Submit score when done
  useEffect(() => {
    if (phase !== 'done') return
    clearInterval(timerRef.current)
    const elapsed = Date.now() - startTimeRef.current
    if (API.isLoggedIn() && score > 0) {
      API.missionProgress('solve_puzzle', score).catch(() => {})
      fetch('/api/puzzles/rush/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({ score, solved: score, time: elapsed })
      }).catch(() => {})
    }
    // Обновляем лидерборд
    fetch('/api/puzzles/rush/leaderboard').then(r => r.json()).then(setLeaderboard).catch(() => {})
  }, [phase]) // eslint-disable-line

  useEffect(() => () => clearInterval(timerRef.current), [])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timerColor = timeLeft <= 10 ? 'var(--p2)' : timeLeft <= 30 ? 'var(--gold)' : 'var(--green)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          Puzzle Rush
        </div>
        {phase === 'playing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: timerColor, fontFamily: 'monospace' }}>
              {minutes}:{String(seconds).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{score}</span>
            {streak > 1 && <span style={{ fontSize: 12, color: 'var(--green)' }}>x{streak}</span>}
          </div>
        )}
        <button className="btn" onClick={() => { clearInterval(timerRef.current); onClose() }}
          style={{ fontSize: 11, padding: '6px 12px' }}>{en ? 'Exit' : 'Выход'}</button>
      </div>

      {/* Ready screen */}
      {phase === 'ready' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--gold)' }}>Puzzle Rush</div>
          <div style={{ fontSize: 14, color: 'var(--ink2)', textAlign: 'center', maxWidth: 360, lineHeight: 1.7 }}>
            {en ? 'Solve as many puzzles as you can in 3 minutes. +10 sec for correct, -15 sec for wrong.' :
              'Решите максимум головоломок за 3 минуты. +10 сек за правильную, -15 сек за ошибку.'}
          </div>
          <button className="btn primary" onClick={start}
            style={{ fontSize: 18, padding: '16px 48px', marginTop: 16 }}>
            {en ? 'Start!' : 'Начать!'}
          </button>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div style={{ marginTop: 32, width: 320 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', marginBottom: 8, textAlign: 'center' }}>
                {en ? 'Top scores' : 'Лучшие результаты'}
              </div>
              {leaderboard.slice(0, 10).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  borderBottom: '1px solid var(--surface)' }}>
                  <span style={{ fontSize: 12, color: i < 3 ? 'var(--gold)' : 'var(--ink3)', fontWeight: 600, minWidth: 20 }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{r.username}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{r.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && puzzles[currentIdx] && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
            #{currentIdx + 1} · {en ? 'Difficulty' : 'Сложность'}: {'★'.repeat(puzzles[currentIdx].difficulty)}
          </div>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <PuzzleBoard
              key={currentIdx}
              puzzle={puzzles[currentIdx]}
              onSolved={handleSolved}
              onFailed={handleFailed}
            />
          </div>
          <button className="btn" onClick={handleFailed} style={{ marginTop: 12, fontSize: 11, color: 'var(--p2)', borderColor: '#ff606640' }}>
            {en ? 'Skip (-15s)' : 'Пропустить (-15с)'}
          </button>
        </div>
      )}

      {phase === 'playing' && !puzzles[currentIdx] && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 18, color: 'var(--green)' }}>{en ? 'All puzzles solved!' : 'Все головоломки решены!'}</div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Mascot pose={score >= 10 ? 'celebrate' : score >= 5 ? 'hero' : 'sad'} size={90} className="mascot-enter" />
          <div style={{ fontSize: 14, color: 'var(--ink3)' }}>{en ? 'Time\'s up!' : 'Время вышло!'}</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--gold)' }}>{score}</div>
          <div style={{ fontSize: 14, color: 'var(--ink2)' }}>
            {en ? 'puzzles solved' : 'головоломок решено'}
          </div>
          {bestStreak > 1 && (
            <div style={{ fontSize: 13, color: 'var(--green)' }}>
              {en ? `Best streak: ${bestStreak}` : `Лучшая серия: ${bestStreak}`}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button className="btn primary" onClick={() => {
              setPhase('ready')
              fetch('/api/puzzles/rush').then(r => r.json()).then(d => setPuzzles(d.puzzles || [])).catch(() => {})
            }} style={{ fontSize: 14, padding: '12px 28px' }}>
              {en ? 'Play again' : 'Ещё раз'}
            </button>
            <button className="btn" onClick={() => {
              const text = `Puzzle Rush: ${score} solved! — highriseheist.com`
              navigator.share?.({ text }).catch(() => navigator.clipboard?.writeText(text))
            }} style={{ fontSize: 14, padding: '12px 20px' }}>
              {en ? 'Share' : 'Поделиться'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
