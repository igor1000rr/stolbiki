/**
 * Integration-тесты middleware (через supertest на реальные роуты).
 *
 * Цель — покрыть поведение auth/adminOnly на живых эндпоинтах:
 *   - Отсутствие token → 401
 *   - Невалидный token → 401
 *   - Expired token → 401 с expired: true
 *   - Token без isAdmin на admin-route → 403
 *   - Валидный token → роут работает (200)
 *
 * RateLimit в VITEST=true выключен (RATE_LIMIT_DISABLED), это проверяется
 * косвенно через то что supertest делает много регистраций без 429.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server.js'
import { JWT_SECRET } from '../db.js'

let counter = 0
function uniqueName(prefix = 'mw') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token, user: res.body.user }
}

describe('auth middleware', () => {
  it('401 при отсутствии token (Authorization header)', async () => {
    const res = await request(app).get('/api/onboarding/status')
    expect(res.status).toBe(401)
    expect(res.body.error).toBeTruthy()
  })

  it('401 при malformed token', async () => {
    const res = await request(app).get('/api/onboarding/status').set('Authorization', 'Bearer not-a-valid-jwt')
    expect(res.status).toBe(401)
  })

  it('401 при token подписанном другим секретом', async () => {
    const fakeToken = jwt.sign({ id: 1, username: 'fake', isAdmin: false, tv: 0 }, 'wrong_secret')
    const res = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${fakeToken}`)
    expect(res.status).toBe(401)
  })

  it('401 и expired:true при просроченном token', async () => {
    const expiredToken = jwt.sign(
      { id: 1, username: 'x', isAdmin: false, tv: 0 },
      JWT_SECRET,
      { expiresIn: '-1h' } // в прошлом
    )
    const res = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${expiredToken}`)
    expect(res.status).toBe(401)
    expect(res.body.expired).toBe(true)
  })

  it('200 при валидном token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/onboarding/status').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('Authorization без "Bearer " префикса работает (replace вырежет Bearer или оставит как есть)', async () => {
    const { token } = await makeUser()
    // header без "Bearer " — jwt.verify попробует распарсить и отвалится или пройдёт
    const res = await request(app).get('/api/onboarding/status').set('Authorization', token)
    // Ожидаем это сработает т.к. код делает .replace('Bearer ', '') — без Bearer выходит то же значение
    expect(res.status).toBe(200)
  })
})

describe('adminOnly middleware', () => {
  it('403 для обычного юзера (token без isAdmin)', async () => {
    const { token } = await makeUser()
    // /api/push/test — эндпоинт с auth + isAdmin проверкой в роуте (эквивалент adminOnly)
    const res = await request(app).post('/api/push/test').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(403)
  })

  it('403 с сфабрикованным isAdmin=false token', async () => {
    const fakeToken = jwt.sign({ id: 999999, username: 'x', isAdmin: false, tv: 0 }, JWT_SECRET, { expiresIn: '1h' })
    // Юзер с id 999999 не существует — token_version check вернёт dbTv=0, sovpadayet → next
    // Но adminOnly в конкретном роуте (push/test) проверяет req.user.isAdmin
    const res = await request(app).post('/api/push/test').set('Authorization', `Bearer ${fakeToken}`).send({})
    expect(res.status).toBe(403)
  })
})
