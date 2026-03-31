import { useState, useEffect } from 'react'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter') // enter → hold → exit

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 100)
    const t2 = setTimeout(() => setPhase('exit'), 1800)
    const t3 = setTimeout(onDone, 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: phase === 'exit' ? 0 : 1,
      transition: 'opacity 0.6s ease-out',
    }}>
      <img
        src="/logo-full.webp"
        alt="Snatch Highrise"
        style={{
          width: 'min(220px, 55vw)',
          height: 'auto',
          transform: phase === 'enter' ? 'scale(0.8)' : 'scale(1)',
          opacity: phase === 'enter' ? 0 : 1,
          transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      <div style={{
        marginTop: 24,
        fontSize: 12,
        color: 'var(--ink3)',
        fontWeight: 500,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: phase === 'enter' ? 0 : 0.6,
        transform: phase === 'enter' ? 'translateY(10px)' : 'translateY(0)',
        transition: 'all 0.6s ease 0.3s',
      }}>
        Strategy Board Game
      </div>
    </div>
  )
}
