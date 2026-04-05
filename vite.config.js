import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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

export default defineConfig({
  plugins: [react(), swBuildHash()],
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
