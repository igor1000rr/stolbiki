import { useEffect } from 'react'

/**
 * Хук клавиатурных сокращений для игрового экрана.
 * Игнорирует события из INPUT/SELECT/TEXTAREA.
 *
 * Shortcuts:
 *   Enter        — подтвердить ход (если canConfirm)
 *   Escape       — отмена переноса (если inTransferMode)
 *   n            — новая партия (только после окончания)
 *   z            — undo (только pvp)
 *   0-9          — клик по стойке 0-9
 *   h            — подсказка
 *   ? / /        — тоггл shortcuts-модалки
 */
export function useKeyboardShortcuts({
  canConfirm, isMyTurn, phase, inTransferMode,
  gameOver, result, mode, undoStackLen, locked, numStands,
  confirmTurn, cancelTransfer, newGame, undoMove,
  onStandClick, requestHint, toggleShortcutsModal,
}) {
  useEffect(() => {
    function handleKey(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if (e.key === 'Enter' && canConfirm && isMyTurn && phase === 'place') {
        e.preventDefault(); confirmTurn()
      }
      if (e.key === 'Escape' && inTransferMode) cancelTransfer()
      if (e.key === 'n' && (gameOver || result !== null)) newGame()
      if (e.key === 'z' && mode === 'pvp' && undoStackLen > 0) undoMove()

      if (!locked && !gameOver && /^[0-9]$/.test(e.key)) {
        const standIdx = e.key === '0' ? 0 : parseInt(e.key)
        if (standIdx >= 0 && standIdx < numStands) onStandClick(standIdx)
      }

      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !locked && !gameOver) {
        requestHint?.()
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        toggleShortcutsModal()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })
}
