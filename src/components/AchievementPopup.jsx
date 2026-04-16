import Mascot from './Mascot'

/**
 * Попап ачивки — появляется на 4 секунды при разблокировке.
 * Вынесено из Game.jsx.
 */
export default function AchievementPopup({ ach, lang }) {
  if (!ach) return null
  const en = lang === 'en'
  return (
    <div className="achievement-popup">
      <Mascot pose="celebrate" size={40} animate={false} />
      <div>
        <div className="ach-label">{en ? 'Achievement unlocked!' : 'Ачивка разблокирована!'}</div>
        <div className="ach-name">{en && ach.nameEn ? ach.nameEn : ach.name}</div>
      </div>
    </div>
  )
}
