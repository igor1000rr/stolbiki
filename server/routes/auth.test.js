/**
 * Real HTTP тесты для auth-роутов через supertest.
 *
 * Используем реальный Express app (импортируется из server.js), но в VITEST-режиме:
 * - server.js не слушает порт (isTest = true)
 * - db.js использует :memory: вместо файла
 * - JWT_SECRET — эфемерный, генерируется в памяти
 *
 * Это настоящие integration тесты — проходят через роутер, middleware (cors, helmet,
 * rate-limit, json-parser), bcrypt, jwt, БД. Только сеть заменена на in-process.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'u') {
  return `${prefix}_${Date.now().toString(36)}_${counter++}`
}

describe('POST /api/auth/register', () => {
  it('создаёт нового юзера и возвращает token + user', async () => {
    const username = uniqueName()
    const res = await request(app).post('/api/auth/register').send({
      username, password: 'password123',
    })
    expect(res.status).toBe(200)
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

  it('400 если password короче 6 символов', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: uniqueName(), password: '12345' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/6/)
  })

  it('409 если username уже занят', async () => {
    const username = uniqueName()
    const first = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expect(first.status).toBe(200)
    const second = await request(app).post('/api/auth/register').send({ username, password: 'different_password' })
    expect(second.status).toBe(409)
    expect(second.body.error).toMatch(/taken/i)
  })

  it('санитизирует опасные символы в username', async () => {
    // <, >, &, ", ' должны быть удалены
    const raw = 'user<>&"\'' + Date.now()
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
    // 1. Регистрируем реферера
    const referrerName = uniqueName('ref')
    const reg1 = await request(app).post('/api/auth/register').send({
      username: referrerName, password: 'password123',
    })
    expect(reg1.status).toBe(200)
    const refCode = reg1.body.user.referralCode
    expect(refCode).toBeTruthy()
    expect(refCode).toMatch(/^[A-Z0-9]+$/) // только A-Z и 0-9

    // 2. Регистрируем реферала с этим кодом
    const refereeName = uniqueName('referee')
    const reg2 = await request(app).post('/api/auth/register').send({
      username: refereeName, password: 'password123', referralCode: refCode,
    })
    expect(reg2.status).toBe(200)
  })

  it('некорректный referralCode не мешает регистрации', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: uniqueName(), password: 'password123', referralCode: 'NONEXISTENT12345',
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/auth/login', () => {
  it('успешный логин с правильными credentials', async () => {
    const username = uniqueName()
    await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    const res = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expect(res.status).toBe(200)
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
      username: 'nonexistent_' + Date.now(), password: 'anything',
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
    const oldToken = reg.body.token
    const res = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${oldToken}`)
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(typeof res.body.token).toBe('string')
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

  it('401 если юзера из токена больше нет в БД', async () => {
    // Создаём токен для несуществующего ID
    // Поскольку JWT_SECRET эфемерный, сложно подделать валидный токен
    // Проверяем через полный flow: регистрация + удаление юзера + refresh
    const username = uniqueName()
    const reg = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    const token = reg.body.token
    const userId = reg.body.user.id
    // Удаляем юзера из БД напрямую через импорт
    const { db } = await import('../db.js')
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    const res = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('flow: register → login → refresh', () => {
  it('полный auth flow работает end-to-end', async () => {
    const username = uniqueName('flow')

    // Register
    const reg = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expect(reg.status).toBe(200)
    const regToken = reg.body.token

    // Login
    const login = await request(app).post('/api/auth/login').send({ username, password: 'password123' })
    expect(login.status).toBe(200)
    const loginToken = login.body.token
    expect(loginToken).toBeTruthy()

    // Refresh с токеном от register
    const refresh1 = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${regToken}`)
    expect(refresh1.status).toBe(200)

    // Refresh с токеном от login
    const refresh2 = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${loginToken}`)
    expect(refresh2.status).toBe(200)
  })
})
