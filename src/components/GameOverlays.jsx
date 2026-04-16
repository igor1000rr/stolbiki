import Mascot from './Mascot'

/**
 * Все overlay-элементы игры в одном месте:
 * - FloatingEmoji — плавающая реакция во время онлайн-партии
 * - AchievementPopup — всплывающее уведомление о достижении
 * - FirstWinCelebration — кликабельный full-screen оверлей первой победы
 *
 * Вынесено из Game.jsx ради распила. Логика показа/скрытия — в Game.jsx.
 */
export default function GameOverlays({
  floatingEmoji,
  newAch, lang,
  firstWinCelebration, onFirstWinClose,
}) {
  return (
    <>
      {floatingEmoji && (
        <div
          key={floatingEmoji.key}
          style={{
            position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
            fontSize: 64, zIndex: 9999, pointerEvents: 'none',
            animation: 'emojiFloat 2s ease-out forwards',
          }}
        >
          {floatingEmoji.emoji}
        </div>
      )}

      {newAch && (
        <div className="achievement-popup">
          <Mascot pose="celebrate" size={40} animate={false} />
          <div>
            <div className="ach-label">
              {lang === 'en' ? 'Achievement unlocked!' : 'Ачивка разблокирована!'}
            </div>
            <div className="ach-name">
              {lang === 'en' && newAch.nameEn ? newAch.nameEn : newAch.name}
            </div>
          </div>
        </div>
      )}

      {firstWinCelebration && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.8)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.5s ease',
          }}
          onClick={onFirstWinClose}
        >
          <div style={{ textAlign: 'center', padding: 32, maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              <Mascot pose="celebrate" size={120} large className="mascot-enter" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
              {lang === 'en' ? 'First Victory!' : 'Первая победа!'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 20 }}>
              {lang === 'en'
                ? 'You beat the AI! Keep playing to unlock achievements and climb the leaderboard.'
                : 'Вы победили AI! Продолжайте играть чтобы открыть ачивки и подняться в рейтинге.'}
            </div>
            <button
              className="btn primary"
              onClick={onFirstWinClose}
              style={{ width: '100%', padding: '14px 0', fontSize: 16, justifyContent: 'center' }}
            >
              {lang === 'en' ? 'Awesome!' : 'Отлично!'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
