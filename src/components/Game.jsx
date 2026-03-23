import { useState, useCallback, useRef, useEffect } from 'react'
import {
  GameState, getValidTransfers, applyAction,
  MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND
} from '../engine/game'
import { mctsSearch } from '../engine/ai'
import { getHint } from '../engine/hints'
import Board from './Board'

const standLabel = i => i === GOLDEN_STAND ? '★' : String(i)

function describeAction(action, player) {
  const pn = `П${player + 1}`
  if (action.swap) return `${pn}: Swap (смена цветов)`
  const parts = []
  if (action.transfer)
    parts.push(`перенос ${standLabel(action.transfer[0])}→${standLabel(action.transfer[1])}`)
  if (action.placement && Object.keys(action.placement).length)
    parts.push(`установка ${Object.entries(action.placement).map(([k, v]) => `${standLabel(+k)}:${v}`).join(', ')}`)
  return `${pn}: ${parts.length ? parts.join(', ') : 'пас'}`
}

export default function Game() {
  const [gs, setGs] = useState(() => new GameState())
  const [phase, setPhase] = useState('place')
  const [selected, setSelected] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [placeCount, setPlaceCount] = useState(1)
  const [humanPlayer, setHumanPlayer] = useState(0)
  const [difficulty, setDifficulty] = useState(50)
  const [log, setLog] = useState([{ text: 'Начало партии', player: -1 }])
  const [info, setInfo] = useState('')
  const [result, setResult] = useState(null)
  const [hint, setHint] = useState(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintMode, setHintMode] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [scoreBump, setScoreBump] = useState(null)
  const [locked, setLocked] = useState(false) // блокировка UI во время анимаций
  const aiRunning = useRef(false)
  const prevScore = useRef([0, 0])
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0
  }, [log])

  // Score bump
  useEffect(() => {
    const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
    if (s0 > prevScore.current[0]) {
      setScoreBump(0)
      setTimeout(() => setScoreBump(null), 700)
    }
    if (s1 > prevScore.current[1]) {
      setScoreBump(1)
      setTimeout(() => setScoreBump(null), 700)
    }
    prevScore.current = [s0, s1]
  }, [gs])

  const addLog = useCallback((text, player) => {
    setLog(prev => [{ text, player }, ...prev])
  }, [])

  // AI ход — с правильными таймингами
  const runAi = useCallback((state) => {
    if (aiRunning.current || state.gameOver) return
    aiRunning.current = true
    setAiThinking(true)
    setLocked(true)
    setInfo('AI думает')

    // Минимум 1.2с "думания" чтобы человек увидел
    const startTime = Date.now()

    setTimeout(() => {
      const action = mctsSearch(state, difficulty)
      const elapsed = Date.now() - startTime
      const minDelay = 1200
      const remaining = Math.max(0, minDelay - elapsed)

      // Ждём минимальный delay
      setTimeout(() => {
        setAiThinking(false)
        addLog(describeAction(action, state.currentPlayer), state.currentPlayer)
        const ns = applyAction(state, action)

        setGs(ns)
        aiRunning.current = false

        if (ns.gameOver) {
          // Пауза перед показом результата
          setTimeout(() => {
            setResult(ns.winner)
            setInfo('Партия окончена')
            setLocked(false)
          }, 800)
          return
        }

        // AI ходит подряд (после swap)
        if (ns.currentPlayer !== humanPlayer) {
          setTimeout(() => runAi(ns), 600)
          return
        }

        // Пауза после хода AI чтобы увидеть изменения
        setTimeout(() => {
          setLocked(false)
          if (ns.isFirstTurn()) {
            setPhase('place')
            setInfo('Ваш ход. Поставьте 1 фишку.')
          } else {
            setPhase('transfer')
            setInfo('Ваш ход. Выберите стойку для переноса или пропустите.')
          }
        }, 600)
      }, remaining)
    }, 100) // Начинаем вычисление чуть позже чтобы UI обновился
  }, [difficulty, humanPlayer, addLog])

  const newGame = useCallback((side, diff) => {
    const hp = side ?? humanPlayer
    const d = diff ?? difficulty
    const state = new GameState()
    setGs(state)
    setPhase('place')
    setSelected(null)
    setTransfer(null)
    setPlacement({})
    setPlaceCount(1)
    setResult(null)
    setHint(null)
    setAiThinking(false)
    setScoreBump(null)
    setLocked(false)
    setHumanPlayer(hp)
    setDifficulty(d)
    aiRunning.current = false
    prevScore.current = [0, 0]

    const pName = hp === 0 ? 'Игрок 1 (синие)' : 'Игрок 2 (красные)'
    setLog([{ text: `Новая партия. Вы — ${pName}`, player: -1 }])

    if (state.currentPlayer !== hp) {
      setInfo('AI делает первый ход')
      setLocked(true)
      setTimeout(() => runAi(state), 600)
    } else {
      setInfo('Первый ход: поставьте 1 фишку на любую стойку.')
    }
  }, [humanPlayer, difficulty, runAi])

  useEffect(() => { newGame(0, 50) }, []) // eslint-disable-line

  const onStandClick = useCallback((i) => {
    if (gs.gameOver || gs.currentPlayer !== humanPlayer || aiRunning.current || locked) return
    if (i in gs.closed) return

    if (phase === 'transfer') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) {
        setSelected(i)
        setPhase('transfer-dst')
        setInfo('Выберите стойку назначения.')
      }
      return
    }

    if (phase === 'transfer-dst') {
      if (i === selected) {
        setSelected(null)
        setPhase('transfer')
        setInfo('Выберите стойку для переноса или пропустите.')
        return
      }
      const transfers = getValidTransfers(gs)
      if (transfers.some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i])
        setSelected(null)
        setPhase('place')
        setInfo('Перенос выбран. Расставьте фишки или подтвердите.')
      }
      return
    }

    if (phase === 'place') {
      const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
      const currentTotal = Object.values(placement).reduce((a, b) => a + b, 0)
      const stands = Object.keys(placement).length

      let space = gs.standSpace(i)
      if (!gs.canCloseByPlacement()) space = Math.max(0, space - 1)

      if (i in placement) {
        setPlacement(prev => { const c = { ...prev }; delete c[i]; return c })
      } else {
        if (stands >= MAX_PLACE_STANDS) { setInfo('Максимум 2 стойки.'); return }
        if (currentTotal >= maxTotal) { setInfo('Все фишки расставлены.'); return }
        const add = Math.min(placeCount, space, maxTotal - currentTotal)
        if (add > 0) setPlacement(prev => ({ ...prev, [i]: add }))
      }
    }
  }, [gs, phase, selected, placement, placeCount, humanPlayer, locked])

  const confirmTurn = useCallback(() => {
    if (gs.currentPlayer !== humanPlayer || gs.gameOver || locked) return
    const action = { transfer, placement }
    addLog(describeAction(action, humanPlayer), humanPlayer)
    const ns = applyAction(gs, action)
    setTransfer(null)
    setPlacement({})
    setSelected(null)
    setHint(null)
    setLocked(true)

    setGs(ns)

    if (ns.gameOver) {
      setTimeout(() => {
        setResult(ns.winner)
        setInfo('Партия окончена')
        setLocked(false)
      }, 800)
      return
    }

    // Пауза чтобы игрок увидел свой ход, потом AI
    setPhase('ai')
    setTimeout(() => runAi(ns), 500)
  }, [gs, transfer, placement, humanPlayer, addLog, runAi, locked])

  const skipTransfer = useCallback(() => {
    setTransfer(null)
    setSelected(null)
    setPhase('place')
    setInfo(gs.isFirstTurn() ? 'Поставьте 1 фишку.' : 'Расставьте фишки (до 3 на 2 стойки).')
  }, [gs])

  const requestHint = useCallback(() => {
    if (gs.currentPlayer !== humanPlayer || gs.gameOver || aiRunning.current || locked) return
    setHintLoading(true)
    setTimeout(() => {
      const h = getHint(gs, 60)
      setHint(h)
      setHintLoading(false)
    }, 100)
  }, [gs, humanPlayer, locked])

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canConfirm = gs.isFirstTurn() ? totalPlaced === 1 : true
  const isMyTurn = gs.currentPlayer === humanPlayer && !gs.gameOver && !aiRunning.current && !locked

  return (
    <div>
      <div className="game-settings">
        <label>
          Сторона:
          <select value={humanPlayer} onChange={e => newGame(+e.target.value, difficulty)}>
            <option value={0}>Игрок 1 (синие)</option>
            <option value={1}>Игрок 2 (красные)</option>
          </select>
        </label>
        <label>
          Сложность:
          <select value={difficulty} onChange={e => newGame(humanPlayer, +e.target.value)}>
            <option value={20}>Лёгкая</option>
            <option value={50}>Средняя</option>
            <option value={100}>Сложная</option>
          </select>
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={hintMode}
            onChange={e => { setHintMode(e.target.checked); setHint(null) }}
            style={{ marginRight: 4 }} />
          Подсказки
        </label>
      </div>

      <div className="scoreboard">
        <div className="score-player">
          <div className="score-label">Игрок 1</div>
          <div className={`score-num p0 ${scoreBump === 0 ? 'score-bump' : ''}`}>{gs.countClosed(0)}</div>
        </div>
        <div className="score-sep">:</div>
        <div className="score-player">
          <div className="score-label">Игрок 2</div>
          <div className={`score-num p1 ${scoreBump === 1 ? 'score-bump' : ''}`}>{gs.countClosed(1)}</div>
        </div>
      </div>

      <div className={`game-info ${aiThinking ? 'thinking-dots' : ''}`}>{info}</div>

      <Board
        state={gs}
        pending={placement}
        selected={selected}
        phase={phase}
        humanPlayer={humanPlayer}
        onStandClick={onStandClick}
        aiThinking={aiThinking}
      />

      {phase === 'place' && !gs.isFirstTurn() && isMyTurn && (
        <div className="place-controls">
          <span>Фишек:</span>
          {[1, 2, 3].map(n => (
            <button key={n}
              className={`chip-btn ${placeCount === n ? 'active' : ''}`}
              onClick={() => setPlaceCount(n)}>
              {n}
            </button>
          ))}
          <span className="place-status">
            {totalPlaced}/{maxTotal} фишек, {Object.keys(placement).length}/{MAX_PLACE_STANDS} стоек
          </span>
        </div>
      )}

      <div className="actions">
        {isMyTurn && (phase === 'transfer' || phase === 'transfer-dst') && (
          <button className="btn" onClick={skipTransfer}>Без переноса →</button>
        )}
        {isMyTurn && phase === 'transfer-dst' && (
          <button className="btn" onClick={() => { setSelected(null); setPhase('transfer') }}>Отмена</button>
        )}
        {isMyTurn && phase === 'place' && totalPlaced > 0 && (
          <button className="btn" onClick={() => setPlacement({})}>Сброс</button>
        )}
        {isMyTurn && phase === 'place' && (
          <button className="btn primary" disabled={!canConfirm} onClick={confirmTurn}>
            Подтвердить
          </button>
        )}
        {hintMode && isMyTurn && (
          <button className="btn" onClick={requestHint} disabled={hintLoading}
            style={{ borderColor: '#ffbe30', color: '#ffbe30' }}>
            {hintLoading ? 'Анализ...' : '💡 Подсказка'}
          </button>
        )}
        <button className="btn" onClick={() => newGame()}>Новая партия</button>
      </div>

      {hint && hintMode && (
        <div className="hint-panel">
          <div className="hint-title">💡 Подсказка</div>
          {hint.explanation.map((line, i) => (
            <p key={i} className="hint-line">{line}</p>
          ))}
        </div>
      )}

      {result !== null && (
        <div className="game-result" style={{ borderLeft: `3px solid ${result === humanPlayer ? '#3dd68c' : '#ff6066'}` }}>
          <span>{result === humanPlayer ? '🎉 Вы победили!' : `AI побеждает • ${gs.countClosed(0)}:${gs.countClosed(1)}`}</span>
        </div>
      )}

      <div className="game-log" ref={logRef}>
        {log.map((entry, i) => (
          <div key={i}>
            <span className={entry.player >= 0 ? `log-p${entry.player}` : ''}>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
