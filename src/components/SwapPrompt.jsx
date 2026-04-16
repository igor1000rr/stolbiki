/**
 * Баннер с вопросом о swap на первом ходу противника.
 * UI-только: логика (applyAction/recordMove/MP.sendMove) — в callback'ах.
 */
export default function SwapPrompt({ show, t, onSwap, onDecline }) {
  if (!show) return null
  return (
    <div style={{ textAlign: 'center', margin: '8px 0' }}>
      <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{t('game.swapQuestion')}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn"
          onClick={onSwap}
          style={{ borderColor: 'var(--purple)', color: 'var(--purple)', padding: '10px 20px' }}
        >
          Swap
        </button>
        <button
          className="btn"
          onClick={onDecline}
          style={{ fontSize: 12, padding: '10px 16px' }}
        >
          {t('game.noContinue')}
        </button>
      </div>
    </div>
  )
}
