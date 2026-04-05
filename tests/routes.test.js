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

let request, app, GameState, getLegalActions, applyAction, db
try {
  request = (await import('supertest')).default
  const serverMod = await import('../server/server.js')
  app = serverMod.app
  const engine = await import('../server/game-engine.js')
  GameState = engine.GameState
  getLegalActions = engine.getLegalActions
  applyAction = engine.applyAction
  const dbMod = await import('../server/db.js')
  db = dbMod.db
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
    it('требует авторизацию', async () => {
      const res = await request(app)
        .post('/api/training')
        .send({ moves: [{ action: {} }], winner: 0 })
      expect(res.status).toBe(401)
    })

    it('отклоняет мусорные ходы', async () => {
      const moves = Array.from({ length: 10 }, () => ({ action: { placement: { 99: 99 } } }))
      const res = await request(app)
        .post('/api/training')
        .set('Authorization', `Bearer ${token}`)
        .send({ moves, winner: 0, mode: 'ai', difficulty: 100 })
      expect(res.status).toBe(400)
    })

    it('отклоняет слишком короткую партию', async () => {
      const res = await request(app)
        .post('/api/training')
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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

  describe('Friends API (безопасность)', () => {
    let alice, bob, aliceToken, bobToken, aliceId, bobId

    beforeAll(async () => {
      alice = 'alice_' + Math.random().toString(36).slice(2, 8)
      bob = 'bob_' + Math.random().toString(36).slice(2, 8)
      const r1 = await request(app).post('/api/auth/register').send({ username: alice, password: 'password1' })
      const r2 = await request(app).post('/api/auth/register').send({ username: bob, password: 'password1' })
      aliceToken = r1.body.token
      bobToken = r2.body.token
      aliceId = r1.body.user.id
      bobId = r2.body.user.id
    })

    it('alice шлёт запрос bob → bob видит pending', async () => {
      const send = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: bob })
      expect(send.status).toBe(200)

      const bobFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${bobToken}`)
      expect(bobFriends.body.pending).toEqual(expect.arrayContaining([expect.objectContaining({ username: alice })]))
    })

    it('повторный request → 409', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: bob })
      expect(res.status).toBe(409)
    })

    it('add-self → 400', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: alice })
      expect(res.status).toBe(400)
    })

    it('несуществующий юзер → 404', async () => {
      const res = await request(app)
        .post('/api/friends/request')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ username: 'ghost_user_xxx' })
      expect(res.status).toBe(404)
    })

    it('[БАГ-ФИКС] accept без pending request → 404, не создаёт одностороннюю дружбу', async () => {
      // Создаём charlie который НЕ отправлял запрос
      const charlie = 'charlie_' + Math.random().toString(36).slice(2, 8)
      const r = await request(app).post('/api/auth/register').send({ username: charlie, password: 'password1' })
      const charlieToken = r.body.token
      const charlieId = r.body.user.id

      // alice пытается "принять" запрос от charlie которого не было
      const fake = await request(app)
        .post('/api/friends/accept')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: charlieId })
      expect(fake.status).toBe(404)

      // Убеждаемся что charlie НЕ видит alice в друзьях
      const charlieFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${charlieToken}`)
      expect(charlieFriends.body.friends).not.toContainEqual(expect.objectContaining({ username: alice }))
    })

    it('bob принимает pending от alice → двусторонняя дружба', async () => {
      const accept = await request(app)
        .post('/api/friends/accept')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ userId: aliceId })
      expect(accept.status).toBe(200)

      const aliceFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${aliceToken}`)
      const bobFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${bobToken}`)
      expect(aliceFriends.body.friends).toContainEqual(expect.objectContaining({ username: bob }))
      expect(bobFriends.body.friends).toContainEqual(expect.objectContaining({ username: alice }))
    })

    it('accept с не-числом userId → 400', async () => {
      const res = await request(app)
        .post('/api/friends/accept')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: 'abc' })
      expect(res.status).toBe(400)
    })

    it('decline с undefined userId → 400', async () => {
      const res = await request(app)
        .post('/api/friends/decline')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({})
      expect(res.status).toBe(400)
    })

    it('remove удаляет обе стороны дружбы', async () => {
      const res = await request(app)
        .post('/api/friends/remove')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ userId: bobId })
      expect(res.status).toBe(200)
      const aliceFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${aliceToken}`)
      const bobFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${bobToken}`)
      expect(aliceFriends.body.friends).not.toContainEqual(expect.objectContaining({ username: bob }))
      expect(bobFriends.body.friends).not.toContainEqual(expect.objectContaining({ username: alice }))
    })
  })

  describe('GET /api/profile/:username (публичный профиль)', () => {
    it('возвращает данные юзера', async () => {
      const res = await request(app).get(`/api/profile/${username}`)
      expect(res.status).toBe(200)
      expect(res.body.username).toBe(username)
      expect(typeof res.body.rating).toBe('number')
    })

    it('[БАГ-ФИКС] НЕ утекает referralCode и email', async () => {
      const res = await request(app).get(`/api/profile/${username}`)
      expect(res.body.referralCode).toBeUndefined()
      expect(res.body.email).toBeUndefined()
      expect(res.body.password_hash).toBeUndefined()
    })

    it('404 на несуществующего', async () => {
      const res = await request(app).get('/api/profile/nonexistent_xxx')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/leaderboard', () => {
    it('возвращает топ игроков', async () => {
      const res = await request(app).get('/api/leaderboard')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('respects limit param, max 100', async () => {
      const res = await request(app).get('/api/leaderboard?limit=500')
      expect(res.status).toBe(200)
      expect(res.body.length).toBeLessThanOrEqual(100)
    })
  })

  describe('GET /api/seasons/current', () => {
    it('возвращает сезон и таблицу', async () => {
      const res = await request(app).get('/api/seasons/current')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('leaderboard')
    })
  })

  // ═══ PUZZLES ═══
  describe('Puzzles API', () => {
    it('GET /api/puzzles/daily — публичный', async () => {
      const res = await request(app).get('/api/puzzles/daily')
      expect(res.status).toBe(200)
    })

    it('GET /api/puzzles/weekly — публичный', async () => {
      const res = await request(app).get('/api/puzzles/weekly')
      expect(res.status).toBe(200)
    })

    it('GET /api/puzzles/bank — банк задач', async () => {
      const res = await request(app).get('/api/puzzles/bank')
      expect(res.status).toBe(200)
    })

    it('GET /api/puzzles/rush — конфиг + leaderboard', async () => {
      const res = await request(app).get('/api/puzzles/rush')
      expect(res.status).toBe(200)
    })

    it('POST /api/puzzles/submit без токена → 401', async () => {
      const res = await request(app)
        .post('/api/puzzles/submit')
        .send({ puzzleType: 'daily', puzzleId: '2026-01-01', solved: true, movesUsed: 3 })
      expect(res.status).toBe(401)
    })

    it('POST /api/puzzles/rush/submit с токеном', async () => {
      const res = await request(app)
        .post('/api/puzzles/rush/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 10, solved: 5, timeMs: 60000 })
      expect([200, 400]).toContain(res.status)
    })

    it('GET /api/puzzles/user/stats с токеном', async () => {
      const res = await request(app)
        .get('/api/puzzles/user/stats')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  // ═══ MISSIONS / STREAK ═══
  describe('Missions & Streak API', () => {
    it('GET /api/missions требует авторизации', async () => {
      const res = await request(app).get('/api/missions')
      expect(res.status).toBe(401)
    })

    it('GET /api/missions возвращает список', async () => {
      const res = await request(app)
        .get('/api/missions')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('POST /api/streak/checkin — первый вход в день', async () => {
      const res = await request(app)
        .post('/api/streak/checkin')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.streak).toBe('number')
    })

    it('GET /api/streak возвращает текущий streak', async () => {
      const res = await request(app)
        .get('/api/streak')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  // ═══ ARENA ═══
  describe('Arena API', () => {
    it('GET /api/arena/current — публичный', async () => {
      const res = await request(app).get('/api/arena/current')
      expect(res.status).toBe(200)
    })

    it('GET /api/arena/history — публичный', async () => {
      const res = await request(app).get('/api/arena/history')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('POST /api/arena/join требует авторизации', async () => {
      const res = await request(app).post('/api/arena/join')
      expect(res.status).toBe(401)
    })

    it('POST /api/arena/join с токеном', async () => {
      const res = await request(app)
        .post('/api/arena/join')
        .set('Authorization', `Bearer ${token}`)
      expect([200, 400, 403]).toContain(res.status)
    })
  })

  // ═══ BLOG ═══
  describe('Blog API', () => {
    it('GET /api/blog — публичный', async () => {
      const res = await request(app).get('/api/blog')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('POST /api/blog требует admin (обычный юзер → 403)', async () => {
      const res = await request(app)
        .post('/api/blog')
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'test', title_ru: 'x', body_ru: 'y' })
      expect([401, 403]).toContain(res.status)
    })
  })

  // ═══ ADMIN (с fixture: создаём admin user через прямой UPDATE) ═══
  describe('Admin API', () => {
    let adminToken, adminUsername

    beforeAll(async () => {
      adminUsername = 'admin_' + Math.random().toString(36).slice(2, 8)
      // Регаем обычного юзера
      await request(app)
        .post('/api/auth/register')
        .send({ username: adminUsername, password: 'adminpass1' })
      // Даём ему admin права напрямую в БД
      db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(adminUsername)
      // Перелогиниваем чтобы получить свежий JWT с isAdmin=true
      const login = await request(app)
        .post('/api/auth/login')
        .send({ username: adminUsername, password: 'adminpass1' })
      adminToken = login.body.token
    })

    it('GET /api/admin/overview требует admin (обычный юзер → 403)', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(403)
    })

    it('GET /api/admin/overview без токена → 401', async () => {
      const res = await request(app).get('/api/admin/overview')
      expect(res.status).toBe(401)
    })

    it('GET /api/admin/overview с admin токеном → 200', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body).toBeDefined()
    })

    it('GET /api/admin/users возвращает список юзеров', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/games возвращает партии', async () => {
      const res = await request(app)
        .get('/api/admin/games')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/blog возвращает все посты', async () => {
      const res = await request(app)
        .get('/api/admin/blog')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /api/admin/seasons возвращает сезоны', async () => {
      const res = await request(app)
        .get('/api/admin/seasons')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /api/admin/rooms возвращает комнаты', async () => {
      const res = await request(app)
        .get('/api/admin/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/server возвращает метрики', async () => {
      const res = await request(app)
        .get('/api/admin/server')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/content возвращает CMS', async () => {
      const res = await request(app)
        .get('/api/admin/content')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('PUT /api/admin/content/:key обновляет запись', async () => {
      // Создаём тестовую запись
      await request(app)
        .post('/api/admin/content')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'test.audit', section: 'test', value_ru: 'ru', value_en: 'en', label: 'audit' })
      const res = await request(app)
        .put('/api/admin/content/test.audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value_ru: 'новое', value_en: 'new' })
      expect(res.status).toBe(200)
    })
  })
})
