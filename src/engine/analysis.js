/**
 * AI Game Review — анализ партии ход за ходом
 * Сравнивает ход игрока с лучшим ходом AI
 */

import { GameState, applyAction } from './game'
import { evaluate } from './neuralnet'
import { mctsSearch } from './ai'

// Классификация хода по разнице оценки
// delta = bestEval - actualEval (с точки зрения игрока)
function classifyMove(delta) {
  if (delta < 0.03) return 'excellent'   // Лучший или почти лучший
  if (delta < 0.10) return 'good'        // Хороший ход
  if (delta < 0.20) return 'inaccuracy'  // Неточность
  if (delta < 0.35) return 'mistake'     // Ошибка
  return 'blunder'                        // Грубая ошибка
}

const LABELS = {
  excellent:  { ru: 'Отличный', en: 'Excellent', color: 'var(--green)', icon: '!!' },
  good:       { ru: 'Хороший', en: 'Good', color: 'var(--p1-light)', icon: '' },
  inaccuracy: { ru: 'Неточность', en: 'Inaccuracy', color: 'var(--gold)', icon: '?!' },
  mistake:    { ru: 'Ошибка', en: 'Mistake', color: 'var(--coral)', icon: '?' },
  blunder:    { ru: 'Грубая ошибка', en: 'Blunder', color: 'var(--p2)', icon: '??' },
}

/**
 * Анализирует партию
 * @param {Array} moveHistory — [{action, player}]
 * @param {number} analyzePlayer — 0 или 1 (чьи ходы анализировать, -1 = оба)
 * @param {Function} onProgress — callback(step, total)
 * @returns {Array} [{moveIdx, action, player, eval, bestAction, bestEval, delta, classification, label}]
 */
export async function analyzeGame(moveHistory, analyzePlayer = -1, onProgress = null) {
  const results = []
  let state = new GameState()
  const sims = 80 // Быстрый MCTS для анализа

  for (let i = 0; i < moveHistory.length; i++) {
    const { action, player } = moveHistory[i]

    if (analyzePlayer !== -1 && player !== analyzePlayer) {
      state = applyAction(state, action)
      results.push({ moveIdx: i, action, player, skip: true })
      if (onProgress) onProgress(i + 1, moveHistory.length)
      continue
    }

    // Оценка позиции ДО хода (с точки зрения текущего игрока)
    const evalBefore = evaluate(state)
    const sign = player === 0 ? 1 : -1 // evaluate возвращает для player 0

    // Лучший ход AI
    let bestAction = null
    let bestEval = evalBefore * sign
    try {
      bestAction = mctsSearch(state, sims, 2)
      if (bestAction) {
        const afterBest = applyAction(state, bestAction)
        bestEval = evaluate(afterBest) * sign * -1 // После хода — оценка с точки зрения того же игрока
      }
    } catch {}

    // Фактический ход
    const afterActual = applyAction(state, action)
    const actualEval = evaluate(afterActual) * sign * -1

    // Дельта: насколько ход хуже лучшего
    const delta = Math.max(0, bestEval - actualEval)
    const classification = classifyMove(delta)

    results.push({
      moveIdx: i,
      action,
      player,
      eval: actualEval,
      bestAction,
      bestEval,
      delta: Math.round(delta * 100) / 100,
      classification,
      label: LABELS[classification],
    })

    state = afterActual

    // Даём UI отрисоваться
    if (onProgress) onProgress(i + 1, moveHistory.length)
    if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
  }

  // Итоговая статистика
  const playerMoves = results.filter(r => !r.skip)
  const stats = {
    total: playerMoves.length,
    excellent: playerMoves.filter(r => r.classification === 'excellent').length,
    good: playerMoves.filter(r => r.classification === 'good').length,
    inaccuracy: playerMoves.filter(r => r.classification === 'inaccuracy').length,
    mistake: playerMoves.filter(r => r.classification === 'mistake').length,
    blunder: playerMoves.filter(r => r.classification === 'blunder').length,
    accuracy: 0,
  }
  stats.accuracy = stats.total > 0
    ? Math.round(((stats.excellent + stats.good) / stats.total) * 100)
    : 0

  return { moves: results, stats }
}

export { LABELS }
