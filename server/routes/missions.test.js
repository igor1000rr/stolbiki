/**
 * Integration-тесты для /api/missions + /api/streak — все auth-only.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'ms') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/missions (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/missions')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/missions').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/missions/progress (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/missions/progress').send({})
    expect(res.status).toBe(401)
  })
})

describe('GET /api/streak (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/streak')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/streak').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/streak/checkin (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/streak/checkin').send({})
    expect(res.status).toBe(401)
  })
})
