/**
 * Integration-тесты для /api/blog/* — минимальная версия.
 * Только public read + auth/admin проверки статус-кодами (без создания постов).
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'bl') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/blog/', () => {
  it('200 + схема пагинации', async () => {
    const res = await request(app).get('/api/blog/')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.posts)).toBe(true)
    expect(typeof res.body.total).toBe('number')
    expect(typeof res.body.page).toBe('number')
  })

  it('не требует auth', async () => {
    const res = await request(app).get('/api/blog/')
    expect(res.status).not.toBe(401)
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

  it('SQL injection в slug → не 5xx', async () => {
    const res = await request(app).get("/api/blog/' OR 1=1 --")
    expect(res.status).toBeLessThan(500)
  })
})

describe('POST /api/blog/ (create) — auth checks', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/blog/').send({ slug: 'x', title_ru: 'T', body_ru: 'B' })
    expect(res.status).toBe(401)
  })

  it('403 для обычного юзера', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/blog/').set('Authorization', `Bearer ${token}`).send({ slug: 'x', title_ru: 'T', body_ru: 'B' })
    expect(res.status).toBe(403)
  })
})
