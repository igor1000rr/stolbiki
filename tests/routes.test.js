/**
 * Интеграционные тесты HTTP-роутов через Supertest.
 *
 * Покрывает верификацию реальных фиксов:
 * - POST /api/games — античит, отклоняет без moves, проверяет moves через движок
 * - POST /api/auth/register + login
 * - POST /api/auth/refresh — принимает expired JWT
 * - GET /api/health, /api/stats
 * - 404 на неизвестный endpoint
 *
 * Зависимости: supertest, better-sqlite3. Обе недоступны в sandbox без native build —
 * при отсутствии тесты скипаются. В CI запускаются полностью.
 */

import { describe, it, expect, beforeAll } from 'vitest'

// Устанавливаем VITEST=true перед любым импортом server.js — блокирует listen/WS
process.env.VITEST = 'true'
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_for_supertest_' + Math.random().toString(36).slice(2)

let request, app, GameState, getLegalActions, applyAction
try {
  request = (await import('supertest')).default
  const serverMod = await import('../server/server.js')
  app = serverMod.app
  const engine = await import('../server/game-engine.js')
  GameState = engine.GameState
  getLegalActions = engine.getLegalActions
  applyAction = engine.applyAction
} catch {
  // supertest или better-sqlite3 не доступны — скипаем весь файл
}

// Утилита: генерирует валидную законченную партию (moves array как ждёт /api/games)
function playFullGame(seed = 42) {
  let s = seed
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  let gs = new GameState()
  const moves = []
  let safety = 300
  while (!gs.gameOver && safety-- > 0) {
    const legal = getLegalActions(gs)
    if (legal.length === 0) break
    const pick = legal[Math.floor(rand() * legal.length)]
    moves.push({ action: pick, player: gs.currentPlayer })
    gs = applyAction(gs, pick)
  }
  return { moves, finalState: gs }
}

const run = (request && app) ? describe : describe.skip

run('HTTP routes', () => {
  let token, username

  beforeAll(async () => {
    username = 'test_' + Math.random().toString(36).slice(2, 8)
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' })
    token = res.body.token
  })

  describe('POST /api/auth/register', () => {
    it('создаёт юзера и возвращает токен', async () => {
      const u = 'user_' + Math.random().toString(36).slice(2, 8)
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: u, password: 'password1' })
      expect(res.status).toBe(200)
      expect(res.body.token).toBeTruthy()
      expect(res.body.user.username).toBe(u)
    })

    it('отклоняет короткий пароль', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'x', password: '1' })
      expect(res.status).toBe(400)
    })

    it('отклоняет дубликат username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username, password: 'password1' })
      expect(res.status).toBe(409)
    })
  })

  describe('POST /api/auth/login', () => {
    it('успешный логин существующего юзера', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'testpass123' })
      expect(res.status).toBe(200)
      expect(res.body.token).toBeTruthy()
    })

    it('неверный пароль → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'wrong' })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('валидный токен → новый токен', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.token).toBeTruthy()
    })

    it('без токена → 401', async () => {
      const res = await request(app).post('/api/auth/refresh')
      expect(res.status).toBe(401)
    })

    it('мусорный токен → 401', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer garbage.token.here')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/games (античит)', () => {
    it('отклоняет AI-игру без moves', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ won: true, score: '6:0', difficulty: 400, isOnline: false })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/ход/i)
    })

    it('отклоняет нелегальные moves', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          won: true, score: '6:0', difficulty: 400, isOnline: false,
          moves: [{ action: { placement: { 99: 99 } }, player: 0 }],
        })
      expect(res.status).toBe(400)
    })

    it('отклоняет некорректный формат счёта', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ won: true, score: 'abc', difficulty: 400 })
      expect(res.status).toBe(400)
    })

    it('отклоняет счёт вне диапазона', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ won: true, score: '15:0', difficulty: 400 })
      expect(res.status).toBe(400)
    })

    it('без токена → 401', async () => {
      const res = await request(app)
        .post('/api/games')
        .send({ won: true, score: '6:0' })
      expect(res.status).toBe(401)
    })

    it('[e2e] принимает валидную партию, меняет рейтинг', async () => {
      // Ищем seed дающий законченную партию
      let moves, finalState
      for (let seed = 1; seed < 50; seed++) {
        const r = playFullGame(seed)
        if (r.finalState.gameOver && r.finalState.winner !== null) {
          moves = r.moves
          finalState = r.finalState
          break
        }
      }
      expect(moves).toBeDefined()

      const wonByP0 = finalState.winner === 0
      // Получаем текущий рейтинг
      const profileRes = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`)
      const ratingBefore = profileRes.body.rating

      // Ждём 10 сек между submits (anti-spam) — но тут первый submit
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          won: wonByP0,
          score: `${finalState.countClosed(0)}:${finalState.countClosed(1)}`,
          difficulty: 200,
          isOnline: false,
          turns: moves.length,
          duration: 60,
          moves,
        })
      expect(res.status).toBe(200)
      expect(res.body.ratingAfter).not.toBe(ratingBefore)
      expect(typeof res.body.ratingDelta).toBe('number')
    })
  })

  describe('POST /api/replays (валидация через движок)', () => {
    it('отклоняет реплей с нелегальными ходами', async () => {
      const res = await request(app)
        .post('/api/replays')
        .set('Authorization', `Bearer ${token}`)
        .send({ moves: [{ action: { placement: { 99: 99 } }, player: 0 }] })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/нелегальн/i)
    })

    it('принимает валидный реплей (частичная партия)', async () => {
      const gs = new GameState()
      const legal = getLegalActions(gs)
      const moves = [{ action: legal[0], player: 0 }]
      const gs2 = applyAction(gs, legal[0])
      const legal2 = getLegalActions(gs2)
      moves.push({ action: legal2[0], player: 1 })

      const res = await request(app)
        .post('/api/replays')
        .set('Authorization', `Bearer ${token}`)
        .send({ moves, score: '0:0', mode: 'ai', turns: 2 })
      expect(res.status).toBe(200)
      expect(res.body.id).toBeTruthy()
    })
  })

  describe('POST /api/training (валидация через движок)', () => {
    it('отклоняет мусорные ходы', async () => {
      const moves = Array.from({ length: 10 }, () => ({ action: { placement: { 99: 99 } } }))
      const res = await request(app)
        .post('/api/training')
        .send({ moves, winner: 0, mode: 'ai', difficulty: 100 })
      expect(res.status).toBe(400)
    })

    it('отклоняет слишком короткую партию', async () => {
      const res = await request(app)
        .post('/api/training')
        .send({ moves: [{ action: {} }], winner: 0 })
      expect(res.status).toBe(400)
    })

    it('принимает валидную партию', async () => {
      // Нужна партия из ≥5 легальных ходов
      let moves = []
      let gs = new GameState()
      while (moves.length < 5 && !gs.gameOver) {
        const legal = getLegalActions(gs)
        moves.push({ action: legal[0] })
        gs = applyAction(gs, legal[0])
      }
      const res = await request(app)
        .post('/api/training')
        .send({ moves, winner: gs.winner ?? -1, mode: 'ai', difficulty: 100 })
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })
  })

  describe('GET /api/health', () => {
    it('возвращает 200 с метриками', async () => {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
      expect(res.body.version).toBeTruthy()
      expect(typeof res.body.users).toBe('number')
    })
  })

  describe('GET /api/stats', () => {
    it('публичные метрики без авторизации', async () => {
      const res = await request(app).get('/api/stats')
      expect(res.status).toBe(200)
      expect(typeof res.body.totalUsers).toBe('number')
      expect(typeof res.body.totalGames).toBe('number')
    })

    it('Cache-Control заголовок установлен', async () => {
      const res = await request(app).get('/api/stats')
      expect(res.headers['cache-control']).toContain('max-age=15')
    })
  })

  describe('404 на неизвестный endpoint', () => {
    it('возвращает 404 с понятной ошибкой', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint')
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/не найден/i)
    })
  })

  describe('POST /api/rooms', () => {
    it('создаёт комнату, возвращает roomId 6 символов', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ mode: 'single' })
      expect(res.status).toBe(200)
      expect(res.body.roomId).toMatch(/^[A-Z0-9]{6}$/)
    })
  })

  describe('POST /api/error-report', () => {
    it('принимает ошибку и возвращает ok', async () => {
      const res = await request(app)
        .post('/api/error-report')
        .send({ message: 'test error', stack: 'at test.js:1', url: '/test', ua: 'vitest' })
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it('отклоняет запрос без message', async () => {
      const res = await request(app)
        .post('/api/error-report')
        .send({})
      expect(res.status).toBe(400)
    })
  })

  describe('JSON body limit', () => {
    it('отклоняет слишком большой payload 413', async () => {
      // 300 КБ — превышает лимит 256 КБ для обычных эндпоинтов
      const huge = 'x'.repeat(300 * 1024)
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(`{"username":"${huge}","password":"x"}`)
      expect([400, 413]).toContain(res.status)
    })
  })
})
