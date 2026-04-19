/**
 * VictoryCity2D — SVG 2.5D fallback для устройств без WebGL.
 * Адаптирован под новую модель: получает towers вместо buildings.
 * Каждая tower — изометрическое здание из tower.pieces[].
 */
import { useState, useEffect, useRef } from 'react'

const HW = 26
const HH = 13
const FH = 9
const COLS = 5
const TOWER_HEIGHT = 11

const SKIN_PALETTE = {
  blocks_classic:  ['#6db4ff','#3a85d0','#1a5fa0'],
  blocks_flat:     ['#4a9eff','#2a7edf','#1060b0'],
  blocks_round:    ['#4a9eff','#2a7edf','#1060b0'],
  blocks_glass:    ['#6ab4ff','#4a9eff','#2a7edf'],
  blocks_metal:    ['#b8d4f0','#6a9cc8','#4a7ca8'],
  blocks_candy:    ['#80d0ff','#4a9eff','#2a7edf'],
  blocks_pixel:    ['#4a9eff','#2a7edf','#1060b0'],
  blocks_neon:     ['#00e5ff','#0099bb','#006688'],
  blocks_glow:     ['#7ec8ff','#4a9eff','#2a7edf'],
}
const GOLDEN_PAL = ['#ffd86e','#bf8800','#8a5f00']
const CROWN_PAL  = ['#ffe080','#e0a030','#a07020']

function pieceColors(piece) {
  if (piece.special) return GOLDEN_PAL
  return SKIN_PALETTE[piece.skin_id] || SKIN_PALETTE.blocks_classic
}

function pts(arr) {
  return arr.map(([a, b]) => `${a},${b}`).join(' ')
}

function IsoFloor({ bx, by, i, palette }) {
  const y0 = by - i * FH
  const y1 = by - (i + 1) * FH
  const left  = pts([[bx-HW,y1],[bx,y1+HH],[bx,y0+HH],[bx-HW,y0]])
  const right = pts([[bx,y1+HH],[bx+HW,y1],[bx+HW,y0],[bx,y0+HH]])
  const top   = pts([[bx-HW,y1],[bx,y1-HH],[bx+HW,y1],[bx,y1+HH]])
  return (
    <g>
      <polygon points={left}  fill={palette[1]} />
      <polygon points={right} fill={palette[2]} />
      <polygon points={top}   fill={palette[0]} />
    </g>
  )
}

function Tower({ bx, by, tower, selected, onSelect }) {
  if (!tower.pieces.length) return null
  const n = tower.pieces.length
  const totalFloors = n + (tower.is_closed && tower.golden_top ? 1 : 0)
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
      {tower.pieces.map((p, i) => (
        <IsoFloor key={i} bx={bx} by={by} i={i} palette={pieceColors(p)} />
      ))}
      {tower.is_closed && tower.golden_top && (
        <IsoFloor bx={bx} by={by} i={n} palette={CROWN_PAL} />
      )}
      {selected && <polygon points={outline} fill="none" stroke="rgba(255,193,69,0.9)" strokeWidth="1.5" />}
    </g>
  )
}

export default function VictoryCity2D({ towers, _stats, en }) {
  const [selIdx, setSelIdx] = useState(null)
  const [view, setView] = useState(null)
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  const positioned = towers
    .map((t, i) => ({
      tower: t, idx: i,
      col: i % COLS, row: Math.floor(i / COLS),
    }))
    .sort((a, b) => (a.col + a.row) - (b.col + b.row))

  const rows = Math.max(1, Math.ceil(towers.length / COLS))
  const maxFloors = positioned.reduce((m, p) =>
    Math.max(m, p.tower.pieces.length + (p.tower.is_closed && p.tower.golden_top ? 1 : 0)), 11)
  const pad = 14
  const vx0 = -(rows - 1) * HW - HW - pad
  const vx1 = (COLS - 1) * HW + HW + pad
  const vy0 = -maxFloors * FH - HH - pad
  const vy1 = (COLS - 1 + rows - 1) * HH + HH * 2 + pad
  const vw0 = vx1 - vx0, vh0 = vy1 - vy0

  useEffect(() => { setView({ x: vx0, y: vy0, w: vw0, h: vh0 }) }, [towers.length]) // eslint-disable-line

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
      sx: e.clientX, sy: e.clientY, vx: cv.x, vy: cv.y,
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

  const selTower = selIdx != null ? towers[selIdx] : null

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
          {positioned.map(({ tower, idx, col, row }) => (
            <Tower
              key={idx}
              bx={(col - row) * HW}
              by={(col + row) * HH}
              tower={tower}
              selected={selIdx === idx}
              onSelect={(e) => { e.stopPropagation(); setSelIdx(selIdx === idx ? null : idx) }}
            />
          ))}
        </svg>
      </div>

      {selTower && (
        <div style={{ marginTop: 10, padding: '14px 16px', background: 'var(--surface)',
          borderRadius: 10, border: '1px solid rgba(255,193,69,0.22)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: selTower.golden_top ? 'var(--gold)' : 'var(--ink)' }}>
                {selTower.golden_top ? '★ ' : '🏢 '}
                {en ? 'Highrise' : 'Высотка'} #{selIdx + 1}
                <span style={{ color: 'var(--ink3)', fontSize: 12, fontWeight: 400, marginLeft: 6 }}>
                  ({selTower.height}/{TOWER_HEIGHT})
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                {selTower.is_closed ? (en ? 'Closed' : 'Закрыта') : (en ? 'Building...' : 'Строится...')}
                {' · '}{selTower.source_wins} {en ? 'wins' : 'побед'}
              </div>
            </div>
            <button onClick={() => setSelIdx(null)}
              style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
            {new Date(selTower.period_from * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
            {selTower.period_to !== selTower.period_from && ' — ' +
              new Date(selTower.period_to * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      )}
    </div>
  )
}
