/**
 * GameReview — AI-анализ партии
 * Показывает каждый ход с оценкой: отличный / хороший / неточность / ошибка / грубая ошибка
 */
import { useState, useEffect, useRef } from 'react'
import { GameState, applyAction } from '../engine/game'
import { analyzeGame, LABELS } from '../engine/analysis'
import Board from './Board'
import { useI18n } from '../engine/i18n'

export default function GameReview({ moveHistory, humanPlayer = 0, onClose }) {
  const { t, lang } = useI18n()
  const en = lang === 'en'
  const [analysis, setAnalysis] = useState(null)
  const [progress, setProgress] = useState(0)
  const [currentMove, setCurrentMove] = useState(-1) // -1 = начальная позиция
  const [gs, setGs] = useState(new GameState())
  const statesRef = useRef([new GameState()])

  // Запуск анализа
  useEffect(() => {
    if (!moveHistory?.length) return
    // Предвычисляем все состояния
    const states = [new GameState()]
    let s = new GameState()
    for (const { action } of moveHistory) {
      s = applyAction(s, action)
      states.push(s)
    }
    statesRef.current = states

    analyzeGame(moveHistory, humanPlayer, (step, total) => {
      setProgress(Math.round((step / total) * 100))
    }).then(result => {
      setAnalysis(result)
      setCurrentMove(0)
      setGs(states[1])
    })
  }, []) // eslint-disable-line

  function goToMove(idx) {
    setCurrentMove(idx)
    setGs(statesRef.current[idx + 1] || statesRef.current[statesRef.current.length - 1])
  }

  // Loading
  if (!analysis) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 600 }}>
          {en ? 'Analyzing game...' : 'Анализ партии...'}
        </div>
        <div style={{ width: 240, height: 6, borderRadius: 3, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #4a9eff, #3dd68c)', transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{progress}%</div>
        <button className="btn" onClick={onClose} style={{ marginTop: 8, fontSize: 12 }}>
          {en ? 'Cancel' : 'Отмена'}
        </button>
      </div>
    )
  }

  const { moves, stats } = analysis
  const current = currentMove >= 0 ? moves[currentMove] : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
          {en ? 'Game review' : 'Анализ партии'}
        </div>
        <button className="btn" onClick={onClose} style={{ fontSize: 12, padding: '6px 14px' }}>
          {en ? 'Close' : 'Закрыть'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

        {/* Left: Board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 16, minWidth: 0 }}>
          <div style={{ width: '100%', maxWidth: 500 }}>
            <Board gs={gs} humanPlayer={humanPlayer} locked selectedStand={-1} />
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={() => goToMove(-1)} disabled={currentMove <= -1}
              style={{ padding: '6px 12px', fontSize: 12 }}>⏮</button>
            <button className="btn" onClick={() => goToMove(Math.max(-1, currentMove - 1))}
              disabled={currentMove <= -1} style={{ padding: '6px 12px', fontSize: 12 }}>◀</button>
            <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--ink2)' }}>
              {currentMove + 1} / {moves.length}
            </span>
            <button className="btn" onClick={() => goToMove(Math.min(moves.length - 1, currentMove + 1))}
              disabled={currentMove >= moves.length - 1} style={{ padding: '6px 12px', fontSize: 12 }}>▶</button>
            <button className="btn" onClick={() => goToMove(moves.length - 1)}
              disabled={currentMove >= moves.length - 1} style={{ padding: '6px 12px', fontSize: 12 }}>⏭</button>
          </div>

          {/* Current move info */}
          {current && !current.skip && (
            <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 10,
              background: `${current.label.color}10`, border: `1px solid ${current.label.color}20`,
              textAlign: 'center', maxWidth: 400 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: current.label.color }}>
                {current.label.icon} {en ? current.label.en : current.label.ru}
              </span>
              {current.delta > 0.05 && current.bestAction && (
                <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 4 }}>
                  {en ? 'Eval loss' : 'Потеря оценки'}: -{(current.delta * 100).toFixed(0)}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Move list + Stats */}
        <div style={{ width: 260, borderLeft: '1px solid var(--surface2)', display: 'flex',
          flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

          {/* Stats */}
          <div style={{ padding: 14, borderBottom: '1px solid var(--surface2)' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: stats.accuracy >= 80 ? '#3dd68c' : stats.accuracy >= 60 ? '#ffc145' : '#ff6066',
              textAlign: 'center', lineHeight: 1 }}>
              {stats.accuracy}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginBottom: 10 }}>
              {en ? 'accuracy' : 'точность'}
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {Object.entries(LABELS).map(([key, lbl]) => {
                const count = stats[key] || 0
                if (!count) return null
                return (
                  <div key={key} style={{ textAlign: 'center', padding: '4px 8px', borderRadius: 6,
                    background: `${lbl.color}15` }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: lbl.color }}>{count}</div>
                    <div style={{ fontSize: 8, color: lbl.color, opacity: 0.7 }}>{lbl.icon || '✓'}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Move list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {moves.map((m, i) => {
              if (m.skip) return null
              const active = i === currentMove
              return (
                <div key={i} onClick={() => goToMove(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                  cursor: 'pointer', background: active ? 'rgba(74,158,255,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #4a9eff' : '3px solid transparent',
                }}>
                  <span style={{ fontSize: 10, color: '#555', minWidth: 20 }}>{i + 1}</span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.label.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: active ? '#e8e6f0' : '#a09cb0', flex: 1 }}>
                    {m.action.transfer ? `↗ ${m.action.transfer[0]}→${m.action.transfer[1]}` :
                     m.action.swap ? 'Swap' :
                     `${Object.entries(m.action.placement || {}).map(([k, v]) => `${k}:${v}`).join(' ')}`}
                  </span>
                  <span style={{ fontSize: 9, color: m.label.color, fontWeight: 600 }}>{m.label.icon}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
