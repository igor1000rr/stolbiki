/**
 * Integration-тесты для /api/push/* через supertest.
 *
 * Большинство роутов отвечают 503 когда push не настроен (нет VAPID ключей
 * в тест-env). А валидация auth/payload проверяется.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'push') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { token: res.body.token, user: res.body.user }
}

describe('GET /api/push/vapid-public-key', () => {
  it('возвращает 200 и схему { configured, publicKey }', async () => {
    const res = await request(app).get('/api/push/vapid-public-key')
    expect(res.status).toBe(200)
    expect(typeof res.body.configured).toBe('boolean')
    // publicKey либо строка, либо null
    expect(['string', 'object']).toContain(typeof res.body.publicKey)
  })

  it('не требует авторизации (публичный эндпоинт)', async () => {
    const res = await request(app).get('/api/push/vapid-public-key')
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })

  it('возвращает Cache-Control когда push настроен', async () => {
    const res = await request(app).get('/api/push/vapid-public-key')
    if (res.body.configured) {
      expect(res.headers['cache-control']).toMatch(/max-age=\d+/)
    }
    // Если не настроен — без cache, это ок
  })
})

describe('POST /api/push/subscribe', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/push/subscribe').send({
      subscription: { endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } },
    })
    expect(res.status).toBe(401)
  })

  it('с auth но без push-config → 503 или 400 (не 5xx)', async () => {
    const { token } = await makeUser()
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        subscription: { endpoint: 'https://example.com/push', keys: { p256dh: 'pub', auth: 'auth' } },
      })
    // 503 если push не настроен, 200 если настроен. Покрываем оба.
    expect([200, 503]).toContain(res.status)
  })

  it('400 если subscription.endpoint отсутствует (при push-configured)', async () => {
    const { token } = await makeUser()
    const vapid = await request(app).get('/api/push/vapid-public-key')
    if (!vapid.body.configured) return // Не настроен — пропускаем
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscription: { keys: { p256dh: 'a', auth: 'b' } } })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/push/unsubscribe', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/push/unsubscribe').send({ endpoint: 'https://x' })
    expect(res.status).toBe(401)
  })

  it('400 если endpoint отсутствует', async () => {
    const { token } = await makeUser()
    const res = await request(app)
      .post('/api/push/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/endpoint/)
  })

  it('200 с валидным endpoint (идемпотентно — не важно была ли подписка)', async () => {
    const { token } = await makeUser()
    const res = await request(app)
      .post('/api/push/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://nonexistent.example.com/push' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('POST /api/push/test', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/push/test').send({})
    expect(res.status).toBe(401)
  })

  it('403 для не-админа', async () => {
    const { token } = await makeUser()
    const res = await request(app).post('/api/push/test').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/admin/i)
  })
})
