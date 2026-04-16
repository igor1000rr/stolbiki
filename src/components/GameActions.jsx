/**
 * Нижняя панель кнопок действий: Transfer/Cancel toggle, Confirm, New Game,
 * Undo, Resign, Offer Draw, Sound, Hint.
 *
 * Вынесено из Game.jsx ради распила монстра (~80 строк JSX).
 * Максимум логики остался в Game.jsx; здесь только рендер + событийные коллбэки.
 */
export default function GameActions({
  isMyTurn, phase, inTransferMode, transfer, totalPlaced, canConfirm,
  modifiers, transfersLeft,
  hasTransfers, undoStack, mode, gameOver,
  soundOn, hintLoading,
  en, t,
  onCancelAction, onStartTransfer, onConfirm,
  onNewGame, onUndo, onResign, onOfferDraw, onToggleSound, onHint,
}) {
  const transferActive = isMyTurn && (inTransferMode || !!transfer)
  const hasPlacements = isMyTurn && phase === 'place' && totalPlaced > 0
  const inCancelMode = transferActive || hasPlacements

  return (
    <div className="actions">
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
          className="btn action-slot action-slot--swap"
          disabled={!(isMyTurn && phase === 'place' && hasTransfers)}
          onClick={onStartTransfer}
        >
          {modifiers.doubleTransfer && transfersLeft > 1 && !transfer
            ? (en ? '⇄⇄ Transfer' : '⇄⇄ Перенос')
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

      <button className="btn" onClick={onNewGame} title="N">{t('game.newGame')}</button>

      {mode === 'pvp' && undoStack.length > 0 && !gameOver && (
        <button
          className="btn"
          onClick={onUndo}
          style={{ fontSize: 11, color: 'var(--gold)', borderColor: '#ffc14540' }}
          aria-label="Undo move"
        >↩ Undo</button>
      )}

      {!gameOver && mode !== 'pvp' && mode !== 'spectate-online' && (
        <button
          className="btn"
          onClick={onResign}
          style={{ fontSize: 11, color: 'var(--p2)', borderColor: '#ff606640' }}
        >{t('game.resign')}</button>
      )}

      {!gameOver && mode === 'online' && (
        <button
          className="btn"
          onClick={onOfferDraw}
          style={{ fontSize: 11, opacity: 0.6 }}
        >{t('game.offerDraw')}</button>
      )}

      <button
        className="btn"
        onClick={onToggleSound}
        style={{ fontSize: 13, opacity: 0.5, padding: '6px 8px', minWidth: 0 }}
        aria-label={soundOn ? 'Mute' : 'Unmute'}
      >
        {soundOn
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
          : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>}
      </button>

      {mode === 'ai' && isMyTurn && !gameOver && (
        <button
          className="btn"
          onClick={onHint}
          disabled={hintLoading}
          style={{ borderColor: 'var(--gold)', color: 'var(--gold)', fontSize: 11, padding: '6px 8px', minWidth: 0 }}
          title="H"
        >
          {hintLoading ? '...' : '💡'}
        </button>
      )}
    </div>
  )
}
