import { useState, useRef, useCallback } from 'react'
import { runSimulation } from '../engine/simulator'

// ─── Пресеты ───
const PRESETS = [
  { name: 'Стандарт', stands: 10, chips: 11, desc: 'Базовые правила' },
  { name: 'Быстрая', stands: 7, chips: 9, desc: '~36 ходов' },
  { name: 'Марафон', stands: 12, chips: 13, desc: '~74 хода' },
  { name: 'Мини', stands: 5, chips: 7, desc: 'Самая быстрая' },
  { name: 'Высокие', stands: 10, chips: 15, desc: 'Долгие стойки' },
  { name: 'Широкая', stands: 16, chips: 9, desc: 'Много стоек' },
]

// ─── Компоненты ───
function ProgressRing({ pct, size = 64, stroke = 5, color = 'var(--accent)' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2a2a38" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.3s' }} />
    </svg>
  )
}

function LiveBar({ p1, p2, height = 28 }) {
  const total = p1 + p2 || 1
  const p1pct = p1 / total * 100
  return (
    <div style={{ position: 'relative', height, borderRadius: height/2, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p1pct}%`,
        background: 'linear-gradient(90deg, #4a9eff, #72b8ff)', borderRadius: `${height/2}px 0 0 ${height/2}px`,
        transition: 'width 0.4s ease' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100-p1pct}%`,
        background: 'linear-gradient(90deg, #ff8a8e, #ff6066)', borderRadius: `0 ${height/2}px ${height/2}px 0`,
        transition: 'width 0.4s ease' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 12px', fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
        <span>P1 {p1pct.toFixed(1)}%</span>
        <span>P2 {(100-p1pct).toFixed(1)}%</span>
      </div>
    </div>
  )
}

function Verdict({ p1Wr, total }) {
  if (total < 50) return null
  const diff = Math.abs(p1Wr - 50)
  const se = Math.sqrt(0.25 / total) * 100  // standard error
  const z = diff / se
  let verdict, color, icon
  if (diff < 2) { verdict = 'Идеально сбалансировано'; color = 'var(--green)'; icon = '✅' }
  else if (diff < 4) { verdict = 'Хороший баланс'; color = '#4ecb71'; icon = 'OK' }
  else if (diff < 7) { verdict = 'Небольшой перекос'; color = '#f0a030'; icon = '⚠️' }
  else { verdict = 'Существенный дисбаланс'; color = 'var(--p2)'; icon = '❌' }

  const significant = z > 1.96
  return (
    <div style={{ padding: '12px 16px', borderRadius: 12, background: `${color}0a`, border: `1px solid ${color}22`,
      display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color }}>{verdict}</div>
        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>
          P1 = {p1Wr.toFixed(1)}% • Отклонение: {diff.toFixed(1)}% • {significant ? 'Статистически значимо (p<0.05)' : 'Статистически незначимо'}
        </div>
      </div>
    </div>
  )
}

function Histogram({ data, bins = 15, title, color = 'var(--p1-light)' }) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const step = Math.max(1, Math.ceil((max - min) / bins))
  const buckets = Array(bins).fill(0)
  for (const v of data) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step))
    buckets[idx]++
  }
  const maxB = Math.max(...buckets, 1)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 55 }}>
        {buckets.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: `${v/maxB * 48 + 2}px`,
              background: `linear-gradient(180deg, ${color}, ${color}66)`, borderRadius: '2px 2px 0 0',
              transition: 'height 0.3s' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>
        <span>{min}</span><span>{Math.round((min+max)/2)}</span><span>{max}</span>
      </div>
    </div>
  )
}

function WinrateTimeline({ snapshots }) {
  if (snapshots.length < 2) return null
  const h = 60, w = '100%'
  const points = snapshots.map((s, i) => {
    const x = i / (snapshots.length - 1) * 100
    const y = (1 - (s.p1Wr - 40) / 20) * h  // 40-60% range
    return `${x},${Math.max(0, Math.min(h, y))}`
  }).join(' ')

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 6, fontWeight: 600 }}>Винрейт P1 в реальном времени</div>
      <div style={{ position: 'relative', height: h + 10 }}>
        <svg width="100%" height={h + 10} viewBox={`0 0 100 ${h + 10}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <line x1="0" y1={h/2} x2="100" y2={h/2} stroke="#333" strokeWidth="0.3" strokeDasharray="2,2" />
          <polyline points={points} fill="none" stroke="#4a9eff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div style={{ position: 'absolute', left: 0, top: h/2 - 6, fontSize: 9, color: 'var(--ink3)' }}>50%</div>
        <div style={{ position: 'absolute', right: 4, top: 0, fontSize: 9, color: 'var(--p1)' }}>
          {snapshots[snapshots.length - 1]?.p1Wr.toFixed(1)}%
        </div>
      </div>
    </div>
  )
}

// ─── Main ───
export default function Simulator() {
  const [numStands, setNumStands] = useState(10)
  const [maxChips, setMaxChips] = useState(11)
  const [maxPlace, setMaxPlace] = useState(3)
  const [maxPlaceStands, setMaxPlaceStands] = useState(2)
  const [numGames, setNumGames] = useState(1000)
  const [running, setRunning] = useState(false)
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [speed, setSpeed] = useState(0)
  const abortRef = useRef(false)
  const startTimeRef = useRef(0)
  const lastBatchRef = useRef(0)

  const applyPreset = (p) => { setNumStands(p.stands); setMaxChips(p.chips); setMaxPlace(3); setMaxPlaceStands(2) }

  const start = useCallback(() => {
    setRunning(true); setData(null); setSnapshots([])
    abortRef.current = false; startTimeRef.current = Date.now(); lastBatchRef.current = 0

    runSimulation(
      { numStands, maxChips, numGames, batchSize: 50, maxPlace, maxPlaceStands },
      (batch) => {
        if (abortRef.current) return
        setData(batch)
        const now = Date.now()
        const elapsed = (now - startTimeRef.current) / 1000
        setSpeed(elapsed > 0 ? Math.round(batch.played / elapsed) : 0)
        // Снимок для графика каждые 50 партий
        if (batch.played - lastBatchRef.current >= 50) {
          lastBatchRef.current = batch.played
          const wr = batch.p1Wins / batch.played * 100
          setSnapshots(prev => [...prev, { played: batch.played, p1Wr: wr }])
        }
      },
      (final) => {
        if (abortRef.current) return
        setData(final); setRunning(false)
        const t = final.p1Wins + final.p2Wins + final.draws
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setSpeed(Math.round(t / elapsed))
        setHistory(prev => [{
          numStands, maxChips, numGames: t,
          p1Wr: (final.p1Wins / t * 100).toFixed(1),
          avgTurns: (final.turns.reduce((a, b) => a + b, 0) / final.turns.length).toFixed(0),
          goldenPct: t > 0 ? (final.goldenDecisive / t * 100).toFixed(1) : '—',
          goldenWr: (final.goldenOwner[0] + final.goldenOwner[1]) > 0
            ? (final.goldenWins / (final.goldenOwner[0] + final.goldenOwner[1]) * 100).toFixed(0) : '—',
          lastCloserWr: t > 0 ? (final.lastCloserWins / t * 100).toFixed(0) : '—',
          speed: Math.round(t / elapsed),
          time: elapsed.toFixed(1),
        }, ...prev].slice(0, 20))
      }
    )
  }, [numStands, maxChips, numGames, maxPlace, maxPlaceStands])

  const stop = () => { abortRef.current = true; setRunning(false) }

  const played = data?.played || 0
  const p1Wr = played > 0 ? data.p1Wins / played * 100 : 50
  const p2Wr = played > 0 ? data.p2Wins / played * 100 : 50
  const avgTurns = data?.turns?.length > 0
    ? (data.turns.reduce((a, b) => a + b, 0) / data.turns.length).toFixed(1) : '—'

  const scoreDist = {}
  if (data?.scores) {
    for (const s of data.scores) {
      const key = `${Math.max(s.p1, s.p2)}:${Math.min(s.p1, s.p2)}`
      scoreDist[key] = (scoreDist[key] || 0) + 1
    }
  }
  const scoreEntries = Object.entries(scoreDist).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const goldenTotal = data ? (data.goldenOwner?.[0] || 0) + (data.goldenOwner?.[1] || 0) : 0
  const goldenWinPct = goldenTotal > 0 ? (data.goldenWins / goldenTotal * 100).toFixed(0) : '—'
  const lastCloserPct = played > 0 ? ((data?.lastCloserWins || 0) / played * 100).toFixed(0) : '—'
  const closeTr = data?.closeByTransfer || 0
  const closePl = data?.closeByPlacement || 0

  return (
    <div>
      {/* Пресеты */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.name} className="btn" onClick={() => applyPreset(p)}
            style={{ fontSize: 11, padding: '6px 12px', minHeight: 32,
              borderColor: numStands === p.stands && maxChips === p.chips ? 'var(--accent)' : undefined,
              color: numStands === p.stands && maxChips === p.chips ? 'var(--accent)' : undefined }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Параметры */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink2)' }}>
            Стоек
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={5} max={16} value={numStands} onChange={e => setNumStands(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <b style={{ color: 'var(--ink)', fontSize: 20, minWidth: 24, textAlign: 'center' }}>{numStands}</b>
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink2)' }}>
            Высота
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={5} max={17} value={maxChips} onChange={e => setMaxChips(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <b style={{ color: 'var(--ink)', fontSize: 20, minWidth: 24, textAlign: 'center' }}>{maxChips}</b>
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink2)' }}>
            Блоков/ход
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={1} max={6} value={maxPlace} onChange={e => setMaxPlace(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--gold)' }} />
              <b style={{ color: 'var(--ink)', fontSize: 20, minWidth: 24, textAlign: 'center' }}>{maxPlace}</b>
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink2)' }}>
            Стоек/ход
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={1} max={5} value={maxPlaceStands} onChange={e => setMaxPlaceStands(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--gold)' }} />
              <b style={{ color: 'var(--ink)', fontSize: 20, minWidth: 24, textAlign: 'center' }}>{maxPlaceStands}</b>
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink2)' }}>
            Партий
            <select value={numGames} onChange={e => setNumGames(+e.target.value)}
              style={{ fontSize: 13, padding: '8px 10px', border: '1px solid #36364a', borderRadius: 8, background: '#1e1e28', color: 'var(--ink)' }}>
              {[200, 500, 1000, 2000, 5000, 10000].map(n => (
                <option key={n} value={n}>{n.toLocaleString()}</option>
              ))}
            </select>
          </label>
          <div>
            {!running
              ? <button className="btn primary" onClick={start} style={{ padding: '10px 24px' }}>▶ Пуск</button>
              : <button className="btn" onClick={stop} style={{ padding: '10px 24px', borderColor: 'var(--p2)', color: 'var(--p2)' }}>⏹ Стоп</button>}
          </div>
        </div>

        {/* Прогресс */}
        {(running || data) && played > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 48, height: 48 }}>
                <ProgressRing pct={played / numGames} size={48} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>
                  {Math.round(played / numGames * 100)}%
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <LiveBar p1={data.p1Wins} p2={data.p2Wins} />
              </div>
              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--ink3)', minWidth: 70 }}>
                <div>{played.toLocaleString()} / {numGames.toLocaleString()}</div>
                <div style={{ color: 'var(--ink2)', fontWeight: 600 }}>{speed} партий/с</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Результаты */}
      {data && played > 0 && (
        <>
          {/* Баланс + вердикт */}
          <div className="dash-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Игрок 1</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--p1)' }}>{p1Wr.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{data.p1Wins} побед</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>VS</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{avgTurns} ходов</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Игрок 2</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--p2)' }}>{p2Wr.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{data.p2Wins} побед</div>
              </div>
            </div>
            <Verdict p1Wr={p1Wr} total={played} />
          </div>

          {/* Живой график + гистограмма */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="dash-card">
              <WinrateTimeline snapshots={snapshots} />
            </div>
            <div className="dash-card">
              <Histogram data={data.turns} title="Распределение длины партий" color="#9b59b6" />
            </div>
          </div>

          {/* Ключевые факторы */}
          <div className="dash-card" style={{ marginBottom: 16 }}>
            <h3>Ключевые факторы</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 8 }}>
              {[
                { icon: '⭐', label: 'Золотая→Win', value: `${goldenWinPct}%`, color: '#f0a030' },
                { icon: 'F', label: 'Последний→Win', value: `${lastCloserPct}%`, color: '#e74c3c' },
                { icon: 'S', label: 'Swap принят', value: `${played > 0 ? ((data.swapCount||0)/played*100).toFixed(0) : '—'}%`, color: 'var(--purple)' },
                { icon: '1', label: '1-я достройка', value: `ход ${data.firstCloseTurns?.length > 0 ? (data.firstCloseTurns.reduce((a,b)=>a+b,0)/data.firstCloseTurns.length).toFixed(0) : '—'}`, color: '#2ecc71' },
                { icon: '↗', label: 'Переносов/игру', value: played > 0 ? ((data.transferCount||0)/played).toFixed(1) : '—', color: '#3498db' },
                { icon: 'T', label: 'Закр. переносом', value: (closeTr+closePl) > 0 ? `${(closeTr/(closeTr+closePl)*100).toFixed(0)}%` : '—', color: '#e67e22' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: '10px 6px', background: `${m.color}08`, borderRadius: 10, border: `1px solid ${m.color}15` }}>
                  <div style={{ fontSize: 16 }}>{m.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: m.color, marginTop: 2 }}>{m.value}</div>
                  <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Счета + стойки */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="dash-card">
              <h3>Финальные счета</h3>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 65, marginTop: 8 }}>
                {scoreEntries.map(([k, v], i) => {
                  const max = Math.max(...scoreEntries.map(e => e[1]), 1)
                  return (
                    <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ fontSize: 8, color: '#888' }}>{(v/played*100).toFixed(0)}%</div>
                      <div style={{ width: '100%', height: `${v/max*48+2}px`, borderRadius: '3px 3px 0 0',
                        background: k.startsWith('5:5') ? 'linear-gradient(180deg, #ffc145, #e6a020)' : 'linear-gradient(180deg, #6db4ff, #4a9eff)',
                        transition: 'height 0.3s' }} />
                      <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{k}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="dash-card">
              <h3>Частота достройки высоток</h3>
              {data.standCloseCount && (
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 65, marginTop: 8 }}>
                  {data.standCloseCount.map((v, i) => {
                    const max = Math.max(...data.standCloseCount, 1)
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', height: `${v/max*48+2}px`, borderRadius: '3px 3px 0 0',
                          background: i === 0 ? 'linear-gradient(180deg, #ffc145, #e6a020)' : 'linear-gradient(180deg, #6db4ff, #4a9eff)',
                          transition: 'height 0.3s' }} />
                        <span style={{ fontSize: 9, color: 'var(--ink3)' }}>{i === 0 ? '★' : i}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* История */}
      {history.length > 0 && (
        <div className="dash-card">
          <h3>История запусков ({history.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table" style={{ marginTop: 8, fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Стоек</th><th>Высота</th><th>Партий</th>
                  <th>P1 WR</th><th>Ходов</th><th>Gold</th>
                  <th>Gold→W</th><th>Last→W</th><th>п/с</th><th>Время</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td>{h.numStands}</td><td>{h.maxChips}</td><td>{h.numGames}</td>
                    <td style={{ fontWeight: 600, color: Math.abs(parseFloat(h.p1Wr)-50) < 3 ? 'var(--green)' : Math.abs(parseFloat(h.p1Wr)-50) < 6 ? '#f0a030' : 'var(--p2)' }}>
                      {h.p1Wr}%
                    </td>
                    <td>{h.avgTurns}</td><td>{h.goldenPct}%</td>
                    <td>{h.goldenWr}%</td><td>{h.lastCloserWr}%</td>
                    <td style={{ color: 'var(--ink2)' }}>{h.speed}</td>
                    <td style={{ color: 'var(--ink3)' }}>{h.time}с</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
