/**
 * Вкладка Ачивки — прогресс, unlocked/locked с rarity.
 */

import { ALL_ACHIEVEMENTS, RARITY_COLORS, RARITY_LABELS_RU, RARITY_LABELS_EN } from './_constants'
import { AchievementCard } from './_helpers'

export default function ProfileAchievements({ profile, en }) {
  const unlockedAch = ALL_ACHIEVEMENTS.filter(a => profile.achievements.includes(a.id))
  const lockedAch = ALL_ACHIEVEMENTS.filter(a => !profile.achievements.includes(a.id))

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--gold)' }}>{unlockedAch.length}</div>
        <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
          {en ? 'of' : 'из'} {ALL_ACHIEVEMENTS.length} {en ? 'achievements' : 'ачивок'}
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: `${unlockedAch.length / ALL_ACHIEVEMENTS.length * 100}%`, height: '100%',
            background: 'linear-gradient(90deg, #ffc145, #3bb8a8)', borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(RARITY_COLORS).map(([rarity, color]) => (
            <span key={rarity} style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {en ? RARITY_LABELS_EN[rarity] : RARITY_LABELS_RU[rarity]}
            </span>
          ))}
        </div>
      </div>

      {unlockedAch.length > 0 && (
        <div className="dash-card" style={{ marginBottom: 16 }}>
          <h3 style={{ color: 'var(--green)' }}>{en ? 'Unlocked' : 'Разблокированные'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
            {unlockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked profile={profile} en={en} />)}
          </div>
        </div>
      )}

      <div className="dash-card">
        <h3>{en ? 'Locked' : 'Заблокированные'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
          {lockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked={false} profile={profile} en={en} />)}
        </div>
      </div>
    </div>
  )
}
