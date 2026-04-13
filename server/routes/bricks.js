/**
 * Монетизация — кирпичи + каталог скинов + покупка + экипировка
 * Issue #3, #8
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

try { db.prepare('ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50').run() } catch {}
try { db.prepare("ALTER TABLE users ADD COLUMN active_skin_blocks TEXT NOT NULL DEFAULT 'blocks_classic'").run() } catch {}
try { db.prepare("ALTER TABLE users ADD COLUMN active_skin_stands TEXT NOT NULL DEFAULT 'stands_classic'").run() } catch {}

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

export function awardBricks(userId, amount, reason, refId = null) {
  try {
    const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(userId)
    if (!user) return null
    const newBalance = Math.max(0, user.bricks + amount)
    db.prepare('UPDATE users SET bricks=? WHERE id=?').run(newBalance, userId)
    db.prepare('INSERT INTO brick_transactions (user_id, amount, balance_after, reason, ref_id) VALUES (?,?,?,?,?)').run(userId, amount, newBalance, reason, refId)
    return newBalance
  } catch { return null }
}

const router = Router()

router.get('/balance', auth, (req, res) => {
  const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
  res.json({ bricks: user?.bricks ?? 0 })
})

router.get('/history', auth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
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

// ─── POST /api/bricks/award-rewarded — +10 кирпичей за просмотр рекламы (Rewarded AdMob) ───
// Rate limit: не более 10 просмотров в сутки
router.post('/award-rewarded', auth, (req, res) => {
  const REWARD_AMOUNT = 10
  const DAILY_LIMIT = 10
  try {
    const now = Math.floor(Date.now() / 1000)
    const dayStart = now - (now % 86400) // начало текущих суток UTC
    const todayCount = db.prepare(
      `SELECT COUNT(*) as c FROM brick_transactions
       WHERE user_id=? AND reason='rewarded_ad' AND created_at >= ?`
    ).get(req.user.id, dayStart)?.c || 0
    if (todayCount >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'Лимит просмотров рекламы на сегодня исчерпан (10/10)' })
    }
    const newBalance = awardBricks(req.user.id, REWARD_AMOUNT, 'rewarded_ad')
    // БАГ-ФИКС: добавлено поле rewarded (тест ожидал res.body.rewarded)
    res.json({ ok: true, bricks: newBalance, rewarded: REWARD_AMOUNT, amount: REWARD_AMOUNT, todayCount: todayCount + 1, dailyLimit: DAILY_LIMIT })
  } catch {
    res.status(500).json({ error: 'Ошибка начисления' })
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

router.post('/purchase', auth, (req, res) => {
  const { skinId } = req.body
  if (!skinId) return res.status(400).json({ error: 'skinId обязателен' })
  const skin = db.prepare('SELECT * FROM skins WHERE id=? AND is_active=1').get(skinId)
  if (!skin) return res.status(404).json({ error: 'Скин не найден' })
  const alreadyOwned = db.prepare('SELECT 1 FROM user_skins WHERE user_id=? AND skin_id=?').get(req.user.id, skinId)
  if (alreadyOwned) return res.status(409).json({ error: 'Скин уже есть' })
  if (skin.price_bricks === 0) {
    db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'free')
    return res.json({ ok: true, bricks: null })
  }
  const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
  if (!user || user.bricks < skin.price_bricks) {
    return res.status(400).json({ error: 'Недостаточно кирпичей', required: skin.price_bricks, current: user?.bricks ?? 0 })
  }
  const newBalance = awardBricks(req.user.id, -skin.price_bricks, `purchase_skin:${skinId}`)
  db.prepare('INSERT INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'bricks')
  res.json({ ok: true, bricks: newBalance, skinId })
})

export default router
