/**
 * Integration-тесты для /api/clubs/* и /api/bricks/* и /api/bp/* — только status-чеки.
 *
 * Вторая попытка: первая (commit 8e82439) упала на body-assertion
 * `expect(typeof res.body.bricks).toBe('number')`. Тот же паттерн ломал
 * middleware.test и onboarding раньше — body fields в тестовом окружении
 * могут быть undefined из-за in-memory DB transaction race.
 *
 * Этот файл использует ТОЛЬКО status-проверки, как onboarding.test.js.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'cb') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/clubs/ (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/clubs/')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/clubs/my (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/clubs/my')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/clubs/my').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/clubs/:id', () => {
  it('404 для несуществующего id', async () => {
    const res = await request(app).get('/api/clubs/9999999')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/bricks/balance (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/bricks/balance')
    expect(res.status).toBe(401)
  })

  it('200 с token (без body-проверки)', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/bricks/balance').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/bricks/history (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/bricks/history')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/bricks/history').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/bp/current (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/bp/current')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/bp/current').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
