import { useEffect, useState } from 'react'
import { S, api } from './_shared'

export function ReferralsTab() {
  const [data, setData] = useState(null)
  useEffect(() => { api('/admin/referrals').then(setData).catch(() => {}) }, [])
  if (!data) return <div style={{ color: 'var(--ink3)' }}>Загрузка...</div>
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={S.metric('var(--accent)')}><div style={S.metricVal('var(--ink)')}>{data.total}</div><div style={S.metricLabel}>Всего рефералов</div></div>
        <div style={S.metric('var(--accent)')}><div style={{ ...S.metricVal('var(--ink)'), color: 'var(--gold)' }}>+{data.totalXP}</div><div style={S.metricLabel}>XP выдано</div></div>
        <div style={S.metric('var(--accent)')}><div style={S.metricVal('var(--ink)')}>{data.topReferrers?.length || 0}</div><div style={S.metricLabel}>Реферреров</div></div>
      </div>
      {data.topReferrers?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 8 }}>Топ реферреров</h3>
          {data.topReferrers.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--surface2)', fontSize: 12 }}>
              <span style={{ color: 'var(--ink3)', width: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1, color: 'var(--ink)' }}>{r.username}</span>
              <span style={{ color: 'var(--ink3)' }}>{r.rating} ELO</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{r.referral_count} чел.</span>
              <span style={{ color: 'var(--gold)' }}>+{r.total_xp} XP</span>
            </div>
          ))}
        </div>
      )}
      {data.recent?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 8 }}>Последние</h3>
          {data.recent.slice(0, 20).map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--ink3)', padding: '4px 0', borderBottom: '1px solid var(--surface)' }}>
              <span style={{ color: 'var(--green)' }}>{r.referrer}</span> → <span style={{ color: 'var(--ink)' }}>{r.referred}</span>
              <span style={{ marginLeft: 8, color: 'var(--gold)' }}>+{r.xp_rewarded} XP</span>
              <span style={{ float: 'right' }}>{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
