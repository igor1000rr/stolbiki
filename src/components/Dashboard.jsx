import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import dashData from '../data/dashboard.json'

Chart.register(...registerables)

// Тёмная тема для Chart.js
Chart.defaults.color = '#6b6880'
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'
Chart.defaults.font.family = "'Outfit', sans-serif"

function MetricCard({ title, value, sub, className }) {
  return (
    <div className="dash-card">
      <h3>{title}</h3>
      <div className={`big-num ${className || ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function SelfPlayChart() {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    const ctx = ref.current.getContext('2d')
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dashData.selfplay.versions,
        datasets: [
          {
            label: 'Loss', data: dashData.selfplay.losses,
            borderColor: '#f0654a', backgroundColor: 'rgba(240, 101, 74, 0.08)',
            fill: true, tension: 0.3, yAxisID: 'y', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          },
          {
            label: 'vs Random %', data: dashData.selfplay.vs_random,
            borderColor: '#4ecb71', backgroundColor: 'rgba(78, 203, 113, 0.08)',
            fill: true, tension: 0.3, yAxisID: 'y1', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          },
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
    return () => chartRef.current?.destroy()
  }, [])

  return <div className="chart-wrap"><canvas ref={ref} /></div>
}

function StrategyChart() {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    const ctx = ref.current.getContext('2d')
    const st = dashData.strategies
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Ранний (0-15)', 'Средний (16-35)', 'Поздний (36+)'],
        datasets: [{
          label: 'Частота переносов %',
          data: [st.transfer_early, st.transfer_mid, st.transfer_late],
          backgroundColor: ['rgba(74, 158, 255, 0.6)', 'rgba(78, 203, 113, 0.6)', 'rgba(240, 101, 74, 0.6)'],
          borderColor: ['#4a9eff', '#4ecb71', '#f0654a'],
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 70, title: { display: true, text: '%' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          x: { grid: { display: false } },
        },
      },
    })
    return () => chartRef.current?.destroy()
  }, [])

  return <div className="chart-wrap"><canvas ref={ref} /></div>
}

function VariantsTable({ data, headers, keyField }) {
  const sorted = Object.entries(data).sort((a, b) => +a[0] - +b[0])
  return (
    <table className="dash-table">
      <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {sorted.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{(v.p1_wr * 100).toFixed(1)}%</td>
            <td>{Math.round(v.avg_turns)}</td>
            <td>{v.decisive_golden > 0 ? `${(v.decisive_golden * 100).toFixed(1)}%` : '— (нечётное)'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Dashboard() {
  const d = dashData

  return (
    <div className="dash-grid">
      <MetricCard
        title="Баланс (P1 винрейт)"
        value={`${(d.random.p1_wr * 100).toFixed(1)}%`}
        sub={`${d.random.games.toLocaleString()} рандомных партий`}
        className="good"
      />
      <MetricCard
        title="Глубина стратегии"
        value={`${(d.mcts_vs_rand.wr * 100).toFixed(0)}%`}
        sub="MCTS (150 сим) vs Рандом"
        className="p1c"
      />
      <MetricCard
        title="Преимущество 1-го хода"
        value={`${(d.mcts_vs_mcts.p1_wr * 100).toFixed(0)}%`}
        sub={`MCTS vs MCTS, ${d.mcts_vs_mcts.games} партий`}
      />
      <MetricCard
        title="Золотая стойка"
        value={`${(d.random.decisive_golden * 100).toFixed(0)}%`}
        sub="Решает при 5:5"
      />

      <div className="dash-card dash-full">
        <h3>Self-Play обучение ({d.selfplay.versions.length} итераций)</h3>
        <SelfPlayChart />
      </div>

      <div className="dash-card dash-full">
        <h3>Количество стоек</h3>
        <VariantsTable
          data={d.variants.stands}
          headers={['Стоек', 'Винрейт P1', 'Ходов', 'Золотая решает']}
        />
      </div>

      <div className="dash-card dash-full">
        <h3>Высота стоек</h3>
        <VariantsTable
          data={d.variants.heights}
          headers={['Макс. фишек', 'Винрейт P1', 'Ходов', 'Золотая решает']}
        />
      </div>

      <div className="dash-card dash-full">
        <h3>Стратегия по этапам</h3>
        <StrategyChart />
      </div>
    </div>
  )
}
