/**
 * Integration-тесты для /api/games + публичных эндпоинтов (leaderboard, seasons).
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'gm') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/games (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/games')
    expect(res.status).toBe(401)
  })

  it('200 с валидным token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/games').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.games)).toBe(true)
    expect(typeof res.body.total).toBe('number')
  })

  it('?limit=5 работает', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/games?limit=5').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.limit).toBe(5)
  })
})

describe('GET /api/games/stats (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/games/stats')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/leaderboard (public)', () => {
  it('200 без auth', async () => {
    const res = await request(app).get('/api/leaderboard')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('Cache-Control выставлен', async () => {
    const res = await request(app).get('/api/leaderboard')
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/)
  })

  it('?limit=10 работает', async () => {
    const res = await request(app).get('/api/leaderboard?limit=10')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeLessThanOrEqual(10)
  })
})

describe('GET /api/seasons/current (public)', () => {
  it('200 без auth', async () => {
    const res = await request(app).get('/api/seasons/current')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/seasons/history (public)', () => {
  it('200 без auth', async () => {
    const res = await request(app).get('/api/seasons/history')
    expect(res.status).toBe(200)
  })
})
