/**
 * Монетизация — валюта-кирпичи (bricks)
 * Issue #3 эпика «Монетизация»
 *
 * Bootstrap: при импорте добавляет колонку bricks в users (если нет) и создаёт
 * таблицу brick_transactions.
 *
 * Экспортирует awardBricks(userId, amount, reason, refId?) — вызывается из games.js
 * и других роутов при начислении кирпичей.
 *
 * Эндпоинты:
 *   GET  /api/bricks/balance   — текущий баланс (auth)
 *   GET  /api/bricks/history   — последние 50 транзакций (auth)
 *   POST /api/bricks/award     — ручное начисление (admin only)
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

// ─── Bootstrap ───
// ALTER TABLE безопасен при повторном вызове — ловим SQLITE_ERROR если колонка уже есть
try {
  db.prepare('ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50').run()
  // Выдаём стартовые 50 кирпичей существующим игрокам (у новых уже DEFAULT 50)
  db.prepare("UPDATE users SET bricks = 50 WHERE bricks = 0 AND games_played = 0").run()
} catch {}

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

// ─── Хелпер: начисление / списание кирпичей ───
// Используется в games.js (награда за победу) и в других роутах.
// Возвращает новый баланс или null при ошибке.
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

export default router
