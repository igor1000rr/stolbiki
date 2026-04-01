/**
 * Обучающий режим: анализ позиции и объяснение лучшего хода
 */

import {
  GameState, getValidTransfers, applyAction,
  MAX_CHIPS, GOLDEN_STAND
} from './game.js'
import { mctsSearch, sampleRandomAction } from './ai.js'

const standLabel = i => i === GOLDEN_STAND ? '★' : String(i)

/**
 * Анализирует текущую позицию и возвращает подсказку
 */
export function getHint(state, simulations = 60) {
  if (state.gameOver) return null

  // Получаем лучший ход от MCTS
  const bestAction = mctsSearch(state, simulations)
  const player = state.currentPlayer

  // Анализируем позицию
  const analysis = analyzePosition(state)

  // Строим объяснение
  const explanation = explainAction(state, bestAction, analysis)

  return {
    action: bestAction,
    explanation,
    analysis,
  }
}

function analyzePosition(state) {
  const player = state.currentPlayer
  const opponent = 1 - player
  const info = {
    myScore: state.countClosed(player),
    oppScore: state.countClosed(opponent),
    openStands: state.numOpen(),
    closingMoves: [],      // Стойки, которые можно закрыть прямо сейчас
    threatenedStands: [],   // Стойки, которые может закрыть соперник
    goldenStatus: null,     // Кто контролирует золотую
    strongStands: [],       // Наши сильные позиции
  }

  const transfers = getValidTransfers(state)

  // Какие стойки можно закрыть
  for (const [src, dst] of transfers) {
    const [gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS) {
      info.closingMoves.push({ src, dst, label: `${standLabel(src)}→${standLabel(dst)}` })
    }
  }

  // Анализ каждой стойки
  for (const i of state.openStands()) {
    const chips = state.stands[i]
    if (!chips.length) continue
    const [topColor, topSize] = state.topGroup(i)
    const myChips = chips.filter(c => c === player).length
    const oppChips = chips.filter(c => c === opponent).length

    // Золотая
    if (i === GOLDEN_STAND) {
      info.goldenStatus = topColor === player ? 'мы сверху' : topColor === opponent ? 'соперник сверху' : 'пуста'
    }

    // Наши сильные позиции (много наших фишек, мы сверху)
    if (topColor === player && myChips >= 5) {
      info.strongStands.push(i)
    }

    // Угрозы: соперник может закрыть
    if (topColor === opponent && oppChips >= 7) {
      info.threatenedStands.push(i)
    }
  }

  return info
}

function explainAction(state, action, analysis) {
  const parts = []
  const player = state.currentPlayer

  // Ситуативный совет
  if (analysis.myScore > analysis.oppScore) {
    parts.push(`Вы ведёте ${analysis.myScore}:${analysis.oppScore}. Удерживайте преимущество.`)
  } else if (analysis.oppScore > analysis.myScore) {
    parts.push(`Вы отстаёте ${analysis.myScore}:${analysis.oppScore}. Нужно активнее достраивать высотки.`)
  } else {
    parts.push(`Счёт равный ${analysis.myScore}:${analysis.oppScore}. Золотая стойка может решить исход.`)
  }

  // Объяснение хода
  if (action.swap) {
    parts.push('Рекомендация: Swap. Забрать позицию первого игрока — она выгоднее.')
    return parts
  }

  if (action.transfer) {
    const [src, dst] = action.transfer
    const [gc, gs] = state.topGroup(src)
    const newTotal = state.stands[dst].length + gs

    if (newTotal >= MAX_CHIPS) {
      // Закрывающий перенос
      const owner = gc === player ? 'вашу' : 'вражескую'
      const isGolden = dst === GOLDEN_STAND
      parts.push(`Рекомендация: достроить высотку ${standLabel(dst)} переносом с ${standLabel(src)}.`)
      if (isGolden) {
        parts.push('Это золотая стойка — её контроль критически важен при равном счёте!')
      }
      const newMyScore = gc === player ? analysis.myScore + 1 : analysis.myScore
      const newOppScore = gc !== player ? analysis.oppScore + 1 : analysis.oppScore
      parts.push(`После достройки счёт станет ${newMyScore}:${newOppScore}.`)
    } else {
      // Стратегический перенос
      if (gc === player) {
        parts.push(`Рекомендация: перенести ${gs} фишек с ${standLabel(src)} на ${standLabel(dst)}, усиливая позицию.`)
        if (state.stands[dst].length + gs >= MAX_CHIPS - 3) {
          parts.push(`Стойка ${standLabel(dst)} будет близка к достройке (${state.stands[dst].length + gs}/${MAX_CHIPS}).`)
        }
      } else {
        parts.push(`Рекомендация: перенести чужие блоки с ${standLabel(src)} на ${standLabel(dst)}, освобождая стойку.`)
      }
    }
  } else if (analysis.closingMoves.length > 0 && !action.transfer) {
    parts.push('Есть возможность достроить высотку, но AI считает что установка сейчас важнее.')
  }

  if (action.placement && Object.keys(action.placement).length > 0) {
    const placements = Object.entries(action.placement)
      .map(([k, v]) => `${v} на ${standLabel(+k)}`).join(', ')
    parts.push(`Установка: ${placements}.`)

    for (const [idx, count] of Object.entries(action.placement)) {
      const i = +idx
      if (i === GOLDEN_STAND) {
        parts.push('Установка на золотую стойку — борьба за контроль.')
      }
      const total = state.stands[i].length + count
      if (total >= MAX_CHIPS - 3) {
        parts.push(`Стойка ${standLabel(i)} приближается к достройке (${total}/${MAX_CHIPS}).`)
      }
    }
  }

  // Предупреждения
  if (analysis.threatenedStands.length > 0) {
    const threatened = analysis.threatenedStands.map(standLabel).join(', ')
    parts.push(`Внимание: соперник близок к достройке высоток ${threatened}.`)
  }

  if (analysis.goldenStatus === 'соперник сверху' && analysis.myScore === analysis.oppScore) {
    parts.push('Золотая стойка под контролем соперника — при равном счёте это проигрыш.')
  }

  return parts
}
