/**
 * Вкладка Рейтинг — глобальный + среди друзей.
 */

import { FAKE_LEADERBOARD } from './_constants'

export default function ProfileLeaderboard({ profile, serverLeaderboard, friendsList, serverOnline, gameCtx, en }) {
  const leaderboard = serverLeaderboard
    ? serverLeaderboard.map(u => ({ ...u, name: u.username, games: u.games, isMe: u.username === profile.name }))
    : [...FAKE_LEADERBOARD, { name: profile.name, rating: profile.rating, wins: profile.wins, games: profile.gamesPlayed, isMe: true }]
        .sort((a, b) => b.rating - a.rating)

  const friendsRanking = friendsList.length > 0
    ? [...(profile ? [{ username: profile.name || profile.username, rating: profile.rating || 1000, isMe: true }] : []),
       ...friendsList.map(f => ({ username: f.username, rating: f.rating, isMe: false }))]
        .sort((a, b) => b.rating - a.rating)
    : []

  return (
    <>
      {friendsRanking.length > 0 && (
        <div className="dash-card" style={{ marginBottom: 16 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥</span> {en ? 'Friends ranking' : 'Среди друзей'}
          </h3>
          <div style={{ marginTop: 8 }}>
            {friendsRanking.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: p.isMe ? 'rgba(74,158,255,0.08)' : 'transparent',
                borderBottom: '1px solid var(--surface2)',
                borderRadius: p.isMe ? 8 : 0,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700,
                  color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--ink3)',
                  minWidth: 24 }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: 13, color: p.isMe ? 'var(--p1-light)' : 'var(--ink)', fontWeight: p.isMe ? 700 : 400 }}>
                  {p.username} {p.isMe && <span style={{ fontSize: 9, color: 'var(--ink3)' }}>({en ? 'you' : 'вы'})</span>}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-card">
        <h3>{en ? 'Leaderboard' : 'Рейтинг игроков'}</h3>
        <table className="dash-table" style={{ marginTop: 8, fontSize: 12 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>{en ? 'Player' : 'Игрок'}</th>
              <th>{en ? 'Rating' : 'Рейтинг'}</th>
              <th>{en ? 'Wins' : 'Побед'}</th>
              <th>{en ? 'Games' : 'Партий'}</th>
              <th>WR</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((p, i) => (
              <tr key={i} style={p.isMe ? { background: 'rgba(74,158,255,0.08)' } : {}}>
                <td style={{ fontWeight: 600, color: i < 3 ? 'var(--gold)' : 'var(--ink3)' }}>{i + 1}</td>
                <td style={{ fontWeight: p.isMe ? 700 : 400, color: p.isMe ? 'var(--p1-light)' : 'var(--ink)' }}>
                  {!p.isMe && serverOnline
                    ? <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.15)' }}
                        onClick={() => gameCtx?.emit('viewProfile', p.name || p.username)}>{p.name || p.username}</span>
                    : <>{p.name || p.username} {p.isMe && <span style={{ fontSize: 9, color: 'var(--ink3)' }}>({en ? 'you' : 'вы'})</span>}</>}
                </td>
                <td style={{ fontWeight: 600 }}>{p.rating}</td>
                <td>{p.wins}</td>
                <td>{p.games}</td>
                <td>{p.games > 0 ? (p.wins / p.games * 100).toFixed(0) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 8, textAlign: 'center' }}>
          {serverOnline
            ? `${leaderboard.length} ${en ? 'players' : 'игроков'}`
            : (en ? 'Offline — demo data' : 'Оффлайн — демо-данные')}
        </p>
      </div>
    </>
  )
}
