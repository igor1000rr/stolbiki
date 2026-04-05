import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db, JWT_SECRET, bcrypt } from '../db.js'
import { formatUser, addXP } from '../helpers.js'

const router = Router()

// Админы задаются через ENV: ADMIN_USERNAMES=admin,igor (запятая-разделитель)
const ADMIN_NAMES = (process.env.ADMIN_USERNAMES || 'admin').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

const TOKEN_EXPIRY = '7d' // Было 30d — снижено для безопасности
const REFERRAL_XP = 100 // XP реферреру за каждого приглашённого

function generateReferralCode(username, id) {
  return username.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') + id.toString(36).toUpperCase()
}

router.post('/register', (req, res) => {
  const { username, email, password, referralCode } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const cleanName = String(username).trim().replace(/[<>&"']/g, '')
  if (cleanName.length < 2 || cleanName.length > 20) return res.status(400).json({ error: 'Username: 2-20 chars' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Password: min 6 chars' })

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanName)
  if (existing) return res.status(409).json({ error: 'Username taken' })

  const hash = bcrypt.hashSync(password, 10)
  const isAdmin = ADMIN_NAMES.includes(cleanName.toLowerCase()) ? 1 : 0

  // Проверяем реферальный код
  let referrerId = null
  if (referralCode) {
    const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(String(referralCode).trim().toUpperCase())
    if (referrer) referrerId = referrer.id
  }

  const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin, referred_by) VALUES (?, ?, ?, ?, ?)').run(cleanName, email || null, hash, isAdmin, referrerId)
  const userId = result.lastInsertRowid

  // Генерируем реферальный код
  const refCode = generateReferralCode(cleanName, userId)
  db.prepare('UPDATE users SET referral_code=? WHERE id=?').run(refCode, userId)

  // Начисляем XP рефереру
  if (referrerId) {
    try {
      db.prepare('INSERT INTO referrals (referrer_id, referred_id, xp_rewarded) VALUES (?, ?, ?)').run(referrerId, userId, REFERRAL_XP)
      addXP(referrerId, REFERRAL_XP)
    } catch {} // UNIQUE constraint — повторная регистрация
  }

  const token = jwt.sign({ id: userId, username: cleanName, isAdmin: !!isAdmin }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
  res.json({ token, user: { id: userId, username: cleanName, rating: 1000, isAdmin: !!isAdmin, referralCode: refCode } })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
  res.json({ token, user: formatUser(user) })
})

// ═══ Token Refresh ═══
// Принимает даже истёкший токен (с валидной подписью) в течение 30 дней — grace period.
// Позволяет юзеру не перелогиниваться если не заходил > 7 дней, но не дольше 30.
router.post('/refresh', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нет токена' })
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true })
  } catch {
    return res.status(401).json({ error: 'Неверная подпись' })
  }
  // Grace period: 30 дней после exp
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && now - payload.exp > 30 * 86400) {
    return res.status(401).json({ error: 'Токен слишком старый, войдите заново' })
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const newToken = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
  res.json({ token: newToken })
})

export default router
