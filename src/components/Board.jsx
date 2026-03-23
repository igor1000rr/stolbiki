import { useEffect, useRef, useState, memo } from 'react'
import { GOLDEN_STAND } from '../engine/game'

// Фишка — memo чтобы не пересоздавалась
const Chip = memo(function Chip({ color, isNew, delay, isPending }) {
  const [visible, setVisible] = useState(!isNew)

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setVisible(true), delay)
      return () => clearTimeout(t)
    }
  }, [isNew, delay])

  if (isPending) {
    return <div className={`chip p${color} chip-pending`} />
  }

  return (
    <div
      className={`chip p${color} ${isNew && visible ? 'chip-drop' : ''} ${isNew && !visible ? 'chip-hidden' : ''}`}
    />
  )
})

export default function Board({ state, pending = {}, selected, phase, humanPlayer, onStandClick, aiThinking }) {
  const prevRef = useRef({ stands: state.stands.map(s => [...s]), closed: { ...state.closed } })
  const [newChipMap, setNewChipMap] = useState({}) // { standIdx: { from, count } }
  const [flashSet, setFlashSet] = useState(new Set())

  useEffect(() => {
    const prev = prevRef.current
    const nc = {}
    const fl = new Set()

    for (let i = 0; i < state.numStands; i++) {
      const oldLen = prev.stands[i]?.length || 0
      const newLen = state.stands[i].length

      // Новые фишки
      if (newLen > oldLen) {
        nc[i] = { from: oldLen, count: newLen - oldLen }
      }

      // Закрытие
      if ((i in state.closed) && !(i in prev.closed)) {
        fl.add(i)
      }
    }

    prevRef.current = { stands: state.stands.map(s => [...s]), closed: { ...state.closed } }

    if (Object.keys(nc).length > 0) {
      setNewChipMap(nc)
      // Держим "new" статус на время анимации (stagger * count + duration)
      const maxDelay = Math.max(...Object.values(nc).map(v => v.count * 120 + 500))
      setTimeout(() => setNewChipMap({}), maxDelay)
    }

    if (fl.size > 0) {
      setFlashSet(fl)
      setTimeout(() => setFlashSet(new Set()), 1000)
    }
  }, [state])

  return (
    <div className={`board ${aiThinking ? 'board-thinking' : ''}`}>
      {state.stands.map((chips, i) => {
        const isClosed = i in state.closed
        const isGolden = i === GOLDEN_STAND
        const isSelected = selected === i
        const isTarget = phase === 'transfer-dst' && !isClosed && i !== selected
        const isFlashing = flashSet.has(i)
        const newInfo = newChipMap[i]
        const pendingCount = pending[i] || 0

        let cls = 'stand'
        if (isGolden) cls += ' golden'
        if (isClosed) cls += ' closed'
        if (isSelected) cls += ' selected'
        if (isTarget) cls += ' target'
        if (isFlashing) cls += ' stand-flash'

        return (
          <div key={i} className={cls} onClick={() => onStandClick?.(i)}>
            <span className="stand-label">{isGolden ? '★' : i}</span>
            {isClosed && <span className="stand-owner">П{state.closed[i] + 1}</span>}

            {chips.map((c, j) => {
              const isNew = newInfo && j >= newInfo.from
              const staggerIdx = isNew ? j - newInfo.from : 0
              return (
                <Chip
                  key={`${i}-${j}`}
                  color={c}
                  isNew={isNew}
                  delay={staggerIdx * 120}
                  isPending={false}
                />
              )
            })}

            {Array.from({ length: pendingCount }).map((_, j) => (
              <Chip key={`pending-${i}-${j}`} color={humanPlayer} isNew={false} delay={0} isPending={true} />
            ))}

            {isFlashing && <div className="stand-flash-glow" />}
          </div>
        )
      })}
    </div>
  )
}
