/**
 * BrickBalance — бейдж 🧱 N с балансом кирпичей
 * Использование: <BrickBalance bricks={profile.bricks} onClick={openShop} />
 *
 * Анимирует +N при изменении баланса (flash зелёным).
 */
import { useState, useEffect, useRef } from 'react'

export default function BrickBalance({ bricks = 0, onClick, style = {} }) {
  const [flash, setFlash] = useState(null) // +N
  const prevRef = useRef(bricks)

  useEffect(() => {
    if (bricks !== prevRef.current) {
      const delta = bricks - prevRef.current
      if (delta > 0) {
        setFlash(`+${delta}`)
        const t = setTimeout(() => setFlash(null), 1400)
        return () => clearTimeout(t)
      }
      prevRef.current = bricks
    }
    prevRef.current = bricks
  }, [bricks])

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 8,
        background: 'rgba(255,193,69,0.1)', border: '1px solid rgba(255,193,69,0.25)',
        cursor: onClick ? 'pointer' : 'default',
        color: 'var(--gold)', fontSize: 13, fontWeight: 700,
        transition: 'background 0.2s',
        ...style,
      }}
      title="Кирпичи — валюта для покупки скинов"
    >
      🧱 {bricks}
      {flash && (
        <span style={{
          position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, fontWeight: 700, color: 'var(--green)',
          animation: 'brickFlash 1.4s ease-out forwards',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{flash}</span>
      )}
      <style>{`
        @keyframes brickFlash {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          80%  { opacity: 1; transform: translateX(-50%) translateY(-8px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-12px); }
        }
      `}</style>
    </button>
  )
}
