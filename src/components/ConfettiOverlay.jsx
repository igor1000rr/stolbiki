/**
 * Confetti-анимация победы. 40 частиц с рандомными цветами/размерами.
 * Стили в game.css (.confetti-container, .confetti).
 * Вынесен из Game.jsx.
 */
export default function ConfettiOverlay({ show }) {
  if (!show) return null
  return (
    <div className="confetti-container">
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} className="confetti" style={{
          left: `${Math.random() * 100}%`,
          background: ['var(--gold)', 'var(--p1-light)', 'var(--p2)', 'var(--green)', 'var(--purple)', 'var(--coral)'][i % 6],
          width: `${6 + Math.random() * 8}px`,
          height: `${6 + Math.random() * 8}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animationDuration: `${1.5 + Math.random() * 2}s`,
          animationDelay: `${Math.random() * 0.8}s`,
        }} />
      ))}
    </div>
  )
}
