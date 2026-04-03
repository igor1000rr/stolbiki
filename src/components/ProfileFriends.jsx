/**
 * ProfileFriends — поиск, запросы, список друзей
 * Извлечён из Profile.jsx
 */

import { useState } from 'react'
import * as API from '../engine/api'

export default function ProfileFriends({ en, serverOnline, friendsList, pendingFriends, onRefresh, onError }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])

  async function doSearch() {
    if (!search.trim() || search.length < 2 || !serverOnline) return
    try { setResults(await API.searchUsers(search)) } catch { setResults([]) }
  }

  async function doAdd(username) {
    if (!serverOnline) return
    try {
      await API.sendFriendRequest(username)
      setResults(prev => prev.filter(u => u.username !== username))
    } catch (e) { onError?.(e.message) }
  }

  async function doAccept(userId) {
    if (!serverOnline) return
    try { await API.acceptFriend(userId); onRefresh?.() } catch {}
  }

  async function doDecline(userId) {
    if (!serverOnline) return
    try { await API.declineFriend(userId); onRefresh?.() } catch {}
  }

  async function doRemove(userId) {
    if (!serverOnline) return
    try { await API.removeFriend(userId); onRefresh?.() } catch {}
  }

  return (
    <div>
      {/* Поиск */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>{en ? 'Find friends' : 'Найти друзей'}</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input type="text" placeholder={en ? 'Username...' : 'Введите никнейм...'} value={search}
            onChange={e => {
              setSearch(e.target.value)
              const q = e.target.value.trim()
              if (q.length >= 2 && serverOnline) {
                clearTimeout(window._friendSearchTimer)
                window._friendSearchTimer = setTimeout(() => API.searchUsers(q).then(setResults).catch(() => {}), 500)
              } else { setResults([]) }
            }}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #36364a',
              background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }} />
          <button className="btn primary" style={{ padding: '8px 16px' }} onClick={doSearch}>
            {en ? 'Find' : 'Найти'}
          </button>
        </div>
        {!serverOnline && <p style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 8 }}>{en ? 'Search requires server connection' : 'Поиск доступен при подключённом сервере'}</p>}
        {results.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {results.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6db4ff, #9b59b6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{u.username}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Rating' : 'Рейтинг'}: {u.rating}</div>
                </div>
                <button className="btn" style={{ fontSize: 11, padding: '4px 12px', minHeight: 28 }}
                  onClick={() => doAdd(u.username)}>+ {en ? 'Add' : 'Добавить'}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Входящие запросы */}
      {pendingFriends.length > 0 && (
        <div className="dash-card" style={{ marginBottom: 16 }}>
          <h3>{en ? 'Friend requests' : 'Запросы в друзья'} ({pendingFriends.length})</h3>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {pendingFriends.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: 'rgba(61,214,140,0.04)', borderRadius: 8, border: '1px solid rgba(61,214,140,0.1)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{u.username}</span>
                <button className="btn primary" style={{ fontSize: 11, padding: '4px 12px', minHeight: 28 }}
                  onClick={() => doAccept(u.id)}>{en ? 'Accept' : 'Принять'}</button>
                <button className="btn" style={{ fontSize: 11, padding: '4px 10px', minHeight: 28, opacity: 0.6 }}
                  onClick={() => doDecline(u.id)} aria-label={en ? 'Decline' : 'Отклонить'}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Список друзей */}
      <div className="dash-card">
        <h3>{en ? 'My friends' : 'Мои друзья'} ({friendsList.length})</h3>
        {friendsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink3)' }}>
            <div style={{ fontSize: 13 }}>{en ? 'No friends yet. Search by username!' : 'Пока нет друзей. Найдите игроков по нику!'}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {friendsList.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6db4ff, #9b59b6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {f.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{f.username}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)' }}>⭐ {f.rating}</div>
                </div>
                <button className="btn" style={{ fontSize: 10, padding: '3px 8px', minHeight: 24, opacity: 0.3 }}
                  onClick={() => { if (confirm(en ? `Remove ${f.username}?` : `Удалить ${f.username}?`)) doRemove(f.id) }}
                  title={en ? 'Remove friend' : 'Удалить из друзей'}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
