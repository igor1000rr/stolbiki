import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db, JWT_SECRET, bcrypt } from '../db.js'
import { formatUser, addXP } from '../helpers.js'

const router = Router()

const ADMIN_NAMES = (process.env.ADMIN_USERNAMES || 'admin').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const TOKEN_EXPIRY = '7d'
const REFERRAL_XP = 100
const REFERRAL_BRICKS_REG = 20
const REFERRAL_BRICKS_GAMES = 30

function generateReferralCode(username, id) {
  return username.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') + id.toString(36).toUpperCase()
}

function awardBricksToReferrer(referrerId, amount, reason, refId) {
  try {
    db.prepare('UPDATE users SET bricks = COALESCE(bricks, 0) + ? WHERE id=?').run(amount, referrerId)
    db.prepare('INSERT INTO brick_transactions (user_id, amount, reason, ref_id, created_at) VALUES (?,?,?,?,?)').run(referrerId, amount, reason, refId || null, Date.now())
  } catch {}
}

// PERF-ФИКС: bcrypt.hash (async) вместо hashSync — не блокирует event loop.
// При hashSync(pwd, 10) CPU занят ~70-100ms — весь сервер стопается, нельзя
// обрабатывать другие запросы. Async-версия отдаёт работу в пул потоков libuv.
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
    const cleanName = String(username).trim().replace(/[<>&"']/g, '')
    if (cleanName.length < 2 || cleanName.length > 20) return res.status(400).json({ error: 'Username: 2-20 chars' })
    if (String(password).length < 6) return res.status(400).json({ error: 'Password: min 6 chars' })

    // Валидация email: необязательное поле, но если прислан — должен быть валидным
    // (защита от мусора типа "<script>" или произвольных строк в БД).
    let cleanEmail = null
    if (email !== undefined && email !== null && email !== '') {
      const e = String(email).trim().toLowerCase()
      if (e.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return res.status(400).json({ error: 'Некорректный email' })
      }
      cleanEmail = e
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanName)
    if (existing) return res.status(409).json({ error: 'Username taken' })

    const hash = await bcrypt.hash(password, 10)
    const isAdmin = ADMIN_NAMES.includes(cleanName.toLowerCase()) ? 1 : 0

    let referrerId = null
    if (referralCode) {
      const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(String(referralCode).trim().toUpperCase())
      if (referrer) referrerId = referrer.id
    }

    const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin, referred_by) VALUES (?, ?, ?, ?, ?)').run(cleanName, cleanEmail, hash, isAdmin, referrerId)
    const userId = result.lastInsertRowid

    const refCode = generateReferralCode(cleanName, userId)
    db.prepare('UPDATE users SET referral_code=? WHERE id=?').run(refCode, userId)

    if (referrerId) {
      try {
        db.prepare('INSERT INTO referrals (referrer_id, referred_id, xp_rewarded) VALUES (?, ?, ?)').run(referrerId, userId, REFERRAL_XP)
        addXP(referrerId, REFERRAL_XP)
        awardBricksToReferrer(referrerId, REFERRAL_BRICKS_REG, 'referral_signup', userId)
      } catch {}
    }

    const token = jwt.sign({ id: userId, username: cleanName, isAdmin: !!isAdmin, tv: 0 }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
    res.json({ token, user: { id: userId, username: cleanName, rating: 1000, isAdmin: !!isAdmin, referralCode: refCode } })
  } catch (e) {
    // В тестах добавляем полный стектрейс в response — без этого CI выводит только "expected 500"
    // и не понять почему. На проде эту ветку не достигаем.
    console.error('[auth/register] error:', e)
    const payload = { error: 'Ошибка регистрации' }
    if (process.env.VITEST) {
      payload._debug = { message: e?.message, code: e?.code, stack: e?.stack?.slice(0, 500) }
    }
    res.status(500).json(payload)
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверный логин или пароль' })
    }
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
    res.json({ token, user: formatUser(user) })
  } catch (e) {
    console.error('[auth/login] error:', e)
    res.status(500).json({ error: 'Ошибка входа' })
  }
})

router.post('/refresh', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нет токена' })
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true })
  } catch {
    return res.status(401).json({ error: 'Неверная подпись' })
  }
  if (typeof payload.exp !== 'number') {
    return res.status(401).json({ error: 'Токен без exp, войдите заново' })
  }
  const now = Math.floor(Date.now() / 1000)
  if (now - payload.exp > 30 * 86400) {
    return res.status(401).json({ error: 'Токен слишком старый, войдите заново' })
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  if (payload.tv !== undefined && payload.tv !== (user.token_version || 0)) {
    return res.status(401).json({ error: 'Токен отозван. Войдите заново' })
  }
  const newToken = jwt.sign({ id: user.id, username: user.username, isAdmin: !!is_admin, tv: user.token_version || 0 }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
  res.json({ token: newToken })
})

export { REFERRAL_BRICKS_GAMES, awardBricksToReferrer }
export default router
