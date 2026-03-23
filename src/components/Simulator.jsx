import { useState, useRef, useCallback } from 'react'
import { runSimulation } from '../engine/simulator'

function ProgressBar({ value, max }) {
  const pct = max > 0 ? (value / max * 100) : 0
  return (
    <div style={{ width: '100%', height: 6, background: '#2a2a38', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f0654a, #ff8a6b)', borderRadius: 3, transition: 'width 0.3s', boxShadow: '0 0 8px rgba(240,101,74,0.3)' }} />
    </div>
  )
}

function ResultCard({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ fontSize: 10, color: '#6b6880', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, fontWeight: 400, color: color || '#e8e6f0', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b6880', marginTop: 2 }}>{sub}</div>}
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
      (batch) => {
        if (abortRef.current) return
        setProgress(batch)
      },
      (final) => {
        if (abortRef.current) return
        setResults(final)
        setRunning(false)
        setHistory(prev => [{
          numStands, maxChips, numGames,
          p1Wr: (final.p1Wins / numGames * 100).toFixed(1),
          avgTurns: (final.turns.reduce((a, b) => a + b, 0) / final.turns.length).toFixed(0),
          goldenPct: (final.goldenDecisive / numGames * 100).toFixed(1),
        }, ...prev].slice(0, 10))
      }
    )
  }, [numStands, maxChips, numGames])

  const stop = () => { abortRef.current = true; setRunning(false) }

  const data = results || progress
  const total = data ? data.total || numGames : numGames
  const played = data ? data.played || 0 : 0
  const p1Wr = data && played > 0 ? (data.p1Wins / played * 100).toFixed(1) : '—'
  const p2Wr = data && played > 0 ? (data.p2Wins / played * 100).toFixed(1) : '—'
  const avgTurns = data && data.turns?.length > 0
    ? (data.turns.reduce((a, b) => a + b, 0) / data.turns.length).toFixed(1) : '—'
  const goldenPct = data && played > 0
    ? (data.goldenDecisive / played * 100).toFixed(1) : '—'

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: 20 }}>
        <h3>Параметры симуляции</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#a09cb0' }}>
            Количество стоек
            <input type="range" min={5} max={16} value={numStands}
              onChange={e => setNumStands(+e.target.value)}
              style={{ accentColor: '#f0654a' }} />
            <span style={{ textAlign: 'center', fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: '#e8e6f0' }}>{numStands}</span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#a09cb0' }}>
            Высота стойки (макс. фишек)
            <input type="range" min={5} max={17} value={maxChips}
              onChange={e => setMaxChips(+e.target.value)}
              style={{ accentColor: '#f0654a' }} />
            <span style={{ textAlign: 'center', fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: '#e8e6f0' }}>{maxChips}</span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#a09cb0' }}>
            Количество партий
            <select value={numGames}
              onChange={e => setNumGames(+e.target.value)}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, padding: '8px 12px', border: '1px solid #36364a', borderRadius: 8, background: '#1e1e28', color: '#e8e6f0' }}>
              <option value={200}>200 (быстро)</option>
              <option value={500}>500</option>
              <option value={1000}>1 000</option>
              <option value={2000}>2 000</option>
              <option value={5000}>5 000 (точно)</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {!running ? (
            <button className="btn primary" onClick={start}>Запустить симуляцию</button>
          ) : (
            <button className="btn" onClick={stop} style={{ borderColor: '#ff6b6b', color: '#ff6b6b' }}>Остановить</button>
          )}
        </div>

        {running && (
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={played} max={total} />
            <div style={{ textAlign: 'center', fontSize: 12, color: '#6b6880', marginTop: 6 }}>
              {played} / {total} партий
            </div>
          </div>
        )}
      </div>

      {data && played > 0 && (
        <div className="dash-card" style={{ marginBottom: 20 }}>
          <h3>Результаты {results ? '' : '(в процессе...)'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
            <ResultCard label="Игрок 1" value={`${p1Wr}%`} color="var(--p1)" sub={`${data.p1Wins} побед`} />
            <ResultCard label="Игрок 2" value={`${p2Wr}%`} color="var(--p2)" sub={`${data.p2Wins} побед`} />
            <ResultCard label="Ходов (avg)" value={avgTurns} />
            <ResultCard label="Золотая при 5:5" value={`${goldenPct}%`} color="var(--gold)" />
          </div>

          {data.standCloseCount && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#a09cb0', marginBottom: 8, fontWeight: 500 }}>Частота закрытия стоек:</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60 }}>
                {data.standCloseCount.map((count, i) => {
                  const max = Math.max(...data.standCloseCount, 1)
                  const pct = count / max
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', height: `${pct * 50}px`, minHeight: 2,
                        background: i === 0
                          ? 'linear-gradient(180deg, #ffc145, #e6a020)'
                          : 'linear-gradient(180deg, #6db4ff, #4a9eff)',
                        borderRadius: '3px 3px 0 0', transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: i === 0 ? '0 0 8px rgba(255,193,69,0.3)' : '0 0 6px rgba(74,158,255,0.2)',
                      }} />
                      <span style={{ fontSize: 9, color: '#6b6880' }}>{i === 0 ? '★' : i}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="dash-card">
          <h3>История запусков</h3>
          <table className="dash-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Стоек</th>
                <th>Высота</th>
                <th>Партий</th>
                <th>P1 WR</th>
                <th>Ходов</th>
                <th>Золотая</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{h.numStands}</td>
                  <td>{h.maxChips}</td>
                  <td>{h.numGames}</td>
                  <td>{h.p1Wr}%</td>
                  <td>{h.avgTurns}</td>
                  <td>{h.goldenPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
