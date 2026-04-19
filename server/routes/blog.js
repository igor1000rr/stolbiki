import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

const router = Router()

// Сидинг вынесен в server/blog-seed.js — вызывается из db.js при старте.
// Здесь только уборка исторически устаревших слагов, которые могут оставаться
// в базах старых инстансов.
try {
  db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()
  db.prepare("DELETE FROM blog_posts WHERE slug='v43-confetti'").run()
} catch {}

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 10
  const offset = (page - 1) * perPage
  const posts = db.prepare('SELECT id, slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at FROM blog_posts WHERE published=1 ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?').all(perPage, offset)
  const total = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE published=1').get().c
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ posts, total, page, pages: Math.ceil(total / perPage) })
})

router.get('/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug=? AND published=1').get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Пост не найден' })
  res.set('Cache-Control', 'public, max-age=120')
  res.json(post)
})

router.post('/', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { slug, title_ru, title_en, body_ru, body_en, tag, pinned } = req.body
  if (!slug || !title_ru || !body_ru) return res.status(400).json({ error: 'slug, title_ru, body_ru обязательны' })
  try {
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(slug, title_ru, title_en || '', body_ru, body_en || '', tag || 'update', pinned ? 1 : 0)
    res.json({ ok: true })
  } catch { res.status(409).json({ error: 'Slug уже существует' }) }
})

router.put('/:slug', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { title_ru, title_en, body_ru, body_en, tag, pinned, published } = req.body
  const upd = db.prepare(`UPDATE blog_posts
      SET title_ru=COALESCE(?,title_ru), title_en=COALESCE(?,title_en),
          body_ru=COALESCE(?,body_ru), body_en=COALESCE(?,body_en),
          tag=COALESCE(?,tag), pinned=COALESCE(?,pinned), published=COALESCE(?,published),
          updated_at=datetime('now')
      WHERE slug=?`)
    .run(title_ru, title_en, body_ru, body_en, tag, pinned, published, req.params.slug)
  if (upd.changes === 0) return res.status(404).json({ error: 'Пост не найден' })
  res.json({ ok: true })
})

export default router
