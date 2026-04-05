import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createHash } from 'crypto'

// Плагин: подставляет __BUILD_HASH__ в dist/sw.js после сборки.
// Без этого все билды делят один CACHE_NAME — SW кеш не инвалидируется.
function swBuildHash() {
  return {
    name: 'sw-build-hash',
    apply: 'build',
    closeBundle() {
      const swPath = resolve('dist/sw.js')
      if (!existsSync(swPath)) return
      const hash = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const content = readFileSync(swPath, 'utf8').replace(/__BUILD_HASH__/g, hash)
      writeFileSync(swPath, content)
      console.log(`[sw-build-hash] CACHE_NAME → stolbiki-v${hash}`)
    },
  }
}

// Плагин: парсит dist/index.html, считает sha256 каждого inline <script>, пишет в dist/csp-hashes.json.
// Сервер читает этот файл при старте и подставляет хеши в CSP script-src → позволяет убрать 'unsafe-inline'.
function cspHashes() {
  return {
    name: 'csp-hashes',
    apply: 'build',
    closeBundle() {
      const htmlPath = resolve('dist/index.html')
      if (!existsSync(htmlPath)) return
      const html = readFileSync(htmlPath, 'utf8')
      const hashes = []
      // Матчим <script> без src — только inline. Учитываем type="application/ld+json" и type="text/javascript".
      const re = /<script(?:\s+type="[^"]*")?>([\s\S]*?)<\/script>/g
      let m
      while ((m = re.exec(html)) !== null) {
        // Пропускаем если есть src= (не inline)
        const tag = m[0].slice(0, m[0].indexOf('>') + 1)
        if (/\ssrc=/.test(tag)) continue
        const content = m[1]
        if (!content.trim()) continue
        const hash = createHash('sha256').update(content).digest('base64')
        hashes.push(`'sha256-${hash}'`)
      }
      writeFileSync(resolve('dist/csp-hashes.json'), JSON.stringify({ scriptSrc: hashes }, null, 2))
      // Дубликат в server/ — деплой-pipeline перекинет его в /opt/stolbiki-api/csp-hashes.json
      try { writeFileSync(resolve('server/csp-hashes.json'), JSON.stringify({ scriptSrc: hashes }, null, 2)) } catch {}
      console.log(`[csp-hashes] ${hashes.length} inline scripts hashed`)
    },
  }
}

export default defineConfig({
  plugins: [react(), swBuildHash(), cspHashes()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // AI движок — отдельный чанк (~3.5MB, кешируется надолго)
          if (id.includes('engine/ai') || id.includes('engine/neuralnet') || id.includes('engine/network') || id.includes('engine/simulator') || id.includes('engine/analysis') || id.includes('engine/hints')) return 'engine'
          // Графики — chart.js (тяжёлый, нужен только в Dashboard/Profile)
          if (id.includes('chart.js') || id.includes('react-chartjs')) return 'charts'
        },
      },
    },
    // engine чанк с весами будет большой
    chunkSizeWarningLimit: 4000,
  },
})
