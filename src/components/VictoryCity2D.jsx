/**
 * VictoryCity2D — SVG 2.5D fallback для устройств без WebGL.
 * Копия прежнего изометрического рендера (v5.4.x) на SVG параллелограммах.
 * Используется из VictoryCity.jsx при WebGL error или при useSWRender=true.
 */
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../engine/i18n'

const HW = 26
const HH = 13
const FH = 9
const COLS = 5

const SKIN_PALETTE = {
  blocks_classic:  { p1: ['#6db4ff','#3a85d0','#1a5fa0'], p2: ['#ff8888','#cc3333','#991111'] },
  blocks_flat:     { p1: ['#4a9eff','#2a7edf','#1060b0'], p2: ['#ff6066','#df3040','#b01020'] },
  blocks_round:    { p1: ['#4a9eff','#2a7edf','#1060b0'], p2: ['#ff6066','#df3040','#b01020'] },
  blocks_glass:    { p1: ['rgba(74,158,255,0.85)','rgba(74,158,255,0.55)','rgba(74,158,255,0.3)'], p2: ['rgba(255,96,102,0.85)','rgba(255,96,102,0.55)','rgba(255,96,102,0.3)'] },
  blocks_metal:    { p1: ['#b8d4f0','#6a9cc8','#4a7ca8'], p2: ['#f0b8b8','#c86a6a','#a84a4a'] },
  blocks_candy:    { p1: ['#a0e0ff','#60c0ff','#40a0e0'], p2: ['#ffa0c0','#ff6090','#e04070'] },
  blocks_pixel:    { p1: ['#4a9eff','#2a7edf','#1060b0'], p2: ['#ff6066','#df3040','#b01020'] },
  blocks_neon:     { p1: ['#00e5ff','#0099bb','#006688'], p2: ['#ff3090','#bb0060','#880040'] },
  blocks_glow:     { p1: ['#7ec8ff','#4a9eff','#2a7edf'], p2: ['#ff9090','#ff6066','#cc3333'] },
}

const CHIP_DEFAULT = {
  0: ['#6db4ff','#3a85d0','#1a5fa0'],
  1: ['#ff8888','#cc3333','#991111'],
  g: ['#ffd86e','#bf8800','#8a5f00'],
}

const SPIRE_COLORS = {
  1: ['#d4a017','#9a7010','#6a4c08'],
  2: ['#e8b830','#b08820','#806012'],
  3: ['#ffc845','#c09020','#906814'],
  4: ['#ffe080','#e0a030','#a07020'],
}

function getDiffBonus(aiDifficulty) {
  if (!aiDifficulty) return 0
  const d = typeof aiDifficulty === 'number' ? aiDifficulty : parseInt(aiDifficulty, 10) || 0
  if (d >= 1500) return 4
  if (d >= 800)  return 3
  if (d >= 400)  return 2
  if (d >= 150)  return 1
  return 0
}

function getDiffLabel(aiDifficulty, en) {
  if (!aiDifficulty) return null
  const d = typeof aiDifficulty === 'number' ? aiDifficulty : parseInt(aiDifficulty, 10) || 0
  if (d >= 1500) return en ? 'Impossible' : 'Невозможно'
  if (d >= 800)  return en ? 'Extreme' : 'Экстрим'
  if (d >= 400)  return en ? 'Hard' : 'Сложно'
  if (d >= 150)  return en ? 'Medium' : 'Средняя'
  return en ? 'Easy' : 'Лёгкая'
}

function getSkinColors(skinId, colorIdx) {
  if (skinId && SKIN_PALETTE[skinId]) {
    return colorIdx === 0 ? SKIN_PALETTE[skinId].p1 : SKIN_PALETTE[skinId].p2
  }
  return CHIP_DEFAULT[colorIdx] || CHIP_DEFAULT[0]
}

function pts(arr) {
  return arr.map(([a, b]) => `${a},${b}`).join(' ')
}

function IsoFloor({ bx, by, i, color, golden, skinId, spireLevel = 0 }) {
  let c
  if (spireLevel > 0) c = SPIRE_COLORS[spireLevel] || SPIRE_COLORS[1]
  else if (golden) c = CHIP_DEFAULT.g
  else c = getSkinColors(skinId, color)
  const y0 = by - i * FH
  const y1 = by - (i + 1) * FH
  const left  = pts([[bx-HW,y1],[bx,y1+HH],[bx,y0+HH],[bx-HW,y0]])
  const right = pts([[bx,y1+HH],[bx+HW,y1],[bx+HW,y0],[bx,y0+HH]])
  const top   = pts([[bx-HW,y1],[bx,y1-HH],[bx+HW,y1],[bx,y1+HH]])
  return (
    <g>
      <polygon points={left}  fill={c[1]} />
      <polygon points={right} fill={c[2]} />
      <polygon points={top}   fill={c[0]} />
    </g>
  )
}

function Building({ bx, by, chips, golden, skinId, extraFloors = 0, selected, onSelect }) {
  if (!chips.length) return null
  const n = chips.length
  const totalFloors = n + extraFloors
  const outline = pts([
    [bx, by - totalFloors * FH - HH],
    [bx + HW, by - totalFloors * FH],
    [bx + HW, by],
    [bx, by + HH],
    [bx - HW, by],
    [bx - HW, by - totalFloors * FH],
  ])
  return (
    <g onClick={onSelect} style={{ cursor: 'pointer' }}>
      {chips.map((c, i) => {
        const isTop = i === n - 1 && extraFloors === 0
        return <IsoFloor key={i} bx={bx} by={by} i={i} color={c} golden={isTop && golden} skinId={skinId} />
      })}
      {extraFloors > 0 && Array.from({ length: extraFloors }).map((_, j) => {
        const spireLevel = extraFloors - j
        const clamped = Math.max(1, Math.min(4, spireLevel))
        return <IsoFloor key={`spire-${j}`} bx={bx} by={by} i={n + j} color={0} golden={false} skinId={skinId} spireLevel={clamped} />
      })}
      {selected && <polygon points={outline} fill="none" stroke="rgba(255,193,69,0.9)" strokeWidth="1.5" />}
    </g>
  )
}

function getChips(building) {
  const snap = building.stands_snapshot || []
  const closed = snap.filter(s => s.owner !== null && Array.isArray(s.chips) && s.chips.length)
  if (!closed.length) return []
  return closed.reduce((a, b) => b.chips.length > a.chips.length ? b : a).chips
}

export default function VictoryCity2D({ buildings, stats, en }) {
  const [selId, setSelId] = useState(null)
  const [view, setView] = useState(null)
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  const positioned = buildings
    .map((b, i) => ({
      b,
      col: i % COLS,
      row: Math.floor(i / COLS),
      chips: getChips(b),
      extraFloors: b.is_ai ? getDiffBonus(b.ai_difficulty) : 0,
    }))
    .filter(p => p.chips.length)
    .sort((a, b_) => (a.col + a.row) - (b_.col + b_.row))

  const rows = Math.max(1, Math.ceil(buildings.length / COLS))
  const maxExtra = positioned.reduce((m, p) => Math.max(m, p.extraFloors), 0)
  const maxChips = positioned.reduce((m, p) => Math.max(m, p.chips.length), 11)
  const pad = 14
  const totalMaxH = maxChips + maxExtra
  const vx0 = -(rows - 1) * HW - HW - pad
  const vx1 = (COLS - 1) * HW + HW + pad
  const vy0 = -totalMaxH * FH - HH - pad
  const vy1 = (COLS - 1 + rows - 1) * HH + HH * 2 + pad
  const vw0 = vx1 - vx0, vh0 = vy1 - vy0

  useEffect(() => { setView({ x: vx0, y: vy0, w: vw0, h: vh0 }) }, [buildings.length]) // eslint-disable-line

  const cv = view || { x: vx0, y: vy0, w: vw0, h: vh0 }

  const onWheel = (e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.15 : 0.87
    setView(v => {
      const nw = Math.max(vw0 * 0.3, Math.min(vw0 * 2.5, v.w * factor))
      const nh = nw * (vh0 / vw0)
      return { x: v.x + (v.w - nw) / 2, y: v.y + (v.h - nh) / 2, w: nw, h: nh }
    })
  }
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const onPointerDown = (e) => {
    if (e.target.tagName === 'polygon') return
    dragRef.current = {
      sx: e.clientX, sy: e.clientY,
      vx: cv.x, vy: cv.y,
      cw: containerRef.current?.clientWidth || 320,
      ch: containerRef.current?.clientHeight || 220,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!dragRef.current) return
    const d = dragRef.current
    const dx = (e.clientX - d.sx) / d.cw * cv.w
    const dy = (e.clientY - d.sy) / d.ch * cv.h
    setView(v => ({ ...v, x: d.vx - dx, y: d.vy - dy }))
  }
  const onPointerUp = () => { dragRef.current = null }

  const selB = selId ? buildings.find(b => b.id === selId) : null

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          background: 'linear-gradient(175deg, #06060f 0%, #0c0c22 55%, #13132c 100%)',
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden', touchAction: 'none', userSelect: 'none',
          cursor: dragRef.current ? 'grabbing' : 'grab',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg viewBox={`${cv.x} ${cv.y} ${cv.w} ${cv.h}`} width="100%"
          style={{ display: 'block', aspectRatio: `${vw0} / ${vh0}`, maxHeight: 440 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <circle key={i}
              cx={vx0 + (i * 137.508 % vw0)}
              cy={vy0 + ((i * 93.71 + 7) % (vh0 * 0.5))}
              r={(i % 5 === 0) ? 1.4 : 0.6}
              fill="white" opacity={0.12 + (i % 8) * 0.06} />
          ))}
          <circle cx={vx1 - 22} cy={vy0 + 22} r={11} fill="#f5e6b0" opacity="0.18" />
          <circle cx={vx1 - 17} cy={vy0 + 18} r={9}  fill="#06060f" opacity="0.95" />
          {positioned.map(({ b, col, row, chips, extraFloors }) => (
            <Building
              key={b.id}
              bx={(col - row) * HW}
              by={(col + row) * HH}
              chips={chips}
              golden={b.result === 'draw_won'}
              skinId={b.player_skin_id || 'blocks_classic'}
              extraFloors={extraFloors}
              selected={selId === b.id}
              onSelect={(e) => { e.stopPropagation(); setSelId(selId === b.id ? null : b.id) }}
            />
          ))}
        </svg>
      </div>

      {selB && (() => {
        const diffBonus = selB.is_ai ? getDiffBonus(selB.ai_difficulty) : 0
        const diffLabel = getDiffLabel(selB.ai_difficulty, en)
        return (
          <div style={{ marginTop: 10, padding: '14px 16px', background: 'var(--surface)',
            borderRadius: 10, border: '1px solid rgba(255,193,69,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: selB.result === 'draw_won' ? 'var(--gold)' : 'var(--green)' }}>
                  {selB.result === 'draw_won' ? '★ ' : '🏆 '}
                  {selB.result === 'draw_won' ? (en ? 'Golden victory' : 'Победа по золотой') : (en ? 'Victory' : 'Победа')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                  {new Date(selB.created_at * 1000).toLocaleDateString(en ? 'en-US' : 'ru',
                    { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button onClick={() => setSelId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Opponent' : 'Соперник'}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                  {selB.opponent_name || (selB.is_ai ? 'Snappy' : (en ? 'Player' : 'Игрок'))}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Floors' : 'Этажей'}</div>
                <div style={{ fontWeight: 700, color: 'var(--gold)', marginTop: 2, fontSize: 16 }}>
                  {getChips(selB).length}
                  {diffBonus > 0 && <span style={{ fontSize: 11, color: '#ffc845', marginLeft: 4 }}>+{diffBonus}▲</span>}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Closed' : 'Достроено'}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                  {(selB.stands_snapshot || []).filter(s => s.owner !== null).length} / 10
                </div>
              </div>
              {diffLabel && (
                <div>
                  <div style={{ color: 'var(--ink3)' }}>{en ? 'Difficulty' : 'Сложность'}</div>
                  <div style={{ fontWeight: 600, color: diffBonus >= 3 ? '#ffc845' : diffBonus >= 1 ? '#e8b830' : 'var(--ink)', marginTop: 2 }}>
                    {diffLabel} {diffBonus > 0 && '⭐'.repeat(diffBonus)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
