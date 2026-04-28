/**
 * Integration-тесты для /api/onboarding/* через supertest.
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

  it('первый вызов → выдаёт first_win + кирпичи', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.bricksAwarded).toBe(20)
    expect(typeof res.body.bricks).toBe('number')
    expect(res.body.bricks).toBeGreaterThanOrEqual(20)
    expect(res.body.achievementUnlocked).toBe(true)
    expect(res.body.achievement).toBe('first_win')
  })

  it('повторный вызов → 409', async () => {
    const { token } = await makeUser()
    const first = await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    expect(first.status).toBe(200)
    const second = await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    expect(second.status).toBe(409)
    expect(second.body.alreadyDone).toBe(true)
  })

  it('после complete status → done: true', async () => {
    const { token } = await makeUser()
    await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    const status = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${token}`)
    expect(status.body.done).toBe(true)
  })
})
