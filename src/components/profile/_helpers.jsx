/**
 * Хелперы профиля — UI-компоненты (AvatarCircle, RatingBadge, AchievementCard,
 * RatingChart, SeasonSection). Извлечено из Profile.jsx.
 */

import { AVATARS, RARITY_COLORS, RARITY_LABELS_RU, RARITY_LABELS_EN, achProgress } from './_constants'

export function AvatarCircle({ avatar, name, size = 56 }) {
  const a = AVATARS[avatar] || AVATARS.default
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: a.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {a.render(name || '?')}
    </div>
  )
}

export function RatingBadge({ rating, en }) {
  let color, label
  if (rating >= 1500) { color = 'var(--gold)'; label = en ? 'Master' : 'Мастер' }
  else if (rating >= 1200) { color = 'var(--purple)'; label = en ? 'Expert' : 'Опытный' }
  else if (rating >= 1000) { color = 'var(--p1)'; label = en ? 'Novice' : 'Новичок' }
  else { color = 'var(--ink3)'; label = en ? 'Beginner' : 'Начинающий' }
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, color, border: `1px solid ${color}33`, background: `${color}11` }}>{label}</span>
}

export function AchievementCard({ ach, unlocked, profile, en }) {
  const [cur, target] = profile ? achProgress(ach.id, profile) : [0, 1]
  const pct = Math.min(cur / target, 1)
  const name = en && ach.nameEn ? ach.nameEn : ach.name
  const desc = en && ach.descEn ? ach.descEn : ach.desc
  const rarityColor = RARITY_COLORS[ach.rarity || 'common']
  const rarityLabel = en ? RARITY_LABELS_EN[ach.rarity || 'common'] : RARITY_LABELS_RU[ach.rarity || 'common']
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: unlocked ? `linear-gradient(135deg, ${ach.color}08, ${ach.color}04)` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${unlocked ? ach.color + '35' : 'var(--surface2)'}`,
      opacity: unlocked ? 1 : 0.5, transition: 'all 0.2s', cursor: 'default', position: 'relative' }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: unlocked ? `linear-gradient(135deg, ${ach.color}30, ${ach.color}15)` : 'var(--surface)',
        border: `2px solid ${unlocked ? ach.color : 'var(--surface3)'}`,
        boxShadow: unlocked ? `0 0 10px ${ach.color}20` : 'none',
        fontSize: 12, fontWeight: 800, color: unlocked ? ach.color : 'var(--ink3)' }}>
        {name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? 'var(--ink)' : 'var(--ink3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {name}
          {ach.rarity && ach.rarity !== 'common' && (
            <span style={{ fontSize: 8, fontWeight: 700, color: rarityColor, letterSpacing: 0.3, opacity: 0.85 }}>
              {rarityLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{desc}</div>
        {ach.holders !== undefined && (
          <div style={{ fontSize: 9, color: rarityColor, opacity: 0.6, marginTop: 1 }}>
            {ach.holders}% {en ? 'of players' : 'игроков'}
          </div>
        )}
        {!unlocked && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 2,
                background: pct > 0.7 ? 'linear-gradient(90deg, #3dd68c, #2ecc71)' : 'linear-gradient(90deg, #6db4ff, #4a9eff)',
                transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--ink3)', minWidth: 30 }}>{Math.min(cur, target)}/{target}</span>
          </div>
        )}
      </div>
      {unlocked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ach.color} strokeWidth="2.5" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>}
    </div>
  )
}

export function RatingChart({ data, en }) {
  if (!data || data.length < 2) return null
  const pts = [...data].reverse().slice(-50)
  const ratings = pts.map(p => p.rating)
  const min = Math.min(...ratings, 950) - 30
  const max = Math.max(...ratings, 1050) + 30
  const w = 100, h = 50
  const points = ratings.map((r, i) => `${((i / (ratings.length - 1)) * w).toFixed(1)},${(h - ((r - min) / (max - min)) * h).toFixed(1)}`).join(' ')
  const lastR = ratings[ratings.length - 1]
  const firstR = ratings[0]
  const color = lastR >= firstR ? 'var(--green)' : 'var(--p2)'
  const tiers = [{ r: 1200, label: '1200', color: 'var(--purple)' }, { r: 1500, label: '1500', color: 'var(--gold)' }, { r: 1800, label: '1800', color: 'var(--p2)' }].filter(t => t.r > min && t.r < max)
  return (
    <div>
      <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ width: '100%', height: 90 }} preserveAspectRatio="none">
        <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {tiers.map(t => { const y = h - ((t.r - min) / (max - min)) * h; return <g key={t.r}><line x1="0" y1={y} x2={w} y2={y} stroke={t.color} strokeWidth="0.3" strokeDasharray="2,2" opacity="0.5" /><text x={w + 1} y={y + 1} fontSize="3" fill={t.color} opacity="0.7">{t.label}</text></g> })}
        <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#rg)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {(() => { const ly = h - ((lastR - min) / (max - min)) * h; return <circle cx={w} cy={ly} r="1.5" fill={color} /> })()}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>
        <span>{firstR}</span>
        <span>{pts.length} {en ? (pts.length === 1 ? 'game' : 'games') : (pts.length === 1 ? 'партия' : 'партий')}</span>
        <span style={{ fontWeight: 600, color }}>{lastR}</span>
      </div>
    </div>
  )
}

export function SeasonSection({ data, myName, en }) {
  if (!data?.season) return null
  const { season, leaderboard } = data
  return (
    <div className="dash-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>{en ? 'Season' : 'Сезон'} {season.name}</h3>
        <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{season.start_date} — {season.end_date}</span>
      </div>
      {leaderboard && leaderboard.length > 0 ? (
        <table className="dash-table" style={{ fontSize: 12 }}>
          <thead><tr><th>#</th><th>{en ? 'Player' : 'Игрок'}</th><th>{en ? 'Rating' : 'Рейтинг'}</th><th>{en ? 'Games' : 'Партий'}</th><th>{en ? 'Wins' : 'Побед'}</th></tr></thead>
          <tbody>
            {leaderboard.map((p, i) => (
              <tr key={i} style={p.username === myName ? { background: 'rgba(74,158,255,0.08)' } : {}}>
                <td style={{ fontWeight: 600, color: i < 3 ? 'var(--gold)' : 'var(--ink3)' }}>{i + 1}</td>
                <td style={{ fontWeight: p.username === myName ? 700 : 400, color: p.username === myName ? 'var(--p1)' : 'var(--ink)' }}>
                  {p.username}{p.level > 1 && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 4, opacity: 0.7 }}>Lv.{p.level}</span>}
                  {p.username === myName && <span style={{ fontSize: 9, color: 'var(--ink3)', marginLeft: 4 }}>({en ? 'you' : 'вы'})</span>}
                </td>
                <td style={{ fontWeight: 600 }}>{p.rating}</td><td>{p.games}</td><td>{p.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', padding: 16 }}>{en ? 'No games this season yet' : 'Партий в этом сезоне пока нет'}</div>
      )}
    </div>
  )
}
