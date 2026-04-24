#!/usr/bin/env node
/**
 * Post-build проверка: все критичные ассеты скопированы в dist/.
 *
 * Почему отдельный скрипт: vite копирует public/ в dist/ автоматически, но если
 * кто-то случайно добавит в .gitignore или vite.config ignore — фоны молча
 * пропадут из APK и игрок увидит чёрный экран без понятной причины.
 * Этот скрипт падает при билде с понятным сообщением, а не через 3 часа после
 * деплоя.
 *
 * Список критичных файлов: все фоны (webp + svg). Если добавляешь новый фон —
 * добавь сюда тоже.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const REQUIRED_ASSETS = [
  'backgrounds/mobile-portrait.webp',
  'backgrounds/mobile-landscape.webp',
  'backgrounds/tablet-portrait.webp',
  'backgrounds/tablet-landscape.webp',
  'backgrounds/desktop.webp',
  'backgrounds/desktop-4k.webp',
  'backgrounds/city-night.svg',
  'backgrounds/mountains.svg',
  'backgrounds/desert.svg',
  'backgrounds/space.svg',
]

let missing = []
let sizes = {}

for (const rel of REQUIRED_ASSETS) {
  const p = path.join(DIST, rel)
  try {
    const st = fs.statSync(p)
    if (st.size < 100) {
      missing.push(`${rel} (файл слишком маленький: ${st.size} bytes)`)
    } else {
      sizes[rel] = st.size
    }
  } catch {
    missing.push(`${rel} (не найден)`)
  }
}

if (missing.length) {
  console.error('\n[verify-build-assets] ❌ Отсутствуют критичные ассеты в dist/:\n')
  for (const m of missing) console.error(`  - ${m}`)
  console.error('\nПроверь: файлы в public/backgrounds/ — лежат ли они в гите? vite.config ignore?\n')
  process.exit(1)
}

const total = Object.values(sizes).reduce((a, b) => a + b, 0)
console.log(`[verify-build-assets] ✅ Все ${REQUIRED_ASSETS.length} фонов на месте в dist/ (суммарно ${(total / 1024).toFixed(0)} КБ)`)
