/**
 * Battle Pass — 30 квестов на сезон с наградами в кирпичах
 * Issue #4
 *
 * Таблицы (bootstrap при импорте):
 *   bp_seasons     — активный сезон (≠ ELO-сезоны из seasons)
 *   bp_quests      — список квестов сезона
 *   user_bp_progress — прогресс каждого юзера
 *
 * Экспортирует updateBPProgress(userId, eventType, payload)
 *   — вызывается из games.js после каждой партии
 *
 * API:
 *   GET  /api/bp/current            — сезон + квесты + прогресс юзера
 *   POST /api/bp/quests/:id/claim   — забрать награду
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { awardBricks } from './bricks.js'

// ─── Bootstrap ───
db.exec(`
  CREATE TABLE IF NOT EXISTS bp_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ru TEXT NOT NULL,
    name_en TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    reward_skin_id TEXT
  );

  CREATE TABLE IF NOT EXISTS bp_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    day_index INTEGER NOT NULL,
    type TEXT NOT NULL,
    target INTEGER NOT NULL,
    reward_bricks INTEGER NOT NULL,
    description_ru TEXT NOT NULL,
    description_en TEXT NOT NULL,
    FOREIGN KEY (season_id) REFERENCES bp_seasons(id)
  );

  CREATE TABLE IF NOT EXISTS user_bp_progress (
    user_id INTEGER NOT NULL,
    quest_id INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    reward_claimed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, quest_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bp_quests_season ON bp_quests(season_id, day_index);
  CREATE INDEX IF NOT EXISTS idx_user_bp_user ON user_bp_progress(user_id, quest_id);
`)

// ─── Seed: создаём сезон на текущий месяц если нет ───
function ensureBPSeason() {
  const now = Math.floor(Date.now() / 1000)
  let season = db.prepare('SELECT * FROM bp_seasons WHERE is_active=1').get()
  if (season) return season

  // Параметры текущего месяца
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() // 0-based
  const startsAt = Math.floor(new Date(y, m, 1).getTime() / 1000)
  const endsAt = Math.floor(new Date(y, m + 1, 0, 23, 59, 59).getTime() / 1000)
  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const monthNamesEn = ['January','February','March','April','May','June','July','August','September','October','November','December']

  // Деактивируем старые сезоны
  db.prepare('UPDATE bp_seasons SET is_active=0').run()

  const result = db.prepare(
    'INSERT INTO bp_seasons (name_ru, name_en, starts_at, ends_at, is_active) VALUES (?,?,?,?,1)'
  ).run(`${monthNames[m]} ${y}`, `${monthNamesEn[m]} ${y}`, startsAt, endsAt)
  const seasonId = result.lastInsertRowid

  // Seed: 30 квестов с нарастающей сложностью и наградами
  const quests = [
    // Неделя 1 — начальные
    { day: 1,  type: 'win_n',       target: 1,  bricks: 5,  ru: 'Одержите 1 победу',               en: 'Win 1 game' },
    { day: 2,  type: 'play_n',      target: 3,  bricks: 5,  ru: 'Сыграйте 3 партии',               en: 'Play 3 games' },
    { day: 3,  type: 'win_n',       target: 2,  bricks: 8,  ru: 'Одержите 2 победы',               en: 'Win 2 games' },
    { day: 4,  type: 'close_golden',target: 1,  bricks: 10, ru: 'Закройте золотую стойку',          en: 'Close the golden stand' },
    { day: 5,  type: 'win_n',       target: 3,  bricks: 10, ru: 'Одержите 3 победы',               en: 'Win 3 games' },
    { day: 6,  type: 'play_n',      target: 5,  bricks: 8,  ru: 'Сыграйте 5 партий',               en: 'Play 5 games' },
    { day: 7,  type: 'win_n',       target: 5,  bricks: 15, ru: 'Одержите 5 побед',                en: 'Win 5 games' },
    // Неделя 2 — сложнее
    { day: 8,  type: 'win_ai_hard', target: 1,  bricks: 15, ru: 'Победите сложного AI',            en: 'Beat Hard AI' },
    { day: 9,  type: 'close_golden',target: 2,  bricks: 15, ru: 'Закройте золотую 2 раза',         en: 'Close golden stand 2 times' },
    { day: 10, type: 'win_n',       target: 7,  bricks: 15, ru: 'Одержите 7 побед',                en: 'Win 7 games' },
    { day: 11, type: 'play_n',      target: 10, bricks: 10, ru: 'Сыграйте 10 партий',              en: 'Play 10 games' },
    { day: 12, type: 'win_ai_hard', target: 2,  bricks: 20, ru: 'Победите сложного AI 2 раза',     en: 'Beat Hard AI 2 times' },
    { day: 13, type: 'win_n',       target: 10, bricks: 20, ru: 'Одержите 10 побед',               en: 'Win 10 games' },
    { day: 14, type: 'close_golden',target: 3,  bricks: 25, ru: 'Закройте золотую 3 раза',         en: 'Close golden stand 3 times' },
    // Неделя 3 — онлайн и продвинутые
    { day: 15, type: 'win_online',  target: 1,  bricks: 20, ru: 'Победите в онлайн-матче',         en: 'Win an online match' },
    { day: 16, type: 'win_ai_hard', target: 3,  bricks: 20, ru: 'Победите сложного AI 3 раза',     en: 'Beat Hard AI 3 times' },
    { day: 17, type: 'win_n',       target: 12, bricks: 20, ru: 'Одержите 12 побед',               en: 'Win 12 games' },
    { day: 18, type: 'play_n',      target: 15, bricks: 15, ru: 'Сыграйте 15 партий',              en: 'Play 15 games' },
    { day: 19, type: 'win_online',  target: 2,  bricks: 25, ru: 'Победите в 2 онлайн-матчах',      en: 'Win 2 online matches' },
    { day: 20, type: 'close_golden',target: 5,  bricks: 30, ru: 'Закройте золотую 5 раз',          en: 'Close golden stand 5 times' },
    { day: 21, type: 'win_n',       target: 15, bricks: 25, ru: 'Одержите 15 побед',               en: 'Win 15 games' },
    // Неделя 4 — финальные
    { day: 22, type: 'win_ai_hard', target: 5,  bricks: 25, ru: 'Победите сложного AI 5 раз',      en: 'Beat Hard AI 5 times' },
    { day: 23, type: 'win_online',  target: 3,  bricks: 30, ru: 'Победите в 3 онлайн-матчах',      en: 'Win 3 online matches' },
    { day: 24, type: 'play_n',      target: 20, bricks: 20, ru: 'Сыграйте 20 партий',              en: 'Play 20 games' },
    { day: 25, type: 'win_n',       target: 18, bricks: 30, ru: 'Одержите 18 побед',               en: 'Win 18 games' },
    { day: 26, type: 'close_golden',target: 7,  bricks: 35, ru: 'Закройте золотую 7 раз',          en: 'Close golden stand 7 times' },
    { day: 27, type: 'win_ai_hard', target: 7,  bricks: 35, ru: 'Победите сложного AI 7 раз',      en: 'Beat Hard AI 7 times' },
    { day: 28, type: 'win_online',  target: 5,  bricks: 40, ru: 'Победите в 5 онлайн-матчах',      en: 'Win 5 online matches' },
    { day: 29, type: 'play_n',      target: 25, bricks: 30, ru: 'Сыграйте 25 партий',              en: 'Play 25 games' },
    // Финальный квест — максимальная награда
    { day: 30, type: 'win_n',       target: 25, bricks: 75, ru: 'Легенда: одержите 25 побед',      en: 'Legend: Win 25 games' },
  ]

  const insertQ = db.prepare(
    'INSERT INTO bp_quests (season_id, day_index, type, target, reward_bricks, description_ru, description_en) VALUES (?,?,?,?,?,?,?)'
  )
  for (const q of quests) {
    insertQ.run(seasonId, q.day, q.type, q.target, q.bricks, q.ru, q.en)
  }

  return db.prepare('SELECT * FROM bp_seasons WHERE id=?').get(seasonId)
}

// Инициализируем при старте сервера
let _activeSeason = null
try { _activeSeason = ensureBPSeason() } catch (e) { console.error('[BP] seed error:', e.message) }

// ─── updateBPProgress — вызывается из games.js ───
// eventType: 'win', 'win_ai_hard', 'win_online', 'close_golden', 'play'
export function updateBPProgress(userId, eventType, payload = {}) {
  try {
    const season = db.prepare('SELECT * FROM bp_seasons WHERE is_active=1').get()
    if (!season) return

    // Маппинг eventType → типы квестов которые инкрементируем
    const relevantTypes = {
      win:          ['win_n'],
      win_ai_hard:  ['win_n', 'win_ai_hard'],
      win_online:   ['win_n', 'win_online'],
      close_golden: ['close_golden'],
      play:         ['play_n'],
    }
    const types = relevantTypes[eventType] || []
    if (types.length === 0) return

    // Находим незавершённые квесты текущего сезона нужных типов
    const quests = db.prepare(
      `SELECT q.* FROM bp_quests q
       LEFT JOIN user_bp_progress p ON p.quest_id=q.id AND p.user_id=?
       WHERE q.season_id=? AND q.type IN (${types.map(() => '?').join(',')})
       AND (p.completed_at IS NULL OR p.completed_at=0)`
    ).all(userId, season.id, ...types)

    const now = Math.floor(Date.now() / 1000)
    for (const quest of quests) {
      // Upsert прогресса
      const existing = db.prepare(
        'SELECT progress FROM user_bp_progress WHERE user_id=? AND quest_id=?'
      ).get(userId, quest.id)

      if (existing) {
        const newProgress = existing.progress + 1
        const completedAt = newProgress >= quest.target ? now : null
        db.prepare(
          'UPDATE user_bp_progress SET progress=?, completed_at=? WHERE user_id=? AND quest_id=?'
        ).run(newProgress, completedAt, userId, quest.id)
      } else {
        const newProgress = 1
        const completedAt = newProgress >= quest.target ? now : null
        db.prepare(
          'INSERT INTO user_bp_progress (user_id, quest_id, progress, completed_at) VALUES (?,?,?,?)'
        ).run(userId, quest.id, newProgress, completedAt)
      }
    }
  } catch (e) {
    console.error('[BP] updateBPProgress error:', e.message)
  }
}

const router = Router()

// ─── GET /api/bp/current ───
router.get('/current', auth, (req, res) => {
  try {
    const season = db.prepare('SELECT * FROM bp_seasons WHERE is_active=1').get()
    if (!season) {
      // Пробуем создать
      try { ensureBPSeason() } catch {}
      const retried = db.prepare('SELECT * FROM bp_seasons WHERE is_active=1').get()
      if (!retried) return res.json({ season: null, quests: [] })
    }

    const activeSeason = season || db.prepare('SELECT * FROM bp_seasons WHERE is_active=1').get()

    const quests = db.prepare(`
      SELECT
        q.id, q.day_index, q.type, q.target, q.reward_bricks,
        q.description_ru, q.description_en,
        COALESCE(p.progress, 0) as progress,
        p.completed_at,
        COALESCE(p.reward_claimed, 0) as reward_claimed
      FROM bp_quests q
      LEFT JOIN user_bp_progress p ON p.quest_id=q.id AND p.user_id=?
      WHERE q.season_id=?
      ORDER BY q.day_index
    `).all(req.user.id, activeSeason.id)

    // Считаем суммарную статистику
    const totalQuests = quests.length
    const completedCount = quests.filter(q => q.completed_at).length
    const claimedCount = quests.filter(q => q.reward_claimed).length
    const totalEarnable = quests.reduce((s, q) => s + q.reward_bricks, 0)
    const totalEarned = quests.filter(q => q.reward_claimed).reduce((s, q) => s + q.reward_bricks, 0)

    res.set('Cache-Control', 'private, max-age=10')
    res.json({
      season: activeSeason,
      quests,
      stats: { totalQuests, completedCount, claimedCount, totalEarnable, totalEarned },
    })
  } catch (e) {
    console.error('[BP] GET /current error:', e.message)
    res.status(500).json({ error: 'Ошибка загрузки Battle Pass' })
  }
})

// ─── POST /api/bp/quests/:id/claim ───
// БАГ-ФИКС: раньше check-then-update без атомарности — двойной клик мог начислить
// награду дважды. Теперь UPDATE ... WHERE reward_claimed=0, проверяем changes>0.
router.post('/quests/:id/claim', auth, (req, res) => {
  const questId = parseInt(req.params.id, 10)
  if (!questId) return res.status(400).json({ error: 'invalid questId' })

  const quest = db.prepare(
    'SELECT q.* FROM bp_quests q JOIN bp_seasons s ON s.id=q.season_id WHERE q.id=? AND s.is_active=1'
  ).get(questId)
  if (!quest) return res.status(404).json({ error: 'Квест не найден' })

  const progress = db.prepare(
    'SELECT * FROM user_bp_progress WHERE user_id=? AND quest_id=?'
  ).get(req.user.id, questId)

  if (!progress?.completed_at) return res.status(400).json({ error: 'Квест не выполнен' })
  if (progress.reward_claimed) return res.status(409).json({ error: 'Награда уже получена' })

  // Атомарный claim: записываем только если ещё не заклеймлено.
  // Если другой одновременный запрос успел — changes=0 и кирпичи не начисляем.
  const claim = db.prepare(
    'UPDATE user_bp_progress SET reward_claimed=1 WHERE user_id=? AND quest_id=? AND reward_claimed=0'
  ).run(req.user.id, questId)

  if (claim.changes === 0) {
    // Гонка: кто-то уже заклеймил первым
    return res.status(409).json({ error: 'Награда уже получена' })
  }

  // Начисляем кирпичи только после успешного claim
  const newBalance = awardBricks(req.user.id, quest.reward_bricks, `bp_quest:${questId}`)

  res.json({ ok: true, bricksEarned: quest.reward_bricks, bricks: newBalance })
})

export default router
