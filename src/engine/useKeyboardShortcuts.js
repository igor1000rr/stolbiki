/**
 * useKeyboardShortcuts — горячие клавиши игры
 * Enter — подтвердить ход, Esc — отмена переноса,
 * N — новая игра, Z — undo, H — подсказка, 0-9 — выбор стойки
 */

import { useEffect } from 'react'

export function useKeyboardShortcuts({
  canConfirm, isMyTurn, phase, confirmTurn,
  inTransferMode, cancelTransfer,
  gameOver, result, newGame,
  mode, undoStack, undoMove,
  locked, numStands, onStandClick,
  requestHint,
}) {
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Enter' && canConfirm && isMyTurn && phase === 'place') { e.preventDefault(); confirmTurn() }
      if (e.key === 'Escape' && inTransferMode) cancelTransfer()
      if (e.key === 'n' && (gameOver || result !== null)) newGame()
      if (e.key === 'z' && mode === 'pvp' && undoStack.length > 0) undoMove()
      if (!locked && !gameOver && /^[0-9]$/.test(e.key)) {
        const standIdx = e.key === '0' ? 0 : parseInt(e.key)
        if (standIdx >= 0 && standIdx < numStands) onStandClick(standIdx)
      }
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !locked && !gameOver) requestHint?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })
}
