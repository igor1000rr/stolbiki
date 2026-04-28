/**
 * Integration-тесты для /api/blog/* через supertest.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'
import { db } from '../db.js'

let counter = 0
function uniqueName(prefix = 'bl') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser({ admin = false } = {}) {
  const username = uniqueName(admin ? 'admin' : 'bl')
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  if (admin) {
    db.prepare('UPDATE users SET is_admin=1 WHERE id=?').run(res.body.user.id)
    // Перелогинимся чтобы token имел isAdmin: true
    const login = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    return { token: login.body.token, user: login.body.user }
  }
  return { token: res.body.token, user: res.body.user }
}

describe('GET /api/blog/', () => {
  it('200 + схема пагинации', async () => {
    const res = await request(app).get('/api/blog/')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.posts)).toBe(true)
    expect(typeof res.body.total).toBe('number')
    expect(typeof res.body.page).toBe('number')
    expect(typeof res.body.pages).toBe('number')
  })

  it('не требует авторизации', async () => {
    const res = await request(app).get('/api/blog/')
    expect(res.status).toBe(200)
  })

  it('Cache-Control max-age', async () => {
    const res = await request(app).get('/api/blog/')
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/)
  })

  it('?page=2 возвращает page=2', async () => {
    const res = await request(app).get('/api/blog/?page=2')
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(2)
  })

  it('?page=999 → пустой массив, не ошибка', async () => {
    const res = await request(app).get('/api/blog/?page=999')
    expect(res.status).toBe(200)
    expect(res.body.posts).toEqual([])
  })

  it('?page=invalid → page=1 (sanitization)', async () => {
    const res = await request(app).get('/api/blog/?page=abc')
    expect(res.body.page).toBe(1)
  })
})

describe('GET /api/blog/:slug', () => {
  it('404 для несуществующего slug', async () => {
    const res = await request(app).get('/api/blog/non-existent-slug-' + Date.now())
    expect(res.status).toBe(404)
  })

  it('SQL injection в slug → 404, не 500', async () => {
    const res = await request(app).get("/api/blog/' OR 1=1 --")
    expect([400, 404]).toContain(res.status)
  })
})

describe('POST /api/blog/ (create)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/blog/').send({ slug: 'x', title_ru: 'T', body_ru: 'B' })
    expect(res.status).toBe(401)
  })

  it('403 для обычного юзера', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({ slug: 'x', title_ru: 'T', body_ru: 'B' })
    expect(res.status).toBe(403)
  })

  it('400 от админа без обязательных полей', async () => {
    const { token } = await makeUser({ admin: true })
    const res = await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({ slug: 'x' })
    expect(res.status).toBe(400)
  })

  it('админ создаёт пост → 200, и он появляется в GET', async () => {
    const { token } = await makeUser({ admin: true })
    const slug = 'test-post-' + Date.now().toString(36)
    const res = await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({
      slug, title_ru: 'Тест', body_ru: 'Тело поста', tag: 'update',
    })
    expect(res.status).toBe(200)

    const get = await request(app).get('/api/blog/' + slug)
    expect(get.status).toBe(200)
    expect(get.body.slug).toBe(slug)
    expect(get.body.title_ru).toBe('Тест')
  })

  it('дубликат slug → 409', async () => {
    const { token } = await makeUser({ admin: true })
    const slug = 'dup-' + Date.now().toString(36)
    const a = await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({
      slug, title_ru: 'A', body_ru: 'A',
    })
    expect(a.status).toBe(200)

    const b = await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({
      slug, title_ru: 'B', body_ru: 'B',
    })
    expect(b.status).toBe(409)
  })
})

describe('PUT /api/blog/:slug (update)', () => {
  it('401 без auth', async () => {
    const res = await request(app).put('/api/blog/some-slug').send({ title_ru: 'X' })
    expect(res.status).toBe(401)
  })

  it('403 для обычного юзера', async () => {
    const { token } = await makeUser()
    const res = await request(app).put('/api/blog/some-slug').set('Authorization', `Bearer ${token}`).send({ title_ru: 'X' })
    expect(res.status).toBe(403)
  })

  it('404 для несуществующего slug', async () => {
    const { token } = await makeUser({ admin: true })
    const res = await request(app).put('/api/blog/no-such-slug-' + Date.now()).set('Authorization', `Bearer ${token}`).send({ title_ru: 'X' })
    expect(res.status).toBe(404)
  })

  it('админ обновляет пост → новый title в GET', async () => {
    const { token } = await makeUser({ admin: true })
    const slug = 'upd-' + Date.now().toString(36)
    await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({
      slug, title_ru: 'Старый', body_ru: 'B',
    })

    const upd = await request(app).put('/api/blog/' + slug).set('Authorization', `Bearer ${token}`).send({
      title_ru: 'Новый',
    })
    expect(upd.status).toBe(200)

    const get = await request(app).get('/api/blog/' + slug)
    expect(get.body.title_ru).toBe('Новый')
    expect(get.body.body_ru).toBe('B') // без изменений — COALESCE в SQL
  })
})
