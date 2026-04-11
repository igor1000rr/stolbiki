/**
 * VictoryCity — изометрический «Город побед»
 * Шаги 3, 5, 6, 7 эпика #2
 *
 * Каждая победа = одно здание. Высота = chips.length в самой высокой
 * закрытой стойке. Цвет этажей = цвет фишек (0=синий, 1=красный).
 * Последний этаж золотого победителя — золотой.
 *
 * Управление: колёсико — зум, тащить — пан, тап — детали здания.
 */
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../engine/i18n'

// --- Изометрические константы ---
const HW = 26   // полуширина ячейки (горизонталь)
const HH = 13   // полувысота ячейки (≈ HW/2)
const FH = 9    // высота одного этажа в пикселях SVG
const COLS = 5  // колонок в городской сетке

// Цвета граней фишек: [верх, лево, право]
const CHIP = {
  0: ['#6db4ff', '#3a85d0', '#1a5fa0'],   // синий
  1: ['#ff8888', '#cc3333', '#991111'],   // красный
  g: ['#ffd86e', '#bf8800', '#8a5f00'],   // золотой (крыша при draw_won)
}

// Вспомогательная: массив точек → строка для SVG polygon
function pts(arr) {
  return arr.map(([a, b]) => `${a},${b}`).join(' ')
}

// Один изометрический этаж — три видимые грани
function IsoFloor({ bx, by, i, color }) {
  const c = CHIP[color] || CHIP[0]
  const y0 = by - i * FH           // низ этажа
  const y1 = by - (i + 1) * FH     // верх этажа
  // Левая грань
  const left  = pts([[bx-HW,y1],[bx,y1+HH],[bx,y0+HH],[bx-HW,y0]])
  // Правая грань
  const right = pts([[bx,y1+HH],[bx+HW,y1],[bx+HW,y0],[bx,y0+HH]])
  // Верхняя грань (ромб)
  const top   = pts([[bx-HW,y1],[bx,y1-HH],[bx+HW,y1],[bx,y1+HH]])
  return (
    <g>
      <polygon points={left}  fill={c[1]} />
      <polygon points={right} fill={c[2]} />
      <polygon points={top}   fill={c[0]} />
    </g>
  )
}

// Здание = стопка этажей + хитбокс для клика
function Building({ bx, by, chips, golden, selected, onSelect }) {
  if (!chips.length) return null
  const n = chips.length
  // Контур для highlight
  const outline = pts([
    [bx, by - n * FH - HH],
    [bx + HW, by - n * FH],
    [bx + HW, by],
    [bx, by + HH],
    [bx - HW, by],
    [bx - HW, by - n * FH],
  ])
  return (
    <g onClick={onSelect} style={{ cursor: 'pointer' }}>
      {chips.map((c, i) => {
        const isTop = i === n - 1
        return (
          <IsoFloor
            key={i}
            bx={bx} by={by}
            i={i}
            color={isTop && golden ? 'g' : c}
          />
        )
      })}
      {selected && (
        <polygon
          points={outline}
          fill="none"
          stroke="rgba(255,193,69,0.9)"
          strokeWidth="1.5"
        />
      )}
    </g>
  )
}

// Извлечь chips из снапшота — берём самую высокую закрытую стойку
function getChips(building) {
  const snap = building.stands_snapshot || []
  const closed = snap.filter(s => s.owner !== null && Array.isArray(s.chips) && s.chips.length)
  if (!closed.length) return []
  return closed.reduce((a, b) => b.chips.length > a.chips.length ? b : a).chips
}

export default function VictoryCity({ userId }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [selId, setSelId] = useState(null)
  const [view, setView] = useState(null)  // { x, y, w, h } — текущий viewBox
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  // Загрузка зданий и статистики
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.all([
      fetch(`/api/buildings/${userId}?limit=60`).then(r => r.json()),
      fetch(`/api/buildings/stats/${userId}`).then(r => r.json()),
    ])
      .then(([d, s]) => { setBuildings(d.buildings || []); setStats(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // Расстановка зданий по изометрической сетке (back-to-front)
  const positioned = buildings
    .map((b, i) => ({ b, col: i % COLS, row: Math.floor(i / COLS), chips: getChips(b) }))
    .filter(p => p.chips.length)
    .sort((a, b_) => (a.col + a.row) - (b_.col + b_.row))

  // Границы SVG-сцены
  const rows = Math.max(1, Math.ceil(buildings.length / COLS))
  const pad = 14
  const vx0 = -(rows - 1) * HW - HW - pad
  const vx1 = (COLS - 1) * HW + HW + pad
  const vy0 = -11 * FH - HH - pad
  const vy1 = (COLS - 1 + rows - 1) * HH + HH * 2 + pad
  const vw0 = vx1 - vx0, vh0 = vy1 - vy0

  // Инициализируем view после загрузки зданий
  useEffect(() => {
    setView({ x: vx0, y: vy0, w: vw0, h: vh0 })
  }, [buildings.length]) // eslint-disable-line

  const cv = view || { x: vx0, y: vy0, w: vw0, h: vh0 }

  // --- Управление зумом колёсиком ---
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

  // --- Управление панорамированием (pointer events — мышь + тач) ---
  const onPointerDown = (e) => {
    // Не перехватываем клики по зданиям
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

  // --- Рендер ---

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontSize: 13 }}>
      {en ? 'Loading city...' : 'Загружаю город...'}
    </div>
  )

  if (!positioned.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏙️</div>
      <div style={{ fontSize: 14, color: 'var(--ink3)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
        {en
          ? 'Win games to build your Victory City — each win adds a new skyscraper!'
          : 'Побеждайте — и стройте Город побед! Каждая победа — новая высотка.'}
      </div>
    </div>
  )

  const selB = selId ? buildings.find(b => b.id === selId) : null

  return (
    <div>
      {/* Статистика */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            [stats.total,       en ? 'Buildings' : 'Зданий',      'var(--ink)'],
            [stats.vs_ai,       'vs AI',                           'var(--p1)'],
            [stats.vs_human,    en ? 'vs Human' : 'vs Живой',      'var(--green)'],
            [stats.golden_wins, '★ ' + (en ? 'Golden' : 'Золотых'), 'var(--gold)'],
          ].map(([v, l, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--surface2)', borderRadius: 8, minWidth: 54 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Изометрический город */}
      <div
        ref={containerRef}
        style={{
          background: 'linear-gradient(175deg, #06060f 0%, #0c0c22 55%, #13132c 100%)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          cursor: dragRef.current ? 'grabbing' : 'grab',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg
          viewBox={`${cv.x} ${cv.y} ${cv.w} ${cv.h}`}
          width="100%"
          style={{ display: 'block', aspectRatio: `${vw0} / ${vh0}`, maxHeight: 420 }}
        >
          {/* Звёзды (декор) */}
          {Array.from({ length: 40 }).map((_, i) => (
            <circle
              key={i}
              cx={vx0 + (i * 137.508 % vw0)}
              cy={vy0 + ((i * 93.71 + 7) % (vh0 * 0.5))}
              r={(i % 5 === 0) ? 1.4 : 0.6}
              fill="white"
              opacity={0.12 + (i % 8) * 0.06}
            />
          ))}

          {/* Луна (декор) */}
          <circle cx={vx1 - 22} cy={vy0 + 22} r={11}  fill="#f5e6b0" opacity="0.18" />
          <circle cx={vx1 - 17} cy={vy0 + 18} r={9}   fill="#06060f" opacity="0.95" />

          {/* Здания (back-to-front) */}
          {positioned.map(({ b, col, row, chips }) => (
            <Building
              key={b.id}
              bx={(col - row) * HW}
              by={(col + row) * HH}
              chips={chips}
              golden={b.result === 'draw_won'}
              selected={selId === b.id}
              onSelect={(e) => {
                e.stopPropagation()
                setSelId(selId === b.id ? null : b.id)
              }}
            />
          ))}
        </svg>
      </div>

      {/* Панель выбранного здания */}
      {selB && (
        <div style={{
          marginTop: 10, padding: '14px 16px',
          background: 'var(--surface)', borderRadius: 10,
          border: '1px solid rgba(255,193,69,0.22)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: selB.result === 'draw_won' ? 'var(--gold)' : 'var(--green)' }}>
                {selB.result === 'draw_won' ? '★ ' : '🏆 '}
                {selB.result === 'draw_won'
                  ? (en ? 'Golden victory' : 'Победа по золотой')
                  : (en ? 'Victory' : 'Победа')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                {new Date(selB.created_at * 1000).toLocaleDateString(
                  en ? 'en-US' : 'ru',
                  { day: 'numeric', month: 'long', year: 'numeric' }
                )}
              </div>
            </div>
            <button
              onClick={() => setSelId(null)}
              style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
            >✕</button>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
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
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--ink3)' }}>{en ? 'Closed' : 'Достроено'}</div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                {(selB.stands_snapshot || []).filter(s => s.owner !== null).length} / 10
              </div>
            </div>
            {selB.ai_difficulty && (
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Difficulty' : 'Сложность'}</div>
                <div style={{ fontWeight: 600, color: 'var(--p1)', marginTop: 2 }}>
                  {selB.ai_difficulty}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', marginTop: 8, opacity: 0.6 }}>
        {en
          ? 'Scroll to zoom · Drag to pan · Tap a building for details'
          : 'Колёсико — зум · Тащи — пан · Тап — детали здания'}
      </div>
    </div>
  )
}
