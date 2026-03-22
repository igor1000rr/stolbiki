import { GOLDEN_STAND } from '../engine/game'

export default function Board({ state, pending = {}, selected, phase, humanPlayer, onStandClick }) {
  return (
    <div className="board">
      {state.stands.map((chips, i) => {
        const isClosed = i in state.closed
        const isGolden = i === GOLDEN_STAND
        const isSelected = selected === i
        const isTarget = phase === 'transfer-dst' && !isClosed && i !== selected

        const classes = [
          'stand',
          isGolden && 'golden',
          isClosed && 'closed',
          isSelected && 'selected',
          isTarget && 'target',
        ].filter(Boolean).join(' ')

        const pendingCount = pending[i] || 0

        return (
          <div key={i} className={classes} onClick={() => onStandClick?.(i)}>
            <span className="stand-label">{isGolden ? '★' : i}</span>
            {isClosed && <span className="stand-owner">П{state.closed[i] + 1}</span>}
            {chips.map((c, j) => (
              <div key={j} className={`chip p${c}`} />
            ))}
            {Array.from({ length: pendingCount }).map((_, j) => (
              <div key={`p${j}`} className={`chip p${humanPlayer} pending`} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
