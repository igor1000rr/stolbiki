import { useEffect, useState } from 'react'
import { S, api } from './_utils'

export function ChallengesTab() {
  const [data, setData] = useState(null)
  useEffect(() => { api('/admin/challenges').then(setData).catch(() => {}) }, [])
  if (!data) return <div style={{ color: 'var(--ink3)' }}>Загрузка...</div>
  const statusColors = { pending: 'var(--gold)', accepted: 'var(--green)', declined: 'var(--p2)', expired: 'var(--ink3)' }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={S.metric('var(--accent)')}><div style={S.metricVal('var(--ink)')}>{data.total}</div><div style={S.metricLabel}>Всего вызовов</div></div>
        {data.byStatus?.map(s => (
          <div key={s.status} style={S.metric('var(--accent)')}>
            <div style={{ ...S.metricVal('var(--ink)'), color: statusColors[s.status] || 'var(--ink)' }}>{s.count}</div>
            <div style={S.metricLabel}>{s.status}</div>
          </div>
        ))}
      </div>
      {data.recent?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 8 }}>Последние</h3>
          {data.recent.slice(0, 30).map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--ink3)', padding: '4px 0', borderBottom: '1px solid var(--surface)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--ink)' }}>{c.from_user}</span>
              <span>→</span>
              <span style={{ color: 'var(--ink)' }}>{c.to_user}</span>
              <span style={{ color: statusColors[c.status], fontWeight: 600 }}>{c.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>{c.room_id}</span>
              <span style={{ fontSize: 10 }}>{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
