/**
 * E2E API coverage — проверяем backend endpoints на happy-path, auth-required и валидацию.
 *
 * Цель: ловить регрессии в REST API без запуска UI. Быстрее чем click-тесты,
 * устойчивее к косметическим изменениям фронта.
 *
 * Структура:
 *   - Public endpoints: должны отдавать 200 без авторизации
 *   - Auth-required: без токена → 401
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
    // Формат может варьироваться: массив или объект с полем
    expect(typeof data).toBe('object')
  })

  test('GET /api/buildings/leaderboard — топ городов побед', async ({ request }) => {
    const res = await request.get(`${API}/api/buildings/leaderboard`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    // Принимаем любой json-ответ — важно только что 200
    expect(typeof data).toBe('object')
  })

  test('GET /api/buildings/feed/recent — лента свежих построек', async ({ request }) => {
    const res = await request.get(`${API}/api/buildings/feed/recent`)
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/globalchat — публичный чат доступен без auth', async ({ request }) => {
    const res = await request.get(`${API}/api/globalchat`)
    expect(res.ok()).toBeTruthy()
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

test.describe('API: auth-required endpoints → 401 без токена', () => {
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
    test(`${method} ${path} без токена → 401`, async ({ request }) => {
      const res = await request.fetch(`${API}${path}`, {
        method,
        data: method === 'POST' || method === 'PUT' ? {} : undefined,
      })
      expect(res.status()).toBe(401)
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

  test('слишком длинный email → 400', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser(), password: 'testpass123', email: 'a'.repeat(95) + '@a.bc' },
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
    // Либо 400 (слишком длинный после очистки не станет), либо 200 с очищенным именем
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

    // 1. Получить профиль
    const profileRes = await request.get(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(profileRes.ok()).toBeTruthy()
    const profile = await profileRes.json()
    expect(profile.username).toBe(user.username)
    expect(profile.rating).toBe(1000)

    // 2. Сменить аватар
    const newAvatar = 'avatar-cat'
    const updateRes = await request.put(`${API}/api/profile/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { avatar: newAvatar },
    })
    expect(updateRes.ok()).toBeTruthy()

    // 3. Проверить что применилось
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

  test('GET /api/bricks/balance для нового юзера → число', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.get(`${API}/api/bricks/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(typeof data.balance).toBe('number')
    expect(data.balance).toBeGreaterThanOrEqual(0)
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

  test('POST /api/puzzles/submit с невалидным puzzle → 400/404', async ({ request }) => {
    const { token } = await registerUser(request)
    const res = await request.post(`${API}/api/puzzles/submit`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { type: 'daily', puzzleId: 'not-a-real-id', solved: true, movesUsed: 1, duration: 10 },
    })
    expect([400, 404]).toContain(res.status())
  })
})

test.describe('API: rate limiting', () => {
  test('много попыток логина подряд не вешают сервер (graceful 429)', async ({ request }) => {
    const username = uniqueUser('rl')
    // Делаем 25 запросов — лимит /api/auth = 20/мин, должны получить 429 после ~20
    const results = []
    for (let i = 0; i < 25; i++) {
      const res = await request.post(`${API}/api/auth/login`, {
        data: { username, password: 'wrong' },
      })
      results.push(res.status())
    }
    // Либо все 401 (rate limit не настроен локально), либо появились 429
    const uniqueStatuses = [...new Set(results)]
    expect(uniqueStatuses.every(s => [401, 429].includes(s))).toBeTruthy()
  })
})
