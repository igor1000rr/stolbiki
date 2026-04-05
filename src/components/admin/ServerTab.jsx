import { useEffect, useState } from 'react'
import { S, api, fmtUptime } from './_utils'
import { Metric } from './_shared'

export function ServerTab() {
  const [info, setInfo] = useState(null)
  useEffect(() => { api('/admin/server').then(setInfo) }, [])

  if (!info) return <div style={S.emptyState}>Загрузка...</div>

  const memPct = Math.round(info.memory.heapUsedMB / info.memory.heapTotalMB * 100)

  return (
    <div>
      <div style={S.grid(4)}>
        <Metric value={info.nodeVersion} label="Node.js" color="var(--green)" />
        <Metric value={fmtUptime(info.uptime)} label="Аптайм" color="var(--p1)" />
        <Metric value={`${info.memory.rssMB}MB`} label="RSS Memory" color="var(--accent)" sub={`heap: ${info.memory.heapUsedMB}/${info.memory.heapTotalMB}MB`} />
        <Metric value={`${info.db.sizeMB}MB`} label="База данных" color="var(--gold)" sub={info.db.walMode} />
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.cardTitle}>Память</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={S.bar(memPct, 'var(--p1)')}>
              <div style={S.barFill(memPct, 'var(--p1)')} />
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink2)' }}>{memPct}%</span>
        </div>
      </div>

      <div style={{ ...S.card }}>
        <div style={S.cardTitle}>Информация</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 2, fontFamily: 'monospace' }}>
          <div>PID: {info.pid}</div>
          <div>Platform: {info.platform}</div>
          <div>Active Rooms: {info.rooms}</div>
          <div>Match Queue: {info.matchQueue}</div>
          <div>Rate Limit Entries: {info.rateLimitEntries}</div>
        </div>
      </div>
    </div>
  )
}
