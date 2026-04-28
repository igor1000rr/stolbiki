/**
 * Integration-тесты для /api/profile/* — минимальные status-чеки.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'pr') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token, username }
}

describe('GET /api/profile/', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/profile/')
    expect(res.status).toBe(401)
  })

  it('200 с валидным token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/profile/').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/profile/:username (public)', () => {
  it('404 для несуществующего юзера', async () => {
    const res = await request(app).get('/api/profile/nonexistent_user_' + Date.now())
    expect(res.status).toBe(404)
  })

  it('200 для существующего (public, без auth)', async () => {
    const { username } = await makeUser()
    const res = await request(app).get(`/api/profile/${username}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/profile/by-id/:id', () => {
  it('404 для несуществующего id', async () => {
    const res = await request(app).get('/api/profile/by-id/9999999')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/profile/rating-history (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/profile/rating-history')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/profile/referrals (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/profile/referrals')
    expect(res.status).toBe(401)
  })

  it('200 с валидным token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/profile/referrals').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
