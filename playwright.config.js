/**
 * Playwright config для E2E тестов.
 *
 * Работает в двух режимах:
 *   - Локально: запусти бекенд (cd server && node server.js), фронт (npm run build && npx vite preview --port 4173), потом `npm run test:e2e`.
 *   - CI: .github/workflows/e2e.yml поднимает стек и запускает тесты.
 *
 * Тесты в папке e2e/. Каждый тест должен быть устойчив к реальному серверу — никаких моков,
 * всё через fresh регистрацию юзера с уникальным именем.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
