/**
 * Тост-уведомление "N дней подряд" — авто-исчезает через 4сек
 * (родитель управляет таймером и видимостью). Чисто презентационный.
 */
export default function StreakPopup({ lang, streak, best, streakXP }) {
  const en = lang === 'en'
  const dayWord = en
    ? 'day streak!'
    : (streak >= 5 ? 'дней подряд!' : streak >= 2 ? 'дня подряд!' : 'день подряд!')
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: 'var(--surface)', borderRadius: 16, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(255,193,69,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontSize: 32 }}>
        <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
          <path d="M16 4c1 8-4 10-4 16a8 8 0 0016 0c0-6-5-8-4-16" stroke="var(--gold)" strokeWidth="2" fill="rgba(255,193,69,0.15)"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>
          {streak} {dayWord}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink2)' }}>
          {en ? `Best: ${best}` : `Рекорд: ${best}`}
          {streakXP && <span style={{ color: 'var(--green)', marginLeft: 8 }}>+{streakXP} XP</span>}
        </div>
      </div>
    </div>
  )
}
