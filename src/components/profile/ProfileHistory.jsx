/**
 * Вкладка История партий.
 */

import Mascot from '../Mascot'

export default function ProfileHistory({ profile, en }) {
  const history = profile.history || []

  if (history.length === 0) {
    return (
      <div className="dash-card" style={{ textAlign: 'center', padding: 32 }}>
        <Mascot pose="wave" size={80} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, color: 'var(--ink3)' }}>
          {en ? 'No games yet. Play your first!' : 'Пока нет партий. Сыграйте свою первую!'}
        </div>
      </div>
    )
  }

  return (
    <div className="dash-card">
      <h3>{en ? 'Recent games' : 'Последние партии'}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {history.map((h, i) => {
          const dt = new Date(h.date)
          const timeStr = dt.toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })
            + ' ' + dt.toLocaleTimeString(en ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: h.won ? 'rgba(61,214,140,0.04)' : 'rgba(255,96,102,0.04)',
              borderRadius: 8, border: `1px solid ${h.won ? 'rgba(61,214,140,0.12)' : 'rgba(255,96,102,0.12)'}` }}>
              <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {h.won
                  ? <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#3dd68c" strokeWidth="2.5"><path d="M4 10l4 4L16 6"/></svg>
                  : <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#ff6066" strokeWidth="2.5"><path d="M5 5l10 10M15 5L5 15"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: h.won ? 'var(--green)' : 'var(--p2)' }}>
                  {h.won ? (en ? 'Win' : 'Победа') : (en ? 'Loss' : 'Поражение')} · {h.score}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>
                  {timeStr}
                  {h.vsHardAi && ' · ' + (en ? 'Hard' : 'Сложная')}
                  {h.closedGolden && ' · ' + (en ? 'Golden' : 'Золотая')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: h.ratingDelta > 0 ? 'var(--green)' : 'var(--p2)' }}>
                  {h.ratingDelta > 0 ? '+' : ''}{h.ratingDelta}
                </div>
                <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{h.ratingAfter}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
