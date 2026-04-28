/**
 * Integration-тесты для /api/achievements/* через supertest.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'
import { invalidateRarityCache } from './achievements.js'

let counter = 0
function uniqueName(prefix = 'ach') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token, user: res.body.user }
}

describe('GET /api/achievements/rarity', () => {
  it('200 + схема { total, rarity, computedAt }', async () => {
    const res = await request(app).get('/api/achievements/rarity')
    expect(res.status).toBe(200)
    expect(typeof res.body.total).toBe('number')
    expect(typeof res.body.rarity).toBe('object')
    expect(typeof res.body.computedAt).toBe('number')
  })

  it('не требует авторизации (публичный)', async () => {
    const res = await request(app).get('/api/achievements/rarity')
    expect(res.status).toBe(200)
  })

  it('выставляет Cache-Control max-age', async () => {
    const res = await request(app).get('/api/achievements/rarity')
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/)
  })

  it('rarity tier в [legendary, epic, rare, common] для каждой ачивки', async () => {
    invalidateRarityCache()
    const res = await request(app).get('/api/achievements/rarity')
    const tiers = ['legendary', 'epic', 'rare', 'common']
    for (const [, info] of Object.entries(res.body.rarity)) {
      expect(tiers).toContain(info.tier)
      expect(typeof info.holders).toBe('number')
      expect(typeof info.percentage).toBe('number')
    }
  })

  it('кэш работает (computedAt одинаковый на быстрых вызовах)', async () => {
    invalidateRarityCache()
    const a = await request(app).get('/api/achievements/rarity')
    const b = await request(app).get('/api/achievements/rarity')
    expect(a.body.computedAt).toBe(b.body.computedAt)
  })
})

describe('GET /api/achievements/me', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/achievements/me')
    expect(res.status).toBe(401)
  })

  it('новый юзер → пустой массив achievements', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/achievements/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.achievements)).toBe(true)
    expect(res.body.achievements).toEqual([])
    expect(typeof res.body.total).toBe('number')
  })

  it('после onboarding/complete — first_win в списке с rarity', async () => {
    const { token } = await makeUser()
    await request(app).post('/api/onboarding/complete').set('Authorization', `Bearer ${token}`).send({})
    const res = await request(app).get('/api/achievements/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.achievements.length).toBe(1)
    expect(res.body.achievements[0].achievement_id).toBe('first_win')
    expect(res.body.achievements[0].rarity).toBeTruthy()
    expect(['legendary', 'epic', 'rare', 'common']).toContain(res.body.achievements[0].rarity.tier)
  })
})
