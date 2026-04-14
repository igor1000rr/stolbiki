/**
 * Issue #6 (довесок) — список ачивок в публичном профиле.
 *
 * Компактный рендер с tier-рамкой вокруг эмодзи и tooltip с % держателей.
 * Вынесен в отдельный файл чтобы не раздувать Profile.jsx и чтобы
 * hook useAchievementRarity вызывался только когда публичный профиль виден.
 */

import { useAchievementRarity } from '../../engine/useAchievementRarity'

const TIER_BORDER = {
  legendary: '2px solid #ffc145',     // золото
  epic:      '2px solid #9b59b6',     // фиолет
  rare:      '2px solid #4a9eff',     // синий
  common:    '1px solid var(--surface3)',
}

const TIER_GLOW = {
  legendary: '0 0 10px rgba(255, 193, 69, 0.4)',
  epic:      '0 0 6px rgba(155, 89, 182, 0.3)',
  rare:      '',
  common:    '',
}

const TIER_LABEL_RU = { legendary: 'Легендарная', epic: 'Эпическая', rare: 'Редкая', common: 'Обычная' }
const TIER_LABEL_EN = { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' }

export default function PublicAchievementsList({ achievements, en }) {
  const { getRarity } = useAchievementRarity()

  if (!achievements || achievements.length === 0) return null

  // Breakdown по tier для баджа сверху
  const counts = { legendary: 0, epic: 0, rare: 0, common: 0 }
  for (const a of achievements) {
    const r = getRarity(a.id)
    const tier = r?.tier || (a.rarity || 'common')
    counts[tier] = (counts[tier] || 0) + 1
  }
  const hasRare = counts.legendary + counts.epic + counts.rare > 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>
          {en ? 'Achievements' : 'Ачивки'} ({achievements.length})
        </span>
        {hasRare && (
          <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
            {counts.legendary > 0 && <span style={{ color: '#ffc145' }}>🥇 {counts.legendary}</span>}
            {counts.epic > 0 && <span style={{ color: '#9b59b6' }}>💜 {counts.epic}</span>}
            {counts.rare > 0 && <span style={{ color: '#4a9eff' }}>💎 {counts.rare}</span>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {achievements.map(a => {
          const r = getRarity(a.id)
          const tier = r?.tier || (a.rarity || 'common')
          const name = en && a.nameEn ? a.nameEn : a.name || a.id
          const tierLabel = (en ? TIER_LABEL_EN : TIER_LABEL_RU)[tier]
          const pctText = r ? (r.percentage < 1 ? '<1%' : `${r.percentage}%`) : null
          const title = r
            ? `${name} — ${tierLabel} (${pctText} ${en ? 'of players' : 'игроков'})`
            : `${name}${tier !== 'common' ? ` — ${tierLabel}` : ''}`

          return (
            <span
              key={a.id}
              title={title}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32, height: 32,
                fontSize: 18,
                borderRadius: 8,
                border: TIER_BORDER[tier],
                boxShadow: TIER_GLOW[tier] || 'none',
                background: tier === 'legendary' ? 'rgba(255,193,69,0.08)'
                  : tier === 'epic' ? 'rgba(155,89,182,0.08)'
                  : tier === 'rare' ? 'rgba(74,158,255,0.08)'
                  : 'rgba(255,255,255,0.02)',
                cursor: 'help',
              }}
            >
              {a.icon || name[0]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
