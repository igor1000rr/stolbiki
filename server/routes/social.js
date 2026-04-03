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
  const { userId } = req.body
  db.prepare('UPDATE friends SET status = "accepted" WHERE user_id = ? AND friend_id = ?').run(userId, req.user.id)
  db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, "accepted")').run(req.user.id, userId)
  res.json({ ok: true })
})

router.post('/friends/decline', auth, (req, res) => {
  const { userId } = req.body
  db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(userId, req.user.id)
  res.json({ ok: true })
})

router.post('/friends/remove', auth, (req, res) => {
  const { userId } = req.body
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
router.post('/friends/challenge', auth, (req, res) => {
  const { friendId } = req.body
  if (!friendId) return res.status(400).json({ error: 'friendId обязателен' })
  // Проверяем дружбу
  const friendship = db.prepare("SELECT * FROM friends WHERE user_id=? AND friend_id=? AND status='accepted'").get(req.user.id, friendId)
  if (!friendship) return res.status(403).json({ error: 'Не в друзьях' })
  // Генерируем комнату
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let roomId = ''
  for (let i = 0; i < 6; i++) roomId += chars[Math.floor(Math.random() * chars.length)]
  // Сохраняем вызов
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
      room_id TEXT NOT NULL, status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (from_id) REFERENCES users(id),
      FOREIGN KEY (to_id) REFERENCES users(id)
    )`)
  } catch {}
  // Отменяем старые вызовы от этого юзера
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
  const { challengeId, accept } = req.body
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

// ═══ Training Data ═══
router.post('/training', auth, (req, res) => {
  const { gameData, winner, totalMoves, mode, difficulty } = req.body
  // Ограничение размера game_data (макс 100KB)
  const json = JSON.stringify(gameData)
  if (json.length > 102400) return res.status(400).json({ error: 'Данные слишком большие (макс 100KB)' })
  db.prepare('INSERT INTO training_data (user_id, game_data, winner, total_moves, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, json, winner, totalMoves || 0, mode || 'ai', difficulty || 150)
  res.json({ ok: true })
})

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
