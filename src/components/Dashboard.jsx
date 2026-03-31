import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import dashData from '../data/dashboard.json'
import { getTrainingStats, exportForTraining, clearTrainingData } from '../engine/collector'

Chart.register(...registerables)
Chart.defaults.color = '#6b6880'
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'
Chart.defaults.font.family = "'Outfit', sans-serif"

function HeroMetric({ value, label, color, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px 6px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6b6880', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function ChartWrap({ children, title }) {
  return (
    <div className="dash-card dash-full" style={{ marginBottom: 16 }}>
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function useChart(ref, chartRef, config) {
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current.getContext('2d'), config)
    return () => chartRef.current?.destroy()
  }, []) // eslint-disable-line
}

function SelfPlayChart() {
  const ref = useRef(null), cr = useRef(null)
  useChart(ref, cr, {
    type: 'line',
    data: {
      labels: dashData.selfplay.versions,
      datasets: [
        { label: 'Loss', data: dashData.selfplay.losses, borderColor: '#f0654a', backgroundColor: 'rgba(240,101,74,0.08)', fill: true, tension: 0.3, yAxisID: 'y', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'vs Random %', data: dashData.selfplay.vs_random, borderColor: '#4ecb71', backgroundColor: 'rgba(78,203,113,0.08)', fill: true, tension: 0.3, yAxisID: 'y1', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Loss' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Win Rate %' }, min: 0, max: 100, grid: { drawOnChartArea: false } },
      },
    },
  })
  return <div className="chart-wrap"><canvas ref={ref} /></div>
}

function BalanceChart() {
  const ref = useRef(null), cr = useRef(null)
  useChart(ref, cr, {
    type: 'line',
    data: {
      labels: ['v320', 'v520', 'v620', 'v720', 'v820', 'v920', 'v1000'],
      datasets: [
        { label: 'P1 %', data: [55,45,55,52,52,68,39], borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,0.1)', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#4a9eff' },
        { label: 'P2 %', data: [45,55,45,48,48,32,61], borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.1)', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#ff6b6b' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        y: { min: 25, max: 75, title: { display: true, text: 'Win Rate %' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } },
      },
    },
  })
  return <div className="chart-wrap"><canvas ref={ref} /></div>
}

function GpuChart() {
  const ref = useRef(null), cr = useRef(null)
  const gpu = dashData.gpu_run3
  if (!gpu) return null
  useChart(ref, cr, {
    type: 'line',
    data: {
      labels: gpu.versions,
      datasets: [
        { label: 'Loss', data: gpu.losses, borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.08)', fill: true, tension: 0.3, yAxisID: 'y', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'LR ×1000', data: gpu.lr.map(v => v * 1000), borderColor: '#555', borderDash: [4, 4], tension: 0.3, yAxisID: 'y1', borderWidth: 1, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Loss' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'LR ×1000' }, grid: { drawOnChartArea: false } },
      },
    },
  })
  return <div className="chart-wrap"><canvas ref={ref} /></div>
}

function StrategyChart() {
  const ref = useRef(null), cr = useRef(null)
  const st = dashData.strategies
  useChart(ref, cr, {
    type: 'bar',
    data: {
      labels: ['Ранний (0-15)', 'Средний (16-35)', 'Поздний (36+)'],
      datasets: [{ data: [st.transfer_early, st.transfer_mid, st.transfer_late], backgroundColor: ['rgba(74,158,255,0.6)', 'rgba(78,203,113,0.6)', 'rgba(240,101,74,0.6)'], borderColor: ['#4a9eff', '#4ecb71', '#f0654a'], borderWidth: 1, borderRadius: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 70, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } },
  })
  return <div className="chart-wrap"><canvas ref={ref} /></div>
}

function VariantsTable({ data, headers }) {
  return (
    <table className="dash-table">
      <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {Object.entries(data).sort((a,b) => +a[0] - +b[0]).map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td style={{ color: Math.abs(v.p1_wr*100-50) < 3 ? '#3dd68c' : '#e8e6f0' }}>{(v.p1_wr*100).toFixed(1)}%</td>
            <td>{Math.round(v.avg_turns)}</td>
            <td>{v.decisive_golden > 0 ? `${(v.decisive_golden*100).toFixed(1)}%` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Dashboard() {
  const d = dashData
  const totalIter = d.selfplay.versions.length
  const avgWr = d.selfplay.vs_random.slice(-20).reduce((a,b) => a+b, 0) / 20

  return (
    <div>
      {/* Hero */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          <HeroMetric value="239K+" label="партий" color="#e8e6f0" sub="проанализировано" />
          <HeroMetric value={`${(d.random.p1_wr*100).toFixed(1)}%`} label="P1 баланс" color="#3dd68c" sub="70K рандом" />
          <HeroMetric value="97%" label="лучший WR" color="#9b59b6" sub="GPU ResNet 840K" />
          <HeroMetric value={`${(d.random.decisive_golden*100).toFixed(0)}%`} label="золотая 5:5" color="#ffc145" />
          <HeroMetric value={`${totalIter + (d.gpu_run3?.iterations || 0)}`} label="self-play итер" color="#3bb8a8" sub="CPU + GPU" />
        </div>
      </div>

      <div className="dash-grid">
        <ChartWrap title={`Self-Play (CPU, ${totalIter} итераций, новые правила)`}>
          <SelfPlayChart />
        </ChartWrap>

        <ChartWrap title="Эволюция баланса P1 vs P2 (новые правила)">
          <BalanceChart />
          <div style={{ fontSize: 11, color: '#6b6880', marginTop: 8, textAlign: 'center' }}>
            Среднее: P1=50%, P2=50% • Осцилляция ±10% (нормально для 64-нейронной CPU сети)
          </div>
        </ChartWrap>

        {/* CPU vs GPU */}
        <div className="dash-card dash-full" style={{ marginBottom: 16 }}>
          <h3>CPU vs GPU обучение</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
            <div style={{ padding: 14, background: 'rgba(74,158,255,0.04)', borderRadius: 10, border: '1px solid rgba(74,158,255,0.1)' }}>
              <div style={{ fontSize: 12, color: '#4a9eff', fontWeight: 600, marginBottom: 8 }}>CPU (numpy MLP)</div>
              <div style={{ fontSize: 12, color: '#a09cb0', lineHeight: 1.8 }}>
                Параметров: <b style={{ color: '#e8e6f0' }}>~8K</b><br/>
                Итераций: <b style={{ color: '#e8e6f0' }}>500 (стар) + 1,000 (нов)</b><br/>
                Loss min: <b style={{ color: '#e8e6f0' }}>0.72</b><br/>
                WR: <b style={{ color: '#e8e6f0' }}>~90%</b><br/>
                Баланс: <b style={{ color: '#3dd68c' }}>50:50</b>
              </div>
            </div>
            <div style={{ padding: 14, background: 'rgba(155,89,182,0.04)', borderRadius: 10, border: '1px solid rgba(155,89,182,0.1)' }}>
              <div style={{ fontSize: 12, color: '#9b59b6', fontWeight: 600, marginBottom: 8 }}>GPU (PyTorch ResNet)</div>
              <div style={{ fontSize: 12, color: '#a09cb0', lineHeight: 1.8 }}>
                Параметров: <b style={{ color: '#e8e6f0' }}>840K</b><br/>
                Итераций: <b style={{ color: '#e8e6f0' }}>1,146 (146 стар + 500×2 нов)</b><br/>
                Loss min: <b style={{ color: '#e8e6f0' }}>0.098 / 0.128</b><br/>
                WR best: <b style={{ color: '#e8e6f0' }}>97%</b><br/>
                GPU: <b style={{ color: '#e8e6f0' }}>NVIDIA GPU</b>
              </div>
            </div>
          </div>
        </div>

        {/* GPU Run 3 график */}
        {d.gpu_run3 && (
          <ChartWrap title={`GPU Self-Play прогон 3 (${d.gpu_run3.iterations} итер, NVIDIA GPU, новые правила)`}>
            <GpuChart />
          </ChartWrap>
        )}

        {/* Trained balance + first move */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, gridColumn: '1/-1', marginBottom: 16 }}>
          {d.trained_mm && (
            <div className="dash-card">
              <h3>Self-Play баланс (v{totalIter})</h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#4a9eff' }}>{d.trained_mm.p1}</div>
                  <div style={{ fontSize: 11, color: '#6b6880' }}>Игрок 1</div>
                </div>
                <div style={{ fontSize: 28, color: '#36364a', alignSelf: 'center' }}>:</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#ff6b6b' }}>{d.trained_mm.p2}</div>
                  <div style={{ fontSize: 11, color: '#6b6880' }}>Игрок 2</div>
                </div>
              </div>
            </div>
          )}
          <div className="dash-card">
            <h3>Преимущество 1-го хода</h3>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#e8e6f0' }}>{(d.mcts_vs_mcts.p1_wr*100).toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: '#6b6880' }}>MCTS vs MCTS, {d.mcts_vs_mcts.games} партий</div>
              <div style={{ fontSize: 11, color: '#3dd68c', marginTop: 4 }}>Swap rule компенсирует</div>
            </div>
          </div>
        </div>

        <ChartWrap title="Стратегия переносов"><StrategyChart /></ChartWrap>

        <div className="dash-card dash-full" style={{ marginBottom: 16 }}>
          <h3>Варианты: количество стоек</h3>
          <VariantsTable data={d.variants.stands} headers={['Стоек', 'P1 WR', 'Ходов', 'Золотая']} />
        </div>

        <div className="dash-card dash-full" style={{ marginBottom: 16 }}>
          <h3>Варианты: высота стоек</h3>
          <VariantsTable data={d.variants.heights} headers={['Макс.', 'P1 WR', 'Ходов', 'Золотая']} />
        </div>

        {/* Данные для дообучения */}
        <TrainingPanel />
      </div>
    </div>
  )
}

function TrainingPanel() {
  const [stats, setStats] = useState(() => getTrainingStats())
  const [exported, setExported] = useState(null)

  function refresh() { setStats(getTrainingStats()) }

  function doExport() {
    const samples = exportForTraining()
    const blob = new Blob([JSON.stringify(samples, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `training_data_${samples.length}_samples.json`
    a.click(); URL.revokeObjectURL(url)
    setExported(samples.length)
  }

  function doClear() {
    if (confirm('Удалить все обучающие данные?')) {
      clearTrainingData()
      refresh()
    }
  }

  return (
    <div className="dash-card dash-full">
      <h3>Данные для дообучения AI</h3>
      <div style={{ fontSize: 12, color: '#a09cb0', marginBottom: 12 }}>
        Система собирает все партии реальных игроков. Данные используются для дообучения нейросети.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <div style={{ textAlign: 'center', padding: 10, background: 'rgba(155,89,182,0.06)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#9b59b6' }}>{stats.games}</div>
          <div style={{ fontSize: 10, color: '#6b6880' }}>Партий</div>
        </div>
        <div style={{ textAlign: 'center', padding: 10, background: 'rgba(74,158,255,0.06)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#4a9eff' }}>{stats.moves}</div>
          <div style={{ fontSize: 10, color: '#6b6880' }}>Ходов</div>
        </div>
        <div style={{ textAlign: 'center', padding: 10, background: 'rgba(78,203,113,0.06)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#4ecb71' }}>{stats.aiGames}</div>
          <div style={{ fontSize: 10, color: '#6b6880' }}>vs AI</div>
        </div>
        <div style={{ textAlign: 'center', padding: 10, background: 'rgba(240,101,74,0.06)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3bb8a8' }}>{stats.pvpGames}</div>
          <div style={{ fontSize: 10, color: '#6b6880' }}>PvP</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={refresh} style={{ fontSize: 11 }}>Обновить</button>
        <button className="btn primary" onClick={doExport} style={{ fontSize: 11 }} disabled={stats.games === 0}>
          Экспорт JSON ({stats.moves} ходов)
        </button>
        <button className="btn" onClick={doClear} style={{ fontSize: 11, borderColor: '#ff6b6b33', color: '#ff6b6b' }}>
          Очистить
        </button>
      </div>
      {exported !== null && (
        <div style={{ fontSize: 11, color: '#3dd68c', marginTop: 8 }}>✓ Экспортировано {exported} сэмплов</div>
      )}
      <div style={{ fontSize: 10, color: '#555', marginTop: 8 }}>
        Формат: {"{ state, action, value: ±1 }"} • Совместим с Python train.py • Макс {200} партий в localStorage
      </div>
    </div>
  )
}
