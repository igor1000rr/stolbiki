/**
 * Confetti-анимация победы. 40 частиц с рандомными цветами/размерами.
 * Стили в game.css (.confetti-container, .confetti).
 * Вынесен из Game.jsx.
 */
import { useState } from 'react'

const COLORS = ['var(--gold)', 'var(--p1-light)', 'var(--p2)', 'var(--green)', 'var(--purple)', 'var(--coral)']

function makeParticles() {
  return Array.from({ length: 40 }, (_, i) => ({
    key: i,
    left: `${Math.random() * 100}%`,
    background: COLORS[i % 6],
    width: `${6 + Math.random() * 8}px`,
    height: `${6 + Math.random() * 8}px`,
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    animationDuration: `${1.5 + Math.random() * 2}s`,
    animationDelay: `${Math.random() * 0.8}s`,
  }))
}

export default function ConfettiOverlay({ show }) {
  // Lazy-init useState: Math.random() вычисляется один раз при маунте.
  // React 19 eslint-plugin-react-hooks считает lazy-инициализатор безопасным —
  // в отличие от useMemo, где impure функция в теле вызывается при каждом рендере.
  const [particles] = useState(makeParticles)

  if (!show) return null
  return (
    <div className="confetti-container">
      {particles.map(p => (
        <div key={p.key} className="confetti" style={{
          left: p.left,
          background: p.background,
          width: p.width,
          height: p.height,
          borderRadius: p.borderRadius,
          animationDuration: p.animationDuration,
          animationDelay: p.animationDelay,
        }} />
      ))}
    </div>
  )
}
