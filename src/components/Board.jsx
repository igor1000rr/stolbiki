import { useEffect, useRef, useState } from 'react'
import { GOLDEN_STAND } from '../engine/game'

export default function Board({ state, pending = {}, selected, phase, humanPlayer, onStandClick, lastAction, aiThinking }) {
  const prevStandsRef = useRef(state.stands.map(s => s.length))
  const [flashStands, setFlashStands] = useState({})
  const [newChips, setNewChips] = useState({})

  // Определяем новые фишки для stagger-анимации
  useEffect(() => {
    const prev = prevStandsRef.current
    const nc = {}
    const fl = {}

    for (let i = 0; i < state.stands.length; i++) {
      const oldLen = prev[i] || 0
      const newLen = state.stands[i].length

      if (newLen > oldLen) {
        // Новые фишки появились
        nc[i] = { from: oldLen, to: newLen }
      }

      // Стойка только что закрылась
      if (i in state.closed && !(i in (prevStandsRef._prevClosed || {}))) {
        fl[i] = true
      }
    }

    if (Object.keys(nc).length > 0) {
      setNewChips(nc)
      setTimeout(() => setNewChips({}), 600)
    }

    if (Object.keys(fl).length > 0) {
      setFlashStands(fl)
      setTimeout(() => setFlashStands({}), 1000)
    }

    prevStandsRef.current = state.stands.map(s => s.length)
    prevStandsRef._prevClosed = { ...state.closed }
  }, [state])

  return (
    <div className={`board ${aiThinking ? 'board-thinking' : ''}`}>
      {state.stands.map((chips, i) => {
        const isClosed = i in state.closed
        const isGolden = i === GOLDEN_STAND
        const isSelected = selected === i
        const isTarget = phase === 'transfer-dst' && !isClosed && i !== selected
        const isFlashing = flashStands[i]
        const newInfo = newChips[i]

        const classes = [
          'stand',
          isGolden && 'golden',
          isClosed && 'closed',
          isSelected && 'selected',
          isTarget && 'target',
          isFlashing && 'stand-flash',
        ].filter(Boolean).join(' ')

        const pendingCount = pending[i] || 0

        return (
          <div key={i} className={classes} onClick={() => onStandClick?.(i)}>
            <span className="stand-label">{isGolden ? '★' : i}</span>
            {isClosed && <span className="stand-owner">П{state.closed[i] + 1}</span>}

            {chips.map((c, j) => {
              const isNew = newInfo && j >= newInfo.from
              const staggerDelay = isNew ? (j - newInfo.from) * 80 : 0

              return (
                <div
                  key={`${i}-${j}-${c}`}
                  className={`chip p${c} ${isNew ? 'chip-enter' : ''}`}
                  style={isNew ? {
                    animationDelay: `${staggerDelay}ms`,
                  } : undefined}
                />
              )
            })}

            {Array.from({ length: pendingCount }).map((_, j) => (
              <div key={`p${j}`} className={`chip p${humanPlayer} chip-pending`} />
            ))}

            {/* Glow overlay для flash */}
            {isFlashing && <div className="stand-flash-overlay" />}
          </div>
        )
      })}
    </div>
  )
}
