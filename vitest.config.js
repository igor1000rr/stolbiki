/**
 * Vitest config — vitest исключает Playwright E2E спеки из unit-тестов.
 *
 * Без этого vitest подхватывает e2e/*.spec.js по дефолтному паттерну и валится на
 * test.describe() — это Playwright API, не vitest.
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
  },
})
