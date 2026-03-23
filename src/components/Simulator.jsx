import { useState, useRef, useCallback } from 'react'
import { runSimulation } from '../engine/simulator'

function Bar({ value, max, color = '#6db4ff', height = 50 }) {
  const pct = max > 0 ? value / max : 0
  return (
    <div style={{ width: '100%', height, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', height: `${Math.max(pct * height, 2)}px`,
        background: `linear-gradient(180deg, ${color}, ${color}88)`,
        borderRadius: '3px 3px 0 0', transition: 'height 0.3s',
      }} />
    </div>
  )
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      textAlign: 'center', padding: '10px 6px',
      background: 'rgba(255,255,255,0.02)', borderRadius: 10,
      border: `1px solid ${color || '#333'}22`,
    }}>
      {icon && <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>}
      <div style={{ fontSize: 9, color: '#6b6880', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || '#e8e6f0', lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#6b6880', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MiniBarChart({ data, labels, colors, title, height = 60 }) {
  if (!data || !data.length) return null
  const max = Math.max(...data, 1)
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: '#a09cb0', marginBottom: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontSize: 8, color: '#888' }}>{v > 0 ? (v / data.reduce((a, b) => a + b, 0) * 100).toFixed(0) + '%' : ''}</div>
            <Bar value={v} max={max} color={colors?.[i] || '#6db4ff'} height={height - 15} />
            <span style={{ fontSize: 9, color: '#6b6880' }}>{labels?.[i] ?? i}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? (value / max * 100) : 0
  return (
    <div style={{ width: '100%', height: 6, background: '#2a2a38', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f0654a, #ff8a6b)', borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

export default function Simulator() {
  const [numStands, setNumStands] = useState(10)
  const [maxChips, setMaxChips] = useState(11)
  const [numGames, setNumGames] = useState(1000)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const abortRef = useRef(false)

  const start = useCallback(() => {
    setRunning(true)
    setResults(null)
    abortRef.current = false
    runSimulation(
      { numStands, maxChips, numGames, batchSize: 100 },
      (batch) => { if (!abortRef.current) setProgress(batch) },
      (final) => {
        if (abortRef.current) return
        setResults(final)
        setRunning(false)
        const p = final
        const total = p.p1Wins + p.p2Wins + p.draws
        setHistory(prev => [{
          numStands, maxChips, numGames: total,
          p1Wr: (p.p1Wins / total * 100).toFixed(1),
          avgTurns: (p.turns.reduce((a, b) => a + b, 0) / p.turns.length).toFixed(0),
          goldenPct: (p.goldenDecisive / total * 100).toFixed(1),
          goldenWr: p.goldenOwner[0] + p.goldenOwner[1] > 0
            ? (p.goldenWins / (p.goldenOwner[0] + p.goldenOwner[1]) * 100).toFixed(0) : '—',
          swapPct: (p.swapCount / total * 100).toFixed(0),
          lastCloserWr: (p.lastCloserWins / total * 100).toFixed(0),
        }, ...prev].slice(0, 10))
      }
    )
  }, [numStands, maxChips, numGames])

  const stop = () => { abortRef.current = true; setRunning(false) }

  const data = results || progress
  const played = data?.played || 0
  const p1Wr = played > 0 ? (data.p1Wins / played * 100).toFixed(1) : '—'
  const p2Wr = played > 0 ? (data.p2Wins / played * 100).toFixed(1) : '—'
  const avgTurns = data?.turns?.length > 0
    ? (data.turns.reduce((a, b) => a + b, 0) / data.turns.length).toFixed(1) : '—'
  const goldenPct = played > 0 ? (data.goldenDecisive / played * 100).toFixed(1) : '—'

  // Score distribution
  const scoreDist = {}
  if (data?.scores) {
    for (const s of data.scores) {
      const key = `${Math.max(s.p1, s.p2)}:${Math.min(s.p1, s.p2)}`
      scoreDist[key] = (scoreDist[key] || 0) + 1
    }
  }
  const scoreEntries = Object.entries(scoreDist).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const goldenTotal = data ? (data.goldenOwner?.[0] || 0) + (data.goldenOwner?.[1] || 0) : 0
  const goldenWinPct = goldenTotal > 0 ? ((data.goldenWins / goldenTotal) * 100).toFixed(0) : '—'
  const lastCloserPct = played > 0 ? ((data?.lastCloserWins || 0) / played * 100).toFixed(0) : '—'
  const avgTransfers = played > 0 ? ((data?.transferCount || 0) / played).toFixed(1) : '—'
  const firstCloseAvg = data?.firstCloseTurns?.length > 0
    ? (data.firstCloseTurns.reduce((a, b) => a + b, 0) / data.firstCloseTurns.length).toFixed(0) : '—'
  const closeTr = data?.closeByTransfer || 0
  const closePl = data?.closeByPlacement || 0
  const closeTotal = closeTr + closePl

  return (
    <div>
      {/* Параметры */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Параметры симуляции</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#a09cb0' }}>
            Стоек: <b style={{ color: '#e8e6f0', fontSize: 20 }}>{numStands}</b>
            <input type="range" min={5} max={16} value={numStands}
              onChange={e => setNumStands(+e.target.value)} style={{ accentColor: '#f0654a' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#a09cb0' }}>
            Высота: <b style={{ color: '#e8e6f0', fontSize: 20 }}>{maxChips}</b>
            <input type="range" min={5} max={17} value={maxChips}
              onChange={e => setMaxChips(+e.target.value)} style={{ accentColor: '#f0654a' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#a09cb0' }}>
            Партий
            <select value={numGames} onChange={e => setNumGames(+e.target.value)}
              style={{ fontSize: 14, padding: '8px 12px', border: '1px solid #36364a', borderRadius: 8, background: '#1e1e28', color: '#e8e6f0' }}>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1 000</option>
              <option value={2000}>2 000</option>
              <option value={5000}>5 000</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {!running
            ? <button className="btn primary" onClick={start}>Запустить</button>
            : <button className="btn" onClick={stop} style={{ borderColor: '#ff6b6b', color: '#ff6b6b' }}>Стоп</button>}
        </div>
        {running && (
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={played} max={numGames} />
            <div style={{ textAlign: 'center', fontSize: 11, color: '#6b6880', marginTop: 4 }}>{played} / {numGames}</div>
          </div>
        )}
      </div>

      {/* Результаты */}
      {data && played > 0 && (
        <>
          {/* Главные метрики */}
          <div className="dash-card" style={{ marginBottom: 16 }}>
            <h3>Баланс {results ? '' : '(считается...)'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
              <StatCard label="Игрок 1" value={`${p1Wr}%`} color="var(--p1)" sub={`${data.p1Wins} побед`} />
              <StatCard label="Игрок 2" value={`${p2Wr}%`} color="var(--p2)" sub={`${data.p2Wins} побед`} />
              <StatCard label="Avg ходов" value={avgTurns} sub={`мин ${Math.min(...data.turns)} — макс ${Math.max(...data.turns)}`} />
              <StatCard label="Золотая 5:5" value={`${goldenPct}%`} color="var(--gold)" sub={`${data.goldenDecisive} партий`} />
            </div>
          </div>

          {/* Расширенная статистика */}
          <div className="dash-card" style={{ marginBottom: 16 }}>
            <h3>Детальная статистика</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 8 }}>
              <StatCard label="Золотая → победа" value={`${goldenWinPct}%`} color="#f0a030" icon="⭐" />
              <StatCard label="Последний закрыл" value={`${lastCloserPct}%`} color="#e74c3c" icon="🏁" />
              <StatCard label="Переносов/игру" value={avgTransfers} color="#3498db" icon="↗" />
              <StatCard label="1-е закрытие" value={`ход ${firstCloseAvg}`} color="#2ecc71" icon="📍" />
              <StatCard label="Swap принят" value={`${played > 0 ? ((data.swapCount || 0) / played * 100).toFixed(0) : '—'}%`} color="#9b59b6" icon="🔄" />
            </div>
          </div>

          {/* Графики */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Финальные счета */}
            <div className="dash-card">
              <MiniBarChart
                data={scoreEntries.map(e => e[1])}
                labels={scoreEntries.map(e => e[0])}
                colors={scoreEntries.map(e => e[0].startsWith('5:5') ? '#f0a030' : '#6db4ff')}
                title="Финальные счета"
                height={70}
              />
            </div>

            {/* Способ закрытия */}
            <div className="dash-card">
              <MiniBarChart
                data={closeTotal > 0 ? [closeTr, closePl] : []}
                labels={['Перенос', 'Установка']}
                colors={['#3498db', '#e67e22']}
                title="Способ закрытия стоек"
                height={70}
              />
            </div>
          </div>

          {/* Частота закрытия стоек */}
          {data.standCloseCount && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <MiniBarChart
                data={data.standCloseCount}
                labels={data.standCloseCount.map((_, i) => i === 0 ? '★' : String(i))}
                colors={data.standCloseCount.map((_, i) => i === 0 ? '#ffc145' : '#6db4ff')}
                title="Частота закрытия стоек"
                height={65}
              />
            </div>
          )}
        </>
      )}

      {/* История */}
      {history.length > 0 && (
        <div className="dash-card">
          <h3>История запусков</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table" style={{ marginTop: 8, fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Стоек</th><th>Высота</th><th>Партий</th>
                  <th>P1 WR</th><th>Ходов</th><th>Золотая</th>
                  <th>Gold→Win</th><th>Last→Win</th><th>Swap</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td>{h.numStands}</td><td>{h.maxChips}</td><td>{h.numGames}</td>
                    <td style={{ color: Math.abs(parseFloat(h.p1Wr) - 50) < 3 ? '#2ecc71' : '#e74c3c' }}>{h.p1Wr}%</td>
                    <td>{h.avgTurns}</td><td>{h.goldenPct}%</td>
                    <td>{h.goldenWr}%</td><td>{h.lastCloserWr}%</td><td>{h.swapPct}%</td>
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
