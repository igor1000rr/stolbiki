/**
 * MascotRunner — анимация Снэппи, пробегающего от стойки-источника к стойке-цели.
 * Issue #1 («Убрать кнопку перенос — сделать с помощью нативных нажатий.
 *             Енот подбегает, забирает столбики»).
 *
 * Использование:
 *   <MascotRunner from={srcIdx} to={dstIdx} onDone={() => setMascotAnim(null)} />
 *
 * Компонент сам находит DOM-элементы стоек по '.board-stand',
 * вычисляет координаты через getBoundingClientRect и анимирует позицию через CSS transition.
 */
import { useEffect, useState, useRef } from 'react'

// Заглушка-конверт если изображение не загрузилось
const FALLBACK = '\uD83E\uDD9D' // 🦝

export default function MascotRunner({ from: fromIdx, to: toIdx, onDone }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [phase, setPhase] = useState('init') // init → run → done
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return

    const stands = document.querySelectorAll('.board-stand')
    const fromEl = stands[fromIdx]
    const toEl = stands[toIdx]

    if (!fromEl || !toEl) {
      onDone?.()
      return
    }

    const fromR = fromEl.getBoundingClientRect()
    const toR = toEl.getBoundingClientRect()

    const SIZE = 52
    const startX = fromR.left + fromR.width / 2 - SIZE / 2
    const startY = fromR.top - SIZE - 6

    setFlipped(toR.left < fromR.left)
    setPos({ x: startX, y: startY })
    setVisible(true)
    setPhase('init')

    // Даём браузеру один кадр нарисовать начальную позицию, потом стартуем переход
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const endX = toR.left + toR.width / 2 - SIZE / 2
        const endY = toR.top - SIZE - 6
        setPos({ x: endX, y: endY })
        setPhase('run')
      })
    })

    // По окончании анимации — скрываем
    const timeout = setTimeout(() => {
      doneRef.current = true
      setPhase('done')
      setVisible(false)
      onDone?.()
    }, 750)

    return () => {
      cancelAnimationFrame(raf1)
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line

  if (!visible || !pos) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 52,
        height: 52,
        zIndex: 9500,
        pointerEvents: 'none',
        transition: phase === 'run' ? 'left 0.55s cubic-bezier(.4,0,.2,1), top 0.55s cubic-bezier(.4,0,.2,1)' : 'none',
        transform: flipped ? 'scaleX(-1)' : 'scaleX(1)',
        willChange: 'left, top',
      }}
    >
      <img
        src="/mascot/wave.webp"
        alt={FALLBACK}
        draggable={false}
        style={{
          width: 52,
          height: 52,
          objectFit: 'contain',
          animation: 'mascotRunBounce 0.25s ease-in-out infinite',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
        }}
        onError={e => { e.target.style.display = 'none' }}
      />
      <div style={{
        position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
        fontSize: 18, lineHeight: 1, display: 'none',
      }}>{FALLBACK}</div>
      <style>{`
        @keyframes mascotRunBounce {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          25% { transform: translateY(-5px) rotate(3deg); }
          75% { transform: translateY(-2px) rotate(-1deg); }
        }
      `}</style>
    </div>
  )
}
