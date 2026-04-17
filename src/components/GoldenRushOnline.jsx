/**
 * GoldenRushOnline — online 2v2 / 4-FFA для Golden Rush.
 *
 * Использует useGoldenRushWS для общения с сервером.
 * Server authority: клиент шлёт action, сервер валидирует и рассылает новый state.
 */

import { useState, useMemo, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import { useGoldenRushWS } from '../engine/goldenRushWS'
import {
  getValidTransfers, computeScores,
  GoldenRushState,
  STAND_META, STAND_COORDS, CENTER_IDX, NUM_STANDS, MAX_CHIPS, MAX_PLACE,
  PLAYER_COLORS, PLAYER_NAMES_RU,
} from '../game/goldenRushEngine'

const SVG_SIZE = 480
const SVG_C = SVG_SIZE / 2
const SVG_R = SVG_SIZE * 0.38

function standXY(i) {
  const c = STAND_COORDS[i]
  return { cx: SVG_C + c.x * SVG_R, cy: SVG_C + c.y * SVG_R }
}

function rehydrate(s) {
  if (!s) return null
  const st = new GoldenRushState({ numPlayers: s.numPlayers, mode: s.mode, teams: s.teams })
  st.stands = s.stands.map(x => [...x])
  st.closed = { ...s.closed }
  st.currentPlayer = s.currentPlayer
  st.turn = s.turn
  st.gameOver = s.gameOver
  st.winner = s.winner
  st.scores = s.scores ? [...s.scores] : null
  st.eligibleForCenter = [...(s.eligibleForCenter || [])]
  return st
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

function Board({ state, pending, onStandClick, yourSlot }) {
  return (
    <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width="100%" style={{ maxWidth: SVG_SIZE, aspectRatio: '1/1', display: 'block', margin: '0 auto' }}>
      <line x1={standXY(3).cx} y1={standXY(3).cy} x2={standXY(7).cx} y2={standXY(7).cy} stroke="var(--ink4)" strokeWidth={1} opacity={0.5} />
      <line x1={standXY(1).cx} y1={standXY(1).cy} x2={standXY(5).cx} y2={standXY(5).cy} stroke="var(--ink4)" strokeWidth={1} opacity={0.5} />

      {(state.eligibleForCenter?.length > 0) && !(CENTER_IDX in (state.closed || {})) && (
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
        const isYourArm = m.type === 'arm' && m.slot === yourSlot

        const stroke = isClosed ? PLAYER_COLORS[closedBy]
          : (isSrc || isDst) ? '#ffd700'
          : isYourArm ? PLAYER_COLORS[yourSlot]
          : 'var(--ink4)'
        const strokeWidth = (isClosed || isSrc || isDst || isYourArm) ? 2.5 : 1.5

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

function Lobby({ onFind, hasToken, lang }) {
  const en = lang === 'en'
  const [mode, setMode] = useState('2v2')

  if (!hasToken) {
    return (
      <div style={{ maxWidth: 480, margin: '32px auto', padding: 20, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--ink4)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Golden Rush Online</h2>
        <p style={{ color: 'var(--ink3)', fontSize: 13 }}>
          {en ? 'Sign in to play online.' : 'Войдите в аккаунт, чтобы играть онлайн.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '24px auto', padding: 20, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--ink4)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Golden Rush Online</h2>
      <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 18 }}>
        {en ? 'Find 3 other players. Random seating, random teams in 2v2.' : 'Найди 3 других игроков. Случайная рассадка, случайные команды в 2v2.'}
      </p>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          {en ? 'Mode' : 'Режим'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('2v2')} style={btnStyle({ active: mode === '2v2' })}>2v2</button>
          <button onClick={() => setMode('ffa')} style={btnStyle({ active: mode === 'ffa' })}>4-FFA</button>
        </div>
      </div>

      <button
        onClick={() => onFind(mode)}
        style={{ width: '100%', padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
      >
        {en ? 'Find match' : 'Найти матч'}
      </button>

      <div style={{ marginTop: 18, padding: 10, background: 'var(--bg)', borderRadius: 6, fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
        {en
          ? 'Rewards: +2 participation, +10 win, +3 center capture. Matchmaking waits for 4 players of the same mode.'
          : 'Награды: +2 за участие, +10 за победу, +3 за центр. Матчмейкинг ждёт 4 игрока одного режима.'}
      </div>
    </div>
  )
}

function Queue({ pos, mode, onCancel, lang }) {
  const en = lang === 'en'
  return (
    <div style={{ maxWidth: 480, margin: '24px auto', padding: 20, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--ink4)', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {en ? 'Looking for match' : 'Поиск матча'}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: '8px 0' }}>
        {mode === '2v2' ? '2v2' : '4-FFA'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
        {en ? 'In queue:' : 'В очереди:'} {pos || '…'}
      </div>
      <button onClick={onCancel} style={{ ...btnStyle(), marginTop: 16 }}>
        {en ? 'Cancel' : 'Отмена'}
      </button>
    </div>
  )
}

function Scoreboard({ state, players, yourSlot, lang }) {
  const scores = state?.scores || (state ? computeScores(rehydrate(state)) : [0, 0, 0, 0])
  const en = lang === 'en'
  const teams = state?.teams
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 12 }}>
        {Array.from({ length: 4 }, (_, p) => {
          const player = players.find(pl => pl.slot === p)
          const name = player?.name || PLAYER_NAMES_RU[p]
          const isCurrent = state?.currentPlayer === p && !state?.gameOver
          const isYou = p === yourSlot
          const teamIdx = teams ? teams.findIndex(t => t.includes(p)) : -1
          return (
            <div key={p} style={{
              padding: '8px 10px',
              background: isCurrent ? PLAYER_COLORS[p] + '22' : 'var(--card)',
              border: `${isYou ? '2px' : '1px'} solid ${isCurrent ? PLAYER_COLORS[p] : (isYou ? PLAYER_COLORS[p] : 'var(--ink4)')}`,
              borderRadius: 6,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isYou && (en ? 'YOU · ' : 'ТЫ · ')}{name}
                {teamIdx >= 0 && <span style={{ marginLeft: 4, color: teamIdx === 0 ? '#4a9eff' : '#ff6b6b' }}>T{teamIdx + 1}</span>}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: PLAYER_COLORS[p] }}>{scores[p]}</div>
              {state?.eligibleForCenter?.includes(p) && !(CENTER_IDX in (state.closed || {})) && (
                <div style={{ fontSize: 9, color: '#ffc145', fontWeight: 700, marginTop: 2 }}>
                  {en ? 'eligible' : 'может центр'} #{state.eligibleForCenter.indexOf(p) + 1}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RewardCard({ reward, lang }) {
  const en = lang === 'en'
  if (!reward) return null
  const { total, parts, resigned } = reward

  if (resigned && total === 0) {
    return (
      <div style={{
        padding: 10,
        background: 'var(--card)',
        border: '1px dashed var(--ink4)',
        borderRadius: 6,
        marginTop: 8,
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--ink3)',
      }}>
        {en ? 'You resigned — no bricks earned.' : 'Ты сдался — бриксы не начислены.'}
      </div>
    )
  }

  const labels = {
    participation: en ? 'Participation' : 'Участие',
    win: en ? 'Win' : 'Победа',
    center: en ? 'Center capture' : 'Центр',
  }

  return (
    <div style={{
      padding: 10,
      background: 'linear-gradient(135deg, #3dd68c20, #3dd68c35)',
      border: '1px solid #3dd68c',
      borderRadius: 6,
      marginTop: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {en ? 'You earned' : 'Начислено'}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#3dd68c' }}>
        +{total} 🧱
      </div>
      {parts.length > 1 && (
        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>
          {parts.map(p => `${labels[p.key] || p.key} +${p.amount}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

function TeamChat({ messages, onSend, lang, disabled }) {
  const en = lang === 'en'
  const [text, setText] = useState('')

  function submit() {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText('')
  }

  return (
    <div style={{ marginTop: 10, padding: 8, background: 'var(--card)', border: '1px solid var(--ink4)', borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {en ? 'Team chat' : 'Чат команды'}
      </div>
      <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 12, marginBottom: 6 }}>
        {messages.slice(-5).map((m, i) => (
          <div key={i} style={{ lineHeight: 1.5 }}>
            <span style={{ color: PLAYER_COLORS[m.slot], fontWeight: 600 }}>{m.from}:</span> {m.text}
          </div>
        ))}
        {messages.length === 0 && <div style={{ color: 'var(--ink3)', fontSize: 11 }}>—</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          maxLength={100}
          placeholder={en ? 'Message teammate…' : 'Сообщение напарнику…'}
          style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--ink4)', borderRadius: 4, background: 'var(--bg)', color: 'var(--ink)', fontSize: 12 }}
          disabled={disabled}
        />
        <button onClick={submit} disabled={disabled || !text.trim()} style={{ ...btnStyle({ primary: true, disabled: disabled || !text.trim() }) }}>↵</button>
      </div>
    </div>
  )
}

export default function GoldenRushOnline() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const gr = useGoldenRushWS()
  const [pending, setPending] = useState({ transfer: null, placement: {} })
  const [transferPhase, setTransferPhase] = useState(null)

  useEffect(() => {
    if (gr.state) setPending({ transfer: null, placement: {} })
    setTransferPhase(null)
  }, [gr.state?.turn])

  const rehydrated = useMemo(() => rehydrate(gr.state), [gr.state])
  const isMyTurn = gr.state && !gr.state.gameOver && gr.state.currentPlayer === gr.yourSlot

  function handleStandClick(i) {
    if (!rehydrated || rehydrated.gameOver || !isMyTurn) return
    if (i in rehydrated.closed) return

    if (transferPhase === 'pick-src') {
      const transfers = getValidTransfers(rehydrated)
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
      const transfers = getValidTransfers(rehydrated)
      if (!transfers.some(([s, d]) => s === src && d === i)) return
      setPending(p => ({ ...p, transfer: [src, i] }))
      setTransferPhase(null)
      return
    }

    const cur = pending.placement[i] || 0
    const total = Object.values(pending.placement).reduce((a, b) => a + b, 0)
    const stands = Object.keys(pending.placement).length
    const cap = Math.min(rehydrated.standSpace(i), MAX_PLACE - (total - cur))
    const maxForThis = cur === 0 ? Math.min(cap, MAX_PLACE - total) : Math.min(cap + cur, MAX_PLACE - (total - cur))
    if (cur === 0 && stands >= 2) return
    if (cap <= 0 && cur === 0) return

    let next
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
    if (!isMyTurn) return
    const action = {}
    if (pending.transfer && pending.transfer[0] != null && pending.transfer[1] != null) {
      action.transfer = pending.transfer
    }
    if (pending.placement && Object.keys(pending.placement).length > 0) {
      action.placement = pending.placement
    }
    if (!action.transfer && !action.placement) return
    gr.sendMove(action)
    setPending({ transfer: null, placement: {} })
    setTransferPhase(null)
  }

  function reset() {
    setPending({ transfer: null, placement: {} })
    setTransferPhase(null)
  }

  if (gr.status === 'idle' || gr.status === 'connecting' || gr.status === 'error') {
    return <Lobby onFind={gr.findMatch} hasToken={gr.hasToken} lang={lang} />
  }

  if (gr.status === 'queued') {
    return <Queue pos={gr.queuePos} mode={gr.queueMode} onCancel={gr.cancelMatch} lang={lang} />
  }

  if (!gr.state) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>…</div>
  }

  const finalScores = gr.scores || gr.state.scores
  const winnerName = gr.status === 'gameover'
    ? (gr.winner < 0 ? (en ? 'Draw' : 'Ничья')
      : gr.state.mode === 'ffa'
        ? (gr.players.find(p => p.slot === gr.winner)?.name || PLAYER_NAMES_RU[gr.winner])
        : (en ? `Team ${gr.winner + 1}` : `Команда ${gr.winner + 1}`))
    : null

  const placeTotal = Object.values(pending.placement).reduce((a, b) => a + b, 0)
  const placeStands = Object.keys(pending.placement).length
  const hasAnyTransfer = rehydrated ? getValidTransfers(rehydrated).length > 0 : false
  const myTeam = gr.state?.teams?.find(t => t.includes(gr.yourSlot)) || []
  const isTeamMode = gr.state?.mode === '2v2'

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          Golden Rush — {gr.state.mode === 'ffa' ? '4-FFA' : '2v2'}
          <span style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 8 }}>#{gr.roomId}</span>
        </h2>
        {gr.status === 'gameover' ? (
          <button onClick={gr.disconnect} style={btnStyle({ primary: true })}>
            {en ? 'New match' : 'Новый матч'}
          </button>
        ) : (
          <button onClick={gr.resign} style={btnStyle({ color: '#ff6b6b' })}>
            {en ? 'Resign' : 'Сдаться'}
          </button>
        )}
      </div>

      {gr.error && (
        <div style={{ padding: 8, marginBottom: 8, background: '#ff6b6b22', border: '1px solid #ff6b6b', borderRadius: 6, fontSize: 12, color: '#ff6b6b' }}>
          {en ? 'Error: ' : 'Ошибка: '}{gr.error}
        </div>
      )}

      {gr.playerLeftSlot !== null && (
        <div style={{ padding: 6, marginBottom: 8, background: '#ffc14522', border: '1px solid #ffc145', borderRadius: 6, fontSize: 11, color: '#ffc145', textAlign: 'center' }}>
          {en ? 'Player disconnected: slot ' : 'Игрок отключился: слот '}{gr.playerLeftSlot}
        </div>
      )}

      {!gr.state.gameOver && (
        <div style={{
          padding: '6px 10px',
          background: PLAYER_COLORS[gr.state.currentPlayer] + '22',
          border: `1px solid ${PLAYER_COLORS[gr.state.currentPlayer]}`,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 10,
          color: PLAYER_COLORS[gr.state.currentPlayer],
        }}>
          {isMyTurn
            ? (en ? '← Your turn' : '← Твой ход')
            : (en ? 'Turn: ' : 'Ход: ') + (gr.players.find(p => p.slot === gr.state.currentPlayer)?.name || PLAYER_NAMES_RU[gr.state.currentPlayer])}
        </div>
      )}

      {gr.status === 'gameover' && (
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
          {gr.resignedBy != null && (
            <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 2 }}>
              {en ? 'Resigned: ' : 'Сдался: '}
              {gr.players.find(p => p.slot === gr.resignedBy)?.name || `slot ${gr.resignedBy}`}
            </div>
          )}
          {finalScores && (
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>
              {finalScores.map((s, i) => {
                const n = gr.players.find(p => p.slot === i)?.name || PLAYER_NAMES_RU[i]
                return `${n}: ${s}`
              }).join(' · ')}
            </div>
          )}
          <RewardCard reward={gr.myReward} lang={lang} />
        </div>
      )}

      <Board state={gr.state} pending={pending} onStandClick={isMyTurn ? handleStandClick : null} yourSlot={gr.yourSlot} />

      {gr.reactions.length > 0 && (
        <div style={{ textAlign: 'center', minHeight: 24, marginTop: 4 }}>
          {gr.reactions.map(r => (
            <span key={r.id} style={{ fontSize: 18, margin: '0 4px', animation: 'fadeOut 2.5s' }}>
              {r.emoji}
            </span>
          ))}
        </div>
      )}

      <Scoreboard state={gr.state} players={gr.players} yourSlot={gr.yourSlot} lang={lang} />

      {!gr.state.gameOver && (
        <div style={{ padding: 12, background: 'var(--card)', border: '1px solid var(--ink4)', borderRadius: 8, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button
              onClick={() => { if (!hasAnyTransfer || !isMyTurn) return; setTransferPhase(transferPhase ? null : 'pick-src') }}
              style={btnStyle({ active: !!transferPhase, disabled: !hasAnyTransfer || !isMyTurn })}
            >
              {en ? 'Transfer' : 'Перенос'}
              {transferPhase === 'pick-src' && ` → ${en ? 'src' : 'откуда'}`}
              {transferPhase === 'pick-dst' && ` → ${en ? 'dst' : 'куда'}`}
            </button>
            <button onClick={reset} style={btnStyle({ disabled: !isMyTurn })} disabled={!isMyTurn}>
              {en ? 'Reset' : 'Сбросить'}
            </button>
            <button
              onClick={commit}
              disabled={!isMyTurn || (!pending.transfer && placeTotal === 0)}
              style={btnStyle({ primary: true, disabled: !isMyTurn || (!pending.transfer && placeTotal === 0) })}
            >
              {en ? 'End turn' : 'Завершить ход'}
            </button>
            <div style={{ flex: 1 }} />
            {['👍', '🔥', '💪', '🎉'].map(emoji => (
              <button key={emoji} onClick={() => gr.sendReaction(emoji)} style={{ ...btnStyle(), padding: '4px 8px', fontSize: 14 }}>
                {emoji}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
            {!isMyTurn
              ? (en ? 'Waiting for other players…' : 'Ждём других игроков…')
              : transferPhase
                ? (en
                    ? `Transfer: ${transferPhase === 'pick-src' ? 'tap source' : 'tap destination'}`
                    : `Перенос: ${transferPhase === 'pick-src' ? 'выбери источник' : 'выбери цель'}`)
                : (en
                    ? `Placed: ${placeTotal}/${MAX_PLACE} on ${placeStands} stand(s)`
                    : `Положил: ${placeTotal}/${MAX_PLACE} на ${placeStands} стойк${placeStands === 1 ? 'у' : 'и'}`)
            }
          </div>
        </div>
      )}

      {isTeamMode && !gr.state.gameOver && (
        <TeamChat
          messages={gr.teamChat.filter(m => myTeam.includes(m.slot))}
          onSend={gr.sendTeamChat}
          lang={lang}
          disabled={false}
        />
      )}
    </div>
  )
}
