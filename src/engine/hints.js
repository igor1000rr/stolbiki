/**
 * Обучающий режим: анализ позиции и объяснение лучшего хода
 */

import {
  GameState, getValidTransfers,
  MAX_CHIPS, GOLDEN_STAND
} from './game.js'
import { mctsSearch } from './ai.js'

const standLabel = i => i === GOLDEN_STAND ? '★' : String(i)

/**
 * Анализирует текущую позицию и возвращает подсказку
 */
export function getHint(state, simulations = 60, lang = 'ru') {
  if (state.gameOver) return null

  // Получаем лучший ход от MCTS
  const bestAction = mctsSearch(state, simulations)

  // Анализируем позицию
  const analysis = analyzePosition(state)

  // Строим объяснение
  const explanation = explainAction(state, bestAction, analysis, lang)

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
    const [_gc, gs] = state.topGroup(src)
    if (state.stands[dst].length + gs >= MAX_CHIPS) {
      info.closingMoves.push({ src, dst, label: `${standLabel(src)}→${standLabel(dst)}` })
    }
  }

  // Анализ каждой стойки
  for (const i of state.openStands()) {
    const chips = state.stands[i]
    if (!chips.length) continue
    const [topColor, _topSize] = state.topGroup(i)
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

function explainAction(state, action, analysis, lang = 'ru') {
  const en = lang === 'en'
  const parts = []
  const player = state.currentPlayer

  // Ситуативный совет
  if (analysis.myScore > analysis.oppScore) {
    parts.push(en
      ? `You're leading ${analysis.myScore}:${analysis.oppScore}. Hold the advantage.`
      : `Вы ведёте ${analysis.myScore}:${analysis.oppScore}. Удерживайте преимущество.`)
  } else if (analysis.oppScore > analysis.myScore) {
    parts.push(en
      ? `You're behind ${analysis.myScore}:${analysis.oppScore}. Push for tower completions.`
      : `Вы отстаёте ${analysis.myScore}:${analysis.oppScore}. Нужно активнее достраивать высотки.`)
  } else {
    parts.push(en
      ? `Score is tied ${analysis.myScore}:${analysis.oppScore}. The golden tower may decide it.`
      : `Счёт равный ${analysis.myScore}:${analysis.oppScore}. Золотая стойка может решить исход.`)
  }

  // Объяснение хода
  if (action.swap) {
    parts.push(en
      ? 'Recommendation: Swap. Take the first player\u2019s position — it\u2019s better.'
      : 'Рекомендация: Swap. Забрать позицию первого игрока — она выгоднее.')
    return parts
  }

  if (action.transfer) {
    const [src, dst] = action.transfer
    const [gc, gs] = state.topGroup(src)
    const newTotal = state.stands[dst].length + gs

    if (newTotal >= MAX_CHIPS) {
      // Закрывающий перенос
      const isGolden = dst === GOLDEN_STAND
      parts.push(en
        ? `Recommendation: complete tower ${standLabel(dst)} by transferring from ${standLabel(src)}.`
        : `Рекомендация: достроить высотку ${standLabel(dst)} переносом с ${standLabel(src)}.`)
      if (isGolden) {
        parts.push(en
          ? 'This is the golden tower — its control is critical when scores are tied!'
          : 'Это золотая стойка — её контроль критически важен при равном счёте!')
      }
      const newMyScore = gc === player ? analysis.myScore + 1 : analysis.myScore
      const newOppScore = gc !== player ? analysis.oppScore + 1 : analysis.oppScore
      parts.push(en
        ? `After completion the score will be ${newMyScore}:${newOppScore}.`
        : `После достройки счёт станет ${newMyScore}:${newOppScore}.`)
    } else {
      // Стратегический перенос
      if (gc === player) {
        parts.push(en
          ? `Recommendation: transfer ${gs} blocks from ${standLabel(src)} to ${standLabel(dst)}, strengthening your position.`
          : `Рекомендация: перенести ${gs} фишек с ${standLabel(src)} на ${standLabel(dst)}, усиливая позицию.`)
        if (state.stands[dst].length + gs >= MAX_CHIPS - 3) {
          parts.push(en
            ? `Tower ${standLabel(dst)} will be close to completion (${state.stands[dst].length + gs}/${MAX_CHIPS}).`
            : `Стойка ${standLabel(dst)} будет близка к достройке (${state.stands[dst].length + gs}/${MAX_CHIPS}).`)
        }
      } else {
        parts.push(en
          ? `Recommendation: transfer opponent\u2019s blocks from ${standLabel(src)} to ${standLabel(dst)}, freeing the tower.`
          : `Рекомендация: перенести чужие блоки с ${standLabel(src)} на ${standLabel(dst)}, освобождая стойку.`)
      }
    }
  } else if (analysis.closingMoves.length > 0 && !action.transfer) {
    parts.push(en
      ? 'There\u2019s a chance to complete a tower, but the AI thinks placing is more important now.'
      : 'Есть возможность достроить высотку, но AI считает что установка сейчас важнее.')
  }

  if (action.placement && Object.keys(action.placement).length > 0) {
    const placements = Object.entries(action.placement)
      .map(([k, v]) => en ? `${v} on ${standLabel(+k)}` : `${v} на ${standLabel(+k)}`).join(', ')
    parts.push(en ? `Place: ${placements}.` : `Установка: ${placements}.`)

    for (const [idx, count] of Object.entries(action.placement)) {
      const i = +idx
      if (i === GOLDEN_STAND) {
        parts.push(en
          ? 'Placing on the golden tower — fighting for control.'
          : 'Установка на золотую стойку — борьба за контроль.')
      }
      const total = state.stands[i].length + count
      if (total >= MAX_CHIPS - 3) {
        parts.push(en
          ? `Tower ${standLabel(i)} is close to completion (${total}/${MAX_CHIPS}).`
          : `Стойка ${standLabel(i)} приближается к достройке (${total}/${MAX_CHIPS}).`)
      }
    }
  }

  // Предупреждения
  if (analysis.threatenedStands.length > 0) {
    const threatened = analysis.threatenedStands.map(standLabel).join(', ')
    parts.push(en
      ? `Warning: opponent is close to completing towers ${threatened}.`
      : `Внимание: соперник близок к достройке высоток ${threatened}.`)
  }

  if (analysis.goldenStatus === 'соперник сверху' && analysis.myScore === analysis.oppScore) {
    parts.push(en
      ? 'The golden tower is controlled by the opponent — at a tied score this means a loss.'
      : 'Золотая стойка под контролем соперника — при равном счёте это проигрыш.')
  }

  return parts
}
