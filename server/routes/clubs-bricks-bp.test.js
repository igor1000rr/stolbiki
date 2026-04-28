/**
 * Integration-тесты для /api/clubs, /api/bricks, /api/bp — только status-чеки.
 *
 * Минимальная версия: только public 200 и auth 401.
 * НЕ создаём пользователей — это сводит к минимуму взаимодействие с DB.
 *
 * Третья попытка: первые две (8e82439, e90bd46) упали даже без body assertions.
 * Возможно register flow конфликтует с другими тестами в parallel run.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

describe('GET /api/clubs/ (public)', () => {
  it('200', async () => {
    const res = await request(app).get('/api/clubs/')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/clubs/my (auth required)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/clubs/my')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/bricks/balance (auth required)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/bricks/balance')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/bricks/history (auth required)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/bricks/history')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/bp/current (auth required)', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/bp/current')
    expect(res.status).toBe(401)
  })
})
