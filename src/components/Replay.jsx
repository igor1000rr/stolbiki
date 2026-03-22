import { useState, useEffect, useRef } from 'react'
import replaysData from '../data/replays.json'

const standLabel = i => i === 0 ? '★' : String(i)

function ReplayBoard({ stateData }) {
  return (
    <div className="board">
      {stateData.s.map((chips, i) => {
        const isClosed = stateData.c[i] !== undefined
        const isGolden = i === 0
        return (
          <div key={i} className={`stand ${isGolden ? 'golden' : ''} ${isClosed ? 'closed' : ''}`}>
            <span className="stand-label">{isGolden ? '★' : i}</span>
            {isClosed && <span className="stand-owner">П{stateData.c[i] + 1}</span>}
            {[...chips].map((c, j) => (
              <div key={j} className={`chip p${c}`} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function Replay() {
  const [gi, setGi] = useState(0)
  const [si, setSi] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef(null)

  const game = replaysData[gi]
  const state = game.states[si]
  const totalStates = game.states.length

  useEffect(() => {
    setSi(0)
    setPlaying(false)
  }, [gi])

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setSi(prev => {
          if (prev >= totalStates - 1) { setPlaying(false); return prev }
          return prev + 1
        })
      }, 700)
    }
    return () => clearInterval(timerRef.current)
  }, [playing, totalStates])

  const goTo = val => setSi(Math.max(0, Math.min(totalStates - 1, val)))

  const move = si > 0 && si <= game.moves.length ? game.moves[si - 1] : null
  const sc = state.sc || [0, 0]
  const isEnd = si === totalStates - 1

  return (
    <div>
      <div className="replay-tabs">
        {replaysData.map((g, i) => {
          const who = g.mp >= 0
            ? (g.mp === 0 ? 'MCTS за П1' : 'MCTS за П2')
            : 'MCTS vs MCTS'
          return (
            <button key={i} className={gi === i ? 'active' : ''} onClick={() => setGi(i)}>
              Партия {g.id} · {who}
            </button>
          )
        })}
      </div>

      <div className="scoreboard">
        <div className="score-player">
          <div className="score-label">Игрок 1</div>
          <div className="score-num p0">{sc[0]}</div>
        </div>
        <div className="score-sep">:</div>
        <div className="score-player">
          <div className="score-label">Игрок 2</div>
          <div className="score-num p1">{sc[1]}</div>
        </div>
      </div>

      <ReplayBoard stateData={state} />

      <div className="transport">
        <button className="transport-btn" onClick={() => goTo(0)}>⏮</button>
        <button className="transport-btn" onClick={() => goTo(si - 1)}>◀</button>
        <button className={`transport-btn play`} onClick={() => setPlaying(!playing)}>
          {playing ? '⏸' : '▶'}
        </button>
        <button className="transport-btn" onClick={() => goTo(si + 1)}>▶</button>
        <button className="transport-btn" onClick={() => goTo(totalStates - 1)}>⏭</button>
      </div>

      <input
        type="range" className="progress-slider"
        min={0} max={totalStates - 1} value={si}
        onChange={e => goTo(+e.target.value)}
      />

      <div className="turn-label">
        Ход {state.tn} из {game.tt}
        {!isEnd && ` · ходит Игрок ${state.pl + 1}`}
        {isEnd && game.w !== undefined && ` · Победитель: Игрок ${game.w + 1}`}
      </div>

      <div className="move-card" style={{ borderLeft: `3px solid var(--${move ? (move.p === 0 ? 'p1' : 'p2') : 'ink3'})` }}>
        {move ? (
          <>
            <span className={`log-p${move.p}`}>Игрок {move.p + 1}</span>
            {' '}({move.who === 'M' ? 'MCTS' : 'Рандом'})
            {move.sw && <><br /><strong>Swap</strong> — смена цветов</>}
            {move.t && <><br /><strong>Перенос:</strong> {standLabel(move.t[0])} → {standLabel(move.t[1])}</>}
            {move.pl && Object.keys(move.pl).length > 0 && (
              <><br /><strong>Установка:</strong> {Object.entries(move.pl).map(([k, v]) => `${standLabel(+k)}: ${v}`).join(', ')}</>
            )}
          </>
        ) : (
          <em>Начальная позиция</em>
        )}
      </div>
    </div>
  )
}
