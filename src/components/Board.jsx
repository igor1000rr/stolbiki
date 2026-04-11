import { useEffect, useRef, useState, memo } from 'react'
import '../css/board-animations.css'
import '../css/stand-skins.css'
import { GOLDEN_STAND } from '../engine/game'
import { useLongPress } from '../hooks/useLongPress'

// Фишка — memo чтобы не пересоздавалась
const Chip = memo(function Chip({ color, isNew, delay, isPending, ghostOut, ghostIn }) {
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

  if (ghostOut) {
    return <div className={`chip p${color} chip-ghost-out`} />
  }

  if (ghostIn) {
    return <div className={`chip p${color} chip-ghost-in`} />
  }

  return (
    <div
      className={`chip p${color} ${isNew && visible ? 'chip-drop' : ''} ${isNew && !visible ? 'chip-hidden' : ''}`}
    />
  )
})

// StandItem — отдельный компонент чтобы useLongPress вызывался не внутри .map()
function StandItem({
  i, chips, closedOwner, isGolden, isSelected, isTarget, isFlashing,
  newInfo, pendingCount, humanPlayer, ghostTransfer, particles,
  showChipCount, showFillBar, maxChips,
  onStandClick, onStandLongPress,
}) {
  const { pressing, handlers } = useLongPress(
    onStandLongPress ? () => onStandLongPress(i) : null,
    () => onStandClick?.(i),
    { delay: 500 }
  )

  const isClosed = closedOwner !== null && closedOwner !== undefined

  let cls = 'stand'
  if (isGolden) cls += ' golden'
  if (isClosed) cls += ' closed'
  if (isSelected) cls += ' selected'
  if (isTarget) cls += ' target'
  if (isFlashing) cls += ' stand-flash stand-closing'
  if (ghostTransfer?.from === i) cls += ' stand-ghost-from'
  if (ghostTransfer?.to === i) cls += ' stand-ghost-to'
  if (pressing && onStandLongPress) cls += ' stand-long-pressing'

  return (
    <div
      className={cls + ' board-stand'}
      style={{ transformOrigin: 'bottom center' }}
      role="button"
      tabIndex={0}
      aria-label={isClosed ? `Stand ${i} closed, owner P${closedOwner + 1}` : `Stand ${i}, ${chips.length} of 11 chips`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStandClick?.(i) } }}
      title={isClosed ? `Достроена: П${closedOwner + 1}` : `${chips.length}/11 блоков, свободно: ${11 - chips.length}`}
      {...handlers}
    >
      <span className="stand-label">{isGolden ? '★' : 'ABCDEFGHI'[i - 1]}</span>
      {isClosed && <span className="stand-owner">П{closedOwner + 1}</span>}

      {showChipCount && !isClosed && (
        <div style={{
          position: 'absolute', bottom: -20, fontSize: 11, fontWeight: 600,
          color: chips.length >= 9 ? 'var(--p2)' : chips.length >= 7 ? 'var(--gold)' : 'var(--ink3)',
          opacity: chips.length > 0 ? 1 : 0.4,
        }}>
          {chips.length}
        </div>
      )}

      {showFillBar && !isClosed && chips.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 2, left: '10%', right: '10%', height: 2,
          background: 'var(--surface2)', borderRadius: 1, overflow: 'hidden', opacity: 0.6,
        }}>
          <div style={{
            width: `${chips.length / (maxChips || 11) * 100}%`, height: '100%',
            background: chips.length >= 9 ? 'var(--p2)' : chips.length >= 7 ? 'var(--gold)' : 'var(--p1)',
            borderRadius: 1, transition: 'width 0.3s',
          }} />
        </div>
      )}

      {chips.map((c, j) => {
        const isNew = newInfo && j >= newInfo.from
        const staggerIdx = isNew ? j - newInfo.from : 0
        const isGhostOut = ghostTransfer && ghostTransfer.from === i && j >= chips.length - ghostTransfer.count
        return (
          <Chip
            key={`${i}-${j}`}
            color={c}
            isNew={isNew}
            delay={staggerIdx * 150}
            isPending={false}
            ghostOut={isGhostOut}
          />
        )
      })}

      {ghostTransfer && ghostTransfer.to === i && Array.from({ length: ghostTransfer.count }).map((_, j) => (
        <Chip key={`ghost-${i}-${j}`} color={ghostTransfer.color} isNew={false} delay={0} isPending={false} ghostIn={true} />
      ))}

      {Array.from({ length: pendingCount }).map((_, j) => (
        <Chip key={`pending-${i}-${j}`} color={humanPlayer} isNew={false} delay={0} isPending={true} />
      ))}

      {isFlashing && <div className="stand-flash-glow" />}
      {particles && (
        <div className="close-particles">
          {particles.map(p => (
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
}

function Board({ state, pending = {}, selected, phase, humanPlayer, onStandClick, onStandLongPress, aiThinking, flip = false, showChipCount = true, showFillBar = true, ghostTransfer = null }) {
  const prevRef = useRef({ stands: state.stands.map(s => [...s]), closed: { ...state.closed } })
  const [newChipMap, setNewChipMap] = useState({})
  const [flashSet, setFlashSet] = useState(new Set())
  const [particles, setParticles] = useState({})
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    const prev = prevRef.current
    const nc = {}
    const fl = new Set()
    const newParticles = {}

    for (let i = 0; i < state.numStands; i++) {
      const oldLen = prev.stands[i]?.length || 0
      const newLen = state.stands[i].length

      if (newLen > oldLen) {
        nc[i] = { from: oldLen, count: newLen - oldLen }
      }

      if ((i in state.closed) && !(i in prev.closed)) {
        fl.add(i)
        const owner = state.closed[i]
        const baseColor = owner === 0 ? ['var(--p1)', 'var(--p1-light)', 'var(--p1-light)'] : ['var(--p2)', 'var(--p2-light)', 'var(--p2-light)']
        const sparkColors = ['var(--gold)', '#fff', ...baseColor]
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
      setShaking(true)
      timers.push(setTimeout(() => setFlashSet(new Set()), 1000))
      timers.push(setTimeout(() => setShaking(false), 600))
    }

    if (Object.keys(newParticles).length > 0) {
      setParticles(newParticles)
      timers.push(setTimeout(() => setParticles({}), 1200))
    }

    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turn, Object.keys(state.closed).length])

  const standOrder = flip ? [...Array(state.numStands).keys()].reverse() : [...Array(state.numStands).keys()]

  return (
    <div className={`board board-3d ${aiThinking ? 'board-thinking' : ''} ${flip ? 'board-flipped' : ''} ${shaking ? 'board-shake' : ''}`}>
      {standOrder.map((i) => {
        const isClosed = i in state.closed
        const isTarget = phase === 'transfer-dst' && !isClosed && i !== selected
        const isFlashing = flashSet.has(i)
        return (
          <StandItem
            key={i}
            i={i}
            chips={state.stands[i]}
            closedOwner={isClosed ? state.closed[i] : null}
            isGolden={i === GOLDEN_STAND}
            isSelected={selected === i}
            isTarget={isTarget}
            isFlashing={isFlashing}
            newInfo={newChipMap[i]}
            pendingCount={pending[i] || 0}
            humanPlayer={humanPlayer}
            ghostTransfer={ghostTransfer}
            particles={particles[i] || null}
            showChipCount={showChipCount}
            showFillBar={showFillBar}
            maxChips={state.maxChips || 11}
            onStandClick={onStandClick}
            onStandLongPress={onStandLongPress}
          />
        )
      })}
    </div>
  )
}

export default memo(Board)
