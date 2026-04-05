import { useEffect, useState } from 'react'
import { Metric, MiniBarChart, S, api, fmtNum, fmtUptime } from './_shared'

export function OverviewTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/admin/overview').then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={S.emptyState}>Загрузка...</div>
  if (!data) return <div style={S.emptyState}>Ошибка загрузки</div>

  const chartH = 80
  const chartW = '100%'

  return (
    <div>
      <div style={S.grid(5)}>
        <Metric value={fmtNum(data.users.total)} label="Пользователи" color="var(--p1)" sub={`${data.users.today} сегодня`} />
        <Metric value={fmtNum(data.games.total)} label="Партий всего" color="var(--green)" sub={`${data.games.today} сегодня`} />
        <Metric value={data.rating.avg} label="Ср. рейтинг" color="var(--gold)" sub={`макс: ${data.rating.max}`} />
        <Metric value={data.rooms} label="Активных комнат" color="var(--accent)" sub={`в очереди: ${data.matchQueue}`} />
        <Metric value={`${data.memoryMB}MB`} label="RAM" color="var(--p2)" sub={fmtUptime(data.uptime)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Регистрации (30 дней)</div>
          <MiniBarChart data={data.charts.regByDay} color="var(--p1)" />
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Партии (30 дней)</div>
          <MiniBarChart data={data.charts.gamesByDay} color="var(--green)" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Топ-5 рейтинг</div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>#</th><th style={S.th}>Игрок</th><th style={S.th}>Рейтинг</th><th style={S.th}>Партий</th><th style={S.th}>Побед</th></tr></thead>
            <tbody>
              {data.topPlayers.map((p, i) => (
                <tr key={p.username}>
                  <td style={S.td}>{i + 1}</td>
                  <td style={{ ...S.td, color: 'var(--ink)', fontWeight: 600 }}>{p.username}</td>
                  <td style={{ ...S.td, color: 'var(--gold)' }}>{p.rating}</td>
                  <td style={S.td}>{p.games_played}</td>
                  <td style={S.td}>{p.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Сводка</div>
          <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 2.2 }}>
            <div>Онлайн-партий: <b style={{ color: 'var(--ink)' }}>{data.games.online}</b></div>
            <div>Партий за неделю: <b style={{ color: 'var(--ink)' }}>{data.games.week}</b></div>
            <div>Активных за 7д: <b style={{ color: 'var(--ink)' }}>{data.users.active7d}</b></div>
            <div>Обуч. данные: <b style={{ color: 'var(--ink)' }}>{fmtNum(data.training)}</b></div>
            <div>Головоломок решено: <b style={{ color: 'var(--ink)' }}>{data.puzzles.solved}/{data.puzzles.total}</b></div>
            <div>Блог-постов: <b style={{ color: 'var(--ink)' }}>{data.blog}</b></div>
            <div>Ачивок выдано: <b style={{ color: 'var(--ink)' }}>{data.achievements}</b></div>
          </div>
        </div>
      </div>
    </div>
  )
}
