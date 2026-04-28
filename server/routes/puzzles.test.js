/**
 * Integration-тесты для /api/puzzles/* — в основном public-эндпоинты.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

describe('GET /api/puzzles/daily (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/puzzles/daily')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/puzzles/weekly (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/puzzles/weekly')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/puzzles/rush (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/puzzles/rush')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/puzzles/rush/leaderboard (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/puzzles/rush/leaderboard')
    expect(res.status).toBe(200)
  })
})

describe('POST /api/puzzles/rush/submit (auth)', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/puzzles/rush/submit').send({ score: 10 })
    expect(res.status).toBe(401)
  })
})
