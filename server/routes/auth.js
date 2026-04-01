import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db, JWT_SECRET, bcrypt } from '../db.js'
import { formatUser } from '../helpers.js'

const router = Router()

router.post('/register', (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const cleanName = String(username).trim().replace(/[<>&"']/g, '')
  if (cleanName.length < 2 || cleanName.length > 20) return res.status(400).json({ error: 'Username: 2-20 chars' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Password: min 6 chars' })

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanName)
  if (existing) return res.status(409).json({ error: 'Username taken' })

  const hash = bcrypt.hashSync(password, 10)
  const adminNames = ['admin']
  const isAdmin = adminNames.includes(cleanName) ? 1 : 0

  const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(cleanName, email || null, hash, isAdmin)
  const token = jwt.sign({ id: result.lastInsertRowid, username: cleanName, isAdmin: !!isAdmin }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: { id: result.lastInsertRowid, username: cleanName, rating: 1000, isAdmin: !!isAdmin } })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: formatUser(user) })
})

export default router
