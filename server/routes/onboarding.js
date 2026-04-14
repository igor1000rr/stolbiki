/**
 * Онбординг-награды. Отдельный endpoint чтобы НЕ влиять на боевую
 * статистику: туториал-победа не идёт в wins/games_played и не портит рейтинг.
 *
 * Побочные эффекты успеха:
 *  - выдаётся ачивка first_win (напрямую через INSERT, не через checkAchievements)
 *  - начисляется 20 кирпичей через awardBricks (в brick_transactions с reason='onboarding')
 *  - выставляется users.onboarding_done = 1
 *
 * Идемпотентность: повторный вызов — 409, никаких побочных эффектов.
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { awardBricks } from './bricks.js'

const router = Router()
const BRICK_REWARD = 20

router.post('/complete', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, onboarding_done, bricks FROM users WHERE id=?').get(req.user.id)
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
    if (user.onboarding_done) {
      return res.status(409).json({ error: 'Обучение уже пройдено', alreadyDone: true, bricks: user.bricks })
    }

    // Atomic guard — если два одновременных запроса (повторный клик) —
    // обновится только один, второй .changes будет 0.
    const upd = db.prepare('UPDATE users SET onboarding_done=1 WHERE id=? AND onboarding_done=0').run(req.user.id)
    if (upd.changes === 0) {
      return res.status(409).json({ error: 'Обучение уже пройдено', alreadyDone: true })
    }

    // Ачивка first_win напрямую (без инкремента wins/games_played).
    let achievementUnlocked = false
    try {
      const r = db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)').run(req.user.id, 'first_win')
      achievementUnlocked = r.changes > 0
    } catch {}

    // Кирпичи через awardBricks — пишет в brick_transactions, обновляет баланс.
    const newBalance = awardBricks(req.user.id, BRICK_REWARD, 'onboarding')

    res.json({
      ok: true,
      bricks: newBalance,
      bricksAwarded: BRICK_REWARD,
      achievementUnlocked,
      achievement: achievementUnlocked ? 'first_win' : null,
    })
  } catch (e) {
    console.error('onboarding/complete:', e.message)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

router.get('/status', auth, (req, res) => {
  const user = db.prepare('SELECT onboarding_done FROM users WHERE id=?').get(req.user.id)
  res.json({ done: !!user?.onboarding_done })
})

export default router
