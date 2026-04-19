/**
 * Integration тесты для публичных API endpoints через supertest.
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

describe('GET /api/health', () => {
  it('возвращает 200 и корректную схему', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.version).toBeTruthy()
    expect(res.body.node).toMatch(/^v/)
    expect(typeof res.body.uptime).toBe('number')
    expect(typeof res.body.users).toBe('number')
    expect(typeof res.body.rooms).toBe('number')
    expect(typeof res.body.memoryMB).toBe('number')
    expect(res.body.csp).toBeTruthy()
    expect(typeof res.body.csp.hashesFound).toBe('boolean')
  })
})

describe('GET /api/stats', () => {
  it('возвращает 200 и числовые счётчики', async () => {
    const res = await request(app).get('/api/stats')
    expect(res.status).toBe(200)
    expect(typeof res.body.totalUsers).toBe('number')
    expect(typeof res.body.totalGames).toBe('number')
    expect(typeof res.body.avgRating).toBe('number')
    expect(typeof res.body.onlinePlayers).toBe('number')
    expect(typeof res.body.todayGames).toBe('number')
    expect(res.body.goldenRush).toBeTruthy()
  })

  it('avgRating >= 1000 (дефолт нового юзера)', async () => {
    const res = await request(app).get('/api/stats')
    expect(res.body.avgRating).toBeGreaterThanOrEqual(1000)
  })

  it('устанавливает Cache-Control header', async () => {
    const res = await request(app).get('/api/stats')
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/)
  })
})

describe('GET /api/content', () => {
  it('возвращает 200 и объект с ключами', async () => {
    const res = await request(app).get('/api/content')
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('object')
    const keys = Object.keys(res.body)
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys.slice(0, 5)) {
      expect(res.body[k]).toHaveProperty('ru')
      expect(res.body[k]).toHaveProperty('en')
    }
  })
})

describe('GET /api/daily', () => {
  it('возвращает seed + первый/второй ход', async () => {
    const res = await request(app).get('/api/daily')
    expect(res.status).toBe(200)
    expect(res.body.seed).toBeTruthy()
    expect(res.body.firstMove).toBeTruthy()
    expect(typeof res.body.firstMove.stand).toBe('number')
    expect(res.body.firstMove.stand).toBeGreaterThanOrEqual(0)
    expect(res.body.firstMove.stand).toBeLessThan(10)
    expect(res.body.secondMove).toBeTruthy()
    expect(Array.isArray(res.body.secondMove.stands)).toBe(true)
    expect(res.body.secondMove.stands.length).toBeGreaterThanOrEqual(1)
    expect(res.body.secondMove.stands.length).toBeLessThanOrEqual(3)
  })

  it('тот же seed для того же дня (детерминированность)', async () => {
    const res1 = await request(app).get('/api/daily')
    const res2 = await request(app).get('/api/daily')
    expect(res1.body.seed).toBe(res2.body.seed)
    expect(res1.body.firstMove.stand).toBe(res2.body.firstMove.stand)
  })
})

describe('GET /api/daily/leaderboard', () => {
  it('возвращает 200 и массив результатов', async () => {
    const res = await request(app).get('/api/daily/leaderboard')
    expect(res.status).toBe(200)
    expect(res.body.seed).toBeTruthy()
    expect(Array.isArray(res.body.results)).toBe(true)
  })
})

describe('GET /api/blog', () => {
  it('возвращает список постов с пагинацией', async () => {
    const res = await request(app).get('/api/blog')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.posts)).toBe(true)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.page).toBe(1)
    expect(typeof res.body.pages).toBe('number')
  })

  it('в ответе есть запинненый пост v595 (PINNED_SLUG)', async () => {
    const res = await request(app).get('/api/blog')
    const pinned = res.body.posts.find(p => p.pinned === 1)
    expect(pinned).toBeTruthy()
    expect(pinned.slug).toBe('v595-golden-rush')
  })

  it('поддерживает query param ?page=', async () => {
    const res = await request(app).get('/api/blog?page=2')
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(2)
  })

  it('устанавливает Cache-Control', async () => {
    const res = await request(app).get('/api/blog')
    expect(res.headers['cache-control']).toMatch(/max-age/)
  })
})

describe('GET /api/blog/:slug', () => {
  it('возвращает 200 и full post для существующего slug', async () => {
    const res = await request(app).get('/api/blog/v595-golden-rush')
    expect(res.status).toBe(200)
    expect(res.body.slug).toBe('v595-golden-rush')
    expect(res.body.title_ru).toBeTruthy()
    expect(res.body.body_ru).toBeTruthy()
    expect(res.body.published).toBe(1)
  })

  it('404 для несуществующего slug', async () => {
    const res = await request(app).get('/api/blog/nonexistent-slug-12345')
    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })
})

describe('POST /api/blog (admin-only)', () => {
  it('401 без auth token (middleware auth)', async () => {
    const res = await request(app).post('/api/blog').send({
      slug: 'test-post', title_ru: 'Тест', body_ru: 'Тело',
    })
    // middleware auth стоит ПЕРЕД проверкой isAdmin — без токена отдаёт 401
    expect(res.status).toBe(401)
  })

  it('403 при auth обычным юзером (не admin)', async () => {
    const username = 'blog_user_' + Date.now()
    const reg = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
    expect(reg.status).toBe(200)
    const token = reg.body.token
    const res = await request(app).post('/api/blog').set('Authorization', `Bearer ${token}`).send({
      slug: 'should-not-create', title_ru: 'Nope', body_ru: 'Nope',
    })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/rooms', () => {
  it('создаёт комнату с валидным roomId', async () => {
    const res = await request(app).post('/api/rooms').send({ mode: 'single' })
    expect(res.status).toBe(200)
    expect(res.body.roomId).toBeTruthy()
    expect(res.body.roomId).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('поддерживает tournament3/tournament5 режимы', async () => {
    const res3 = await request(app).post('/api/rooms').send({ mode: 'tournament3' })
    expect(res3.status).toBe(200)

    const res5 = await request(app).post('/api/rooms').send({ mode: 'tournament5' })
    expect(res5.status).toBe(200)
  })

  it('дефолтный режим = single если не указан', async () => {
    const res = await request(app).post('/api/rooms').send({})
    expect(res.status).toBe(200)
    expect(res.body.roomId).toBeTruthy()
  })
})

describe('GET /api/rooms/active', () => {
  it('возвращает массив (даже пустой)', async () => {
    const res = await request(app).get('/api/rooms/active')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/rooms/:id', () => {
  it('возвращает 200 для существующей комнаты', async () => {
    const create = await request(app).post('/api/rooms').send({ mode: 'single' })
    const roomId = create.body.roomId

    const res = await request(app).get(`/api/rooms/${roomId}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(roomId)
    expect(res.body.mode).toBe('single')
    expect(res.body.state).toBe('waiting')
    expect(Array.isArray(res.body.players)).toBe(true)
  })

  it('404 для несуществующей комнаты', async () => {
    const res = await request(app).get('/api/rooms/XXXXXX')
    expect(res.status).toBe(404)
  })

  it('case-insensitive для roomId (приводится к uppercase)', async () => {
    const create = await request(app).post('/api/rooms').send({})
    const roomId = create.body.roomId

    const res = await request(app).get(`/api/rooms/${roomId.toLowerCase()}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(roomId)
  })
})

describe('POST /api/track', () => {
  it('возвращает ok для валидного события', async () => {
    const res = await request(app).post('/api/track').send({
      event: 'page_view', page: 'landing', sessionId: 'test-session',
    })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('400 если event отсутствует', async () => {
    const res = await request(app).post('/api/track').send({ page: 'landing' })
    expect(res.status).toBe(400)
  })

  it('event и page обрезаются до 50 символов (не падает)', async () => {
    const res = await request(app).post('/api/track').send({
      event: 'a'.repeat(100), page: 'b'.repeat(100),
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/error-report', () => {
  it('принимает error report', async () => {
    const res = await request(app).post('/api/error-report').send({
      message: 'Test error', stack: 'Error: at line 1', component: 'TestComponent',
    })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('400 без message', async () => {
    const res = await request(app).post('/api/error-report').send({ stack: 'no message' })
    expect(res.status).toBe(400)
  })
})

describe('404 для неизвестных /api/ endpoints', () => {
  it('GET /api/nonexistent → 404', async () => {
    const res = await request(app).get('/api/nonexistent-endpoint-xyz')
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/не найден/i)
  })
})
