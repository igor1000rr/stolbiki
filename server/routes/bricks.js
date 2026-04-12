/**
 * Монетизация — кирпичи + каталог скинов + покупка + экипировка
 * Issue #3, #8
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

try { db.prepare('ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50').run() } catch {}
try { db.prepare('ALTER TABLE users ADD COLUMN active_skin_blocks TEXT NOT NULL DEFAULT \'blocks_classic\'').run() } catch {}
try { db.prepare('ALTER TABLE users ADD COLUMN active_skin_stands TEXT NOT NULL DEFAULT \'stands_classic\'').run() } catch {}

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
  { id: 'blocks_classic',  type: 'blocks', ru: '\u041a\u043b\u0430\u0441\u0441\u0438\u043a\u0430',  en: 'Classic',   price: 0,   rarity: 'common' },
  { id: 'blocks_flat',     type: 'blocks', ru: '\u041f\u043b\u043e\u0441\u043a\u0438\u0435',   en: 'Flat',      price: 0,   rarity: 'common' },
  { id: 'blocks_round',    type: 'blocks', ru: '\u041a\u0440\u0443\u0433\u043b\u044b\u0435',   en: 'Round',     price: 50,  rarity: 'common' },
  { id: 'blocks_glass',    type: 'blocks', ru: '\u0421\u0442\u0435\u043a\u043b\u043e',    en: 'Glass',     price: 80,  rarity: 'rare' },
  { id: 'blocks_metal',    type: 'blocks', ru: '\u041c\u0435\u0442\u0430\u043b\u043b',    en: 'Metal',     price: 120, rarity: 'rare' },
  { id: 'blocks_candy',    type: 'blocks', ru: 'Candy',     en: 'Candy',     price: 200, rarity: 'epic' },
  { id: 'blocks_pixel',    type: 'blocks', ru: '\u041f\u0438\u043a\u0441\u0435\u043b\u044c',   en: 'Pixel',     price: 150, rarity: 'rare' },
  { id: 'blocks_neon',     type: 'blocks', ru: '\u041d\u0435\u043e\u043d',      en: 'Neon',      price: 300, rarity: 'epic' },
  { id: 'blocks_glow',     type: 'blocks', ru: '\u0421\u0432\u0435\u0447\u0435\u043d\u0438\u0435',  en: 'Glow',      price: 350, rarity: 'legendary' },
  { id: 'stands_classic',  type: 'stands', ru: '\u041a\u043b\u0430\u0441\u0441\u0438\u043a\u0430',  en: 'Classic',   price: 0,   rarity: 'common' },
  { id: 'stands_marble',   type: 'stands', ru: '\u041c\u0440\u0430\u043c\u043e\u0440',    en: 'Marble',    price: 60,  rarity: 'common' },
  { id: 'stands_concrete', type: 'stands', ru: '\u0411\u0435\u0442\u043e\u043d',     en: 'Concrete',  price: 40,  rarity: 'common' },
  { id: 'stands_bamboo',   type: 'stands', ru: '\u0411\u0430\u043c\u0431\u0443\u043a',    en: 'Bamboo',    price: 100, rarity: 'rare' },
  { id: 'stands_obsidian', type: 'stands', ru: '\u041e\u0431\u0441\u0438\u0434\u0438\u0430\u043d',  en: 'Obsidian',  price: 180, rarity: 'epic' },
  { id: 'stands_crystal',  type: 'stands', ru: '\u041a\u0440\u0438\u0441\u0442\u0430\u043b\u043b',  en: 'Crystal',   price: 250, rarity: 'epic' },
  { id: 'stands_rust',     type: 'stands', ru: '\u0420\u0436\u0430\u0432\u0447\u0438\u043d\u0430',  en: 'Rust',      price: 200, rarity: 'rare' },
  { id: 'stands_void',     type: 'stands', ru: 'Void',      en: 'Void',      price: 400, rarity: 'legendary' },
  { id: 'stands_ice',      type: 'stands', ru: '\u041b\u0451\u0434',       en: 'Ice',       price: 500, rarity: 'legendary' },
  { id: 'theme_default',   type: 'theme', ru: '\u0422\u0451\u043c\u043d\u0430\u044f',  en: 'Dark',     price: 0,   rarity: 'common' },
  { id: 'theme_forest',    type: 'theme', ru: '\u041b\u0435\u0441',      en: 'Forest',   price: 0,   rarity: 'common' },
  { id: 'theme_minimal',   type: 'theme', ru: '\u0421\u0432\u0435\u0442\u043b\u0430\u044f',  en: 'Light',    price: 0,   rarity: 'common' },
  { id: 'theme_ocean',     type: 'theme', ru: '\u041e\u043a\u0435\u0430\u043d',    en: 'Ocean',    price: 300, rarity: 'rare' },
  { id: 'theme_sunset',    type: 'theme', ru: '\u0417\u0430\u043a\u0430\u0442',    en: 'Sunset',   price: 400, rarity: 'rare' },
  { id: 'theme_royal',     type: 'theme', ru: '\u041a\u043e\u0440\u043e\u043b\u0435\u0432\u0441\u043a\u0430\u044f', en: 'Royal',  price: 400, rarity: 'epic' },
  { id: 'theme_sakura',    type: 'theme', ru: '\u0421\u0430\u043a\u0443\u0440\u0430',   en: 'Sakura',   price: 500, rarity: 'epic' },
  { id: 'theme_neon',      type: 'theme', ru: '\u041d\u0435\u043e\u043d',     en: 'Neon',     price: 600, rarity: 'legendary' },
  { id: 'theme_wood',      type: 'theme', ru: '\u0414\u0435\u0440\u0435\u0432\u043e',   en: 'Wood',     price: 300, rarity: 'rare' },
  { id: 'theme_arctic',    type: 'theme', ru: '\u0410\u0440\u043a\u0442\u0438\u043a\u0430',  en: 'Arctic',   price: 400, rarity: 'rare' },
  { id: 'theme_retro',     type: 'theme', ru: '\u0420\u0435\u0442\u0440\u043e',    en: 'Retro',    price: 500, rarity: 'epic' },
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
  if (!skinId) return res.status(400).json({ error: 'skinId \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u0435\u043d' })

  const skin = db.prepare('SELECT * FROM skins WHERE id=?').get(skinId)
  if (!skin) return res.status(404).json({ error: '\u0421\u043a\u0438\u043d \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d' })

  if (skin.price_bricks > 0) {
    const owned = db.prepare('SELECT 1 FROM user_skins WHERE user_id=? AND skin_id=?').get(req.user.id, skinId)
    if (!owned) return res.status(403).json({ error: '\u0421\u043a\u0438\u043d \u043d\u0435 \u043a\u0443\u043f\u043b\u0435\u043d' })
  }

  if (skin.type === 'blocks') {
    db.prepare('UPDATE users SET active_skin_blocks=? WHERE id=?').run(skinId, req.user.id)
  } else if (skin.type === 'stands') {
    db.prepare('UPDATE users SET active_skin_stands=? WHERE id=?').run(skinId, req.user.id)
  } else if (skin.type === 'theme') {
    // \u0422\u0435\u043c\u044b \u0445\u0440\u0430\u043d\u044f\u0442\u0441\u044f \u0432 localStorage \u043d\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0435, \u0437\u0434\u0435\u0441\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c \u0432\u043b\u0430\u0434\u0435\u043d\u0438\u0435
  } else {
    return res.status(400).json({ error: '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0442\u0438\u043f \u0441\u043a\u0438\u043d\u0430' })
  }

  res.json({ ok: true, type: skin.type, skinId })
})

router.post('/award', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: '\u0422\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440' })
  const { userId, amount, reason } = req.body
  if (!userId || !amount || !reason) return res.status(400).json({ error: 'userId, amount, reason \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b' })
  const target = db.prepare('SELECT id, username FROM users WHERE id=?').get(parseInt(userId, 10))
  if (!target) return res.status(404).json({ error: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d' })
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
  if (!skinId) return res.status(400).json({ error: 'skinId \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u0435\u043d' })

  const skin = db.prepare('SELECT * FROM skins WHERE id=? AND is_active=1').get(skinId)
  if (!skin) return res.status(404).json({ error: '\u0421\u043a\u0438\u043d \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d' })

  const alreadyOwned = db.prepare('SELECT 1 FROM user_skins WHERE user_id=? AND skin_id=?').get(req.user.id, skinId)
  if (alreadyOwned) return res.status(409).json({ error: '\u0421\u043a\u0438\u043d \u0443\u0436\u0435 \u0435\u0441\u0442\u044c' })

  if (skin.price_bricks === 0) {
    db.prepare('INSERT OR IGNORE INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'free')
    return res.json({ ok: true, bricks: null })
  }

  const user = db.prepare('SELECT bricks FROM users WHERE id=?').get(req.user.id)
  if (!user || user.bricks < skin.price_bricks) {
    return res.status(400).json({ error: '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043a\u0438\u0440\u043f\u0438\u0447\u0435\u0439', required: skin.price_bricks, current: user?.bricks ?? 0 })
  }

  const newBalance = awardBricks(req.user.id, -skin.price_bricks, `purchase_skin:${skinId}`)
  db.prepare('INSERT INTO user_skins (user_id, skin_id, acquired_via) VALUES (?,?,?)').run(req.user.id, skinId, 'bricks')

  res.json({ ok: true, bricks: newBalance, skinId })
})

export default router
