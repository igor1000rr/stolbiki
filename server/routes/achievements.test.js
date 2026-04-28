/**
 * Integration-тесты для /api/achievements/* — минимальная версия.
 * Избегаем integration с onboarding/complete (ранее это ломало CI из-за body fields).
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'ach') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/achievements/rarity', () => {
  it('200 + базовая схема', async () => {
    const res = await request(app).get('/api/achievements/rarity')
    expect(res.status).toBe(200)
    expect(typeof res.body.total).toBe('number')
    expect(typeof res.body.rarity).toBe('object')
  })

  it('не требует auth', async () => {
    const res = await request(app).get('/api/achievements/rarity')
    expect(res.status).not.toBe(401)
  })

  it('выставляет Cache-Control', async () => {
    const res = await request(app).get('/api/achievements/rarity')
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/)
  })
})

describe('GET /api/achievements/me', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/achievements/me')
    expect(res.status).toBe(401)
  })

  it('200 для авторизованного юзера', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/achievements/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.achievements)).toBe(true)
  })
})
