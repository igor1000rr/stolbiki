import { useState, useEffect, useRef } from 'react'
import { GameState, applyAction, getValidTransfers, MAX_PLACE, MAX_PLACE_STANDS, GOLDEN_STAND } from '../engine/game'
import { useI18n } from '../engine/i18n'
import { isLoggedIn } from '../engine/api'
import Board from './Board'

const SL = i => i === GOLDEN_STAND ? '★' : String(i)
const DIFF_LABELS = { 1: { ru: 'Лёгкая', en: 'Easy' }, 2: { ru: 'Средняя', en: 'Medium' }, 3: { ru: 'Сложная', en: 'Hard' } }
const DIFF_COLORS = { 1: '#3dd68c', 2: '#ffc145', 3: '#ff6066' }

function Countdown({ label, targetDate }) {
  const [left, setLeft] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = targetDate - Date.now()
      if (diff <= 0) { setLeft('00:00:00'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [targetDate])
  return (
    <span style={{ fontSize: 10, color: 'var(--ink3)' }}>
      {label} {left}
    </span>
  )
}

function PuzzleLeaderboard({ data, lang }) {
  if (!data?.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {lang === 'en' ? 'Leaderboard' : 'Лидерборд'}
      </div>
      {data.slice(0, 5).map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11, color: 'var(--ink2)' }}>
          <span style={{ width: 16, color: i === 0 ? '#ffc145' : 'var(--ink3)', fontWeight: 700 }}>{i + 1}</span>
          <span style={{ flex: 1 }}>{r.username}</span>
          <span style={{ color: 'var(--ink3)' }}>{r.moves_used} {lang === 'en' ? 'moves' : 'ход.'}</span>
        </div>
      ))}
    </div>
  )
}

function PuzzleCard({ puzzle, lang, onPlay, userSolved }) {
  const diff = DIFF_LABELS[puzzle.difficulty]?.[lang] || DIFF_LABELS[puzzle.difficulty]?.ru
  const color = DIFF_COLORS[puzzle.difficulty]
  const desc = lang === 'en' ? puzzle.desc_en : puzzle.desc_ru
  const title = lang === 'en' ? puzzle.title_en : puzzle.title_ru
  const solved = userSolved || false
  const solveRate = puzzle.stats?.attempts > 0 ? Math.round((puzzle.stats.solved / puzzle.stats.attempts) * 100) : null

  return (
    <div className="dash-card" style={{ padding: '14px 18px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onClick={onPlay}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 20px ${color}15` }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}60` }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{title}</span>
        {solved && <span style={{ fontSize: 14 }}>✅</span>}
        <span style={{ fontSize: 10, color: 'var(--ink3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 4 }}>
          {puzzle.maxMoves} {lang === 'en' ? 'moves' : 'ход.'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{desc}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: 'var(--ink3)' }}>
        <span>{diff}</span>
        {solveRate !== null && <span>{lang === 'en' ? 'Solve rate' : 'Решаемость'}: {solveRate}%</span>}
        {puzzle.stats?.solved > 0 && <span>{puzzle.stats.solved} {lang === 'en' ? 'solved' : 'решили'}</span>}
      </div>
    </div>
  )
}

// ═══ Игровой экран головоломки ═══
function PuzzleGame({ puzzle, lang, onBack, onSolved }) {
  const [gs, setGs] = useState(null)
  const [movesUsed, setMovesUsed] = useState(0)
  const [status, setStatus] = useState(null) // null | 'solved' | 'failed'
  const [phase, setPhase] = useState('place')
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [selectedStand, setSelectedStand] = useState(null)
  const startTime = useRef(Date.now())

  useEffect(() => {
    if (!puzzle) return
    const state = new GameState()
    state.swapAvailable = false
    state.currentPlayer = 0
    state.turn = puzzle.turn || 6
    if (puzzle.stands) {
      for (let i = 0; i < 10; i++) state.stands[i] = puzzle.stands[i] ? [...puzzle.stands[i]] : []
    }
    if (puzzle.closed) state.closed = { ...puzzle.closed }
    setGs(state)
    setMovesUsed(0)
    setStatus(null)
    setPhase('place')
    setTransfer(null)
    setPlacement({})
    startTime.current = Date.now()
  }, [puzzle])

  function checkGoal(state) {
    if (!puzzle?.goal) return false
    if (puzzle.goal.closedByPlayer) {
      return Object.entries(puzzle.goal.closedByPlayer).every(([idx, player]) => state.closed[idx] === player)
    }
    if (puzzle.goal.minClosed) {
      return Object.values(state.closed).filter(v => v === 0).length >= puzzle.goal.minClosed
    }
    return false
  }

  function onStandClick(i) {
    if (!gs || status || i in gs.closed) return
    if (phase === 'transfer-select') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) { setSelectedStand(i); setPhase('transfer-dst') }
      return
    }
    if (phase === 'transfer-dst') {
      if (i === selectedStand) { setSelectedStand(null); setPhase('transfer-select'); return }
      if (getValidTransfers(gs).some(([s, d]) => s === selectedStand && d === i)) {
        setTransfer([selectedStand, i]); setSelectedStand(null); setPhase('place')
      }
      return
    }
    if (phase === 'place') {
      const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
      const numStands = Object.keys(placement).length
      const canClose = gs.canCloseByPlacement()
      let space = gs.standSpace(i)
      if (!canClose) space = Math.max(0, space - 1)
      if (space <= 0) return
      if (i in placement) {
        const c = placement[i]; const rem = MAX_PLACE - totalPlaced; const sl = space - c
        if (rem > 0 && sl > 0) setPlacement({ ...placement, [i]: c + 1 })
        else { const np = { ...placement }; delete np[i]; setPlacement(np) }
        return
      }
      if (numStands >= MAX_PLACE_STANDS || totalPlaced >= MAX_PLACE) return
      setPlacement({ ...placement, [i]: 1 })
    }
  }

  function confirmTurn() {
    if (!gs || status) return
    const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
    if (totalPlaced === 0 && !transfer) return
    const ns = applyAction(gs, { transfer, placement })
    const newMoves = movesUsed + 1
    setGs(ns); setMovesUsed(newMoves)
    setTransfer(null); setPlacement({}); setSelectedStand(null); setPhase('place')

    if (checkGoal(ns)) {
      setStatus('solved')
      const duration = Math.floor((Date.now() - startTime.current) / 1000)
      onSolved?.(newMoves, duration)
    } else if (newMoves >= puzzle.maxMoves) {
      setStatus('failed')
    }
  }

  function reset() {
    const state = new GameState()
    state.swapAvailable = false; state.currentPlayer = 0; state.turn = puzzle.turn || 6
    if (puzzle.stands) for (let i = 0; i < 10; i++) state.stands[i] = puzzle.stands[i] ? [...puzzle.stands[i]] : []
    if (puzzle.closed) state.closed = { ...puzzle.closed }
    setGs(state); setMovesUsed(0); setStatus(null); setPhase('place')
    setTransfer(null); setPlacement({}); setSelectedStand(null); startTime.current = Date.now()
  }

  if (!gs) return null
  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const hasTransfers = getValidTransfers(gs).length > 0
  const inTransferMode = phase === 'transfer-select' || phase === 'transfer-dst'
  const title = lang === 'en' ? puzzle.title_en : puzzle.title_ru
  const desc = lang === 'en' ? puzzle.desc_en : puzzle.desc_ru

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
        <button className="btn" onClick={onBack} style={{ fontSize: 11, padding: '5px 12px' }}>←</button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{desc}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: movesUsed >= puzzle.maxMoves ? 'var(--p2)' : 'var(--ink)' }}>
            {movesUsed}/{puzzle.maxMoves}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{lang === 'en' ? 'moves' : 'ходов'}</div>
        </div>
      </div>

      <Board state={gs} pending={placement} selected={selectedStand} phase={phase} humanPlayer={0} onStandClick={onStandClick} aiThinking={false} />

      {/* Результат */}
      {status && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{status === 'solved' ? '🎉' : '😔'}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: status === 'solved' ? 'var(--green)' : 'var(--p2)', marginBottom: 12 }}>
            {status === 'solved' ? (lang === 'en' ? 'Solved!' : 'Решено!') : (lang === 'en' ? 'Failed' : 'Не удалось')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={reset}>{lang === 'en' ? 'Retry' : 'Заново'}</button>
            <button className="btn primary" onClick={onBack}>{lang === 'en' ? 'Back' : 'К списку'}</button>
          </div>
        </div>
      )}

      {/* Управление */}
      {!status && (
        <div className="actions" style={{ marginTop: 10 }}>
          {hasTransfers && !transfer && phase === 'place' && (
            <button className="btn" onClick={() => setPhase('transfer-select')}>↗</button>
          )}
          {inTransferMode && (
            <button className="btn" onClick={() => { setSelectedStand(null); setTransfer(null); setPhase('place') }}>✕</button>
          )}
          {transfer && <span style={{ fontSize: 12, color: 'var(--green)', padding: '0 6px' }}>✓ {SL(transfer[0])}→{SL(transfer[1])}</span>}
          {totalPlaced > 0 && <button className="btn" onClick={() => setPlacement({})}>↺</button>}
          <button className="btn primary" disabled={totalPlaced === 0 && !transfer} onClick={confirmTurn}>OK</button>
          <button className="btn" onClick={reset} style={{ fontSize: 11 }}>⟳</button>
        </div>
      )}
    </div>
  )
}

// ═══ Главный компонент ═══
export default function Puzzles() {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState('featured') // featured | bank
  const [daily, setDaily] = useState(null)
  const [weekly, setWeekly] = useState(null)
  const [bank, setBank] = useState(null)
  const [bankPage, setBankPage] = useState(1)
  const [bankDiff, setBankDiff] = useState(0)
  const [activePuzzle, setActivePuzzle] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [solvedSet, setSolvedSet] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('stolbiki_puzzles_solved') || '[]')) } catch { return new Set() }
  })

  useEffect(() => {
    fetch('/api/puzzles/daily').then(r => r.json()).then(setDaily).catch(() => {})
    fetch('/api/puzzles/weekly').then(r => r.json()).then(setWeekly).catch(() => {})
    if (isLoggedIn()) fetch('/api/puzzles/user/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` } }).then(r => r.json()).then(setUserStats).catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/puzzles/bank?page=${bankPage}${bankDiff ? `&difficulty=${bankDiff}` : ''}`).then(r => r.json()).then(setBank).catch(() => {})
  }, [bankPage, bankDiff])

  function markSolved(key, moves, duration) {
    const newSet = new Set(solvedSet); newSet.add(key)
    setSolvedSet(newSet)
    localStorage.setItem('stolbiki_puzzles_solved', JSON.stringify([...newSet]))
    // Отправляем на сервер
    if (isLoggedIn()) {
      const [type, id] = key.split(':')
      fetch('/api/puzzles/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({ type, puzzleId: id, solved: true, movesUsed: moves, duration })
      }).catch(() => {})
    }
  }

  // Таймер до следующего дня/недели
  const now = new Date()
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const dayOfWeek = now.getDay()
  const nextMonday = new Date(now); nextMonday.setDate(now.getDate() + (8 - dayOfWeek) % 7 || 7); nextMonday.setHours(0,0,0,0)

  // ═══ Активная головоломка ═══
  if (activePuzzle) {
    const key = `${activePuzzle.type}:${activePuzzle.id}`
    return (
      <PuzzleGame puzzle={activePuzzle} lang={lang} onBack={() => setActivePuzzle(null)}
        onSolved={(moves, dur) => markSolved(key, moves, dur)} />
    )
  }

  // ═══ Список ═══
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Заголовок + статы */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 700, margin: 0 }}>
            🧩 {lang === 'en' ? 'Puzzles' : 'Головоломки'}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>
            {lang === 'en' ? 'Close stands in limited moves' : 'Закрывайте стойки за ограниченное число ходов'}
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink3)' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{solvedSet.size}</div>
          {lang === 'en' ? 'solved' : 'решено'}
        </div>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[
          ['featured', lang === 'en' ? '⭐ Featured' : '⭐ Избранные'],
          ['bank', lang === 'en' ? '📦 All puzzles' : '📦 Все головоломки'],
        ].map(([id, label]) => (
          <button key={id} className={`btn ${tab === id ? 'primary' : ''}`} onClick={() => setTab(id)}
            style={{ fontSize: 12, padding: '7px 16px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ FEATURED: daily + weekly ═══ */}
      {tab === 'featured' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Daily */}
          <div className="dash-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {lang === 'en' ? 'Daily Puzzle' : 'Головоломка дня'}
                </div>
                <Countdown label={lang === 'en' ? 'Next in' : 'Новая через'} targetDate={nextDay.getTime()} />
              </div>
              {daily && solvedSet.has(`daily:${daily.id}`) && <span style={{ fontSize: 20 }}>✅</span>}
            </div>
            {daily ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
                  {lang === 'en' ? daily.desc_en : daily.desc_ru}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: DIFF_COLORS[daily.difficulty], background: `${DIFF_COLORS[daily.difficulty]}15`, padding: '2px 8px', borderRadius: 4 }}>
                    {DIFF_LABELS[daily.difficulty]?.[lang]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{daily.maxMoves} {lang === 'en' ? 'moves' : 'ходов'}</span>
                  {daily.stats?.solved > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{daily.stats.solved} ✓</span>
                  )}
                </div>
                <button className="btn primary" onClick={() => setActivePuzzle({ ...daily, type: 'daily' })}
                  style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px 0' }}>
                  {solvedSet.has(`daily:${daily.id}`) ? (lang === 'en' ? '↻ Replay' : '↻ Переиграть') : (lang === 'en' ? '▶ Play' : '▶ Играть')}
                </button>
                <PuzzleLeaderboard data={daily.leaderboard} lang={lang} />
              </>
            ) : (
              <div style={{ color: 'var(--ink3)', fontSize: 12 }}>{lang === 'en' ? 'Loading...' : 'Загрузка...'}</div>
            )}
          </div>

          {/* Weekly */}
          <div className="dash-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>🏆</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {lang === 'en' ? 'Weekly Challenge' : 'Задача недели'}
                </div>
                <Countdown label={lang === 'en' ? 'Next in' : 'Новая через'} targetDate={nextMonday.getTime()} />
              </div>
              {weekly && solvedSet.has(`weekly:${weekly.id}`) && <span style={{ fontSize: 20 }}>✅</span>}
            </div>
            {weekly ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
                  {lang === 'en' ? weekly.desc_en : weekly.desc_ru}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: DIFF_COLORS[weekly.difficulty], background: `${DIFF_COLORS[weekly.difficulty]}15`, padding: '2px 8px', borderRadius: 4 }}>
                    {DIFF_LABELS[weekly.difficulty]?.[lang]}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{weekly.maxMoves} {lang === 'en' ? 'moves' : 'ходов'}</span>
                </div>
                <button className="btn primary" onClick={() => setActivePuzzle({ ...weekly, type: 'weekly' })}
                  style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px 0' }}>
                  {solvedSet.has(`weekly:${weekly.id}`) ? (lang === 'en' ? '↻ Replay' : '↻ Переиграть') : (lang === 'en' ? '▶ Play' : '▶ Играть')}
                </button>
                <PuzzleLeaderboard data={weekly.leaderboard} lang={lang} />
              </>
            ) : (
              <div style={{ color: 'var(--ink3)', fontSize: 12 }}>{lang === 'en' ? 'Loading...' : 'Загрузка...'}</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ BANK ═══ */}
      {tab === 'bank' && (
        <div>
          {/* Фильтр сложности */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {[
              [0, lang === 'en' ? 'All' : 'Все'],
              [1, lang === 'en' ? '🟢 Easy' : '🟢 Лёгкие'],
              [2, lang === 'en' ? '🟡 Medium' : '🟡 Средние'],
              [3, lang === 'en' ? '🔴 Hard' : '🔴 Сложные'],
            ].map(([d, label]) => (
              <button key={d} className={`btn ${bankDiff === d ? 'primary' : ''}`}
                onClick={() => { setBankDiff(d); setBankPage(1) }}
                style={{ fontSize: 11, padding: '5px 12px' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Список */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {bank?.puzzles?.map(p => (
              <PuzzleCard key={p.id} puzzle={p} lang={lang}
                userSolved={solvedSet.has(`bank:${p.id}`)}
                onPlay={() => setActivePuzzle({ ...p, type: 'bank' })} />
            ))}
          </div>
          {(!bank?.puzzles?.length) && (
            <div style={{ textAlign: 'center', color: 'var(--ink3)', padding: 40, fontSize: 13 }}>
              {lang === 'en' ? 'Loading puzzles...' : 'Загрузка головоломок...'}
            </div>
          )}

          {/* Пагинация */}
          {bank && bank.pages > 1 && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 20 }}>
              {Array.from({ length: bank.pages }, (_, i) => (
                <button key={i} className={`btn ${bankPage === i + 1 ? 'primary' : ''}`}
                  onClick={() => setBankPage(i + 1)}
                  style={{ fontSize: 11, padding: '5px 10px', minWidth: 32 }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
