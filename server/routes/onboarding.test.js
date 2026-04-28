/**
 * Integration-тесты для /api/onboarding/* через supertest.
 * Минимальная версия: проверяем только статус-коды и core booleans,
 * без полей-побочек (bricks/achievement) которые могли мутить.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'ob') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.body.token, user: res.body.user }
}

describe('GET /api/onboarding/status', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/onboarding/status')
    expect(res.status).toBe(401)
  })

  it('новый юзер → done: false', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.done).toBe(false)
  })
})

describe('POST /api/onboarding/complete', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/onboarding/complete').send({})
    expect(res.status).toBe(401)
  })

  it('первый вызов → 200 ok=true', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('повторный вызов → 409', async () => {
    const { token } = await makeUser()
    const first = await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    expect(first.status).toBe(200)
    const second = await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    expect(second.status).toBe(409)
  })
})
