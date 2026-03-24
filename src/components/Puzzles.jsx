import { useState, useEffect, useCallback } from 'react'
import { GameState, applyAction, getValidTransfers, MAX_CHIPS, MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND } from '../engine/game'
import { useI18n } from '../engine/i18n'
import Board from './Board'

const SL = i => i === GOLDEN_STAND ? '★' : String(i)

// ─── Набор головоломок ───
const PUZZLES = [
  {
    id: 1, difficulty: 1,
    title: { ru: 'Первое закрытие', en: 'First close' },
    desc: { ru: 'Закройте стойку 1 за один ход', en: 'Close stand 1 in one move' },
    goal: { closedByPlayer: [1], maxMoves: 1 },
    setup: (gs) => {
      // Стойка 1: 8 наших + 2 чужих — перенос своих замкнёт
      gs.stands[1] = [0,0,0,0,0,0,0,0,1,1]
      gs.stands[3] = [0,0,0] // наши для переноса
      gs.currentPlayer = 0; gs.turn = 4
    },
  },
  {
    id: 2, difficulty: 1,
    title: { ru: 'Золотая стойка', en: 'Golden stand' },
    desc: { ru: 'Закройте золотую стойку (★) за один ход', en: 'Close the golden stand (★) in one move' },
    goal: { closedByPlayer: [0], maxMoves: 1 },
    setup: (gs) => {
      gs.stands[0] = [0,0,0,0,0,0,1,1,0,0] // 10 фишек, наши сверху
      gs.stands[2] = [0] // для переноса
      gs.currentPlayer = 0; gs.turn = 4
    },
  },
  {
    id: 3, difficulty: 2,
    title: { ru: 'Двойное закрытие', en: 'Double close' },
    desc: { ru: 'Закройте 2 стойки за 2 хода', en: 'Close 2 stands in 2 moves' },
    goal: { minClosed: 2, maxMoves: 2 },
    setup: (gs) => {
      gs.stands[1] = [0,0,0,0,0,1,1,0,0,0] // 10
      gs.stands[4] = [0,0,0,0,0,0,0,0] // 8
      gs.stands[7] = [0,0,0] // для переноса
      gs.currentPlayer = 0; gs.turn = 6
    },
  },
  {
    id: 4, difficulty: 2,
    title: { ru: 'Захват', en: 'Capture' },
    desc: { ru: 'Закройте вражескую стойку на себя', en: 'Close an enemy stand for yourself' },
    goal: { closedByPlayer: [5], maxMoves: 1 },
    setup: (gs) => {
      gs.stands[5] = [1,1,1,1,1,0,0,0] // 8 фишек, наши сверху
      gs.stands[2] = [0,0,0] // для переноса
      gs.currentPlayer = 0; gs.turn = 6
    },
  },
  {
    id: 5, difficulty: 3,
    title: { ru: 'Размен', en: 'Trade' },
    desc: { ru: 'Перенесите и закройте 2 стойки за 2 хода', en: 'Transfer and close 2 stands in 2 moves' },
    goal: { minClosed: 2, maxMoves: 2 },
    setup: (gs) => {
      gs.stands[2] = [1,1,1,0,0,0,0,0,0,0] // 10
      gs.stands[6] = [0,0,0,0,0,1,1,1] // 8
      gs.stands[8] = [0,0] // для переноса на 6
      gs.currentPlayer = 0; gs.turn = 8
    },
  },
  {
    id: 6, difficulty: 3,
    title: { ru: 'Три за три', en: 'Three for three' },
    desc: { ru: 'Закройте 3 стойки за 3 хода', en: 'Close 3 stands in 3 moves' },
    goal: { minClosed: 3, maxMoves: 3 },
    setup: (gs) => {
      gs.stands[1] = [0,0,0,0,0,0,0,0,0,0] // 10
      gs.stands[3] = [0,0,0,0,0,0,0,0,0] // 9
      gs.stands[5] = [0,0,0,0,0,0,0,0] // 8
      gs.stands[9] = [0,0,0] // для переноса
      gs.currentPlayer = 0; gs.turn = 10
    },
  },
]

function createPuzzleState(puzzle) {
  const gs = new GameState()
  gs.swapAvailable = false
  puzzle.setup(gs)
  return gs
}

function checkGoal(puzzle, gs, startState) {
  const goal = puzzle.goal
  const myClosed = Object.entries(gs.closed).filter(([, v]) => v === 0)
  if (goal.closedByPlayer) {
    return goal.closedByPlayer.every(standIdx => gs.closed[standIdx] === 0)
  }
  if (goal.minClosed) {
    return myClosed.length >= goal.minClosed
  }
  return false
}

export default function Puzzles() {
  const { t, lang } = useI18n()
  const [selected, setSelected] = useState(null)
  const [gs, setGs] = useState(null)
  const [startGs, setStartGs] = useState(null)
  const [movesUsed, setMovesUsed] = useState(0)
  const [status, setStatus] = useState(null) // null | 'solved' | 'failed'
  const [solved, setSolved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stolbiki_puzzles') || '[]') } catch { return [] }
  })

  // Фазы хода (упрощённые)
  const [phase, setPhase] = useState('place')
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [selectedStand, setSelectedStand] = useState(null)
  const [info, setInfo] = useState('')

  function startPuzzle(puzzle) {
    const state = createPuzzleState(puzzle)
    setSelected(puzzle)
    setGs(state)
    setStartGs(state.copy())
    setMovesUsed(0)
    setStatus(null)
    setPhase('place')
    setTransfer(null)
    setPlacement({})
    setSelectedStand(null)
    setInfo(puzzle.desc[lang] || puzzle.desc.ru)
  }

  function resetPuzzle() {
    if (!selected) return
    startPuzzle(selected)
  }

  function onStandClick(i) {
    if (!gs || status || i in gs.closed) return

    if (phase === 'transfer-select') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) {
        setSelectedStand(i)
        setPhase('transfer-dst')
      }
      return
    }

    if (phase === 'transfer-dst') {
      if (i === selectedStand) { setSelectedStand(null); setPhase('transfer-select'); return }
      if (getValidTransfers(gs).some(([s, d]) => s === selectedStand && d === i)) {
        setTransfer([selectedStand, i])
        setSelectedStand(null)
        setPhase('place')
        setInfo('Перенос выбран. Расставьте фишки')
      }
      return
    }

    if (phase === 'place') {
      const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
      const maxTotal = MAX_PLACE
      const numStands = Object.keys(placement).length
      const canClose = gs.canCloseByPlacement()
      let space = gs.standSpace(i)
      if (!canClose) space = Math.max(0, space - 1)
      if (space <= 0) return

      if (i in placement) {
        const current = placement[i]
        const remaining = maxTotal - totalPlaced
        const spaceLeft = space - current
        if (remaining > 0 && spaceLeft > 0) {
          setPlacement({ ...placement, [i]: current + 1 })
        } else {
          const np = { ...placement }; delete np[i]; setPlacement(np)
        }
        return
      }
      if (numStands >= MAX_PLACE_STANDS || totalPlaced >= maxTotal) return
      setPlacement({ ...placement, [i]: 1 })
    }
  }

  function confirmTurn() {
    if (!gs || status) return
    const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
    if (totalPlaced === 0 && !transfer) return

    const action = { transfer, placement }
    const ns = applyAction(gs, action)
    const newMoves = movesUsed + 1
    setGs(ns)
    setMovesUsed(newMoves)
    setTransfer(null)
    setPlacement({})
    setSelectedStand(null)
    setPhase('place')

    if (checkGoal(selected, ns, startGs)) {
      setStatus('solved')
      if (!solved.includes(selected.id)) {
        const newSolved = [...solved, selected.id]
        setSolved(newSolved)
        localStorage.setItem('stolbiki_puzzles', JSON.stringify(newSolved))
      }
    } else if (newMoves >= selected.goal.maxMoves) {
      setStatus('failed')
    } else {
      setInfo(`Ход ${newMoves}/${selected.goal.maxMoves}`)
    }
  }

  const totalPlaced = placement ? Object.values(placement).reduce((a, b) => a + b, 0) : 0
  const hasTransfers = gs && getValidTransfers(gs).length > 0
  const inTransferMode = phase === 'transfer-select' || phase === 'transfer-dst'

  // ─── Список головоломок ───
  if (!selected) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '12px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧩</div>
          <h2 style={{ fontSize: 20, color: 'var(--ink)', fontWeight: 700 }}>{t('puzzle.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>{t('puzzle.subtitle')}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PUZZLES.map(p => {
            const isSolved = solved.includes(p.id)
            return (
              <div key={p.id} className="dash-card" onClick={() => startPuzzle(p)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  border: isSolved ? '1px solid rgba(61,214,140,0.2)' : undefined,
                  transition: 'transform 0.15s', }}>
                <div style={{ fontSize: 24, width: 40, textAlign: 'center' }}>
                  {isSolved ? '✅' : ['🟢','🟡','🔴'][p.difficulty - 1]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {p.title[lang] || p.title.ru}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                    {p.desc[lang] || p.desc.ru}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>
                  {p.goal.maxMoves} {lang === 'en' ? 'moves' : 'ходов'}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--ink3)' }}>
          {solved.length}/{PUZZLES.length} {lang === 'en' ? 'solved' : 'решено'}
        </div>
      </div>
    )
  }

  // ─── Активная головоломка ───
  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button className="btn" onClick={() => setSelected(null)} style={{ fontSize: 11, padding: '4px 10px' }}>
          {t('puzzle.back')}
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {selected.title[lang] || selected.title.ru}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
          {movesUsed}/{selected.goal.maxMoves}
        </span>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
        {info}
      </div>

      <Board state={gs} pending={placement} selected={selectedStand} phase={phase}
        humanPlayer={0} onStandClick={onStandClick} aiThinking={false} />

      {status && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>
            {status === 'solved' ? t('puzzle.solved') : t('puzzle.failed')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={resetPuzzle}>{t('puzzle.retry')}</button>
            {status === 'solved' && PUZZLES.findIndex(p => p.id === selected.id) < PUZZLES.length - 1 && (
              <button className="btn primary" onClick={() => {
                const idx = PUZZLES.findIndex(p => p.id === selected.id)
                startPuzzle(PUZZLES[idx + 1])
              }}>{t('puzzle.next')}</button>
            )}
          </div>
        </div>
      )}

      {!status && (
        <div className="actions" style={{ marginTop: 8 }}>
          {hasTransfers && !transfer && phase === 'place' && (
            <button className="btn" onClick={() => setPhase('transfer-select')}>{t('game.transfer')}</button>
          )}
          {inTransferMode && (
            <button className="btn" onClick={() => { setSelectedStand(null); setTransfer(null); setPhase('place') }}>
              {t('game.cancelTransfer')}
            </button>
          )}
          {transfer && (
            <span style={{ fontSize: 12, color: '#3dd68c', padding: '0 8px' }}>✓ {SL(transfer[0])} → {SL(transfer[1])}</span>
          )}
          {totalPlaced > 0 && <button className="btn" onClick={() => setPlacement({})}>{t('game.reset')}</button>}
          <button className="btn primary" disabled={totalPlaced === 0 && !transfer} onClick={confirmTurn}>
            {t('game.confirm')}
          </button>
        </div>
      )}
    </div>
  )
}
