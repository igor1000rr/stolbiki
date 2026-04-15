import { forwardRef } from 'react'

/**
 * Лог ходов игры. Прокрутка вниз через ref.
 * Вынесен из Game.jsx.
 */
const GameLog = forwardRef(function GameLog({ log }, ref) {
  return (
    <div className="game-log" ref={ref}>
      {log.map((e, i) => (
        <div key={i}>
          <span style={{ color: 'var(--ink3)', fontSize: 10, marginRight: 6 }}>{e.time}</span>
          <span className={e.player >= 0 ? `log-p${e.player}` : ''}>{e.text}</span>
        </div>
      ))}
    </div>
  )
})

export default GameLog
