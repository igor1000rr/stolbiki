/**
 * Верхняя узкая панель: кнопки изменения состояния игры.
 *   New game  |  Undo (опц)  |  Resign (опц)  |  Offer draw (опц)
 *
 * Высота в 2 раза меньше основных кнопок — чтобы отличались визуально и
 * случайно не нажимались пальцем при игре. Располагаются НАД MobileGameBar
 * (режим/сложность), отдельно от игровых действий.
 */
export default function GameActionsTop({
  mode, undoStack, gameOver, t,
  onNewGame, onUndo, onResign, onOfferDraw,
}) {
  return (
    <div className="actions actions-top">
      <button className="btn btn-compact" onClick={onNewGame} title="N">
        {t('game.newGame')}
      </button>

      {mode === 'pvp' && undoStack.length > 0 && !gameOver && (
        <button
          className="btn btn-compact"
          onClick={onUndo}
          style={{ color: 'var(--gold)', borderColor: '#ffc14540' }}
          aria-label="Undo move"
        >↩ Undo</button>
      )}

      {!gameOver && mode !== 'pvp' && mode !== 'spectate-online' && (
        <button
          className="btn btn-compact"
          onClick={onResign}
          style={{ color: 'var(--p2)', borderColor: '#ff606640' }}
        >
          {t('game.resign')}
        </button>
      )}

      {!gameOver && mode === 'online' && (
        <button
          className="btn btn-compact"
          onClick={onOfferDraw}
          style={{ opacity: 0.6 }}
        >
          {t('game.offerDraw')}
        </button>
      )}
    </div>
  )
}
