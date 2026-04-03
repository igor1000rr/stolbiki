/**
 * Админ-панель Snatch Highrise
 * Полное управление: пользователи, партии, блог, сезоны, сервер
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '../engine/i18n'
import Icon from './Icon'

const API = '/api'
let _token = null
function getToken() {
  if (!_token) _token = localStorage.getItem('stolbiki_token')
  return _token
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...opts.headers } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ═══ Утилиты ═══
function ago(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}д назад`
  return d.toLocaleDateString('ru')
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}д ${h}ч` : h > 0 ? `${h}ч ${m}м` : `${m}м`
}

// ═══ Стили ═══
const S = {
  wrap: { display: 'flex', gap: 0, minHeight: 'calc(100vh - 100px)', margin: '0 -24px' },
  sidebar: {
    width: 220, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '16px 0', position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto',
  },
  sideTitle: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--ink3)', padding: '12px 20px 6px', },
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
  bar: (pct, color) => ({
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

// ═══ Компоненты-блоки ═══
function Metric({ value, label, color = 'var(--accent)', sub }) {
  return (
    <div style={S.metric(color)}>
      <div style={S.metricVal(color)}>{value}</div>
      <div style={S.metricLabel}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div style={S.pagination}>
      <button style={S.btn()} disabled={page <= 1} onClick={() => onChange(page - 1)}>←</button>
      <span style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink3)' }}>{page} / {pages}</span>
      <button style={S.btn()} disabled={page >= pages} onClick={() => onChange(page + 1)}>→</button>
    </div>
  )
}

function Confirm({ msg, onOk, onCancel }) {
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

// ═══ OVERVIEW ═══
function OverviewTab() {
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

function MiniBarChart({ data, color }) {
  // Всегда показываем 30 дней, заполняя пустые нулями
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

// ═══ USERS ═══
function UsersTab() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('created_at')
  const [dir, setDir] = useState('desc')
  const [selected, setSelected] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const searchTimer = useRef(null)

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, sort, dir, q: search })
    api(`/admin/users?${params}`).then(d => {
      setUsers(d.users); setTotal(d.total); setPages(d.pages)
    })
  }, [page, sort, dir, search])

  useEffect(() => { load() }, [load])

  function onSearch(v) {
    setSearch(v); setPage(1)
  }

  function toggleSort(col) {
    if (sort === col) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setDir('desc') }
    setPage(1)
  }

  async function saveUser(id, updates) {
    await api(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
    setEditModal(null); load()
  }

  async function deleteUser(id) {
    await api(`/admin/users/${id}`, { method: 'DELETE' })
    setConfirmDelete(null); load()
  }

  const SortTh = ({ col, children }) => (
    <th style={S.th} onClick={() => toggleSort(col)}>
      {children} {sort === col ? (dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          style={{ ...S.input, maxWidth: 280 }} placeholder="Поиск по нику..."
          value={search} onChange={e => onSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{total} пользователей</span>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <SortTh col="username">Ник</SortTh>
              <SortTh col="rating">Рейтинг</SortTh>
              <SortTh col="games_played">Партий</SortTh>
              <th style={S.th}>W/L</th>
              <th style={S.th}>WR%</th>
              <SortTh col="created_at">Регистрация</SortTh>
              <SortTh col="last_seen">Последний визит</SortTh>
              <th style={S.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ background: selected === u.id ? 'rgba(240,96,64,0.04)' : 'transparent' }}>
                <td style={{ ...S.td, color: 'var(--ink3)', fontSize: 11 }}>{u.id}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--ink)' }}>
                  {u.avatar && u.avatar !== 'default' && <span style={{ marginRight: 4, fontSize: 10, opacity: 0.6 }}>[{u.avatar}]</span>}
                  {u.username}
                  {u.is_admin ? <span style={{ ...S.badge('var(--accent)'), marginLeft: 6 }}>admin</span> : null}
                </td>
                <td style={{ ...S.td, color: 'var(--gold)', fontWeight: 600 }}>{u.rating}</td>
                <td style={S.td}>{u.games_played}</td>
                <td style={S.td}><span style={{ color: 'var(--green)' }}>{u.wins}</span>/<span style={{ color: 'var(--p2)' }}>{u.losses}</span></td>
                <td style={S.td}>{u.games_played > 0 ? (u.wins / u.games_played * 100).toFixed(0) + '%' : '—'}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(u.created_at)}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(u.last_seen)}</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => setEditModal(u)}>✎</button>
                    <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 11 }} onClick={() => setConfirmDelete(u)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <div style={S.emptyState}>Ничего не найдено</div>}
        <Pagination page={page} pages={pages} onChange={setPage} />
      </div>

      {editModal && <UserEditModal user={editModal} onSave={saveUser} onClose={() => setEditModal(null)} />}
      {confirmDelete && <Confirm msg={`Удалить пользователя ${confirmDelete.username}? Все данные будут потеряны.`} onOk={() => deleteUser(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  )
}

function UserEditModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    username: user.username,
    rating: user.rating,
    is_admin: user.is_admin,
    reset_password: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={S.cardTitle}>Редактировать: {user.username}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Ник
            <input style={{ ...S.input, marginTop: 4 }} value={form.username} onChange={e => set('username', e.target.value)} />
          </label>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Рейтинг
            <input style={{ ...S.input, marginTop: 4 }} type="number" min="100" max="2500" value={form.rating} onChange={e => set('rating', +e.target.value)} />
          </label>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Новый пароль (оставьте пустым чтобы не менять)
            <input style={{ ...S.input, marginTop: 4 }} type="text" value={form.reset_password} onChange={e => set('reset_password', e.target.value)} placeholder="min 6 символов" />
          </label>
          <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_admin} onChange={e => set('is_admin', e.target.checked)} />
            Администратор
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.8 }}>
              Партий: {user.games_played}<br />
              Побед: {user.wins}<br />
              Серия: {user.best_streak}<br />
              Золотых: {user.golden_closed}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.8 }}>
              Камбэков: {user.comebacks}<br />
              Перфектов: {user.perfect_wins}<br />
              Быстрых: {user.fast_wins}<br />
              Онлайн: {user.online_wins}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={S.btn()} onClick={onClose}>Отмена</button>
          <button style={S.btn('primary')} onClick={() => {
            const updates = {}
            if (form.username !== user.username) updates.username = form.username
            if (form.rating !== user.rating) updates.rating = form.rating
            if (form.is_admin !== user.is_admin) updates.is_admin = form.is_admin
            if (form.reset_password) updates.reset_password = form.reset_password
            onSave(user.id, updates)
          }}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

// ═══ GAMES ═══
function GamesTab() {
  const [games, setGames] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [mode, setMode] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ page, ...(mode && { mode }) })
    api(`/admin/games?${params}`).then(d => {
      setGames(d.games); setTotal(d.total); setPages(d.pages)
    })
  }, [page, mode])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {['', 'ai', 'pvp', 'online'].map(m => (
          <button key={m} style={{ ...S.btn(mode === m ? 'primary' : 'default'), fontSize: 11 }} onClick={() => { setMode(m); setPage(1) }}>
            {m === '' ? 'Все' : m === 'ai' ? 'vs AI' : m.toUpperCase()}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink3)', marginLeft: 8 }}>{total} партий</span>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Игрок</th>
              <th style={S.th}>Результат</th>
              <th style={S.th}>Счёт</th>
              <th style={S.th}>Δ</th>
              <th style={S.th}>Режим</th>
              <th style={S.th}>Ходов</th>
              <th style={S.th}>Длит.</th>
              <th style={S.th}>Дата</th>
            </tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.id}>
                <td style={{ ...S.td, fontSize: 11, color: 'var(--ink3)' }}>{g.id}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--ink)' }}>{g.username}</td>
                <td style={S.td}>
                  <span style={S.badge(g.won ? 'var(--green)' : 'var(--p2)')}>{g.won ? 'WIN' : 'LOSS'}</span>
                </td>
                <td style={S.td}>{g.score}</td>
                <td style={{ ...S.td, color: g.rating_delta > 0 ? 'var(--green)' : 'var(--p2)', fontWeight: 600 }}>
                  {g.rating_delta > 0 ? '+' : ''}{g.rating_delta}
                </td>
                <td style={S.td}>
                  <span style={S.badge(g.is_online ? 'var(--p1)' : 'var(--ink3)')}>{g.mode || 'ai'}</span>
                </td>
                <td style={S.td}>{g.turns || '—'}</td>
                <td style={S.td}>{g.duration ? `${Math.floor(g.duration / 60)}:${String(g.duration % 60).padStart(2, '0')}` : '—'}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(g.played_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!games.length && <div style={S.emptyState}>Нет партий</div>}
        <Pagination page={page} pages={pages} onChange={setPage} />
      </div>
    </div>
  )
}

// ═══ BLOG ═══
function BlogTab() {
  const [posts, setPosts] = useState([])
  const [editPost, setEditPost] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  function load() { api('/admin/blog').then(setPosts) }
  useEffect(() => { load() }, [])

  async function savePost(post) {
    if (post._new) {
      await api('/blog', { method: 'POST', body: JSON.stringify(post) })
    } else {
      await api(`/blog/${post.slug}`, { method: 'PUT', body: JSON.stringify(post) })
    }
    setEditPost(null); load()
  }

  async function deletePost(slug) {
    await api(`/admin/blog/${slug}`, { method: 'DELETE' })
    setConfirmDel(null); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{posts.length} постов</span>
        <button style={S.btn('primary')} onClick={() => setEditPost({ _new: true, slug: '', title_ru: '', title_en: '', body_ru: '', body_en: '', tag: 'update', pinned: 0, published: 1 })}>
          + Новый пост
        </button>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Slug</th>
              <th style={S.th}>Заголовок</th>
              <th style={S.th}>Тег</th>
              <th style={S.th}>Статус</th>
              <th style={S.th}>Дата</th>
              <th style={S.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.slug}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{p.slug}</td>
                <td style={{ ...S.td, color: 'var(--ink)', fontWeight: 500 }}>{p.title_ru}</td>
                <td style={S.td}><span style={S.badge(p.tag === 'release' ? 'var(--green)' : p.tag === 'ai' ? 'var(--p1)' : 'var(--ink3)')}>{p.tag}</span></td>
                <td style={S.td}>
                  {p.published ? <span style={S.badge('var(--green)')}>опубликован</span> : <span style={S.badge('var(--ink3)')}>черновик</span>}
                  {p.pinned ? <span style={{ ...S.badge('var(--gold)'), marginLeft: 4 }}>pin</span> : null}
                </td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(p.created_at)}</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => setEditPost(p)}>✎</button>
                    <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 11 }} onClick={() => setConfirmDel(p)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editPost && <BlogEditModal post={editPost} onSave={savePost} onClose={() => setEditPost(null)} />}
      {confirmDel && <Confirm msg={`Удалить пост «${confirmDel.title_ru}»?`} onOk={() => deletePost(confirmDel.slug)} onCancel={() => setConfirmDel(null)} />}
    </div>
  )
}

function BlogEditModal({ post, onSave, onClose }) {
  const [form, setForm] = useState({ ...post })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const ta = { ...S.input, minHeight: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, overflow: 'auto', padding: 20 }} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 680, margin: '40px auto' }} onClick={e => e.stopPropagation()}>
        <div style={S.cardTitle}>{post._new ? 'Новый пост' : `Редактировать: ${post.slug}`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {post._new && (
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Slug (URL)
              <input style={{ ...S.input, marginTop: 4 }} value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="my-post-slug" />
            </label>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Заголовок RU
              <input style={{ ...S.input, marginTop: 4 }} value={form.title_ru} onChange={e => set('title_ru', e.target.value)} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Заголовок EN
              <input style={{ ...S.input, marginTop: 4 }} value={form.title_en || ''} onChange={e => set('title_en', e.target.value)} />
            </label>
          </div>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Текст RU
            <textarea style={{ ...ta, marginTop: 4 }} value={form.body_ru} onChange={e => set('body_ru', e.target.value)} />
          </label>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Текст EN
            <textarea style={{ ...ta, marginTop: 4 }} value={form.body_en || ''} onChange={e => set('body_en', e.target.value)} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Тег
              <select style={{ ...S.input, marginTop: 4 }} value={form.tag} onChange={e => set('tag', e.target.value)}>
                <option value="update">update</option>
                <option value="release">release</option>
                <option value="ai">ai</option>
                <option value="feature">feature</option>
                <option value="guide">guide</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" checked={!!form.pinned} onChange={e => set('pinned', e.target.checked ? 1 : 0)} />
              Закреплён
            </label>
            <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" checked={form.published !== 0} onChange={e => set('published', e.target.checked ? 1 : 0)} />
              Опубликован
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={S.btn()} onClick={onClose}>Отмена</button>
          <button style={S.btn('primary')} onClick={() => onSave(form)}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

// ═══ ROOMS ═══
function RoomsTab() {
  const [data, setData] = useState(null)
  const [auto, setAuto] = useState(true)

  function load() { api('/admin/rooms').then(setData) }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!auto) return
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [auto])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <button style={S.btn()} onClick={load}>Обновить</button>
        <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          Автообновление (5с)
        </label>
        {data && <span style={{ fontSize: 12, color: 'var(--ink3)' }}>В очереди: {data.queueLength}</span>}
      </div>

      <div style={S.card}>
        {!data?.rooms?.length ? (
          <div style={S.emptyState}>Нет активных комнат</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Режим</th>
                <th style={S.th}>Игроки</th>
                <th style={S.th}>Состояние</th>
                <th style={S.th}>Счёт</th>
                <th style={S.th}>Партия</th>
                <th style={S.th}>Возраст</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map(r => (
                <tr key={r.id}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{r.id}</td>
                  <td style={S.td}><span style={S.badge('var(--p1)')}>{r.mode}</span></td>
                  <td style={{ ...S.td, color: 'var(--ink)' }}>{r.players.join(' vs ') || 'ожидание'}</td>
                  <td style={S.td}><span style={S.badge(r.state === 'playing' ? 'var(--green)' : 'var(--gold)')}>{r.state}</span></td>
                  <td style={S.td}>{r.scores.join(' : ')}</td>
                  <td style={S.td}>{r.currentGame}/{r.totalGames}</td>
                  <td style={S.td}>{r.ageMin}м</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══ SERVER ═══
function ServerTab() {
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

// ═══ ACHIEVEMENTS ═══
function AchievementsTab() {
  const [stats, setStats] = useState([])
  useEffect(() => { api('/admin/achievements').then(setStats) }, [])

  const ACHIEVEMENT_NAMES = {
    first_win: 'Первая победа', perfect: 'Идеальная', perfect_3: '3 идеальных', fast_win: 'Молния',
    fast_win_5: '5 молний', streak_3: 'Серия 3', streak_5: 'Серия 5', streak_10: 'Серия 10',
    streak_20: 'Бессмертный', golden_1: 'Золотая', golden_10: '10 золотых', golden_50: '50 золотых',
    comeback: 'Камбэк', comeback_5: '5 камбэков', games_10: '10 партий', games_50: '50 партий',
    games_100: '100 партий', games_500: '500 партий', rating_1200: 'Рейтинг 1200',
    rating_1500: 'Рейтинг 1500', rating_1800: 'Гроссмейстер', rating_2000: 'Легенда',
    beat_hard: 'Победил Hard AI', online_win: 'Онлайн победа', online_10: '10 онлайн', puzzle_10: '10 пазлов',
  }
  const TIERS = {
    first_win: 'var(--bronze)', streak_3: 'var(--bronze)', golden_1: 'var(--bronze)', comeback: 'var(--bronze)', games_10: 'var(--bronze)',
    perfect: 'var(--silver)', streak_5: 'var(--silver)', golden_10: 'var(--silver)', games_50: 'var(--silver)', fast_win: 'var(--silver)',
    rating_1200: 'var(--silver)', beat_hard: 'var(--silver)', online_win: 'var(--silver)',
    streak_10: 'var(--gold)', perfect_3: 'var(--gold)', golden_50: 'var(--gold)', comeback_5: 'var(--gold)', games_100: 'var(--gold)',
    rating_1500: 'var(--gold)', fast_win_5: 'var(--gold)', online_10: 'var(--gold)', puzzle_10: 'var(--gold)',
    streak_20: '#b9f2ff', games_500: '#b9f2ff', rating_1800: '#b9f2ff', rating_2000: '#b9f2ff',
  }

  return (
    <div>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Ачивка</th>
              <th style={S.th}>Тир</th>
              <th style={S.th}>Получили</th>
              <th style={S.th}>Первый</th>
              <th style={S.th}>Последний</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(a => (
              <tr key={a.achievement_id}>
                <td style={{ ...S.td, fontWeight: 500, color: 'var(--ink)' }}>{ACHIEVEMENT_NAMES[a.achievement_id] || a.achievement_id}</td>
                <td style={S.td}>{TIERS[a.achievement_id] || '—'}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--green)' }}>{a.count}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(a.first_unlock)}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(a.last_unlock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stats.length && <div style={S.emptyState}>Ачивки ещё не выдавались</div>}
      </div>
    </div>
  )
}

// ═══ TRAINING ═══
function TrainingTab() {
  const [data, setData] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function load() { api('/admin/training').then(setData) }
  useEffect(() => { load() }, [])

  async function cleanup(days) {
    setDeleting(true)
    const r = await api(`/admin/training?olderThan=${days}`, { method: 'DELETE' })
    alert(`Удалено: ${r.deleted} записей`)
    setDeleting(false)
    load()
  }

  if (!data) return <div style={S.emptyState}>Загрузка...</div>

  return (
    <div>
      <div style={S.grid(4)}>
        <Metric value={fmtNum(data.total)} label="Всего записей" color="var(--p1)" />
        <Metric value={`${data.sizeMB}MB`} label="Размер данных" color="var(--accent)" />
        {data.byMode.map(m => (
          <Metric key={m.mode} value={m.count} label={m.mode || 'unknown'} color="var(--green)" sub={`~${Math.round(m.avgMoves)} ходов/игра`} />
        ))}
      </div>

      {data.byDay.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.cardTitle}>Сбор данных (30 дней)</div>
          <MiniBarChart data={data.byDay} color="var(--p1)" />
        </div>
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.cardTitle}>Очистка</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('danger')} disabled={deleting} onClick={() => cleanup(90)}>Старше 90 дней</button>
          <button style={S.btn('danger')} disabled={deleting} onClick={() => cleanup(30)}>Старше 30 дней</button>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.cardTitle}>Доучивание GPU-нейросети</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.8 }}>
          <p>Данные партий игроков используются для дообучения AI. Текущая сеть: <b>ResNet 840K params (v500)</b></p>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 14px', margin: '10px 0', fontFamily: 'monospace', fontSize: 11, color: '#a8a4b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
{`# 1. Скачать БД с VPS
scp root@178.212.12.71:/opt/stolbiki-api/data/stolbiki.db .

# 2. Запустить доучивание (Windows, нужен PyTorch + NVIDIA GPU)
cd gpu_train
py -3.12 retrain.py --db stolbiki.db --model gpu_checkpoint/model_v500.pt

# 3. Скрипт автоматически:
#    - Загрузит партии из БД
#    - Закодирует позиции (107 фич)
#    - Дообучит сеть (30 эпох)
#    - Экспортирует gpu_weights.json

# 4. Задеплоить новые веса
cd ..
git add src/engine/gpu_weights.json
git commit -m "update: AI дообучен на N партиях игроков"
git push`}
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink3)' }}>Или через API (без скачивания БД):</p>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#a8a4b8', whiteSpace: 'pre-wrap' }}>
{`py -3.12 retrain.py --url https://snatch-highrise.com --token ВАШ_JWT_ТОКЕН`}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══ SEASONS ═══
function SeasonsTab() {
  const [seasons, setSeasons] = useState([])
  function load() { api('/admin/seasons').then(setSeasons) }
  useEffect(() => { load() }, [])

  async function toggle(id, active) {
    await api(`/admin/seasons/${id}`, { method: 'PUT', body: JSON.stringify({ active: !active }) })
    load()
  }

  return (
    <div>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Название</th>
              <th style={S.th}>Начало</th>
              <th style={S.th}>Конец</th>
              <th style={S.th}>Статус</th>
              <th style={S.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map(s => (
              <tr key={s.id}>
                <td style={{ ...S.td, fontSize: 11, color: 'var(--ink3)' }}>{s.id}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</td>
                <td style={S.td}>{s.start_date}</td>
                <td style={S.td}>{s.end_date}</td>
                <td style={S.td}>
                  <span style={S.badge(s.active ? 'var(--green)' : 'var(--ink3)')}>{s.active ? 'Активен' : 'Завершён'}</span>
                </td>
                <td style={S.td}>
                  <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => toggle(s.id, s.active)}>
                    {s.active ? 'Завершить' : 'Активировать'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!seasons.length && <div style={S.emptyState}>Сезонов пока нет</div>}
      </div>
    </div>
  )
}

// ═══ КОНТЕНТ (CMS) ═══
function ContentTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [search, setSearch] = useState('')
  const [edited, setEdited] = useState({})

  useEffect(() => {
    fetch('/api/admin/content', { headers: { 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` } })
      .then(r => r.json()).then(data => {
        setItems(data)
        const sections = [...new Set(data.map(i => i.section))]
        if (sections.length) setActiveSection(sections[0])
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  const sections = [...new Set(items.map(i => i.section))]
  const filtered = items.filter(i => {
    if (activeSection && i.section !== activeSection) return false
    if (search) {
      const q = search.toLowerCase()
      return i.label?.toLowerCase().includes(q) || i.value_ru.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    }
    return true
  })

  function handleChange(key, field, value) {
    setEdited(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function saveItem(key) {
    const item = items.find(i => i.key === key)
    const edits = edited[key] || {}
    const body = {
      value_ru: edits.value_ru !== undefined ? edits.value_ru : item.value_ru,
      value_en: edits.value_en !== undefined ? edits.value_en : item.value_en,
    }
    setSaving(key)
    try {
      await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify(body),
      })
      setItems(prev => prev.map(i => i.key === key ? { ...i, ...body } : i))
      setEdited(prev => { const n = { ...prev }; delete n[key]; return n })
      localStorage.removeItem('stolbiki_content')
    } catch {}
    setSaving(null)
  }

  async function saveAll() { for (const key of Object.keys(edited)) await saveItem(key) }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>Загрузка...</div>

  const hasEdits = Object.keys(edited).length > 0

  return (
    <div>
      {/* Вкладки по секциям */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: activeSection === s ? 'var(--accent)' : 'var(--surface2)',
            color: activeSection === s ? '#fff' : 'var(--ink3)',
          }}>{s} ({items.filter(i => i.section === s).length})</button>
        ))}
      </div>

      {/* Поиск + сохранить */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по описанию или тексту..."
          style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13 }} />
        {hasEdits && (
          <button onClick={saveAll} style={{
            padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>Сохранить ({Object.keys(edited).length})</button>
        )}
      </div>

      {/* Карточки */}
      {filtered.map(item => {
        const e = edited[item.key] || {}
        const ruVal = e.value_ru !== undefined ? e.value_ru : item.value_ru
        const enVal = e.value_en !== undefined ? e.value_en : item.value_en
        const isChanged = item.key in edited
        const long = (item.value_ru + item.value_en).length > 120

        return (
          <div key={item.key} style={{
            padding: '14px 18px', marginBottom: 10, borderRadius: 12,
            background: isChanged ? 'rgba(240,96,64,0.05)' : 'var(--surface)',
            border: `1px solid ${isChanged ? 'rgba(240,96,64,0.2)' : 'var(--surface3)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.label || item.key}</span>
              {isChanged && (
                <button onClick={() => saveItem(item.key)} disabled={saving === item.key}
                  style={{ padding: '4px 14px', borderRadius: 6, background: 'var(--green)', color: '#000', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {saving === item.key ? '...' : 'Сохранить'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--p2)', marginBottom: 4, fontWeight: 600 }}>Русский</div>
                {long ? (
                  <textarea value={ruVal} onChange={e2 => handleChange(item.key, 'value_ru', e2.target.value)} rows={3}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                ) : (
                  <input value={ruVal} onChange={e2 => handleChange(item.key, 'value_ru', e2.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13 }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--p1)', marginBottom: 4, fontWeight: 600 }}>English</div>
                {long ? (
                  <textarea value={enVal} onChange={e2 => handleChange(item.key, 'value_en', e2.target.value)} rows={3}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                ) : (
                  <input value={enVal} onChange={e2 => handleChange(item.key, 'value_en', e2.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13 }} />
                )}
              </div>
            </div>
          </div>
        )
      })}
      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>Ничего не найдено</div>}
    </div>
  )
}

// ═══ MAIN ═══
// ═══ Рефералы ═══
function ReferralsTab() {
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

// ═══ Вызовы (Challenges) ═══
function ChallengesTab() {
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

// ═══ Аналитика поведения ═══
function AnalyticsTab() {
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

export default function Admin() {
  const [tab, setTab] = useState('overview')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (isMobile) {
    return (
      <div>
        {/* Горизонтальные табы на мобилке */}
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 12px',
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'var(--accent)' : 'var(--surface2)',
              color: tab === t.id ? '#fff' : 'var(--ink3)',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--ink)' }}>
          {TABS.find(t => t.id === tab)?.label}
        </h2>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'games' && <GamesTab />}
        {tab === 'blog' && <BlogTab />}
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'achievements' && <AchievementsTab />}
        {tab === 'seasons' && <SeasonsTab />}
        {tab === 'training' && <TrainingTab />}
        {tab === 'referrals' && <ReferralsTab />}
        {tab === 'challenges' && <ChallengesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'server' && <ServerTab />}
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <aside style={S.sidebar}>
        <div style={S.sideTitle}>Админ-панель</div>
        {TABS.map(t => (
          <button key={t.id} style={S.sideBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </aside>
      <main style={S.main}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--ink)' }}>
          {TABS.find(t => t.id === tab)?.label}
        </h2>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'games' && <GamesTab />}
        {tab === 'blog' && <BlogTab />}
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'achievements' && <AchievementsTab />}
        {tab === 'seasons' && <SeasonsTab />}
        {tab === 'training' && <TrainingTab />}
        {tab === 'referrals' && <ReferralsTab />}
        {tab === 'challenges' && <ChallengesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'server' && <ServerTab />}
      </main>
    </div>
  )
}
