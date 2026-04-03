import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
