/**
 * Античит: верификация результата партии по массиву ходов.
 * Проигрывает moves через движок, возвращает настоящий winner/score/turns.
 * Без зависимостей от DB — можно импортировать в тестах.
 */

import { GameState, applyAction, getLegalActions } from './game-engine.js'

function actionsEqual(a, b) {
  if (a.swap || b.swap) return !!a.swap === !!b.swap
  const at = a.transfer, bt = b.transfer
  if ((!!at) !== (!!bt)) return false
  if (at && bt && (at[0] !== bt[0] || at[1] !== bt[1])) return false
  const ap = a.placement || {}, bp = b.placement || {}
  const ak = Object.keys(ap).sort(), bk = Object.keys(bp).sort()
  if (ak.length !== bk.length) return false
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i] || ap[ak[i]] !== bp[bk[i]]) return false
  }
  return true
}

/**
 * @param {Array<{action: object, player?: number}>} moves
 * @returns {{ok: boolean, winner?: number, scoreStr?: string, turns?: number}}
 */
export function verifyGameFromMoves(moves) {
  if (!Array.isArray(moves) || moves.length === 0) return { ok: false }
  try {
    let s = new GameState()
    let turns = 0
    for (const m of moves) {
      if (!m || !m.action) return { ok: false }
      const legal = getLegalActions(s)
      const isLegal = legal.some(l => actionsEqual(l, m.action))
      if (!isLegal) return { ok: false }
      s = applyAction(s, m.action)
      turns++
      if (s.gameOver) break
    }
    if (!s.gameOver) return { ok: false }
    const c0 = s.countClosed(0), c1 = s.countClosed(1)
    return { ok: true, winner: s.winner, scoreStr: `${c0}:${c1}`, turns }
  } catch {
    return { ok: false }
  }
}
