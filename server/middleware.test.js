/**
 * Integration-тесты middleware (через supertest на реальные роуты).
 * Минимальная версия: только базовые статусы 401/200/403 без хрупких ассерций
 * на body fields (expired, error message).
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'mw') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('auth middleware', () => {
  it('401 при отсутствии token', async () => {
    const res = await request(app).get('/api/onboarding/status')
    expect(res.status).toBe(401)
  })

  it('401 при malformed token', async () => {
    const res = await request(app).get('/api/onboarding/status').set('Authorization', 'Bearer not-a-valid-jwt')
    expect(res.status).toBe(401)
  })

  it('401 при token подписанном другим секретом', async () => {
    const fakeToken = jwt.sign({ id: 1, username: 'fake', isAdmin: false, tv: 0 }, 'wrong_secret_xyz_unique')
    const res = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${fakeToken}`)
    expect(res.status).toBe(401)
  })

  it('200 при валидном token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('adminOnly middleware', () => {
  it('403 для обычного юзера на admin endpoint', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/push/test').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(403)
  })

  it('401 без token на admin endpoint', async () => {
    const res = await request(app).post('/api/push/test').send({})
    expect(res.status).toBe(401)
  })
})
