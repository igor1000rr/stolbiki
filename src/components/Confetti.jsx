/**
 * Confetti — canvas-based анимация конфетти
 * Вызывается при победе, первой победе, ачивках
 */
import { useEffect, useRef } from 'react'

const COLORS = ['#ff6066', '#4a9eff', '#ffc145', '#3dd68c', '#ff69b4', '#00bcd4', '#9b59b6']

export default function Confetti({ duration = 3000 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = window.innerWidth
    const H = canvas.height = window.innerHeight
    const particles = []

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.5,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 1,
      })
    }

    let frame
    const start = Date.now()
    function draw() {
      const elapsed = Date.now() - start
      if (elapsed > duration) { ctx.clearRect(0, 0, W, H); return }

      ctx.clearRect(0, 0, W, H)
      const fade = elapsed > duration * 0.7 ? 1 - (elapsed - duration * 0.7) / (duration * 0.3) : 1

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = fade
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [duration])

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }} />
}
