import { useState, useCallback, useRef, useEffect } from 'react'
import {
  GameState, getValidTransfers, applyAction,
  MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND
} from '../engine/game'
import { mctsSearch } from '../engine/ai'
import { getHint } from '../engine/hints'
import Board from './Board'

const SL = i => i === GOLDEN_STAND ? '★' : String(i)

function describeAction(a, p) {
  const name = p === 0 ? 'Синие' : 'Красные'
  if (a.swap) return `${name}: Swap — смена цветов`
  const parts = []
  if (a.transfer) {
    const [gc] = [0] // placeholder
    parts.push(`перенос ${SL(a.transfer[0])} → ${SL(a.transfer[1])}`)
  }
  if (a.placement && Object.keys(a.placement).length) {
    const chips = Object.entries(a.placement).map(([k, v]) => `${v} на ${SL(+k)}`).join(', ')
    parts.push(`установка: ${chips}`)
  }
  if (!parts.length) parts.push('пас')
  return `${name}: ${parts.join(' + ')}`
}

export default function Game() {
  const [gs, setGs] = useState(() => new GameState())
  // Фазы: 'place' (по умолчанию), 'transfer-select', 'transfer-dst', 'ai', 'done'
  const [phase, setPhase] = useState('place')
  const [selected, setSelected] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [placeCount, setPlaceCount] = useState(1)
  const [humanPlayer, setHumanPlayer] = useState(0)
  const [difficulty, setDifficulty] = useState(50)
  const [log, setLog] = useState([])
  const [info, setInfo] = useState('')
  const [result, setResult] = useState(null)
  const [hint, setHint] = useState(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintMode, setHintMode] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [scoreBump, setScoreBump] = useState(null)
  const [locked, setLocked] = useState(false)
  const aiRunning = useRef(false)
  const prevScore = useRef([0, 0])
  const logRef = useRef(null)

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0 }, [log])

  useEffect(() => {
    const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
    if (s0 > prevScore.current[0]) { setScoreBump(0); setTimeout(() => setScoreBump(null), 700) }
    if (s1 > prevScore.current[1]) { setScoreBump(1); setTimeout(() => setScoreBump(null), 700) }
    prevScore.current = [s0, s1]
  }, [gs])

  const addLog = useCallback((text, player) => {
    setLog(prev => [{ text, player, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev])
  }, [])

  const myColor = humanPlayer === 0 ? 'синие' : 'красные'
  const hasTransfers = !gs.isFirstTurn() && getValidTransfers(gs).length > 0

  // ─── AI ход ───
  const runAi = useCallback((state) => {
    if (aiRunning.current || state.gameOver) return
    aiRunning.current = true
    setAiThinking(true)
    setLocked(true)
    setInfo('AI думает')

    const startTime = Date.now()
    setTimeout(() => {
      const action = mctsSearch(state, difficulty)
      const remaining = Math.max(0, 1000 - (Date.now() - startTime))

      setTimeout(() => {
        setAiThinking(false)
        addLog(describeAction(action, state.currentPlayer), state.currentPlayer)

        setTimeout(() => {
          const ns = applyAction(state, action)
          setGs(ns)
          aiRunning.current = false

          if (ns.gameOver) {
            setTimeout(() => { setResult(ns.winner); setPhase('done'); setInfo('Партия завершена'); setLocked(false) }, 800)
            return
          }
          if (ns.currentPlayer !== humanPlayer) {
            setTimeout(() => runAi(ns), 600)
            return
          }
          setTimeout(() => {
            setLocked(false)
            setPhase('place')
            setTransfer(null)
            setPlacement({})
            setInfo(ns.isFirstTurn() ? 'Поставьте 1 фишку на любую стойку' : 'Ваш ход — расставьте фишки')
          }, 500)
        }, 300)
      }, remaining)
    }, 50)
  }, [difficulty, humanPlayer, addLog])

  // ─── Новая игра ───
  const newGame = useCallback((side, diff) => {
    const hp = side ?? humanPlayer
    const d = diff ?? difficulty
    const state = new GameState()
    setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({})
    setPlaceCount(1); setResult(null); setHint(null); setAiThinking(false)
    setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(d)
    aiRunning.current = false; prevScore.current = [0, 0]
    const c = hp === 0 ? 'синие' : 'красные'
    setLog([{ text: `Новая партия. Вы — ${c}`, player: -1, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
    if (state.currentPlayer !== hp) {
      setInfo('AI делает первый ход')
      setLocked(true)
      setTimeout(() => runAi(state), 500)
    } else {
      setInfo('Первый ход — поставьте 1 фишку на любую стойку')
    }
  }, [humanPlayer, difficulty, runAi])

  useEffect(() => { newGame(0, 50) }, []) // eslint-disable-line

  // ─── Клик по стойке ───
  const onStandClick = useCallback((i) => {
    if (gs.gameOver || gs.currentPlayer !== humanPlayer || aiRunning.current || locked) return
    if (i in gs.closed) return

    // Фаза переноса: выбор источника
    if (phase === 'transfer-select') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) {
        setSelected(i)
        setPhase('transfer-dst')
        setInfo(`Выберите куда перенести фишки со стойки ${SL(i)}`)
      }
      return
    }

    // Фаза переноса: выбор цели
    if (phase === 'transfer-dst') {
      if (i === selected) { setSelected(null); setPhase('transfer-select'); setInfo('Выберите стойку для переноса'); return }
      if (getValidTransfers(gs).some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i])
        setSelected(null)
        setPhase('place')
        addLog(`Перенос: ${SL(selected)} → ${SL(i)}`, humanPlayer)
        setInfo('Перенос выбран. Теперь расставьте фишки')
      } else {
        setInfo(`Нельзя перенести на стойку ${SL(i)}`)
      }
      return
    }

    // Фаза установки
    if (phase === 'place') {
      const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
      const currentTotal = Object.values(placement).reduce((a, b) => a + b, 0)
      const numStands = Object.keys(placement).length

      let space = gs.standSpace(i)
      if (!gs.canCloseByPlacement()) space = Math.max(0, space - 1)

      if (space <= 0) { setInfo(`Стойка ${SL(i)} заполнена`); return }

      if (i in placement) {
        // Повторный клик на стойку с фишками:
        // Если можно добавить ещё — добавляем placeCount
        // Если нельзя — убираем все с этой стойки
        const current = placement[i]
        const canAddMore = currentTotal < maxTotal && current < space
        if (canAddMore) {
          const add = Math.min(placeCount, space - current, maxTotal - currentTotal)
          if (add > 0) {
            setPlacement(prev => ({ ...prev, [i]: current + add }))
            const newTotal = currentTotal + add
            setInfo(`${newTotal}/${maxTotal} фишек на ${Object.keys(placement).length} стойках`)
            return
          }
        }
        // Убираем
        setPlacement(prev => { const c = { ...prev }; delete c[i]; return c })
        setInfo(`Фишки убраны со стойки ${SL(i)}`)
      } else {
        if (numStands >= MAX_PLACE_STANDS) { setInfo('Максимум 2 стойки за ход. Кликните на стойку с фишками чтобы убрать'); return }
        if (currentTotal >= maxTotal) { setInfo(`Все ${maxTotal} фишки расставлены`); return }
        const add = Math.min(placeCount, space, maxTotal - currentTotal)
        if (add > 0) {
          setPlacement(prev => ({ ...prev, [i]: add }))
          const newTotal = currentTotal + add
          setInfo(`${newTotal}/${maxTotal} фишек. ${newTotal >= maxTotal ? 'Подтвердите ход' : 'Кликните ещё стойку'}`)
        }
      }
    }
  }, [gs, phase, selected, placement, placeCount, humanPlayer, locked, addLog])

  // ─── Подтверждение ───
  const confirmTurn = useCallback(() => {
    if (gs.currentPlayer !== humanPlayer || gs.gameOver || locked) return
    const action = { transfer, placement }
    addLog(describeAction(action, humanPlayer), humanPlayer)
    const ns = applyAction(gs, action)
    setTransfer(null); setPlacement({}); setSelected(null); setHint(null); setLocked(true)
    setGs(ns)
    if (ns.gameOver) {
      setTimeout(() => { setResult(ns.winner); setPhase('done'); setInfo('Партия завершена'); setLocked(false) }, 800)
      return
    }
    setPhase('ai')
    setTimeout(() => runAi(ns), 500)
  }, [gs, transfer, placement, humanPlayer, addLog, runAi, locked])

  // ─── Перенос ───
  const startTransfer = useCallback(() => {
    setPhase('transfer-select')
    setInfo('Выберите стойку откуда перенести')
  }, [])

  const cancelTransfer = useCallback(() => {
    setSelected(null); setTransfer(null); setPhase('place')
    setInfo('Перенос отменён. Расставьте фишки')
  }, [])

  const requestHint = useCallback(() => {
    if (gs.currentPlayer !== humanPlayer || gs.gameOver || locked) return
    setHintLoading(true)
    setTimeout(() => { setHint(getHint(gs, 60)); setHintLoading(false) }, 100)
  }, [gs, humanPlayer, locked])

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canConfirm = gs.isFirstTurn() ? totalPlaced === 1 : (totalPlaced > 0 || transfer)
  const isMyTurn = gs.currentPlayer === humanPlayer && !gs.gameOver && !aiRunning.current && !locked
  const inTransferMode = phase === 'transfer-select' || phase === 'transfer-dst'

  return (
    <div>
      <div className="game-settings">
        <label>Сторона:
          <select value={humanPlayer} onChange={e => newGame(+e.target.value, difficulty)}>
            <option value={0}>Синие (первый ход)</option>
            <option value={1}>Красные (swap)</option>
          </select>
        </label>
        <label>Сложность:
          <select value={difficulty} onChange={e => newGame(humanPlayer, +e.target.value)}>
            <option value={20}>Лёгкая</option>
            <option value={50}>Средняя</option>
            <option value={100}>Сложная</option>
          </select>
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={hintMode} onChange={e => { setHintMode(e.target.checked); setHint(null) }} style={{ marginRight: 4 }} />
          Подсказки
        </label>
      </div>

      <div className="scoreboard">
        <div className="score-player">
          <div className="score-label">Синие</div>
          <div className={`score-num p0 ${scoreBump === 0 ? 'score-bump' : ''}`}>{gs.countClosed(0)}</div>
        </div>
        <div className="score-sep">:</div>
        <div className="score-player">
          <div className="score-label">Красные</div>
          <div className={`score-num p1 ${scoreBump === 1 ? 'score-bump' : ''}`}>{gs.countClosed(1)}</div>
        </div>
      </div>

      <div className={`game-info ${aiThinking ? 'thinking-dots' : ''}`}>{info}</div>

      <Board state={gs} pending={placement} selected={selected} phase={phase} humanPlayer={humanPlayer} onStandClick={onStandClick} aiThinking={aiThinking} />

      {/* Кнопки выбора количества фишек */}
      {phase === 'place' && !gs.isFirstTurn() && isMyTurn && (
        <div className="place-controls">
          <span>За клик:</span>
          {[1, 2, 3].map(n => (
            <button key={n} className={`chip-btn ${placeCount === n ? 'active' : ''}`} onClick={() => { setPlaceCount(n); setInfo(`Клик = ${n} фишек. Кликните на стойку`) }}>{n}</button>
          ))}
          <span className="place-status">
            {totalPlaced}/{maxTotal} фишек · {Object.keys(placement).length}/{MAX_PLACE_STANDS} стоек
            {transfer && ` · перенос ✓`}
          </span>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="actions">
        {/* Перенос — только если есть куда и мы в фазе place */}
        {isMyTurn && phase === 'place' && hasTransfers && !transfer && (
          <button className="btn" onClick={startTransfer}>↗ Сделать перенос</button>
        )}
        {isMyTurn && inTransferMode && (
          <button className="btn" onClick={cancelTransfer}>✕ Отменить перенос</button>
        )}
        {isMyTurn && transfer && phase === 'place' && (
          <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            ✓ Перенос: {SL(transfer[0])} → {SL(transfer[1])}
          </span>
        )}

        {/* Сброс и подтверждение */}
        {isMyTurn && phase === 'place' && totalPlaced > 0 && (
          <button className="btn" onClick={() => setPlacement({})}>Сброс</button>
        )}
        {isMyTurn && phase === 'place' && (
          <button className="btn primary" disabled={!canConfirm} onClick={confirmTurn}>Подтвердить ход</button>
        )}

        {/* Подсказка */}
        {hintMode && isMyTurn && (
          <button className="btn" onClick={requestHint} disabled={hintLoading} style={{ borderColor: '#ffbe30', color: '#ffbe30' }}>
            {hintLoading ? '...' : '💡'}
          </button>
        )}

        <button className="btn" onClick={() => newGame()}>Новая игра</button>
      </div>

      {/* Подсказка */}
      {hint && hintMode && (
        <div className="hint-panel">
          <div className="hint-title">💡 Подсказка</div>
          {hint.explanation.map((l, i) => <p key={i} className="hint-line">{l}</p>)}
        </div>
      )}

      {/* Результат */}
      {result !== null && (
        <div className="game-result" style={{ borderLeft: `3px solid ${result === humanPlayer ? '#3dd68c' : '#ff6066'}` }}>
          <span>{result === humanPlayer ? '🎉 Победа!' : `AI побеждает • ${gs.countClosed(0)}:${gs.countClosed(1)}`}</span>
        </div>
      )}

      {/* Лог */}
      <div className="game-log" ref={logRef}>
        {log.map((e, i) => (
          <div key={i}>
            <span style={{ color: 'var(--ink3)', fontSize: 10, marginRight: 6 }}>{e.time}</span>
            <span className={e.player >= 0 ? `log-p${e.player}` : ''}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
