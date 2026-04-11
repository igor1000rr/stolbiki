/**
 * MascotRunner — Snappy летит дугой от стойки-источника к стойке-цели при переносе блоков
 * Issue #1: «Енот подбегает, забирает столбики»
 *
 * Использует data-stand={i} атрибуты на .board-stand (добавлены в Board.jsx),
 * что корректно работает при любом порядке стоек (включая flip).
 *
 * Props:
 *   run: { from: number, to: number, color: 0|1, count: number, key: string } | null
 *   onDone: () => void
 */
import { useEffect, useRef, useState } from 'react'

export default function MascotRunner({ run, onDone }) {
  const [anim, setAnim] = useState(null)
  const styleRef = useRef(null)

  useEffect(() => {
    if (!run) { setAnim(null); return }

    const srcEl = document.querySelector(`.board-stand[data-stand="${run.from}"]`)
    const dstEl = document.querySelector(`.board-stand[data-stand="${run.to}"]`)
    if (!srcEl || !dstEl) { onDone?.(); return }

    const srcRect = srcEl.getBoundingClientRect()
    const dstRect = dstEl.getBoundingClientRect()

    const x1 = srcRect.left + srcRect.width / 2
    const y1 = srcRect.top + srcRect.height * 0.25

    const x2 = dstRect.left + dstRect.width / 2
    const y2 = dstRect.top + dstRect.height * 0.25

    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    const arcH = Math.min(dist * 0.5, 90) // высота дуги

    // Уникальное имя keyframe на случай быстрых повторных переносов
    const animId = `_mr${Date.now()}`
    const css = `
      @keyframes ${animId} {
        0%   { transform: translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.75); opacity: 0.5; }
        15%  { opacity: 1; transform: translate(${x1 + dx * 0.15}px, ${y1 + dy * 0.15 - arcH * 0.65}px) translate(-50%, -50%) scale(1.1); }
        50%  { transform: translate(${x1 + dx * 0.5}px, ${y1 + dy * 0.5 - arcH}px) translate(-50%, -50%) scale(1.18); }
        85%  { transform: translate(${x1 + dx * 0.85}px, ${y1 + dy * 0.85 - arcH * 0.3}px) translate(-50%, -50%) scale(1.05); }
        100% { transform: translate(${x2}px, ${y2}px) translate(-50%, -50%) scale(0.8); opacity: 0.3; }
      }
    `

    styleRef.current?.remove()
    const styleEl = document.createElement('style')
    styleEl.textContent = css
    document.head.appendChild(styleEl)
    styleRef.current = styleEl

    setAnim({ x1, y1, color: run.color, count: run.count, animId, dir: dx })

    const t = setTimeout(() => {
      setAnim(null)
      styleEl.remove()
      onDone?.()
    }, 760)

    return () => { clearTimeout(t); styleEl.remove() }
  }, [run?.key]) // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => styleRef.current?.remove(), [])

  if (!anim) return null

  const chipColor = anim.color === 0 ? 'var(--p1)' : 'var(--p2)'
  const chipGlow  = anim.color === 0 ? 'rgba(74,158,255,0.6)' : 'rgba(255,96,102,0.6)'

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1500 }}>
      <div style={{
        position: 'absolute', left: 0, top: 0,
        animation: `${anim.animId} 0.76s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
        willChange: 'transform',
      }}>
        {/* Блоки над головой */}
        {Array.from({ length: Math.min(anim.count, 4) }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: -(28 + i * 9), left: -11,
            width: 22, height: 7, borderRadius: 4,
            background: chipColor,
            boxShadow: `0 0 8px ${chipGlow}`,
            opacity: 0.95,
          }} />
        ))}

        {/* Снаппи */}
        <img
          src="/mascot/celebrate.webp"
          alt="Snappy"
          width={54}
          height={54}
          draggable={false}
          style={{
            display: 'block',
            objectFit: 'contain',
            marginLeft: -27,
            marginTop: -27,
            userSelect: 'none',
            transform: anim.dir < 0 ? 'scaleX(-1)' : 'none',
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
          }}
        />
      </div>
    </div>
  )
}
