/**
 * Integration-тесты для /api/buildings/* — public + auth.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

describe('GET /api/buildings/leaderboard (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/buildings/leaderboard')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/buildings/feed/recent (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/buildings/feed/recent')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/buildings/stats/:userId (public)', () => {
  it('отвечает без 5xx даже для несуществующего id', async () => {
    const res = await request(app).get('/api/buildings/stats/9999999')
    expect(res.status).toBeLessThan(500)
  })
})

describe('GET /api/buildings/city/:userId (public)', () => {
  it('отвечает без 5xx', async () => {
    const res = await request(app).get('/api/buildings/city/9999999')
    expect(res.status).toBeLessThan(500)
  })
})

describe('POST /api/buildings/ (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/buildings/').send({})
    expect(res.status).toBe(401)
  })
})
