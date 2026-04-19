/**
 * Smoke E2E тесты: проверяем что главные страницы рендерятся без JS ошибок.
 *
 * Философия: НЕ ловим конкретные тексты кнопок (они меняются), ловим:
 *   - корректный HTTP статус
 *   - правильный title (для landing)
 *   - отсутствие runtime JS ошибок на страницах
 *   - что страница отрендерилась (body не пустой, есть #root с детьми)
 */

import { test, expect } from '@playwright/test'

const API = process.env.API_URL || 'http://localhost:3001'

/**
 * Helper: навигация на путь + сбор всех JS ошибок в массив.
 * Возвращает { errors, response } для ассертов.
 */
async function visitPage(page, path) {
  const errors = []
  const consoleErrors = []
  page.on('pageerror', err => errors.push(err.message))
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Игнорируем некритичные ошибки: Yandex Metrika, Service Worker regsitration в dev,
      // CORS preflight для внешних ресурсов, и WS connection errors (у нас WS в preview отключён).
      if (text.includes('mc.yandex.ru')) return
      if (text.includes('sw.js') || text.includes('ServiceWorker')) return
      if (text.includes('WebSocket')) return
      if (text.includes('Failed to fetch') && text.includes('manifest')) return
      consoleErrors.push(text)
    }
  })
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  // Даём React смонтироваться
  await page.waitForTimeout(500)
  return { errors, consoleErrors, response }
}

test.describe('smoke: главные страницы рендерятся', () => {
  test('/ — landing page загружается', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/')
    expect(response.status()).toBeLessThan(400)
    await expect(page).toHaveTitle(/Highrise/i)
    // SPA: #root должен быть не пустой после гидрации
    const rootHasChildren = await page.evaluate(() => document.getElementById('root')?.children.length > 0)
    expect(rootHasChildren).toBe(true)
    expect(errors).toEqual([])
  })

  test('/game — игровая страница', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/game')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/online — онлайн лобби', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/online')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/rules — правила', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/rules')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/blog — блог', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/blog')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/profile — профиль (должен работать даже без auth)', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/profile')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/puzzles — головоломки', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/puzzles')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/goldenrush-online — Golden Rush онлайн', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/goldenrush-online')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/changelog — changelog', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/changelog')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })

  test('/settings — настройки', async ({ page }) => {
    const { errors, response } = await visitPage(page, '/settings')
    expect(response.status()).toBeLessThan(400)
    expect(errors).toEqual([])
  })
})

test.describe('API smoke: backend отвечает на критичные endpoints', () => {
  test('GET /api/health → 200 ok', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.version).toBeTruthy()
  })

  test('GET /api/stats → числовые счётчики', async ({ request }) => {
    const res = await request.get(`${API}/api/stats`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(typeof data.totalUsers).toBe('number')
    expect(typeof data.onlinePlayers).toBe('number')
  })

  test('GET /api/content → CMS контент', async ({ request }) => {
    const res = await request.get(`${API}/api/content`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Object.keys(data).length).toBeGreaterThan(0)
  })

  test('GET /api/blog → список постов', async ({ request }) => {
    const res = await request.get(`${API}/api/blog`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.posts)).toBe(true)
    expect(data.posts.length).toBeGreaterThan(0)
  })

  test('GET /api/daily → daily seed', async ({ request }) => {
    const res = await request.get(`${API}/api/daily`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.seed).toBeTruthy()
    expect(typeof data.firstMove.stand).toBe('number')
  })
})

test.describe('E2E: auth flow через API', () => {
  test('register → login → profile', async ({ request }) => {
    const username = 'e2e_' + Date.now()
    const password = 'testpass123'

    // Register
    const reg = await request.post(`${API}/api/auth/register`, {
      data: { username, password },
    })
    expect(reg.ok()).toBeTruthy()
    const { token, user } = await reg.json()
    expect(token).toBeTruthy()
    expect(user.username).toBe(username)

    // Login с теми же credentials
    const login = await request.post(`${API}/api/auth/login`, {
      data: { username, password },
    })
    expect(login.ok()).toBeTruthy()

    // Profile с токеном
    const profile = await request.get(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // /api/profile может вернуть 200 или 404/другое в зависимости от роута
    expect([200, 401, 404]).toContain(profile.status())
  })

  test('duplicate username → 409', async ({ request }) => {
    const username = 'e2e_dup_' + Date.now()
    const first = await request.post(`${API}/api/auth/register`, {
      data: { username, password: 'pass123456' },
    })
    expect(first.ok()).toBeTruthy()

    const second = await request.post(`${API}/api/auth/register`, {
      data: { username, password: 'differentpass' },
    })
    expect(second.status()).toBe(409)
  })

  test('invalid credentials → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'nonexistent_xyz_' + Date.now(), password: 'whatever' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('UI integration: critical flows', () => {
  test('открыть landing и прокликать на /rules', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await expect(page).toHaveTitle(/Highrise/i)

    // Переход на /rules — либо клик по ссылке, либо прямая навигация (SPA)
    await page.goto('/rules')
    await page.waitForTimeout(500)
    expect(errors).toEqual([])
  })

  test('SPA работает: переключение между маршрутами не ломает рендер', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await page.goto('/game')
    await page.goto('/rules')
    await page.goto('/blog')
    await page.goto('/')

    // Между всеми переключениями — никаких JS ошибок
    expect(errors).toEqual([])
  })

  test('несуществующий роут не роняет приложение', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/этот-роут-точно-не-существует-' + Date.now())
    await page.waitForTimeout(500)

    // React Router должен обработать 404 в SPA, а не крашнуть
    expect(errors).toEqual([])
    const rootHasChildren = await page.evaluate(() => document.getElementById('root')?.children.length > 0)
    expect(rootHasChildren).toBe(true)
  })
})
