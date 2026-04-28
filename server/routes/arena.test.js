/**
 * Integration-тесты для /api/arena/* — status-чеки.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'ar') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/arena/current (public)', () => {
  it('200 без auth', async () => {
    const res = await request(app).get('/api/arena/current')
    expect(res.status).toBe(200)
  })
})

describe('POST /api/arena/join (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/arena/join').send({})
    expect(res.status).toBe(401)
  })
})

describe('POST /api/arena/leave (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/arena/leave').send({})
    expect(res.status).toBe(401)
  })
})

describe('POST /api/arena/start (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/arena/start').send({})
    expect(res.status).toBe(401)
  })
})
