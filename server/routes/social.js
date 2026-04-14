import { Router } from 'express'
import { db } from '../db.js'
import { auth, adminOnly } from '../middleware.js'
import { sanitize } from '../validate.js'

const router = Router()

// ═══ Friends ═══
router.post('/friends/request', auth, (req, res) => {
  const username = sanitize(req.body.username)
  if (!username) return res.status(400).json({ error: 'Username обязателен' })
  const friend = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (!friend) return res.status(404).json({ error: 'Пользователь не найден' })
  if (friend.id === req.user.id) return res.status(400).json({ error: 'Нельзя добавить себя' })
  const existing = db.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?').get(req.user.id, friend.id)
  if (existing) return res.status(409).json({ error: 'Запрос уже отправлен' })
  db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, "pending")').run(req.user.id, friend.id)
  res.json({ ok: true })
})

router.post('/friends/accept', auth, (req, res) => {
  const userId = Number(req.body.userId)
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' })
  // Принять можно только существующий pending запрос от этого юзера
  const pending = db.prepare("SELECT id FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'").get(userId, req.user.id)
  if (!pending) return res.status(404).json({ error: 'Запрос не найден' })
  db.prepare('UPDATE friends SET status = "accepted" WHERE id = ?').run(pending.id)
  db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, "accepted")').run(req.user.id, userId)
  res.json({ ok: true })
})

router.post('/friends/decline', auth, (req, res) => {
  const userId = Number(req.body.userId)
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' })
  db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(userId, req.user.id)
  res.json({ ok: true })
})

router.post('/friends/remove', auth, (req, res) => {
  const userId = Number(req.body.userId)
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'userId обязателен' })
  db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(req.user.id, userId, userId, req.user.id)
  res.json({ ok: true })
})

router.get('/friends', auth, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.username, u.rating, u.last_seen, f.status
    FROM friends f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'accepted'
  `).all(req.user.id)
  const pending = db.prepare(`
    SELECT u.id, u.username, u.rating
    FROM friends f JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `).all(req.user.id)
  res.json({ friends, pending })
})

// ═══ Friend Challenge ═══
// Таблица challenges создаётся в db.js (CREATE TABLE IF NOT EXISTS) при старте —
// раньше здесь был CREATE TABLE на каждый POST-запрос, это лишний overhead.
router.post('/friends/challenge', auth, (req, res) => {
  const friendId = Number(req.body.friendId)
  if (!Number.isInteger(friendId) || friendId <= 0) return res.status(400).json({ error: 'friendId обязателен' })
  if (friendId === req.user.id) return res.status(400).json({ error: 'Нельзя вызвать самого себя' })
  // Проверяем дружбу
  const friendship = db.prepare("SELECT 1 FROM friends WHERE user_id=? AND friend_id=? AND status='accepted'").get(req.user.id, friendId)
  if (!friendship) return res.status(403).json({ error: 'Не в друзьях' })
  // Генерируем комнату (без похожих символов 0/O/1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let roomId = ''
  for (let i = 0; i < 6; i++) roomId += chars[Math.floor(Math.random() * chars.length)]
  // Отменяем старые pending-вызовы от этого юзера
  db.prepare("UPDATE challenges SET status='expired' WHERE from_id=? AND status='pending'").run(req.user.id)
  db.prepare('INSERT INTO challenges (from_id, to_id, room_id) VALUES (?, ?, ?)').run(req.user.id, friendId, roomId)
  const fromUser = db.prepare('SELECT username FROM users WHERE id=?').get(req.user.id)
  res.json({ roomId, from: fromUser?.username })
})

router.get('/friends/challenges', auth, (req, res) => {
  const challenges = db.prepare(`
    SELECT c.id, c.room_id, c.created_at, u.username as from_username, u.rating as from_rating
    FROM challenges c JOIN users u ON u.id = c.from_id
    WHERE c.to_id = ? AND c.status = 'pending' AND c.created_at > datetime('now', '-5 minutes')
    ORDER BY c.created_at DESC
  `).all(req.user.id)
  res.json(challenges)
})

router.post('/friends/challenge/respond', auth, (req, res) => {
  const challengeId = Number(req.body.challengeId)
  const accept = !!req.body.accept
  if (!Number.isInteger(challengeId) || challengeId <= 0) return res.status(400).json({ error: 'challengeId обязателен' })
  const challenge = db.prepare('SELECT * FROM challenges WHERE id=? AND to_id=? AND status=?').get(challengeId, req.user.id, 'pending')
  if (!challenge) return res.status(404).json({ error: 'Вызов не найден или истёк' })
  db.prepare('UPDATE challenges SET status=? WHERE id=?').run(accept ? 'accepted' : 'declined', challengeId)
  res.json({ ok: true, roomId: accept ? challenge.room_id : null })
})

// ═══ Search ═══
router.get('/users/search', auth, (req, res) => {
  const q = req.query.q
  if (!q || q.length < 2) return res.json([])
  const escaped = q.replace(/[%_]/g, '\\$&')
  const users = db.prepare("SELECT id, username, rating FROM users WHERE username LIKE ? ESCAPE '\\' AND id != ? LIMIT 10").all(`%${escaped}%`, req.user.id)
  res.json(users)
})

// БАГ-ФИКС: удалён дубль POST /training (был здесь без rateLimit и без walkMoves).
// В games.js есть правильная версия с rateLimit(3600000, 10) и anti-cheat через walkMoves —
// она mount'ится первой (см. server.js), поэтому этот дубль был dead code, но представлял
// риск регрессии: если кто-то поменяет порядок mount — клиент сможет спамить training_data
// и обходить проверку легальности ходов. Убран.
//
// Admin-роуты GET /training/stats и GET /training/export дублируются в admin.js
// (/api/admin/training, /api/admin/training/export-gpu) — оставлены как есть для обратной
// совместимости, но стоит перевести на /api/admin/* и убрать отсюда в будущем.
router.get('/training/stats', auth, adminOnly, (req, res) => {
  const stats = db.prepare('SELECT COUNT(*) as games, SUM(total_moves) as moves FROM training_data').get()
  const byMode = db.prepare('SELECT mode, COUNT(*) as count FROM training_data GROUP BY mode').all()
  res.json({ ...stats, byMode })
})

router.get('/training/export', auth, adminOnly, (req, res) => {
  const data = db.prepare('SELECT game_data, winner FROM training_data ORDER BY created_at DESC LIMIT 500').all()
  res.json(data.map(d => ({ ...JSON.parse(d.game_data), winner: d.winner })))
})

export default router
