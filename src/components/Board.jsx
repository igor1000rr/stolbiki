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

export default function Board({ state, pending = {}, selected, phase, humanPlayer, onStandClick, aiThinking, flip = false, showChipCount = true, showFillBar = true }) {
  const prevRef = useRef({ stands: state.stands.map(s => [...s]), closed: { ...state.closed } })
  const [newChipMap, setNewChipMap] = useState({}) // { standIdx: { from, count } }
  const [flashSet, setFlashSet] = useState(new Set())
  const [particles, setParticles] = useState({}) // { standIdx: [{ id, x, y, color, dx, dy }] }

  useEffect(() => {
    const prev = prevRef.current
    const nc = {}
    const fl = new Set()
    const newParticles = {}

    for (let i = 0; i < state.numStands; i++) {
      const oldLen = prev.stands[i]?.length || 0
      const newLen = state.stands[i].length

      // Новые фишки
      if (newLen > oldLen) {
        nc[i] = { from: oldLen, count: newLen - oldLen }
      }

      // Закрытие — запускаем частицы
      if ((i in state.closed) && !(i in prev.closed)) {
        fl.add(i)
        const owner = state.closed[i]
        const baseColor = owner === 0 ? ['#4a9eff', '#6db4ff', '#a0d0ff'] : ['#ff6b6b', '#ff8888', '#ffb0b0']
        const sparkColors = ['#ffc145', '#fff', ...baseColor]
        newParticles[i] = Array.from({ length: 14 }, (_, j) => ({
          id: j,
          color: sparkColors[j % sparkColors.length],
          angle: (j / 14) * 360 + Math.random() * 20,
          dist: 30 + Math.random() * 40,
          size: 3 + Math.random() * 5,
          delay: Math.random() * 0.15,
        }))
      }
    }

    prevRef.current = { stands: state.stands.map(s => [...s]), closed: { ...state.closed } }

    const timers = []

    if (Object.keys(nc).length > 0) {
      setNewChipMap(nc)
      const maxDelay = Math.max(...Object.values(nc).map(v => v.count * 150 + 700))
      timers.push(setTimeout(() => setNewChipMap({}), maxDelay))
    }

    if (fl.size > 0) {
      setFlashSet(fl)
      timers.push(setTimeout(() => setFlashSet(new Set()), 1000))
    }

    if (Object.keys(newParticles).length > 0) {
      setParticles(newParticles)
      timers.push(setTimeout(() => setParticles({}), 1200))
    }

    return () => timers.forEach(clearTimeout)
  }, [state])

  const standOrder = flip ? [...Array(state.numStands).keys()].reverse() : [...Array(state.numStands).keys()]

  return (
    <div className={`board ${aiThinking ? 'board-thinking' : ''} ${flip ? 'board-flipped' : ''}`}>
      {standOrder.map((i) => {
        const chips = state.stands[i]
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
          <div key={i} className={cls} onClick={() => onStandClick?.(i)}
            role="button" tabIndex={0} aria-label={isClosed ? `Stand ${i} closed, owner P${state.closed[i]+1}` : `Stand ${i}, ${chips.length} of 11 chips`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStandClick?.(i) } }}
            title={isClosed ? `Закрыта: П${state.closed[i]+1}` : `${chips.length}/11 фишек, свободно: ${11 - chips.length}`}>
            <span className="stand-label">{isGolden ? '★' : i}</span>
            {isClosed && <span className="stand-owner">П{state.closed[i] + 1}</span>}

            {/* Счётчик фишек */}
            {showChipCount && !isClosed && chips.length > 0 && (
              <div style={{
                position: 'absolute', bottom: -18, fontSize: 9, fontWeight: 600,
                color: chips.length >= 9 ? '#ff6b6b' : chips.length >= 7 ? '#ffc145' : '#555',
                opacity: chips.length >= 7 ? 1 : 0.5,
              }}>
                {chips.length}/{state.maxChips || 11}
              </div>
            )}

            {/* Индикатор заполненности */}
            {showFillBar && !isClosed && chips.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 2, left: '10%', right: '10%', height: 2,
                background: '#2a2a38', borderRadius: 1, overflow: 'hidden', opacity: 0.6,
              }}>
                <div style={{
                  width: `${chips.length / (state.maxChips || 11) * 100}%`, height: '100%',
                  background: chips.length >= 9 ? '#ff6b6b' : chips.length >= 7 ? '#ffc145' : '#4a9eff',
                  borderRadius: 1, transition: 'width 0.3s',
                }} />
              </div>
            )}

            {chips.map((c, j) => {
              const isNew = newInfo && j >= newInfo.from
              const staggerIdx = isNew ? j - newInfo.from : 0
              return (
                <Chip
                  key={`${i}-${j}`}
                  color={c}
                  isNew={isNew}
                  delay={staggerIdx * 150}
                  isPending={false}
                />
              )
            })}

            {Array.from({ length: pendingCount }).map((_, j) => (
              <Chip key={`pending-${i}-${j}`} color={humanPlayer} isNew={false} delay={0} isPending={true} />
            ))}

            {isFlashing && <div className="stand-flash-glow" />}
            {/* Частицы при закрытии */}
            {particles[i] && (
              <div className="close-particles">
                {particles[i].map(p => (
                  <div key={p.id} className="close-particle"
                    style={{
                      '--angle': `${p.angle}deg`,
                      '--dist': `${p.dist}px`,
                      '--delay': `${p.delay}s`,
                      '--size': `${p.size}px`,
                      background: p.color,
                    }} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
