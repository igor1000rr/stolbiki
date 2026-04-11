/**
 * Монетизация — валюта-кирпичи (bricks) + каталог скинов + покупка
 * Issue #3 эпика «Монетизация»
 *
 * Bootstrap: bricks в users, brick_transactions, skins catalog, user_skins
 *
 * Экспортирует awardBricks(userId, amount, reason, refId?) — вызывается из games.js
 *
 * Эндпоинты:
 *   GET  /api/bricks/balance        — текущий баланс
 *   GET  /api/bricks/history        — последние транзакции
 *   POST /api/bricks/award          — ручная выдача (admin)
 *   GET  /api/bricks/skins          — каталог скинов
 *   GET  /api/bricks/owned          — мои скины
 *   POST /api/bricks/purchase       — купить скин за кирпичи
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

// ─── Bootstrap: bricks column ───
try {
  db.prepare('ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50').run()
} catch {}

// ─── Bootstrap: brick_transactions ───
db.exec(`
  CREATE TABLE IF NOT EXISTS brick_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    ref_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_brick_tx_user
    ON brick_transactions(user_id, created_at DESC);
`)

// ─── Bootstrap: skins catalog ───
db.exec(`
  CREATE TABLE IF NOT EXISTS skins (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name_ru TEXT, name_en TEXT,
    price_bricks INTEGER NOT NULL DEFAULT 0,
    rarity TEXT NOT NULL DEFAULT 'common',
    is_active INTEGER NOT NULL DEFAULT 1,
    released_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS user_skins (
    user_id INTEGER NOT NULL,
    skin_id TEXT NOT NULL,
    acquired_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    acquired_via TEXT DEFAULT 'bricks',
    PRIMARY KEY (user_id, skin_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// ─── Seed: базовые скины (бесплатные, выдаются всем новым) ───
const seedSkins = [
  // Блоки — бесплатные (доступны по уровню)
  { id: 'blocks_classic', type: 'blocks', ru: 'Классика', en: 'Classic', price: 0, rarity: 'common' },
  { id: 'blocks_flat',    type: 'blocks', ru: 'Плоские',  en: 'Flat',    price: 0, rarity: 'common' },
  // Блоки — платные (за кирпичи)
  { id: 'blocks_glass',   type: 'blocks', ru: 'Стекло',   en: 'Glass',   price: 80,  rarity: 'rare' },
  { id: 'blocks_metal',   type: 'blocks', ru: 'Металл',   en: 'Metal',   price: 120, rarity: 'rare' },
  { id: 'blocks_candy',   type: 'blocks', ru: 'Candy',    en: 'Candy',   price: 200, rarity: 'epic' },
  { id: 'blocks_pixel',   type: 'blocks', ru: 'Пиксель',  en: 'Pixel',   price: 150, rarity: 'rare' },
  { id: 'blocks_glow',    type: 'blocks', ru: 'Свечение', en: 'Glow',    price: 350, rarity: 'legendary' },
  // Стойки — бесплатные
  { id: 'stands_classic',  type: 'stands', ru: 'Классика',  en: 'Classic',  price: 0,   rarity: 'common' },
  { id: 'stands_marble',   type: 'stands', ru: 'Мрамор',    en: 'Marble',   price: 60,  rarity: 'common' },
  // Стойки — платные
  { id: 'stands_bamboo',   type: 'stands', ru: 'Бамбук',    en: 'Bamboo',   price: 100, rarity: 'rare' },
  { id: 'stands_obsidian', type: 'stands', ru: 'Обсидиан',  en: 'Obsidian', price: 180, rarity: 'epic' },
  { id: 'stands_crystal',  type: 'stands', ru: 'Кристалл',  en: 'Crystal',  price: 250, rarity: 'epic' },
  { id: 'stands_void',     type: 'stands', ru: 'Void',       en: 'Void',     price: 400, rarity: 'legendary' },
  { id: 'stands_ice',      type: 'stands', ru: 'Лёд',        en: 'Ice',      price: 500, rarity: 'legendary' },
]

const insertSkin = db.prepare('INSERT OR IGNORE INTO skins (id, type, name_ru, name_en, price_bricks, rarity) VALUES (?,?,?,?,?,?)')
for (const s of seedSkins) {
  insertSkin.run(s.id, s.type, s.ru, s.en, s.price, s.rarity)
}

// ─── Хелпер: начисление / списание кирпичей ───
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

// ─── GET /api/bricks/balance ───
router.get('/balance', auth, (req, res) => {
  const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
  res.json({ bricks: user?.bricks ?? 0 })
})

// ─── GET /api/bricks/history ───
router.get('/history', auth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
  const rows = db.prepare(`
    SELECT id, amount, balance_after, reason, ref_id, created_at
    FROM brick_transactions
    WHERE user_id=?
    ORDER BY created_at DESC LIMIT ?
  `).all(req.user.id, limit)
  res.json({ transactions: rows })
})

// ─── POST /api/bricks/award — ручная выдача (admin) ───
router.post('/award', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { userId, amount, reason } = req.body
  if (!userId || !amount || !reason) return res.status(400).json({ error: 'userId, amount, reason обязательны' })
  const target = db.prepare('SELECT id, username FROM users WHERE id=?').get(parseInt(userId, 10))
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' })
  const newBalance = awardBricks(target.id, parseInt(amount, 10), `admin:${reason}`)
  res.json({ ok: true, userId: target.id, username: target.username, bricks: newBalance })
})

// ─── GET /api/bricks/skins — каталог + owned ───
router.get('/skins', auth, (req, res) => {
  const allSkins = db.prepare('SELECT * FROM skins WHERE is_active=1 ORDER BY type, price_bricks').all()
  const ownedRows = db.prepare('SELECT skin_id FROM user_skins WHERE user_id=?').all(req.user.id)
  const owned = new Set(ownedRows.map(r => r.skin_id))
  res.set('Cache-Control', 'private, max-age=10')
  res.json({
    skins: allSkins.map(s => ({ ...s, owned: owned.has(s.id) })),
  })
})

// ─── GET /api/bricks/owned — только свои скины ───
router.get('/owned', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.type, s.name_ru, s.name_en, s.rarity, us.acquired_at, us.acquired_via
    FROM user_skins us JOIN skins s ON s.id = us.skin_id
    WHERE us.user_id=?
    ORDER BY us.acquired_at DESC
  `).all(req.user.id)
  res.json({ skins: rows })
})

// ─── POST /api/bricks/purchase — купить скин ───
router.post('/purchase', auth, (req, res) => {
  const { skinId } = req.body
  if (!skinId) return res.status(400).json({ error: 'skinId обязателен' })

  const skin = db.prepare('SELECT * FROM skins WHERE id=? AND is_active=1').get(skinId)
  if (!skin) return res.status(404).json({ error: 'Скин не найден' })

  // Проверяем что ещё не владеет
  const alreadyOwned = db.prepare('SELECT 1 FROM user_skins WHERE user_id=? AND skin_id=?').get(req.user.id, skinId)
  if (alreadyOwned) return res.status(409).json({ error: 'Скин уже есть' })

  // Бесплатный скин (price=0) — просто выдаём
  if (skin.price_bricks === 0) {
    db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'free')
    return res.json({ ok: true, bricks: null })
  }

  // Платный — списываем кирпичи
  const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
  if (!user || user.bricks < skin.price_bricks) {
    return res.status(400).json({ error: 'Недостаточно кирпичей', required: skin.price_bricks, current: user?.bricks ?? 0 })
  }

  const newBalance = awardBricks(req.user.id, -skin.price_bricks, `purchase_skin:${skinId}`)
  db.prepare('INSERT INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'bricks')

  res.json({ ok: true, bricks: newBalance, skinId })
})

export default router
