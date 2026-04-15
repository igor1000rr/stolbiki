import Mascot from '../Mascot'

/**
 * Модалка «Первая победа» — показывается после первого выигранного матча.
 *
 * Вынесено из Game.jsx.
 */
export default function GameFirstWinCelebration({ lang, onClose }) {
  const en = lang === 'en'
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.5s ease',
      }}
      onClick={onClose}
    >
      <div style={{ textAlign: 'center', padding: 32, maxWidth: 320 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          <Mascot pose="celebrate" size={120} large className="mascot-enter" />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
          {en ? 'First Victory!' : 'Первая победа!'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 20 }}>
          {en
            ? 'You beat the AI! Keep playing to unlock achievements and climb the leaderboard.'
            : 'Вы победили AI! Продолжайте играть чтобы открыть ачивки и подняться в рейтинге.'}
        </div>
        <button
          className="btn primary"
          onClick={onClose}
          style={{ width: '100%', padding: '14px 0', fontSize: 16, justifyContent: 'center' }}
        >
          {en ? 'Awesome!' : 'Отлично!'}
        </button>
      </div>
    </div>
  )
}
