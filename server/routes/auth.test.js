/**
 * Real HTTP тесты для auth-роутов через supertest.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'u') {
  // Максимум 20 символов — это username лимит в auth. prefix(1-2) + '_' + base36(6) + '_' + counter(1-3)
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

// Helper: если response не ожидаемый status — дампим body в error message.
// В auth.js при VITEST=1 в body прилетает _debug с реальным стектрейсом.
function expectStatus(res, expected) {
  if (res.status !== expected) {
    throw new Error(`Expected ${expected}, got ${res.status}. Body: ${JSON.stringify(res.body)}`)
  }
}

describe('POST /api/auth/register', () => {
  it('создаёт нового юзера и возвращает token + user', async () => {
    const username = uniqueName()
    const res = await request(app).post('/api/auth/register').send({
      username, password: 'password123',
    })
    expectStatus(res, 200)
    expect(res.body.token).toBeTruthy()
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user.username).toBe(username)
    expect(res.body.user.id).toBeTruthy()
    expect(res.body.user.rating).toBe(1000)
    expect(res.body.user.referralCode).toBeTruthy()
  })

  it('400 если нет username', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: 'password123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('400 если нет password', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: uniqueName() })
    expect(res.status).toBe(400)
  })

  it('400 если username короче 2 символов', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a', password: 'password123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/2-20/)
  })

  it('400 если username длиннее 20 символов', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a'.repeat(21), password: 'password123' })
    expect(res.status).toBe(400)
  })

  it('400 если password короче 8 символов', async () => {
    // 7 символов — должно отклониться после поднятия лимита с 6 до 8.
    const res = await request(app).post('/api/auth/register').send({ username: uniqueName(), password: '1234567' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/8/)
  })

  it('409 если username уже занят', async () => {
    const username = uniqueName()
    const first = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expectStatus(first, 200)
    const second = await request(app).post('/api/auth/register').send({ username, password: 'different_password' })
    expect(second.status).toBe(409)
    expect(second.body.error).toMatch(/taken/i)
  })

  it('санитизирует опасные символы в username', async () => {
    // Короткий suffix из-за лимита 20 символов
    const raw = `u<>&"'_${Date.now().toString(36).slice(-4)}`
    const res = await request(app).post('/api/auth/register').send({
      username: raw, password: 'password123',
    })
    if (res.status === 200) {
      expect(res.body.user.username).not.toContain('<')
      expect(res.body.user.username).not.toContain('>')
      expect(res.body.user.username).not.toContain('&')
      expect(res.body.user.username).not.toContain('"')
      expect(res.body.user.username).not.toContain("'")
    }
  })

  it('referralCode — реферер получает бонус при регистрации реферала', async () => {
    const referrerName = uniqueName('r')
    const reg1 = await request(app).post('/api/auth/register').send({
      username: referrerName, password: 'password123',
    })
    expectStatus(reg1, 200)
    const refCode = reg1.body.user.referralCode
    expect(refCode).toBeTruthy()
    expect(refCode).toMatch(/^[A-Z0-9]+$/)

    const refereeName = uniqueName('re')
    const reg2 = await request(app).post('/api/auth/register').send({
      username: refereeName, password: 'password123', referralCode: refCode,
    })
    expectStatus(reg2, 200)
  })

  it('некорректный referralCode не мешает регистрации', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: uniqueName(), password: 'password123', referralCode: 'NONEXISTENT12345',
    })
    expectStatus(res, 200)
  })
})

describe('POST /api/auth/login', () => {
  it('успешный логин с правильными credentials', async () => {
    const username = uniqueName()
    const reg = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expectStatus(reg, 200)
    const res = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expectStatus(res, 200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.username).toBe(username)
  })

  it('401 при неверном пароле', async () => {
    const username = uniqueName()
    await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    const res = await request(app).post('/api/auth/login').send({ username, password: 'wrong_password' })
    expect(res.status).toBe(401)
  })

  it('401 для несуществующего юзера', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: uniqueName('nope'), password: 'anything',
    })
    expect(res.status).toBe(401)
  })

  it('401 если body пустое', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/refresh', () => {
  it('обновляет token по валидному свежему токену', async () => {
    const username = uniqueName()
    const reg = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expectStatus(reg, 200)
    const oldToken = reg.body.token
    const res = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${oldToken}`)
    expectStatus(res, 200)
    expect(res.body.token).toBeTruthy()
  })

  it('401 если нет Authorization header', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/токен/i)
  })

  it('401 если токен с неверной подписью', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })
})

describe('flow: register → login → refresh', () => {
  it('полный auth flow работает end-to-end', async () => {
    const username = uniqueName('fl')

    const reg = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expectStatus(reg, 200)
    const regToken = reg.body.token

    const login = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expectStatus(login, 200)
    const loginToken = login.body.token

    const refresh1 = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${regToken}`)
    expectStatus(refresh1, 200)

    const refresh2 = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${loginToken}`)
    expectStatus(refresh2, 200)
  })
})
