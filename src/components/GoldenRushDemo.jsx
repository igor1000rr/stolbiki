/**
 * GoldenRushDemo — hot-seat UI для режима Golden Rush.
 * Движок: ../game/goldenRushEngine.js
 * Спека: docs/modes/golden-rush.md
 *
 * Минимально рабочий прототип для первого playtest. Без анимаций, без 3D,
 * без zoom/pan — только SVG-крест и tappable контролы.
 */

import { useState, useMemo } from 'react'
import { useI18n } from '../engine/i18n'
import {
  GoldenRushState, applyAction, getValidTransfers,
  computeScores,
  STAND_META, STAND_COORDS, CENTER_IDX, NUM_STANDS, MAX_CHIPS, MAX_PLACE,
  PLAYER_COLORS, PLAYER_NAMES_RU, PLAYER_NAMES_EN,
} from '../game/goldenRushEngine'

const SVG_SIZE = 480
const SVG_C = SVG_SIZE / 2
const SVG_R = SVG_SIZE * 0.38

function standXY(i) {
  const c = STAND_COORDS[i]
  return { cx: SVG_C + c.x * SVG_R, cy: SVG_C + c.y * SVG_R }
}

function btnStyle({ active = false, disabled = false, primary = false, color = null } = {}) {
  return {
    padding: '7px 12px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--ink4)'}`,
    background: color || (primary || active ? 'var(--accent)' : 'transparent'),
    color: (primary || active || color) ? '#fff' : 'var(--ink)',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

function Lobby({ onStart, lang }) {
  const en = lang === 'en'
  const DEFAULT = en ? ['Player 1', 'Player 2', 'Player 3', 'Player 4'] : ['Игрок 1', 'Игрок 2', 'Игрок 3', 'Игрок 4']
  const [mode, setMode] = useState('ffa')
  const [names, setNames] = useState(DEFAULT)

  return (
    <div style={{ maxWidth: 480, margin: '24px auto', padding: 20, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--ink4)' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Golden Rush</h2>
      <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 18 }}>
        {en ? 'Race to the center. Control the gold.' : 'Гонка к центру. Забери золото.'}
      </p>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {en ? 'Mode' : 'Режим'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('ffa')} style={btnStyle({ active: mode === 'ffa' })}>4-FFA</button>
          <button onClick={() => setMode('2v2')} style={btnStyle({ active: mode === '2v2' })}>2v2 (0+2 vs 1+3)</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {en ? 'Player names' : 'Имена игроков'}
        </div>
        {names.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: PLAYER_COLORS[i], flex: '0 0 auto' }} />
            <input
              value={n}
              maxLength={20}
              onChange={e => setNames(ns => ns.map((x, j) => j === i ? e.target.value : x))}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--ink4)', borderRadius: 6, background: 'var(--bg)', color: 'var(--ink)' }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => onStart({ mode, names })}
        style={{ width: '100%', padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
      >
        {en ? 'Start hot-seat' : 'Начать hot-seat'}
      </button>

      <div style={{ marginTop: 18, padding: 10, background: 'var(--bg)', borderRadius: 6, fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
        {en
          ? '9 stands in a cross. Each player has 2 stands from corner to center. Close your line (order 1 → 2), then claim the golden center (+15). Full rules: docs/modes/golden-rush.md'
          : '9 стоек крестом. У каждого игрока 2 стойки от угла к центру. Замкни линию (order 1 → 2), забери центр (+15). Полные правила: docs/modes/golden-rush.md'}
      </div>
    </div>
  )
}

function Board({ state, pending, transferPhase, onStandClick }) {
  return (
    <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width="100%" style={{ maxWidth: SVG_SIZE, aspectRatio: '1/1', display: 'block', margin: '0 auto' }}>
      <line x1={standXY(3).cx} y1={standXY(3).cy} x2={standXY(7).cx} y2={standXY(7).cy} stroke="var(--ink4)" strokeWidth={1} opacity={0.5} />
      <line x1={standXY(1).cx} y1={standXY(1).cy} x2={standXY(5).cx} y2={standXY(5).cy} stroke="var(--ink4)" strokeWidth={1} opacity={0.5} />

      {state.eligibleForCenter.length > 0 && !(CENTER_IDX in state.closed) && (
        <circle cx={standXY(CENTER_IDX).cx} cy={standXY(CENTER_IDX).cy} r={52} fill="#ffc14530" />
      )}

      {Array.from({ length: NUM_STANDS }, (_, i) => {
        const { cx, cy } = standXY(i)
        const m = STAND_META[i]
        const chips = state.stands[i]
        const closedBy = state.closed[i]
        const isClosed = closedBy !== undefined
        const r = i === CENTER_IDX ? 36 : 28
        const isPendingPlace = pending?.placement && i in pending.placement
        const isSrc = pending?.transfer && pending.transfer[0] === i
        const isDst = pending?.transfer && pending.transfer[1] === i

        const stroke = isClosed ? PLAYER_COLORS[closedBy]
          : (isSrc || isDst) ? '#ffd700'
          : 'var(--ink4)'
        const strokeWidth = (isClosed || isSrc || isDst) ? 3 : 1.5

        return (
          <g key={i}
            onClick={() => onStandClick?.(i)}
            style={{ cursor: onStandClick && !isClosed ? 'pointer' : 'default' }}
          >
            <circle cx={cx} cy={cy} r={r} fill={i === CENTER_IDX ? '#2a2420' : 'var(--card)'} stroke={stroke} strokeWidth={strokeWidth} />

            {chips.map((color, idx) => (
              <rect key={idx}
                x={cx - r + 6}
                y={cy + r - 6 - idx * 3}
                width={2 * r - 12}
                height={2}
                fill={PLAYER_COLORS[color]}
                opacity={0.9}
              />
            ))}

            {m.type === 'arm' && (
              <circle cx={cx - r + 8} cy={cy - r + 8} r={4} fill={PLAYER_COLORS[m.slot]} opacity={0.7} />
            )}
            {m.type === 'arm' && (
              <text x={cx + r - 10} y={cy - r + 12} fill="var(--ink3)" fontSize={10} fontWeight={700}>{m.order}</text>
            )}
            {m.type === 'center' && (
              <text x={cx} y={cy - 2} textAnchor="middle" fill="#ffc145" fontSize={22} fontWeight={800} opacity={0.6}>★</text>
            )}

            <text x={cx} y={cy + r + 14} textAnchor="middle" fill="var(--ink2)" fontSize={11} fontWeight={600}>
              {chips.length}/{MAX_CHIPS}
            </text>

            {isPendingPlace && (
              <g>
                <circle cx={cx} cy={cy - r - 18} r={13} fill="#ffd700" stroke="#000" strokeWidth={1} />
                <text x={cx} y={cy - r - 14} textAnchor="middle" fill="#000" fontSize={13} fontWeight={800}>
                  +{pending.placement[i]}
                </text>
              </g>
            )}

            {isClosed && (
              <g>
                <line x1={cx - r + 6} y1={cy - r - 4} x2={cx - r + 6} y2={cy - r + 12} stroke="#fff" strokeWidth={1.5} />
                <polygon
                  points={`${cx - r + 6},${cy - r - 4} ${cx - r + 22},${cy - r + 2} ${cx - r + 6},${cy - r + 8}`}
                  fill={PLAYER_COLORS[closedBy]}
                  stroke="#fff"
                  strokeWidth={0.5}
                />
              </g>
            )}

            {(isSrc || isDst) && (
              <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#ffd700" strokeWidth={2} strokeDasharray="4 3" />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Scoreboard({ state, names, lang }) {
  const scores = useMemo(() => computeScores(state), [state])
  const en = lang === 'en'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 12 }}>
      {Array.from({ length: 4 }, (_, p) => {
        const isCurrent = state.currentPlayer === p && !state.gameOver
        return (
          <div key={p} style={{
            padding: '8px 10px',
            background: isCurrent ? PLAYER_COLORS[p] + '22' : 'var(--card)',
            border: `1px solid ${isCurrent ? PLAYER_COLORS[p] : 'var(--ink4)'}`,
            borderRadius: 6,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {names[p]}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: PLAYER_COLORS[p] }}>{scores[p]}</div>
            {state.eligibleForCenter.includes(p) && !(CENTER_IDX in state.closed) && (
              <div style={{ fontSize: 9, color: '#ffc145', fontWeight: 700, marginTop: 2 }}>
                {en ? 'eligible' : 'может центр'} #{state.eligibleForCenter.indexOf(p) + 1}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActionPanel({ state, pending, setPending, transferPhase, setTransferPhase, onCommit, lang }) {
  const en = lang === 'en'
  const placeTotal = pending?.placement ? Object.values(pending.placement).reduce((a, b) => a + b, 0) : 0
  const placeStands = pending?.placement ? Object.keys(pending.placement).length : 0
  const transfers = useMemo(() => getValidTransfers(state), [state])
  const hasAnyTransfer = transfers.length > 0

  function reset() {
    setPending({ transfer: null, placement: {} })
    setTransferPhase(null)
  }

  function canCommit() {
    if (state.gameOver) return false
    if (pending.transfer || placeTotal > 0) return true
    return false
  }

  return (
    <div style={{ padding: 12, background: 'var(--card)', border: '1px solid var(--ink4)', borderRadius: 8, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button
          onClick={() => {
            if (!hasAnyTransfer) return
            setTransferPhase(transferPhase ? null : 'pick-src')
          }}
          style={btnStyle({ active: !!transferPhase, disabled: !hasAnyTransfer })}
        >
          {en ? 'Transfer' : 'Перенос'}
          {transferPhase === 'pick-src' && ` → ${en ? 'pick source' : 'выбери откуда'}`}
          {transferPhase === 'pick-dst' && ` → ${en ? 'pick destination' : 'выбери куда'}`}
        </button>

        <button onClick={reset} style={btnStyle()}>
          {en ? 'Reset' : 'Сбросить'}
        </button>

        <button onClick={onCommit} disabled={!canCommit()} style={btnStyle({ primary: true, disabled: !canCommit() })}>
          {en ? 'End turn' : 'Завершить ход'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
        {transferPhase && (
          <div>
            {en
              ? `Transfer mode: ${transferPhase === 'pick-src' ? 'tap the source stand' : 'tap the destination stand'}`
              : `Режим переноса: ${transferPhase === 'pick-src' ? 'тапни источник' : 'тапни цель'}`}
          </div>
        )}
        {!transferPhase && (
          <div>
            {en
              ? `Tap open stands to place blocks. Max ${MAX_PLACE} blocks on up to 2 stands. Placed: ${placeTotal}/${MAX_PLACE} on ${placeStands} stand${placeStands !== 1 ? 's' : ''}.`
              : `Тапай открытые стойки чтобы класть блоки. Максимум ${MAX_PLACE} блока на 1-2 стойки. Положил: ${placeTotal}/${MAX_PLACE} на ${placeStands} стойк${placeStands === 1 ? 'у' : 'и'}.`}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GoldenRushDemo() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [phase, setPhase] = useState('lobby') // lobby | playing | gameover
  const [mode, setMode] = useState('ffa')
  const [names, setNames] = useState(PLAYER_NAMES_RU)
  const [state, setState] = useState(null)
  const [pending, setPending] = useState({ transfer: null, placement: {} })
  const [transferPhase, setTransferPhase] = useState(null) // null | 'pick-src' | 'pick-dst'

  function startGame({ mode: m, names: ns }) {
    setMode(m)
    setNames(ns)
    setState(new GoldenRushState({ mode: m, numPlayers: 4 }))
    setPending({ transfer: null, placement: {} })
    setTransferPhase(null)
    setPhase('playing')
  }

  function handleStandClick(i) {
    if (!state || state.gameOver) return
    if (i in state.closed) return

    // Transfer mode
    if (transferPhase === 'pick-src') {
      const transfers = getValidTransfers(state)
      if (!transfers.some(([src]) => src === i)) return
      setPending(p => ({ ...p, transfer: [i, null] }))
      setTransferPhase('pick-dst')
      return
    }
    if (transferPhase === 'pick-dst') {
      if (!pending.transfer) return
      const src = pending.transfer[0]
      if (i === src) {
        setPending(p => ({ ...p, transfer: null }))
        setTransferPhase('pick-src')
        return
      }
      const transfers = getValidTransfers(state)
      if (!transfers.some(([s, d]) => s === src && d === i)) return
      setPending(p => ({ ...p, transfer: [src, i] }))
      setTransferPhase(null)
      return
    }

    // Placement mode
    const cur = pending.placement[i] || 0
    const total = Object.values(pending.placement).reduce((a, b) => a + b, 0)
    const stands = Object.keys(pending.placement).length
    const cap = Math.min(state.standSpace(i), MAX_PLACE - (total - cur))
    if (cap <= 0 && cur === 0) return
    // Циклим 0 → 1 → 2 → 3 → 0 с учётом cap
    const maxForThis = cur === 0 ? Math.min(cap, MAX_PLACE - total) : Math.min(cap + cur, MAX_PLACE - (total - cur))
    let next
    if (cur === 0 && stands >= 2) {
      // уже 2 стойки — не можем добавить 3-ю
      return
    }
    if (cur >= maxForThis) next = 0
    else next = cur + 1

    setPending(p => {
      const np = { ...p.placement }
      if (next === 0) delete np[i]
      else np[i] = next
      return { ...p, placement: np }
    })
  }

  function commit() {
    if (!state || state.gameOver) return
    const action = {}
    if (pending.transfer && pending.transfer[0] != null && pending.transfer[1] != null) {
      action.transfer = pending.transfer
    }
    if (pending.placement && Object.keys(pending.placement).length > 0) {
      action.placement = pending.placement
    }
    if (!action.transfer && !action.placement) return
    const next = applyAction(state, action)
    setState(next)
    setPending({ transfer: null, placement: {} })
    setTransferPhase(null)
    if (next.gameOver) setPhase('gameover')
  }

  function newGame() {
    setPhase('lobby')
    setState(null)
  }

  if (phase === 'lobby') {
    return <Lobby onStart={startGame} lang={lang} />
  }

  const finalScores = state?.scores || (state ? computeScores(state) : [0, 0, 0, 0])
  const winnerName = state?.gameOver
    ? (state.mode === 'ffa' && state.winner >= 0 ? names[state.winner]
      : state.mode === '2v2' && state.winner >= 0 ? (en ? `Team ${state.winner + 1}` : `Команда ${state.winner + 1}`)
      : en ? 'Draw' : 'Ничья')
    : null

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Golden Rush — {mode === 'ffa' ? '4-FFA' : '2v2'}</h2>
        <button onClick={newGame} style={btnStyle()}>
          {en ? 'New game' : 'Новая игра'}
        </button>
      </div>

      {!state?.gameOver && (
        <div style={{
          padding: '6px 10px',
          background: PLAYER_COLORS[state.currentPlayer] + '22',
          border: `1px solid ${PLAYER_COLORS[state.currentPlayer]}`,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 10,
          color: PLAYER_COLORS[state.currentPlayer],
        }}>
          {en ? 'Turn' : 'Ход'}: {names[state.currentPlayer]}
        </div>
      )}

      {state?.gameOver && (
        <div style={{
          padding: 16,
          background: 'linear-gradient(135deg, #ffc14520, #ffc14540)',
          border: '2px solid #ffc145',
          borderRadius: 8,
          marginBottom: 10,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 4 }}>
            {en ? 'Winner' : 'Победитель'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ffc145' }}>{winnerName}</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>
            {finalScores.map((s, i) => `${names[i]}: ${s}`).join(' · ')}
          </div>
        </div>
      )}

      <Board state={state} pending={pending} transferPhase={transferPhase} onStandClick={handleStandClick} />
      <Scoreboard state={state} names={names} lang={lang} />
      {!state.gameOver && (
        <ActionPanel
          state={state}
          pending={pending}
          setPending={setPending}
          transferPhase={transferPhase}
          setTransferPhase={setTransferPhase}
          onCommit={commit}
          lang={lang}
        />
      )}
    </div>
  )
}
