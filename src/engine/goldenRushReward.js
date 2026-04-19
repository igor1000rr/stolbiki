/**
 * Чистая функция вычисления бриксов именно мне после Golden Rush матча.
 *
 * Вынесена из goldenRushWS.js для unit-тестирования.
 * Та же логика что на сервере (GR_REWARDS константы приходят от сервера через gr.gameOver).
 *
 * Пункты с amount=0 НЕ попадают в parts — UI не должен показывать "+0".
 *
 * @param {object} opts
 * @param {object} opts.state — финальный state комнаты
 * @param {number} opts.winner — слот победителя (FFA) или индекс команды (2v2). -1 = ничья.
 * @param {number|null} opts.resignedBy — кто сдался (если был ресайн)
 * @param {object} opts.rewards — { participation, win, centerCapture } от сервера
 * @param {number} opts.yourSlot — мой слот 0..3
 * @returns {null | { total: number, parts: Array<{key, amount}>, resigned: boolean }}
 */
export function computeMyReward({ state, winner, resignedBy, rewards, yourSlot }) {
  if (!rewards || yourSlot == null) return null
  const { participation = 0, win: winBonus = 0, centerCapture = 0 } = rewards
  const resigned = resignedBy === yourSlot

  let total = 0
  const parts = []

  if (!resigned && participation > 0) {
    total += participation
    parts.push({ key: 'participation', amount: participation })
  }

  const won = (state?.mode === 'ffa' && winner === yourSlot)
    || (state?.mode === '2v2' && winner >= 0 && state.teams?.[winner]?.includes(yourSlot))
  if (won && winBonus > 0) {
    total += winBonus
    parts.push({ key: 'win', amount: winBonus })
  }

  const centerOwner = state?.closed?.[0]
  if (centerOwner === yourSlot && !resigned && centerCapture > 0) {
    total += centerCapture
    parts.push({ key: 'center', amount: centerCapture })
  }

  return { total, parts, resigned }
}
