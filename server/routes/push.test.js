/**
 * Integration-тесты для /api/push/* через supertest.
 * Минимальные: только статусы без body assertions которые могут различаться в
 * зависимости от push-config в тестовой среде.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'push') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/push/vapid-public-key', () => {
  it('200 — публичный', async () => {
    const res = await request(app).get('/api/push/vapid-public-key')
    expect(res.status).toBe(200)
  })

  it('не требует auth (не 401/403)', async () => {
    const res = await request(app).get('/api/push/vapid-public-key')
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('POST /api/push/subscribe', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/push/subscribe').send({})
    expect(res.status).toBe(401)
  })
})

describe('POST /api/push/unsubscribe', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/push/unsubscribe').send({})
    expect(res.status).toBe(401)
  })

  it('400 без endpoint при auth', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/push/unsubscribe').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/push/test', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/push/test').send({})
    expect(res.status).toBe(401)
  })

  it('403 для не-админа', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/push/test').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(403)
  })
})
