/**
 * React-компоненты админ-панели, которые используют S/api через _utils.
 * Вынесено из одного файла для корректной работы react-refresh (HMR).
 */

import { S } from './_utils'

export function Metric({ value, label, color = 'var(--accent)', sub }) {
  return (
    <div style={S.metric(color)}>
      <div style={S.metricVal(color)}>{value}</div>
      <div style={S.metricLabel}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div style={S.pagination}>
      <button style={S.btn()} disabled={page <= 1} onClick={() => onChange(page - 1)}>←</button>
      <span style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink3)' }}>{page} / {pages}</span>
      <button style={S.btn()} disabled={page >= pages} onClick={() => onChange(page + 1)}>→</button>
    </div>
  )
}

export function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...S.card, maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 16 }}>{msg}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button style={S.btn('danger')} onClick={onOk}>Подтвердить</button>
          <button style={S.btn()} onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export function MiniBarChart({ data, color }) {
  const days = []
  const dataMap = new Map((data || []).map(d => [d.day, d.count]))
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ day: key, count: dataMap.get(key) || 0 })
  }
  const max = Math.max(...days.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64 }}>
      {days.map((d, i) => (
        <div key={i} title={`${d.day}: ${d.count}`} style={{
          flex: 1, minWidth: 2, maxWidth: 16,
          height: d.count > 0 ? `${Math.max(8, (d.count / max) * 100)}%` : '2px',
          background: d.count > 0 ? color : 'rgba(255,255,255,0.06)',
          borderRadius: '2px 2px 0 0', opacity: d.count > 0 ? 0.75 : 0.4,
          transition: 'height 0.3s', cursor: 'default',
        }} />
      ))}
    </div>
  )
}
