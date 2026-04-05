import { useCallback, useEffect, useRef, useState } from 'react'
import { Confirm, Pagination, S, ago, api } from './_shared'

export function UsersTab() {
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
