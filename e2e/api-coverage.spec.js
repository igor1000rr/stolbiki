/**
 * E2E API coverage — проверяем backend endpoints на happy-path, auth-required и валидацию.
 *
 * Цель: ловить регрессии в REST API без запуска UI. Быстрее чем click-тесты,
 * устойчивее к косметическим изменениям фронта.
 *
 * Структура:
 *   - Public endpoints: должны отдавать 200 без авторизации
 *   - Auth-required: без токена → 401 (либо 400 если валидация query идёт до auth)
 *   - Validation: битый/пустой payload → 400
 *   - Authenticated flow: register → получить профиль → поменять аватар → проверить что применилось
 */

import { test, expect } from '@playwright/test'

const API = process.env.API_URL || 'http://localhost:3001'

let counter = 0
function uniqueUser(prefix = 'api') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function registerUser(request, username = uniqueUser()) {
  const res = await request.post(`${API}/api/auth/register`, {
    data: { username, password: 'testpass123' },
  })
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`register failed: ${res.status()} ${body}`)
  }
  return { ...(await res.json()), username }
}

test.describe('API: public endpoints (без auth)', () => {
  test('GET /api/puzzles/daily — есть ежедневный пазл', async ({ request }) => {
    const res = await request.get(`${API}/api/puzzles/daily`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.id).toBeTruthy()
    expect(typeof data.maxMoves).toBe('number')
  })

  test('GET /api/puzzles/weekly — есть недельный пазл', async ({ request }) => {
    const res = await request.get(`${API}/api/puzzles/weekly`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.id).toBeTruthy()
  })

  test('GET /api/puzzles/bank — банк пазлов с пагинацией', async ({ request }) => {
    const res = await request.get(`${API}/api/puzzles/bank?page=1`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.puzzles)).toBe(true)
    expect(typeof data.pages).toBe('number')
  })

  test('GET /api/puzzles/rush/leaderboard — leaderboard rush-режима', async ({ request }) => {
    const res = await request.get(`${API}/api/puzzles/rush/leaderboard`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.leaderboard || data)).toBe(true)
  })

  test('GET /api/achievements/rarity — таблица редкости ачивок', async ({ request }) => {
    const res = await request.get(`${API}/api/achievements/rarity`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(typeof data).toBe('object')
  })

  test('GET /api/buildings/leaderboard — топ городов побед', async ({ request }) => {
    const res = await request.get(`${API}/api/buildings/leaderboard`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(typeof data).toBe('object')
  })

  test('GET /api/buildings/feed/recent — лента последних построек (endpoint не падает)', async ({ request }) => {
    const res = await request.get(`${API}/api/buildings/feed/recent`)
    // Endpoint может требовать auth или параметры, главное — не 500
    expect(res.status()).not.toBe(500)
    expect(res.status()).toBeLessThan(500)
  })

  test('GET /api/globalchat — публичный чат (endpoint не падает)', async ({ request }) => {
    const res = await request.get(`${API}/api/globalchat`)
    // Может требовать auth или query param — главное что не крашит сервер
    expect(res.status()).not.toBe(500)
    expect(res.status()).toBeLessThan(500)
  })

  test('GET /api/blog/:slug — конкретный пост (первый из списка)', async ({ request }) => {
    const listRes = await request.get(`${API}/api/blog`)
    expect(listRes.ok()).toBeTruthy()
    const { posts } = await listRes.json()
    expect(posts.length).toBeGreaterThan(0)

    const slug = posts[0].slug
    const res = await request.get(`${API}/api/blog/${encodeURIComponent(slug)}`)
    expect(res.ok()).toBeTruthy()
    const post = await res.json()
    expect(post.slug).toBe(slug)
  })

  test('GET /api/blog/:slug — несуществующий slug → 404', async ({ request }) => {
    const res = await request.get(`${API}/api/blog/definitely-not-a-real-slug-xyz-${Date.now()}`)
    expect(res.status()).toBe(404)
  })

  test('GET /api/profile/:username — публичный профиль несуществующего юзера → 404', async ({ request }) => {
    const res = await request.get(`${API}/api/profile/definitely-not-a-user-${Date.now()}`)
    expect(res.status()).toBe(404)
  })
})

test.describe('API: auth-required endpoints → 4xx без токена', () => {
  // Большинство эндпоинтов возвращают 401 Unauthorized.
  // Некоторые (с query params) сначала валидируют → 400 Bad Request, это тоже ок.
  // Главное: не 200 (не раздают данные без auth) и не 500 (не крашат).
  const endpoints = [
    ['GET', '/api/profile'],
    ['GET', '/api/profile/rating-history'],
    ['GET', '/api/profile/analytics'],
    ['GET', '/api/profile/referrals'],
    ['PUT', '/api/profile/avatar'],
    ['PUT', '/api/profile/password'],
    ['DELETE', '/api/profile/account'],
    ['GET', '/api/friends'],
    ['GET', '/api/missions'],
    ['GET', '/api/streak'],
    ['GET', '/api/bricks/balance'],
    ['GET', '/api/bricks/history'],
    ['GET', '/api/bricks/skins'],
    ['POST', '/api/bricks/purchase'],
    ['GET', '/api/puzzles/user/stats'],
    ['POST', '/api/puzzles/submit'],
    ['POST', '/api/buildings'],
    ['GET', '/api/achievements/me'],
  ]
  for (const [method, path] of endpoints) {
    test(`${method} ${path} без токена → 4xx`, async ({ request }) => {
      const res = await request.fetch(`${API}${path}`, {
        method,
        data: method === 'POST' || method === 'PUT' ? {} : undefined,
      })
      // 400 (валидация) или 401 (auth) — оба приемлемы. Главное не 200/500.
      expect([400, 401, 403]).toContain(res.status())
    })
  }
})

test.describe('API: /api/auth/register валидация', () => {
  test('пустой body → 400', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, { data: {} })
    expect(res.status()).toBe(400)
  })

  test('только username без password → 400', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser() },
    })
    expect(res.status()).toBe(400)
  })

  test('username 1 символ → 400 (минимум 2)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'a', password: 'testpass123' },
    })
    expect(res.status()).toBe(400)
  })

  test('username 21 символ → 400 (максимум 20)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'a'.repeat(21), password: 'testpass123' },
    })
    expect(res.status()).toBe(400)
  })

  test('password 5 символов → 400 (минимум 6)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser(), password: '12345' },
    })
    expect(res.status()).toBe(400)
  })

  test('невалидный email → 400', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser(), password: 'testpass123', email: 'не-email' },
    })
    expect(res.status()).toBe(400)
  })

  test('email без @ → 400', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser(), password: 'testpass123', email: 'plainstring' },
    })
    expect(res.status()).toBe(400)
  })

  test('слишком длинный email (>100 символов) → 400', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      // 200 символов — точно > 100 лимита
      data: { username: uniqueUser(), password: 'testpass123', email: 'a'.repeat(200) + '@b.com' },
    })
    expect(res.status()).toBe(400)
  })

  test('валидный email → 200', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser(), password: 'testpass123', email: 'test@example.com' },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('username с XSS-символами — санитизируется', async ({ request }) => {
    const raw = 'e2e' + Date.now().toString(36).slice(-4) + '<script>'
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: raw, password: 'testpass123' },
    })
    if (res.ok()) {
      const { user } = await res.json()
      expect(user.username).not.toContain('<')
      expect(user.username).not.toContain('>')
    }
  })
})

test.describe('API: authenticated flow', () => {
  test('полный цикл: register → profile → сменить аватар → проверить', async ({ request }) => {
    const { token, user } = await registerUser(request)

    const profileRes = await request.get(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(profileRes.ok()).toBeTruthy()
    const profile = await profileRes.json()
    expect(profile.username).toBe(user.username)
    expect(profile.rating).toBe(1000)

    const newAvatar = 'avatar-cat'
    const updateRes = await request.put(`${API}/api/profile/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { avatar: newAvatar },
    })
    expect(updateRes.ok()).toBeTruthy()

    const afterRes = await request.get(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const after = await afterRes.json()
    expect(after.avatar).toBe(newAvatar)
  })

  test('битый токен → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/profile`, {
      headers: { Authorization: 'Bearer not-a-real-jwt-token' },
    })
    expect(res.status()).toBe(401)
  })

  test('refresh токена — новый юзер получает новый токен', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.post(`${API}/api/auth/refresh`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.token).toBeTruthy()
    expect(typeof data.token).toBe('string')
  })

  test('refresh без токена → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/refresh`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/bricks/balance для нового юзера возвращает данные', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.get(`${API}/api/bricks/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    // Структура может варьироваться: {balance:N}, {bricks:N}, или просто число.
    // Главное что 200 и response — валидный JSON.
    expect(data).toBeDefined()
    expect(data).not.toBeNull()
  })

  test('GET /api/missions — новый юзер получает список миссий', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.get(`${API}/api/missions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toBeTruthy()
  })

  test('GET /api/friends — новый юзер имеет пустой список друзей', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.get(`${API}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.friends)).toBe(true)
    expect(data.friends.length).toBe(0)
  })

  test('POST /api/puzzles/submit с невалидным puzzle не крашит сервер', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.post(`${API}/api/puzzles/submit`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { type: 'daily', puzzleId: 'not-a-real-id', solved: true, movesUsed: 1, duration: 10 },
    })
    // Сервер может вернуть 200 (gracefully игнорирует), 400 (validation) или 404.
    // Главное: не 500.
    expect(res.status()).not.toBe(500)
    expect([200, 400, 404]).toContain(res.status())
  })
})

test.describe('API: rate limiting', () => {
  test('endpoint не крашит сервер при массе запросов', async ({ request }) => {
    // В NODE_ENV=test rate limit отключён, в проде — работает.
    // Тут просто проверяем что 25 быстрых запросов не ломают сервер.
    const username = uniqueUser('rl')
    const results = []
    for (let i = 0; i < 25; i++) {
      const res = await request.post(`${API}/api/auth/login`, {
        data: { username, password: 'wrong' },
      })
      results.push(res.status())
    }
    // Все ответы должны быть legit HTTP кодами, не 500 и не разрывы
    expect(results.every(s => [401, 429].includes(s))).toBeTruthy()
  })
})
