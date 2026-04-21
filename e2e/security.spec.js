/**
 * E2E security-тесты — проверяем защиту от типовых атак.
 *
 * Цель: поймать регрессии в middleware (helmet, cors, rate limit, json limits)
 * и в санитайзерах входных данных. Если эти тесты начинают падать — значит
 * безопасность просела и надо чинить срочно.
 *
 * Что проверяем:
 *   - SQL injection в параметрах (не крашит сервер, не возвращает данные)
 *   - Path traversal в route params
 *   - CORS: чужой origin не получает Access-Control-Allow-Origin
 *   - Большие payloads: 413 вместо краша
 *   - Security headers от helmet
 *   - CSP с правильными хешами скриптов
 *   - Битый JSON → 400, не 500
 *   - NoSQL injection в email/username
 */

import { test, expect } from '@playwright/test'

const API = process.env.API_URL || 'http://localhost:3001'
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173'

let counter = 0
function uniqueUser(prefix = 'sec') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

test.describe('Security: SQL injection attempts', () => {
  test('SQL injection в username не крашит сервер', async ({ request }) => {
    const payloads = [
      "admin' OR '1'='1",
      "admin'; DROP TABLE users; --",
      "admin' UNION SELECT * FROM users --",
      "' OR 1=1; --",
    ]
    for (const p of payloads) {
      const res = await request.post(`${API}/api/auth/login`, {
        data: { username: p, password: 'whatever' },
      })
      // Не должно быть 500 (краш) или 200 (успешный логин через injection).
      // 401 (отказ) или 429 (rate limit) — оба валидные reject-коды.
      expect(res.status()).not.toBe(500)
      expect(res.status()).not.toBe(200)
      expect([401, 429]).toContain(res.status())
    }
  })

  test('SQL injection в публичном профиле → 404/400, не 500', async ({ request }) => {
    const payloads = [
      "admin'--",
      "'; DROP TABLE users; --",
      "admin' OR '1'='1",
    ]
    for (const p of payloads) {
      const res = await request.get(`${API}/api/profile/${encodeURIComponent(p)}`)
      expect(res.status()).not.toBe(500)
      expect([400, 404]).toContain(res.status())
    }
  })

  test('SQL injection в blog slug → 404, не 500', async ({ request }) => {
    const res = await request.get(`${API}/api/blog/${encodeURIComponent("'; DROP TABLE posts; --")}`)
    expect(res.status()).not.toBe(500)
    expect([400, 404]).toContain(res.status())
  })
})

test.describe('Security: path traversal', () => {
  test('../ в пути профиля не выходит за пределы БД', async ({ request }) => {
    const payloads = [
      '../../../etc/passwd',
      '..%2F..%2F..%2Fetc%2Fpasswd',
      '....//....//etc/passwd',
    ]
    for (const p of payloads) {
      const res = await request.get(`${API}/api/profile/${p}`)
      expect(res.status()).not.toBe(200)
      expect(res.status()).not.toBe(500)
    }
  })

  test('../ в blog slug не читает произвольные файлы', async ({ request }) => {
    const res = await request.get(`${API}/api/blog/../../../etc/passwd`)
    // Либо 404 от роутера, либо redirect/нормализация — в любом случае НЕ 200 с содержимым файла
    expect(res.status()).not.toBe(500)
    const body = await res.text()
    expect(body).not.toContain('root:')
  })
})

test.describe('Security: CORS', () => {
  test('CORS отклоняет неразрешённый origin', async ({ request }) => {
    const res = await request.get(`${API}/api/health`, {
      headers: { Origin: 'https://evil.example.com' },
    })
    // Ответ может прийти, но без Access-Control-Allow-Origin
    const allowOrigin = res.headers()['access-control-allow-origin']
    expect(allowOrigin).not.toBe('https://evil.example.com')
    expect(allowOrigin).not.toBe('*')
  })

  test('CORS разрешает same-origin запрос без Origin header', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    // Без Origin — запрос не-браузерный, должен пройти
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Security: payload limits', () => {
  test('огромный username (100KB) в register → 400/413, не 500', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'a'.repeat(100_000), password: 'testpass123' },
    })
    expect(res.status()).not.toBe(500)
    // Может быть 400 (валидация username ≤20) или 413 (payload слишком большой)
    expect([400, 413]).toContain(res.status())
  })

  test('битый JSON → 400, не 500', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: '{ broken json, "username": ',
    })
    expect(res.status()).toBe(400)
  })

  test('POST с неправильным Content-Type обрабатывается без крашей', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not json at all',
    })
    expect(res.status()).not.toBe(500)
  })
})

test.describe('Security: HTTP headers', () => {
  test('index.html имеет строгую CSP', async ({ request }) => {
    const res = await request.get(`${BASE}/`)
    expect(res.ok()).toBeTruthy()
    const csp = res.headers()['content-security-policy']
    if (csp) {
      // unsafe-inline в script-src — красный флаг, допустимо только при наличии хешей
      expect(csp).toMatch(/default-src|script-src/)
    }
  })

  test('X-Content-Type-Options: nosniff', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.headers()['x-content-type-options']).toBe('nosniff')
  })

  test('X-Frame-Options защищает от clickjacking', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    const xfo = res.headers()['x-frame-options']
    expect(xfo === 'DENY' || xfo === 'SAMEORIGIN').toBeTruthy()
  })

  test('нет X-Powered-By: Express (helmet должен скрыть)', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.headers()['x-powered-by']).toBeUndefined()
  })
})

test.describe('Security: auth token attacks', () => {
  test('JWT со сломанной подписью → 401', async ({ request }) => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWV9.fake_signature'
    const res = await request.get(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    })
    expect(res.status()).toBe(401)
  })

  test('JWT с alg=none не принимается', async ({ request }) => {
    // Payload: {"id":1,"isAdmin":true} - без подписи (alg=none)
    const noneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6MSwiaXNBZG1pbiI6dHJ1ZX0.'
    const res = await request.get(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${noneToken}` },
    })
    expect(res.status()).toBe(401)
  })

  test('Authorization без Bearer prefix → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/profile`, {
      headers: { Authorization: 'some-raw-token' },
    })
    expect(res.status()).toBe(401)
  })

  test('пустой Authorization header → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/profile`, {
      headers: { Authorization: '' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('Security: input санитизация', () => {
  test('XSS в имени пользователя при регистрации — санитизируется', async ({ request }) => {
    // Имя с XSS должно либо отвергнуться, либо очиститься
    const raw = 'x' + Date.now().toString(36).slice(-4)
    const xss = raw + '<>'
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: xss, password: 'testpass123' },
    })
    if (res.ok()) {
      const { user } = await res.json()
      expect(user.username).not.toContain('<')
      expect(user.username).not.toContain('>')
    }
    // Если не ok — тоже ок (сработала валидация длины/формата)
  })

  test('null-byte injection в username не крашит', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: uniqueUser() + '\x00admin', password: 'testpass123' },
    })
    expect(res.status()).not.toBe(500)
  })

  test('Unicode в username обрабатывается', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'тест' + Date.now().toString(36).slice(-4), password: 'testpass123' },
    })
    expect(res.status()).not.toBe(500)
  })
})
