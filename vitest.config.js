/**
 * Vitest config — vitest исключает Playwright E2E спеки из unit-тестов.
 *
 * Без этого vitest подхватывает e2e/*.spec.js по дефолтному паттерну и валится на
 * test.describe() — это Playwright API, не vitest.
 *
 * Coverage:
 *   npm run test:coverage  — генерирует отчёт в ./coverage
 *   Threshold пока низкие (warn, не error) — поднимем когда добавим больше тестов.
 *   Включает только server/ + src/ (без dist/, node_modules/, scripts/).
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // E2E тесты запускаются отдельно через `npx playwright test`
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'server/**/*.js',
        'src/**/*.{js,jsx,ts,tsx}',
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.config.{js,ts}',
        'server/data/**',
        'server/scripts/**',
        'src/main.jsx',
        'scripts/**',
        'dist/**',
      ],
      // Advisory thresholds — не блокируют CI пока.
      // Поднять до error когда добавим >300 тестов.
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 30,
        statements: 20,
      },
    },
  },
})
