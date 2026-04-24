#!/usr/bin/env node
/**
 * Prerender всех публичных роутов из sitemap.xml в статический HTML.
 *
 * Поток:
 *   1. Читаем dist/sitemap.xml → извлекаем список URL
 *   2. Поднимаем статический сервер на dist/ (порт 4173, как vite preview)
 *   3. Запускаем headless Chromium, обходим каждый URL
 *   4. Ждём пока React отрисуется, извлекаем document.documentElement.outerHTML
 *   5. Пишем в dist/<route>/index.html
 *
 * Ничего не ломает если chromium не установлен — печатает warning и
 * выходит с кодом 0, чтобы CI не падал на машинах без playwright browsers.
 * Запускается отдельно от vite build: `npm run prerender` (после build).
 */

import { createServer } from 'node:http'
import { readFile, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { resolve, extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, '..', 'dist')
const PORT = 4173
const HOST = '127.0.0.1'
const TIMEOUT_MS = 20000  // 20s на страницу
const SETTLE_MS = 800     // буфер после networkidle для React-эффектов

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.map':  'application/json',
}

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ не найден. Сначала запусти `npm run build`.')
  process.exit(1)
}

// ─── Парсим sitemap ─────────────────────────────────────────────
const sitemapPath = resolve(DIST, 'sitemap.xml')
if (!existsSync(sitemapPath)) {
  console.warn('[prerender] dist/sitemap.xml не найден — prerender нечего')
  process.exit(0)
}
const sitemapXml = readFileSync(sitemapPath, 'utf8')
const urlMatches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
const routes = urlMatches
  .map(m => {
    try { return new URL(m[1]).pathname } catch { return null }
  })
  .filter(Boolean)
  // Дедуп
  .filter((p, i, arr) => arr.indexOf(p) === i)

if (routes.length === 0) {
  console.warn('[prerender] из sitemap не извлечено ни одного роута')
  process.exit(0)
}
console.log(`[prerender] найдено ${routes.length} роутов в sitemap`)

// ─── Статический сервер dist/ ─────────────────────────────────
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  if (url.includes('..')) { res.writeHead(400); res.end('Bad Request'); return }

  let filepath = join(DIST, url)
  // Директория → index.html внутри
  try {
    if (existsSync(filepath) && statSync(filepath).isDirectory()) {
      filepath = join(filepath, 'index.html')
    }
  } catch {}
  // SPA-фолбэк на корневой index.html
  if (!existsSync(filepath)) filepath = join(DIST, 'index.html')

  readFile(filepath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return }
    const ext = extname(filepath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

await new Promise((ok, fail) => {
  server.on('error', fail)
  server.listen(PORT, HOST, ok)
})
console.log(`[prerender] static server на http://${HOST}:${PORT}`)

// ─── Запуск chromium (lazy import — не падаем если нет) ────────
let chromium
try {
  ;({ chromium } = await import('@playwright/test'))
} catch (err) {
  console.warn('[prerender] @playwright/test не установлен — пропускаем prerender')
  console.warn('[prerender] для включения: npm i -D @playwright/test && npx playwright install chromium')
  server.close()
  process.exit(0)
}

let browser
try {
  browser = await chromium.launch({ headless: true })
} catch (err) {
  console.warn('[prerender] не удалось запустить chromium:', err.message)
  console.warn('[prerender] запусти `npx playwright install chromium` и повтори')
  server.close()
  process.exit(0)
}

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (compatible; HighriseHeistPrerenderer/1.0)',
  viewport: { width: 1280, height: 800 },
})

// Блокируем внешние запросы — API, трекеры, шрифты с CDN.
// Приложение устойчиво к fetch-фейлам (везде catch).
await context.route('**/*', (route) => {
  const url = route.request().url()
  if (url.startsWith(`http://${HOST}:${PORT}`)) return route.continue()
  if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue()
  return route.abort()
})

// ─── Prerender каждой страницы ─────────────────────────────────
let ok = 0, failed = 0
const failures = []

for (const route of routes) {
  const url = `http://${HOST}:${PORT}${route}`
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT_MS })
    await page.waitForTimeout(SETTLE_MS)
    const html = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML)

    // / → dist/index.html; /rules → dist/rules/index.html
    const outPath = route === '/'
      ? join(DIST, 'index.html')
      : join(DIST, route.replace(/^\//, '').replace(/\/$/, ''), 'index.html')

    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, html, 'utf8')
    ok++
    console.log(`[prerender] ✓ ${route}`)
  } catch (err) {
    failed++
    failures.push({ route, error: err.message })
    console.warn(`[prerender] ✗ ${route}: ${err.message}`)
  } finally {
    await page.close().catch(() => {})
  }
}

await browser.close().catch(() => {})
server.close()

console.log(`[prerender] готово: ok=${ok} failed=${failed}`)

// Падаем только если лендинг упал, или >50% страниц фейлнулись.
const landingFailed = failures.some(f => f.route === '/')
if (landingFailed || failed > routes.length / 2) {
  console.error('[prerender] слишком много фейлов — exit 1')
  process.exit(1)
}
