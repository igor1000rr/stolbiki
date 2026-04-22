/**
 * Монетизация — кирпичи + каталог скинов + покупка + экипировка
 * Issue #3, #8
 *
 * Колонки users.bricks, active_skin_blocks, active_skin_stands создаются в миграции 8 (db.js).
 * Таблицы brick_transactions / skins / user_skins создаём здесь (CREATE TABLE IF NOT EXISTS).
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'
import { verifyAdmobSsv } from '../admob-ssv.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS brick_transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    amount     INTEGER NOT NULL,
    balance_after INTEGER NOT NULL DEFAULT 0,
    reason     TEXT    NOT NULL,
    ref_id     INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_brick_tx_user
    ON brick_transactions(user_id, created_at DESC);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS skins (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    name_ru      TEXT, name_en TEXT,
    price_bricks INTEGER NOT NULL DEFAULT 0,
    rarity       TEXT NOT NULL DEFAULT 'common',
    is_active    INTEGER NOT NULL DEFAULT 1,
    released_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS user_skins (
    user_id     INTEGER NOT NULL,
    skin_id     TEXT    NOT NULL,
    acquired_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    acquired_via TEXT   DEFAULT 'bricks',
    PRIMARY KEY (user_id, skin_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// Таблица для защиты от replay в AdMob SSV — храним последние transaction_id.
db.exec(`
  CREATE TABLE IF NOT EXISTS admob_ssv_txs (
    transaction_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_admob_ssv_txs_created
    ON admob_ssv_txs(created_at DESC);
`)

const seedSkins = [
  { id: 'blocks_classic',  type: 'blocks', ru: 'Классика',  en: 'Classic',   price: 0,   rarity: 'common' },
  { id: 'blocks_flat',     type: 'blocks', ru: 'Плоские',   en: 'Flat',      price: 0,   rarity: 'common' },
  { id: 'blocks_round',    type: 'blocks', ru: 'Круглые',   en: 'Round',     price: 50,  rarity: 'common' },
  { id: 'blocks_glass',    type: 'blocks', ru: 'Стекло',    en: 'Glass',     price: 80,  rarity: 'rare' },
  { id: 'blocks_metal',    type: 'blocks', ru: 'Металл',    en: 'Metal',     price: 120, rarity: 'rare' },
  { id: 'blocks_candy',    type: 'blocks', ru: 'Candy',     en: 'Candy',     price: 200, rarity: 'epic' },
  { id: 'blocks_pixel',    type: 'blocks', ru: 'Пиксель',   en: 'Pixel',     price: 150, rarity: 'rare' },
  { id: 'blocks_neon',     type: 'blocks', ru: 'Неон',      en: 'Neon',      price: 300, rarity: 'epic' },
  { id: 'blocks_glow',     type: 'blocks', ru: 'Свечение',  en: 'Glow',      price: 350, rarity: 'legendary' },
  { id: 'stands_classic',  type: 'stands', ru: 'Классика',  en: 'Classic',   price: 0,   rarity: 'common' },
  { id: 'stands_marble',   type: 'stands', ru: 'Мрамор',    en: 'Marble',    price: 60,  rarity: 'common' },
  { id: 'stands_concrete', type: 'stands', ru: 'Бетон',     en: 'Concrete',  price: 40,  rarity: 'common' },
  { id: 'stands_bamboo',   type: 'stands', ru: 'Бамбук',    en: 'Bamboo',    price: 100, rarity: 'rare' },
  { id: 'stands_obsidian', type: 'stands', ru: 'Обсидиан',  en: 'Obsidian',  price: 180, rarity: 'epic' },
  { id: 'stands_crystal',  type: 'stands', ru: 'Кристалл',  en: 'Crystal',   price: 250, rarity: 'epic' },
  { id: 'stands_rust',     type: 'stands', ru: 'Ржавчина',  en: 'Rust',      price: 200, rarity: 'rare' },
  { id: 'stands_void',     type: 'stands', ru: 'Void',      en: 'Void',      price: 400, rarity: 'legendary' },
  { id: 'stands_ice',      type: 'stands', ru: 'Лёд',       en: 'Ice',       price: 500, rarity: 'legendary' },
  { id: 'theme_default',   type: 'theme', ru: 'Тёмная',  en: 'Dark',     price: 0,   rarity: 'common' },
  { id: 'theme_forest',    type: 'theme', ru: 'Лес',      en: 'Forest',   price: 0,   rarity: 'common' },
  { id: 'theme_minimal',   type: 'theme', ru: 'Светлая',  en: 'Light',    price: 0,   rarity: 'common' },
  { id: 'theme_ocean',     type: 'theme', ru: 'Океан',    en: 'Ocean',    price: 300, rarity: 'rare' },
  { id: 'theme_sunset',    type: 'theme', ru: 'Закат',    en: 'Sunset',   price: 400, rarity: 'rare' },
  { id: 'theme_royal',     type: 'theme', ru: 'Королевская', en: 'Royal',  price: 400, rarity: 'epic' },
  { id: 'theme_sakura',    type: 'theme', ru: 'Сакура',   en: 'Sakura',   price: 500, rarity: 'epic' },
  { id: 'theme_neon',      type: 'theme', ru: 'Неон',     en: 'Neon',     price: 600, rarity: 'legendary' },
  { id: 'theme_wood',      type: 'theme', ru: 'Дерево',   en: 'Wood',     price: 300, rarity: 'rare' },
  { id: 'theme_arctic',    type: 'theme', ru: 'Арктика',  en: 'Arctic',   price: 400, rarity: 'rare' },
  { id: 'theme_retro',     type: 'theme', ru: 'Ретро',    en: 'Retro',    price: 500, rarity: 'epic' },
]
const insertSkin = db.prepare('INSERT OR IGNORE INTO skins (id, type, name_ru, name_en, price_bricks, rarity) VALUES (?,?,?,?,?,?)')
for (const s of seedSkins) insertSkin.run(s.id, s.type, s.ru, s.en, s.price, s.rarity)

// SECURITY-ФИКС: обёрнуто в db.transaction() — UPDATE баланса и INSERT транзакции
// раньше могли разъехаться при ошибке (orphan INSERT без обновлённого баланса).
export function awardBricks(userId, amount, reason, refId = null) {
  try {
    const tx = db.transaction(() => {
      const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(userId)
      if (!user) return null
      const newBalance = Math.max(0, user.bricks + amount)
      db.prepare('UPDATE users SET bricks=? WHERE id=?').run(newBalance, userId)
      db.prepare('INSERT INTO brick_transactions (user_id, amount, balance_after, reason, ref_id) VALUES (?,?,?,?,?)').run(userId, amount, newBalance, reason, refId)
      return newBalance
    })
    return tx()
  } catch { return null }
}

const router = Router()

router.get('/balance', auth, (req, res) => {
  const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
  res.json({ bricks: user?.bricks ?? 0 })
})

// SECURITY-ФИКС: limit теперь clamp'ится через Math.max(1, ...) — раньше при
// limit=-1 SQLite возвращал ВСЕ строки (спецсемантика LIMIT -1).
router.get('/history', auth, (req, res) => {
  const raw = parseInt(req.query.limit, 10) || 50
  const limit = Math.max(1, Math.min(100, raw))
  const rows = db.prepare(`
    SELECT id, amount, balance_after, reason, ref_id, created_at
    FROM brick_transactions WHERE user_id=?
    ORDER BY created_at DESC LIMIT ?
  `).all(req.user.id, limit)
  res.json({ transactions: rows })
})

router.get('/active', auth, (req, res) => {
  const user = db.prepare('SELECT active_skin_blocks, active_skin_stands FROM users WHERE id=?').get(req.user.id)
  res.json({
    blocks: user?.active_skin_blocks || 'blocks_classic',
    stands: user?.active_skin_stands || 'stands_classic',
  })
})

router.post('/equip', auth, (req, res) => {
  const { skinId } = req.body
  if (!skinId) return res.status(400).json({ error: 'skinId обязателен' })
  const skin = db.prepare('SELECT * FROM skins WHERE id=?').get(skinId)
  if (!skin) return res.status(404).json({ error: 'Скин не найден' })
  if (skin.price_bricks > 0) {
    const owned = db.prepare('SELECT 1 FROM user_skins WHERE user_id=? AND skin_id=?').get(req.user.id, skinId)
    if (!owned) return res.status(403).json({ error: 'Скин не куплен' })
  }
  if (skin.type === 'blocks') {
    db.prepare('UPDATE users SET active_skin_blocks=? WHERE id=?').run(skinId, req.user.id)
  } else if (skin.type === 'stands') {
    db.prepare('UPDATE users SET active_skin_stands=? WHERE id=?').run(skinId, req.user.id)
  } else if (skin.type !== 'theme') {
    return res.status(400).json({ error: 'Неизвестный тип скина' })
  }
  res.json({ ok: true, type: skin.type, skinId })
})

// ─── POST /api/bricks/award-rewarded — legacy client-trust endpoint ───
// Используется только когда ADMOB_SSV_ENABLED ВЫКЛЮЧен. Клиент сам вызывает
// с JWT после просмотра рекламы — без server-side verification. Для production
// нужно включать SSV (GET /api/bricks/admob-ssv).
router.post('/award-rewarded', auth, (req, res) => {
  const REWARD_AMOUNT = 10
  const DAILY_LIMIT = 10
  try {
    // Если SSV включен — блокируем легаси endpoint (он небезопасен).
    // Клиент должен переключиться на AdMob SDK с настроенным SSV-callback.
    if (process.env.ADMOB_SSV_ENABLED === '1') {
      return res.status(410).json({
        error: 'Legacy endpoint disabled in SSV mode. Use AdMob SSV callback.',
      })
    }

    const now = Math.floor(Date.now() / 1000)
    const dayStart = now - (now % 86400) // начало текущих суток UTC
    const todayCount = db.prepare(
      `SELECT COUNT(*) as c FROM brick_transactions
       WHERE user_id=? AND reason LIKE 'rewarded_ad%' AND created_at >= ?`
    ).get(req.user.id, dayStart)?.c || 0
    if (todayCount >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'Лимит просмотров рекламы на сегодня исчерпан (10/10)' })
    }
    const newBalance = awardBricks(req.user.id, REWARD_AMOUNT, 'rewarded_ad')
    res.json({ ok: true, bricks: newBalance, rewarded: REWARD_AMOUNT, amount: REWARD_AMOUNT, todayCount: todayCount + 1, dailyLimit: DAILY_LIMIT })
  } catch {
    res.status(500).json({ error: 'Ошибка начисления' })
  }
})

// ─── GET /api/bricks/admob-ssv — реальный AdMob Server-Side Verification callback ───
//
// Этот endpoint вызывает САМ Google AdMob после просмотра рекламы на клиенте
// (Android/iOS через AdMob SDK). Ни JWT юзера, ни auth middleware не применяем
// — только ECDSA-подпись Google. user_id передаётся в query (custom_data).
//
// Настройка:
//   1) В AdMob Console указать в настройках rewarded ad unit:
//      SSV callback URL = https://highriseheist.com/api/bricks/admob-ssv
//   2) В клиенте при показе рекламы установить customData = user_id (из JWT)
//   3) Env ADMOB_SSV_ENABLED=1 и ADMOB_AD_UNIT=ca-app-pub-.../... (опционально для строгой проверки)
//
// Все проверки:
//   ✓ ECDSA P-256 SHA-256 подпись от Google (против replay и подделки)
//   ✓ timestamp свежий (не старше 1 часа)
//   ✓ transaction_id уникален (PK constraint в admob_ssv_txs)
//   ✓ reward_amount в ограниченном диапазоне (1-100)
//   ✓ user_id существует в нашей БД
//   ✓ daily limit 10 просмотров/сутки (на всякий случай)
router.get('/admob-ssv', async (req, res) => {
  if (process.env.ADMOB_SSV_ENABLED !== '1') {
    return res.status(404).json({ error: 'SSV not enabled' })
  }

  try {
    const {
      signature, key_id,
      user_id, custom_data, transaction_id,
      reward_amount, reward_item, timestamp, ad_unit,
    } = req.query

    // 1. Verify ECDSA signature
    const verification = await verifyAdmobSsv({
      originalUrl: req.originalUrl,
      signature,
      keyId: key_id,
    })
    if (!verification.ok) {
      console.warn('[admob-ssv] signature verify failed:', verification.reason)
      return res.status(403).json({ error: 'signature_invalid' })
    }

    // 2. Timestamp freshness (<=1h)
    const tsMs = Number(timestamp)
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 60 * 60 * 1000) {
      return res.status(400).json({ error: 'timestamp_expired' })
    }

    // 3. Optional ad_unit whitelist (если настроен в env)
    if (process.env.ADMOB_AD_UNIT && ad_unit && ad_unit !== process.env.ADMOB_AD_UNIT) {
      console.warn('[admob-ssv] ad_unit mismatch:', ad_unit, 'vs', process.env.ADMOB_AD_UNIT)
      return res.status(403).json({ error: 'ad_unit_mismatch' })
    }

    // 4. Resolve user_id — приоритет custom_data (клиент его устанавливает из JWT),
    //    фолбэк — user_id query параметр (AdMob иногда не передаёт custom_data).
    const resolvedUserId = parseInt(custom_data || user_id, 10)
    if (!Number.isFinite(resolvedUserId) || resolvedUserId <= 0) {
      return res.status(400).json({ error: 'invalid_user_id' })
    }
    const userExists = db.prepare('SELECT id FROM users WHERE id=?').get(resolvedUserId)
    if (!userExists) {
      return res.status(404).json({ error: 'user_not_found' })
    }

    // 5. Transaction_id uniqueness — replay protection
    if (!transaction_id || typeof transaction_id !== 'string' || transaction_id.length > 128) {
      return res.status(400).json({ error: 'invalid_transaction_id' })
    }
    const insertTx = db.prepare(
      'INSERT OR IGNORE INTO admob_ssv_txs (transaction_id, user_id) VALUES (?, ?)'
    ).run(String(transaction_id).slice(0, 128), resolvedUserId)
    if (insertTx.changes === 0) {
      // Уже обработано — возвращаем 200 (Google может ретрайнуть, это нормально)
      return res.status(200).json({ ok: true, duplicate: true })
    }

    // 6. Reward amount с валидацией
    const amount = Math.max(1, Math.min(100, parseInt(reward_amount, 10) || 10))

    // 7. Daily limit (defense in depth)
    const DAILY_LIMIT = 10
    const now = Math.floor(Date.now() / 1000)
    const dayStart = now - (now % 86400)
    const todayCount = db.prepare(
      `SELECT COUNT(*) as c FROM brick_transactions
       WHERE user_id=? AND reason LIKE 'rewarded_ad%' AND created_at >= ?`
    ).get(resolvedUserId, dayStart)?.c || 0
    if (todayCount >= DAILY_LIMIT) {
      // SSV уже проверен, но лимит достигнут — отвечаем 200 без начисления
      return res.status(200).json({ ok: true, capped: true })
    }

    const newBalance = awardBricks(resolvedUserId, amount, `rewarded_ad:ssv:${transaction_id}`)

    res.status(200).json({
      ok: true,
      user_id: resolvedUserId,
      awarded: amount,
      bricks: newBalance,
      reward_item: reward_item || 'bricks',
    })
  } catch (e) {
    console.error('[admob-ssv] unexpected error:', e)
    res.status(500).json({ error: 'internal_error' })
  }
})

router.post('/award', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { userId, amount, reason } = req.body
  if (!userId || !amount || !reason) return res.status(400).json({ error: 'userId, amount, reason обязательны' })
  const target = db.prepare('SELECT id, username FROM users WHERE id=?').get(parseInt(userId, 10))
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' })
  const newBalance = awardBricks(target.id, parseInt(amount, 10), `admin:${reason}`)
  res.json({ ok: true, userId: target.id, username: target.username, bricks: newBalance })
})

// ─── GET /api/bricks/skins — каталог + owned + active + bricks ───
router.get('/skins', auth, (req, res) => {
  const allSkins = db.prepare('SELECT * FROM skins WHERE is_active=1 ORDER BY type, price_bricks').all()
  const ownedRows = db.prepare('SELECT skin_id FROM user_skins WHERE user_id=?').all(req.user.id)
  const owned = new Set(ownedRows.map(r => r.skin_id))
  const user = db.prepare('SELECT active_skin_blocks, active_skin_stands, bricks FROM users WHERE id=?').get(req.user.id)
  const activeBlocks = user?.active_skin_blocks || 'blocks_classic'
  const activeStands = user?.active_skin_stands || 'stands_classic'
  res.set('Cache-Control', 'private, max-age=10')
  res.json({
    skins: allSkins.map(s => ({
      ...s,
      owned: owned.has(s.id) || s.price_bricks === 0,
      equipped: s.id === activeBlocks || s.id === activeStands,
    })),
    active: { blocks: activeBlocks, stands: activeStands },
    bricks: user?.bricks ?? 0,
  })
})

router.get('/owned', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.type, s.name_ru, s.name_en, s.rarity, us.acquired_at, us.acquired_via
    FROM user_skins us JOIN skins s ON s.id = us.skin_id
    WHERE us.user_id=?
    ORDER BY us.acquired_at DESC
  `).all(req.user.id)
  const freeBase = db.prepare("SELECT id, type, name_ru, name_en, rarity FROM skins WHERE price_bricks=0 AND is_active=1").all()
  const ownedIds = new Set(rows.map(r => r.id))
  const freeMissing = freeBase.filter(s => !ownedIds.has(s.id))
  res.json({ skins: [...rows, ...freeMissing.map(s => ({ ...s, acquired_via: 'free', acquired_at: 0 }))] })
})

// SECURITY-ФИКС: TOCTOU race на параллельных purchase. Раньше:
//   SELECT bricks → check → awardBricks → INSERT user_skins
// — два запроса могли оба пройти check, списать бриксы дважды, второй INSERT
// падал на PK-constraint и возвращал 500 с уже потерянными бриксами.
//
// Теперь всё в db.transaction(): сначала INSERT OR IGNORE — если скин уже есть,
// changes===0 и мы откатываемся без списания. Если INSERT прошёл — только тогда
// проверяем баланс и списываем. SQLite BEGIN IMMEDIATE гарантирует exclusive lock.
router.post('/purchase', auth, (req, res) => {
  const { skinId } = req.body
  if (!skinId) return res.status(400).json({ error: 'skinId обязателен' })
  const skin = db.prepare('SELECT * FROM skins WHERE id=? AND is_active=1').get(skinId)
  if (!skin) return res.status(404).json({ error: 'Скин не найден' })

  // Бесплатные скины — отдельная быстрая ветка
  if (skin.price_bricks === 0) {
    db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'free')
    return res.json({ ok: true, bricks: null })
  }

  try {
    const tx = db.transaction(() => {
      const ins = db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)')
        .run(req.user.id, skinId, 'bricks')
      if (ins.changes === 0) {
        const err = new Error('already_owned')
        err.code = 'ALREADY_OWNED'
        throw err
      }
      const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
      if (!user || user.bricks < skin.price_bricks) {
        const err = new Error('not_enough')
        err.code = 'NOT_ENOUGH'
        err.required = skin.price_bricks
        err.current = user?.bricks ?? 0
        throw err
      }
      const newBalance = user.bricks - skin.price_bricks
      db.prepare('UPDATE users SET bricks=? WHERE id=?').run(newBalance, req.user.id)
      db.prepare('INSERT INTO brick_transactions (user_id, amount, balance_after, reason, ref_id) VALUES (?,?,?,?,?)')
        .run(req.user.id, -skin.price_bricks, newBalance, `purchase_skin:${skinId}`, null)
      return newBalance
    })
    const newBalance = tx()
    return res.json({ ok: true, bricks: newBalance, skinId })
  } catch (e) {
    if (e.code === 'ALREADY_OWNED') return res.status(409).json({ error: 'Скин уже есть' })
    if (e.code === 'NOT_ENOUGH') return res.status(400).json({ error: 'Недостаточно кирпичей', required: e.required, current: e.current })
    console.error('[bricks] purchase error:', e)
    return res.status(500).json({ error: 'Ошибка покупки' })
  }
})

export default router
