/**
 * Вкладка Ачивки — прогресс, unlocked/locked с сортировкой по rarity.
 * Issue #6: rarity UI (glow, breakdown, сортировка) + живой % держателей
 * через useAchievementRarity hook (enrich ach.holders из /api/achievements/rarity).
 */

import { ALL_ACHIEVEMENTS, RARITY_COLORS, RARITY_LABELS_RU, RARITY_LABELS_EN } from './_constants'
import { AchievementCard } from './_helpers'
import { useAchievementRarity } from '../../engine/useAchievementRarity'

// Порядок rarity для сортировки: легендарные первыми
const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

function sortByRarity(arr) {
  return [...arr].sort((a, b) => {
    const ra = RARITY_ORDER[a.rarity || 'common']
    const rb = RARITY_ORDER[b.rarity || 'common']
    if (ra !== rb) return ra - rb
    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function ProfileAchievements({ profile, en }) {
  const { getRarity } = useAchievementRarity()

  // Обогащаем каждую ачивку живым % держателей с сервера.
  // Если сервер ещё не ответил / ачивку никто не получил — fallback на статическое
  // значение из _constants.js (ach.holders, если там есть), иначе поле undefined
  // и AchievementCard его просто не рендерит.
  const enrich = (a) => {
    const live = getRarity(a.id)
    if (live && typeof live.percentage === 'number') {
      return { ...a, holders: live.percentage }
    }
    return a
  }

  const unlockedAch = sortByRarity(
    ALL_ACHIEVEMENTS.filter(a => profile.achievements.includes(a.id)).map(enrich)
  )
  const lockedAch = sortByRarity(
    ALL_ACHIEVEMENTS.filter(a => !profile.achievements.includes(a.id)).map(enrich)
  )

  // Breakdown: сколько из каждого rarity открыто / всего
  const breakdown = Object.keys(RARITY_COLORS).map(rarity => {
    const total = ALL_ACHIEVEMENTS.filter(a => (a.rarity || 'common') === rarity).length
    const open = unlockedAch.filter(a => (a.rarity || 'common') === rarity).length
    return { rarity, color: RARITY_COLORS[rarity], total, open,
      label: en ? RARITY_LABELS_EN[rarity] : RARITY_LABELS_RU[rarity] }
  })

  return (
    <div>
      {/* Keyframes для легендарной анимации */}
      <style>{`
        @keyframes ach-legendary-pulse {
          0%, 100% { box-shadow: 0 0 22px rgba(255,193,69,0.45), inset 0 0 14px rgba(255,193,69,0.15); }
          50%      { box-shadow: 0 0 32px rgba(255,193,69,0.75), inset 0 0 18px rgba(255,193,69,0.25); }
        }
        .ach-card-legendary { animation: ach-legendary-pulse 2.8s ease-in-out infinite; }
      `}</style>

      <div className="dash-card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--gold)' }}>{unlockedAch.length}</div>
        <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
          {en ? 'of' : 'из'} {ALL_ACHIEVEMENTS.length} {en ? 'achievements' : 'ачивок'}
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: `${unlockedAch.length / ALL_ACHIEVEMENTS.length * 100}%`, height: '100%',
            background: 'linear-gradient(90deg, #ffc145, #3bb8a8)', borderRadius: 3 }} />
        </div>

        {/* Breakdown по rarity с счётчиками */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
          {breakdown.map(b => (
            <div key={b.rarity} style={{
              padding: '8px 6px', borderRadius: 8,
              background: `${b.color}10`,
              border: `1px solid ${b.color}25`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: b.color }}>
                {b.open}<span style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 400 }}>/{b.total}</span>
              </div>
              <div style={{ fontSize: 9, color: b.color, opacity: 0.85, marginTop: 2,
                textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {b.label}
              </div>
            </div>
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
