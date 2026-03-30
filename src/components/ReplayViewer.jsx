/**
 * ReplayViewer — просмотр записи партии
 * Вынесен из Game.jsx для декомпозиции
 */

import { useState, useRef, useEffect } from 'react'
import { GameState, applyAction, GOLDEN_STAND } from '../engine/game'
import { useI18n } from '../engine/i18n'
import Board from './Board'

const SL = i => i === GOLDEN_STAND ? '★' : 'ABCDEFGHI'[i - 1] || String(i)

function describeAction(a, p, t) {
  if (!a) return ''
  if (a.swap) return 'Swap'
  const parts = []
  if (a.transfer) parts.push(`↗ ${SL(a.transfer[0])}→${SL(a.transfer[1])}`)
  if (a.placement) {
    const pl = Object.entries(a.placement).map(([i, c]) => `${SL(+i)}×${c}`).join('+')
    if (pl) parts.push(pl)
  }
  const who = p === 0 ? t('game.blue') : t('game.red')
  return `${who}: ${parts.join(', ') || t('game.pass')}`
}

export default function ReplayViewer({ moves, onClose }) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [gs, setGs] = useState(() => new GameState())
  const timerRef = useRef(null)

  useEffect(() => {
    let state = new GameState()
    for (let i = 0; i < step; i++) {
      if (moves[i]) state = applyAction(state, moves[i].action)
    }
    setGs(state)
  }, [step, moves])

  useEffect(() => {
    if (!playing) { clearInterval(timerRef.current); return }
    timerRef.current = setInterval(() => {
      setStep(prev => {
        if (prev >= moves.length) { setPlaying(false); return prev }
        return prev + 1
      })
    }, 1200)
    return () => clearInterval(timerRef.current)
  }, [playing, moves.length])

  const currentMove = step > 0 && step <= moves.length ? moves[step - 1] : null
  const s0 = gs.countClosed(0), s1 = gs.countClosed(1)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, overflow: 'auto', padding: '12px' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{t('game.replayTitle')}</span>
          <button className="btn" onClick={onClose} style={{ fontSize: 11, padding: '4px 12px' }}>{t('replay.close')}</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{s0} : {s1}</span>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
            {t('game.turn')} {step}/{moves.length}
            {currentMove && ` · ${describeAction(currentMove.action, currentMove.player, t)}`}
          </div>
        </div>

        <Board state={gs} pending={{}} selected={null} phase="done" humanPlayer={0} onStandClick={() => {}} aiThinking={false} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => { setStep(0); setPlaying(false) }} disabled={step === 0} style={{ fontSize: 12, padding: '8px 12px' }}>⏮</button>
          <button className="btn" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ fontSize: 12, padding: '8px 12px' }}>◀</button>
          <button className="btn primary" onClick={() => setPlaying(p => !p)} style={{ fontSize: 12, padding: '8px 16px' }}>
            {playing ? t('replay.pause') : t('replay.play')}
          </button>
          <button className="btn" onClick={() => setStep(s => Math.min(moves.length, s + 1))} disabled={step >= moves.length} style={{ fontSize: 12, padding: '8px 12px' }}>▶</button>
          <button className="btn" onClick={() => { setStep(moves.length); setPlaying(false) }} disabled={step >= moves.length} style={{ fontSize: 12, padding: '8px 12px' }}>⏭</button>
        </div>

        <div style={{ margin: '10px 0', height: 4, borderRadius: 2, background: 'var(--surface2)', cursor: 'pointer' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            setStep(Math.round(pct * moves.length))
            setPlaying(false)
          }}>
          <div style={{ width: `${moves.length ? (step / moves.length) * 100 : 0}%`, height: '100%', borderRadius: 2, background: 'var(--p1)', transition: 'width 0.3s' }} />
        </div>
      </div>
    </div>
  )
}

export { describeAction }
