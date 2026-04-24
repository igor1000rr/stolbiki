/**
 * Нижняя панель с ключевыми игровыми действиями (одна рука достаёт).
 * Порядок по требованию Александра (апр 2026):
 *   Tower Takeover / Cancel  |  Confirm  |  Hint 💡  |  Sound 🔊
 *
 * Кнопки изменения состояния игры (New Game, Resign, Undo, Offer Draw)
 * вынесены в GameActionsTop над MobileGameBar — чтобы случайно не нажать
 * в процессе игры.
 */
export default function GameActionsBottom({
  isMyTurn, phase, inTransferMode, transfer, totalPlaced, canConfirm,
  modifiers, transfersLeft,
  hasTransfers, mode, gameOver,
  soundOn, hintLoading,
  en, t,
  onCancelAction, onStartTransfer, onConfirm,
  onToggleSound, onHint,
}) {
  const transferActive = isMyTurn && (inTransferMode || !!transfer)
  const hasPlacements = isMyTurn && phase === 'place' && totalPlaced > 0
  const inCancelMode = transferActive || hasPlacements

  return (
    <div className="actions actions-bottom">
      {inCancelMode ? (
        <button
          key="slot1-cancel"
          className="btn action-slot action-slot--swap"
          onClick={() => { if (transferActive) onCancelAction('transfer'); if (hasPlacements) onCancelAction('placement') }}
          title="Esc"
        >
          {t('game.cancelTransfer')}
        </button>
      ) : (
        <button
          key="slot1-transfer"
          className="btn action-slot action-slot--swap action-slot--takeover"
          disabled={!(isMyTurn && phase === 'place' && hasTransfers)}
          onClick={onStartTransfer}
        >
          {modifiers.doubleTransfer && transfersLeft > 1 && !transfer
            ? (en ? '⇄⇄ Tower Takeover' : '⇄⇄ Перехват')
            : t('game.transfer')}
        </button>
      )}

      <button
        className="btn primary action-slot"
        disabled={!(isMyTurn && phase === 'place' && canConfirm)}
        onClick={onConfirm}
        title="Enter"
      >
        {t('game.confirm')} ⏎
      </button>

      {/* Hint "лампочка" — только в AI-режиме. В других режимах занимает место невидимкой
         чтобы ряд из 4 кнопок не плясал в зависимости от режима. */}
      {mode === 'ai' && isMyTurn && !gameOver ? (
        <button
          className="btn action-icon"
          onClick={onHint}
          disabled={hintLoading}
          style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
          title={en ? 'Hint (H)' : 'Подсказка (H)'}
          aria-label={en ? 'Hint' : 'Подсказка'}
        >
          {hintLoading ? '...' : '💡'}
        </button>
      ) : (
        <span className="btn action-icon action-icon--placeholder" aria-hidden="true" />
      )}

      <button
        className="btn action-icon"
        onClick={onToggleSound}
        aria-label={soundOn ? 'Mute' : 'Unmute'}
      >
        {soundOn
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
          : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>}
      </button>
    </div>
  )
}
