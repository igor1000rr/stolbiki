/**
 * Issue #6 — Бейдж с рарностью ачивки.
 *
 * Тиры вычисляются на сервере по порогам:
 *   legendary  < 1%   (красно-золотой)
 *   epic       < 5%   (фиолетовый)
 *   rare       < 20%  (синий)
 *   common     >= 20% (серый)
 *
 * Использование в Profile.jsx / Dashboard.jsx:
 *   <AchievementRarityBadge achievementId="first_win" />
 *
 * Если rarity для этой ачивки ещё не посчитана (никто не получил) — не рендерим.
 */

import { useAchievementRarity } from '../engine/useAchievementRarity'
import { useI18n } from '../engine/i18n'

const TIER_STYLES = {
  legendary: {
    bg: 'linear-gradient(135deg, #ff6b00 0%, #ffd700 100%)',
    color: '#1a0a00',
    glow: '0 0 8px rgba(255, 183, 0, 0.5)',
  },
  epic: {
    bg: 'linear-gradient(135deg, #9b4dff 0%, #d580ff 100%)',
    color: '#1a0a2e',
    glow: '0 0 6px rgba(155, 77, 255, 0.4)',
  },
  rare: {
    bg: 'linear-gradient(135deg, #4a9eff 0%, #80c8ff 100%)',
    color: '#0a1a2e',
    glow: '0 0 4px rgba(74, 158, 255, 0.35)',
  },
  common: {
    bg: 'var(--surface2)',
    color: 'var(--ink3)',
    glow: 'none',
  },
}

const TIER_LABEL = {
  ru: { legendary: 'Легендарная', epic: 'Эпическая', rare: 'Редкая', common: 'Обычная' },
  en: { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' },
}

export default function AchievementRarityBadge({ achievementId, size = 'sm' }) {
  const { getRarity } = useAchievementRarity()
  const { lang } = useI18n()
  const en = lang === 'en'
  const rarity = getRarity(achievementId)
  if (!rarity) return null

  const style = TIER_STYLES[rarity.tier] || TIER_STYLES.common
  const label = (en ? TIER_LABEL.en : TIER_LABEL.ru)[rarity.tier]
  const fontSize = size === 'sm' ? 9 : 11
  const padding = size === 'sm' ? '2px 6px' : '4px 8px'

  return (
    <span
      title={`${label} — ${rarity.holders} ${en ? 'players' : 'игроков'} (${rarity.percentage}%)`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: 4,
        background: style.bg,
        color: style.color,
        boxShadow: style.glow,
        whiteSpace: 'nowrap',
        letterSpacing: 0.2,
      }}
    >
      {rarity.percentage < 1 ? `<1%` : `${rarity.percentage}%`}
    </span>
  )
}
