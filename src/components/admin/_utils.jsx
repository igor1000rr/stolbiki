/**
 * Shared утилиты админ-панели — api клиент, форматтеры, стили.
 */

const API = '/api'
let _token = null
function getToken() {
  if (!_token) _token = localStorage.getItem('stolbiki_token')
  return _token
}

export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export function ago(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}д назад`
  return d.toLocaleDateString('ru')
}

export function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function fmtUptime(s) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}д ${h}ч` : h > 0 ? `${h}ч ${m}м` : `${m}м`
}

export const S = {
  wrap: { display: 'flex', gap: 0, minHeight: 'calc(100vh - 100px)', margin: '0 -24px' },
  sidebar: {
    width: 220, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '16px 0', position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto',
  },
  sideTitle: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--ink3)', padding: '12px 20px 6px' },
  sideBtn: (active) => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 20px',
    background: active ? 'rgba(240,96,64,0.08)' : 'transparent', color: active ? 'var(--accent)' : 'var(--ink2)',
    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
    fontFamily: 'inherit', textAlign: 'left', borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
    transition: 'all 0.15s',
  }),
  main: { flex: 1, padding: '20px 28px', overflow: 'auto', minWidth: 0 },
  card: {
    background: 'var(--surface)', borderRadius: 12, padding: '20px 24px', marginBottom: 16,
    border: '1px solid rgba(255,255,255,0.04)',
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  grid: (cols = 4) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }),
  metric: (color) => ({
    textAlign: 'center', padding: '16px 10px', background: `${color}08`, borderRadius: 10,
    border: `1px solid ${color}18`,
  }),
  metricVal: (color) => ({ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }),
  metricLabel: { fontSize: 10, color: 'var(--ink3)', marginTop: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    textAlign: 'left', padding: '10px 12px', color: 'var(--ink3)', fontWeight: 600,
    borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8,
    cursor: 'pointer', userSelect: 'none',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--ink2)' },
  input: {
    background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    padding: '9px 14px', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%',
  },
  btn: (variant = 'default') => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
    ...(variant === 'primary' ? { background: 'var(--accent)', color: '#fff' } :
      variant === 'danger' ? { background: 'rgba(255,80,80,0.12)', color: '#ff5050', border: '1px solid rgba(255,80,80,0.2)' } :
        { background: 'var(--surface2)', color: 'var(--ink2)' }),
  }),
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
    background: `${color}18`, color, lineHeight: '16px',
  }),
  bar: () => ({
    height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 4,
    position: 'relative',
  }),
  barFill: (pct, color) => ({
    position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
    background: color, borderRadius: 2, transition: 'width 0.5s',
  }),
  sparkline: (data, color, w = 120, h = 32) => {
    if (!data?.length) return null
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  emptyState: { textAlign: 'center', padding: 40, color: 'var(--ink3)', fontSize: 13 },
  pagination: { display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 },
}

