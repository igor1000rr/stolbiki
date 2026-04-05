import { useEffect, useState } from 'react'
import { S, api } from './_utils'

export function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(7)
  useEffect(() => { api(`/admin/analytics?days=${days}`).then(setData).catch(() => {}) }, [days])
  if (!data) return <div style={{ color: 'var(--ink3)' }}>Загрузка...</div>
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>Период:</span>
        {[1, 7, 14, 30].map(d => (
          <button key={d} style={S.btn(days === d ? 'primary' : 'default')} onClick={() => setDays(d)}>
            {d === 1 ? 'Сегодня' : `${d} дней`}
          </button>
        ))}
      </div>

      <div style={S.grid(4)}>
        <div style={S.metric('var(--accent)')}>
          <div style={S.metricVal('var(--accent)')}>{data.totalEvents.toLocaleString()}</div>
          <div style={S.metricLabel}>Событий</div>
        </div>
        <div style={S.metric('#4a9eff')}>
          <div style={S.metricVal('#4a9eff')}>{data.totalSessions.toLocaleString()}</div>
          <div style={S.metricLabel}>Сессий</div>
        </div>
        <div style={S.metric('var(--green)')}>
          <div style={S.metricVal('var(--green)')}>{data.activeUsers?.length || 0}</div>
          <div style={S.metricLabel}>Активных юзеров</div>
        </div>
        <div style={S.metric('var(--gold)')}>
          <div style={S.metricVal('var(--gold)')}>{data.pageViews?.length || 0}</div>
          <div style={S.metricLabel}>Страниц</div>
        </div>
      </div>

      {data.byDay?.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.cardTitle}>По дням</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.byDay.length, 14)}, 1fr)`, gap: 4, alignItems: 'end', height: 80 }}>
            {data.byDay.slice(-14).map((d, i) => {
              const max = Math.max(...data.byDay.map(x => x.sessions))
              const h = max > 0 ? Math.max(4, (d.sessions / max) * 80) : 4
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ background: 'var(--accent)', borderRadius: 2, height: h, opacity: 0.7, marginBottom: 4 }} title={`${d.day}: ${d.sessions} сессий, ${d.events} событий`} />
                  <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{d.day.slice(5)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Страницы</div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Страница</th><th style={S.th}>Просмотры</th><th style={S.th}>Сессии</th></tr></thead>
            <tbody>
              {(data.pageViews || []).map((p, i) => (
                <tr key={i}><td style={S.td}>{p.page || '—'}</td><td style={S.td}>{p.views}</td><td style={S.td}>{p.sessions}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>События</div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Событие</th><th style={S.th}>Кол-во</th><th style={S.th}>Сессии</th></tr></thead>
            <tbody>
              {(data.topEvents || []).slice(0, 15).map((e, i) => (
                <tr key={i}><td style={S.td}>{e.event}</td><td style={S.td}>{e.count}</td><td style={S.td}>{e.sessions}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.devices?.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.cardTitle}>Устройства</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {data.devices.map((d, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--ink2)' }}>
                <span style={{ fontWeight: 600 }}>{d.device}</span>: {d.sessions} сессий
              </div>
            ))}
          </div>
        </div>
      )}

      {data.activeUsers?.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.cardTitle}>Активные юзеры</div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Юзер</th><th style={S.th}>Рейтинг</th><th style={S.th}>Событий</th><th style={S.th}>Посл. визит</th></tr></thead>
            <tbody>
              {data.activeUsers.slice(0, 20).map((u, i) => (
                <tr key={i}>
                  <td style={S.td}>{u.username}</td>
                  <td style={S.td}>{u.rating}</td>
                  <td style={S.td}>{u.events}</td>
                  <td style={S.td}>{new Date(u.last_seen).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'overview', label: 'Обзор', icon: '◉' },
  { id: 'content', label: 'Контент', icon: '✏' },
  { id: 'users', label: 'Пользователи', icon: '◎' },
  { id: 'games', label: 'Партии', icon: '♟' },
  { id: 'blog', label: 'Блог', icon: '✎' },
  { id: 'rooms', label: 'Комнаты', icon: '⊞' },
  { id: 'achievements', label: 'Ачивки', icon: '★' },
  { id: 'seasons', label: 'Сезоны', icon: '☾' },
  { id: 'training', label: 'Обуч. данные', icon: '⟁' },
  { id: 'referrals', label: 'Рефералы', icon: '🎁' },
  { id: 'challenges', label: 'Вызовы', icon: '⚔' },
  { id: 'analytics', label: 'Аналитика', icon: '◈' },
  { id: 'server', label: 'Сервер', icon: '⚙' },
]
