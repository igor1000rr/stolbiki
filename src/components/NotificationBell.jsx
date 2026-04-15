/**
 * Колокольчик с уведомлениями (friend requests + challenges) в десктопном хедере.
 * Раньше был inline в App.jsx (~45 строк JSX-каши).
 *
 * Состояние (count, data, open) живёт в App.jsx — компонент чисто презентационный.
 */
export default function NotificationBell({ count, data, open, onToggle, onClose, onGo, lang }) {
  const en = lang === 'en'
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onToggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', position: 'relative', color: 'var(--ink2)', fontSize: 18 }}
        aria-label="Notifications">
        🔔
        {count > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--p2)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, width: 280, marginTop: 8, background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            {en ? 'Notifications' : 'Уведомления'} {count > 0 && `(${count})`}
          </div>
          {data.challenges.map(ch => (
            <div key={ch.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚔️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--ink)' }}>{ch.from_username}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'challenges you!' : 'вызывает вас!'}</div>
              </div>
              <button className="btn primary" style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => { onGo('online'); window.dispatchEvent(new CustomEvent('stolbiki-deeplink-room', { detail: { room: ch.room_id } })); onClose() }}>
                {en ? 'Accept' : 'Принять'}
              </button>
            </div>
          ))}
          {data.friends.map(f => (
            <div key={f.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>👋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--ink)' }}>{f.username}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'friend request' : 'запрос в друзья'}</div>
              </div>
              <button className="btn primary" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => { onGo('profile'); onClose() }}>
                {en ? 'View' : 'Открыть'}
              </button>
            </div>
          ))}
          {count === 0 && (
            <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
              {en ? 'No new notifications' : 'Нет новых уведомлений'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
