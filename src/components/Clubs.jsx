/**
 * Clubs — клубы/гильдии
 * Issue #8: Sprint 5
 *
 * Экраны: list → detail | create | my
 *
 * 26.04.2026 — фикс по обратной связи Александра:
 * "Clubs: ширину окошка сделать как в других разделах". Раньше Card
 * имел жёсткий maxWidth: 600 — на широких экранах был узким окошком,
 * не таким как другие вкладки профиля (где ширина = ширине контейнера).
 * Убрали maxWidth, оставили margin: 12px auto на случай standalone-рендера.
 */
import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../engine/i18n'

const API = (path, opts = {}) => {
  const token = localStorage.getItem('stolbiki_token')
  return fetch(`/api/clubs${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(r => r.json())
}

const EMBLEMS = ['raccoon', 'tower', 'brick', 'crown', 'star', 'lightning', 'shield', 'fire']
const EMBLEM_EMOJI = { raccoon: '🦝', tower: '🏗', brick: '🧱', crown: '👑', star: '⭐', lightning: '⚡', shield: '🛡', fire: '🔥' }

const ROLE_LABELS_RU = { owner: 'Владелец', officer: 'Офицер', member: 'Участник' }
const ROLE_LABELS_EN = { owner: 'Owner', officer: 'Officer', member: 'Member' }
const ROLE_COLOR = { owner: 'var(--gold)', officer: '#9b59b6', member: 'var(--ink3)' }

// Card раньше имел maxWidth: 600 — на десктопе выглядел узким "окошком" в
// отличие от других вкладок профиля (full-width). Теперь ширина = ширине
// родителя (Profile-tab контейнера) — выглядит единообразно.
function Card({ children, style }) {
  return <div className="dash-card" style={{ margin: '12px auto', ...style }}>{children}</div>
}

export default function Clubs() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [screen, setScreen] = useState('list') // list | detail | create
  const [clubs, setClubs] = useState([])
  const [myClub, setMyClub] = useState(null)
  const [myRole, setMyRole] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Create form
  const [form, setForm] = useState({ name: '', tag: '', description: '', emblem_id: 'raccoon' })
  const isLoggedIn = !!localStorage.getItem('stolbiki_token')

  const loadList = useCallback(async () => {
    setLoading(true)
    const data = await API('/').catch(() => [])
    setClubs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  const loadMy = useCallback(async () => {
    if (!isLoggedIn) return
    const data = await API('/my').catch(() => null)
    if (data?.club) { setMyClub(data.club); setMyRole(data.role) }
    else { setMyClub(null); setMyRole(null) }
  }, [isLoggedIn])

  useEffect(() => { loadList(); loadMy() }, [])

  const openDetail = async (id) => {
    setLoading(true)
    const data = await API(`/${id}`).catch(() => null)
    if (data?.id) { setSelected(data); setScreen('detail') }
    setLoading(false)
  }

  const createClub = async () => {
    if (!form.name.trim() || !form.tag.trim()) { setError(en ? 'Name and tag required' : 'Имя и тег обязательны'); return }
    setError(''); setLoading(true)
    const data = await API('/', { method: 'POST', body: form })
    setLoading(false)
    if (data.ok) { await loadMy(); await loadList(); setScreen('list') }
    else setError(data.error || 'Ошибка')
  }

  const join = async (id) => {
    const data = await API(`/${id}/join`, { method: 'POST' })
    if (data.ok) { await loadMy(); openDetail(id) }
    else setError(data.error || 'Ошибка')
  }

  const leave = async () => {
    if (!myClub) return
    const data = await API(`/${myClub.id}/leave`, { method: 'POST' })
    if (data.ok) { setMyClub(null); setMyRole(null); await loadList(); setScreen('list') }
    else setError(data.error || 'Ошибка')
  }

  const kick = async (userId) => {
    if (!selected) return
    const data = await API(`/${selected.id}/kick/${userId}`, { method: 'DELETE' })
    if (data.ok) openDetail(selected.id)
    else setError(data.error || 'Ошибка')
  }

  // ─── LIST ───
  if (screen === 'list') return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>{en ? 'Clubs' : 'Клубы'}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {myClub && (
              <button className="btn primary" onClick={() => openDetail(myClub.id)} style={{ fontSize: 12 }}>
                {EMBLEM_EMOJI[myClub.emblem_id] || '🦝'} [{myClub.tag}] {myClub.name}
              </button>
            )}
            {!myClub && isLoggedIn && (
              <button className="btn" onClick={() => { setScreen('create'); setError('') }} style={{ fontSize: 12 }}>
                + {en ? 'Create' : 'Создать'}
              </button>
            )}
            <button className="btn" onClick={loadList} style={{ fontSize: 11, padding: '6px 10px' }}>↺</button>
          </div>
        </div>

        {error && <div style={{ color: 'var(--p2)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        {loading && <div style={{ textAlign: 'center', color: 'var(--ink3)', padding: 20 }}>...</div>}

        {!loading && clubs.length === 0 && (
          <p style={{ color: 'var(--ink3)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            {en ? 'No clubs yet — be the first!' : 'Клубов пока нет — создай первым!'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clubs.map((c, i) => (
            <div key={c.id} onClick={() => openDetail(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface2)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{EMBLEM_EMOJI[c.emblem_id] || '🦝'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(59,184,168,0.1)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>[{c.tag}]</span>
                  {i === 0 && <span style={{ fontSize: 9, color: 'var(--gold)', background: 'rgba(255,193,69,0.1)', padding: '1px 6px', borderRadius: 4 }}>#{en ? '1' : '1'} 🏆</span>}
                </div>
                {c.description && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 12, flexShrink: 0, fontSize: 11, color: 'var(--ink3)' }}>
                <span>👥 {c.member_count}</span>
                <span>🏆 {c.total_wins}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )

  // ─── CREATE ───
  if (screen === 'create') return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn" onClick={() => setScreen('list')} style={{ fontSize: 11, padding: '5px 10px' }}>←</button>
        <h3 style={{ margin: 0, fontSize: 16 }}>{en ? 'Create Club' : 'Создать клуб'}</h3>
      </div>

      {error && <div style={{ color: 'var(--p2)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value.slice(0, 32) }))}
          placeholder={en ? 'Club name (3–32)' : 'Название клуба (3–32)'}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--surface2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 }} />

        <input value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) }))}
          placeholder={en ? 'Tag [2–5 chars, A-Z0-9]' : 'Тег [2–5 символов, A-Z0-9]'}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--surface2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 18, letterSpacing: 4, fontWeight: 700, textAlign: 'center' }} />

        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value.slice(0, 200) }))}
          placeholder={en ? 'Description (optional)' : 'Описание (необязательно)'}
          rows={2}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--surface2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, resize: 'none', fontFamily: 'inherit' }} />

        <div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>{en ? 'Emblem' : 'Эмблема'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EMBLEMS.map(e => (
              <button key={e} onClick={() => setForm(p => ({ ...p, emblem_id: e }))}
                style={{ fontSize: 24, padding: '6px 10px', borderRadius: 8, border: `2px solid ${form.emblem_id === e ? 'var(--accent)' : 'var(--surface2)'}`, background: form.emblem_id === e ? 'rgba(59,184,168,0.08)' : 'var(--surface)', cursor: 'pointer' }}>
                {EMBLEM_EMOJI[e]}
              </button>
            ))}
          </div>
        </div>

        <button className="btn primary" onClick={createClub} disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 0', marginTop: 4 }}>
          {loading ? '...' : (en ? 'Create Club' : 'Создать клуб')}
        </button>
      </div>
    </Card>
  )

  // ─── DETAIL ───
  if (screen === 'detail' && selected) {
    const isMember = isLoggedIn && myClub?.id === selected.id
    const canManage = isMember && ['owner', 'officer'].includes(myRole)
    const members = selected.members || []

    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn" onClick={() => { setScreen('list'); setSelected(null) }} style={{ fontSize: 11, padding: '5px 10px' }}>←</button>
          <span style={{ fontSize: 28 }}>{EMBLEM_EMOJI[selected.emblem_id] || '🦝'}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{selected.name}</h3>
              <span style={{ fontSize: 11, color: 'var(--accent)', background: 'rgba(59,184,168,0.1)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>[{selected.tag}]</span>
            </div>
            {selected.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink3)' }}>{selected.description}</p>}
          </div>
        </div>

        {/* Статистика */}
        <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: '1px solid var(--surface2)', borderBottom: '1px solid var(--surface2)', marginBottom: 16 }}>
          {[['👥', selected.member_count, en ? 'Members' : 'Участников'], ['🏆', selected.total_wins, en ? 'Wins' : 'Побед'], ['🎖', members.find(m => m.role === 'owner')?.username || '—', en ? 'Leader' : 'Лидер']].map(([icon, val, label]) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 16 }}>{icon} <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{val}</span></div>
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ color: 'var(--p2)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {/* Кнопки вступления */}
        {isLoggedIn && !isMember && !myClub && (
          <button className="btn primary" onClick={() => join(selected.id)}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
            {en ? 'Join Club' : 'Вступить в клуб'}
          </button>
        )}
        {isMember && myRole !== 'owner' && (
          <button className="btn" onClick={leave}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 16, borderColor: '#ff606640', color: 'var(--p2)' }}>
            {en ? 'Leave Club' : 'Покинуть клуб'}
          </button>
        )}

        {/* Список участников */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>
          {en ? 'Members' : 'Участники'} ({members.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map(m => (
            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: m.role === 'owner' ? 700 : 400 }}>{m.username}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: ROLE_COLOR[m.role], letterSpacing: 0.5 }}>
                  {en ? ROLE_LABELS_EN[m.role] : ROLE_LABELS_RU[m.role]}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--ink3)' }}>⭐ {m.rating}</span>
                {canManage && m.role !== 'owner' && (
                  <button onClick={() => kick(m.user_id)}
                    style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid #ff606620', background: 'transparent', color: 'var(--p2)', cursor: 'pointer' }}>
                    {en ? 'Kick' : 'Кик'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return null
}
