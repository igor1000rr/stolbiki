/**
 * CityMiniPreview — лёгкий SVG-силуэт города для использования в списках
 * (Хол оф фейм, embed previews и т.п.). Без WebGL, без three.js, без сети.
 * Принимает компактные данные leaderboard'а и рисует ~20 высоток в изометрии.
 *
 * Алгоритм: имея только totals (closed_towers, crowned_towers, total_bricks)
 * генерирует псевдо-город — closed высотки полные (11 этажей), последняя
 * строящаяся имеет высоту total_bricks % 11. Цвета: золото для crowned,
 * синий для обычных, фиолет для строящейся.
 */

const HW = 9
const HH = 4.5
const FH = 3
const COLS_LAYOUT = 4

function pts(arr) { return arr.map(([a, b]) => `${a},${b}`).join(' ') }

function Floor({ bx, by, i, palette }) {
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

const CROWN_PAL   = ['#ffe080','#e0a030','#a07020']
const REGULAR_PAL = ['#6db4ff','#3a85d0','#1a5fa0']
const BUILDING_PAL = ['#9b59b6','#6a3e8a','#42255a']  // строящаяся

export default function CityMiniPreview({ entry, width = 200, height = 80 }) {
  // Восстанавливаем псевдо-город из агрегатов
  const closed = entry.closed_towers || 0
  const crowned = Math.min(entry.crowned_towers || 0, closed)
  const buildingProgress = (entry.total_bricks || 0) % 11
  const totalTowers = closed + (buildingProgress > 0 ? 1 : 0)
  if (totalTowers === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink3)', fontSize: 10, opacity: 0.5 }}>—</div>
    )
  }

  // Список высоток: первые crowned — золотые, потом regular, потом строящаяся
  const towers = []
  for (let i = 0; i < crowned; i++) towers.push({ height: 11, type: 'crowned' })
  for (let i = 0; i < closed - crowned; i++) towers.push({ height: 11, type: 'regular' })
  if (buildingProgress > 0) towers.push({ height: buildingProgress, type: 'building' })

  // Ограничим визуализацию до 20 высоток (всё равно не уместятся больше)
  const visTowers = towers.slice(0, 20)

  // Раскладываем по сетке (изометрия col-row)
  const positioned = visTowers.map((tw, i) => ({
    tower: tw, idx: i, col: i % COLS_LAYOUT, row: Math.floor(i / COLS_LAYOUT),
  })).sort((a, b) => (a.col + a.row) - (b.col + b.row))

  // Bounding box для viewBox
  const rows = Math.max(1, Math.ceil(visTowers.length / COLS_LAYOUT))
  const maxFloors = visTowers.reduce((m, t) => Math.max(m, t.height), 1)
  const pad = 8
  const vx0 = -(rows - 1) * HW - HW - pad
  const vx1 = (COLS_LAYOUT - 1) * HW + HW + pad
  const vy0 = -maxFloors * FH - HH - pad
  const vy1 = (COLS_LAYOUT - 1 + rows - 1) * HH + HH * 2 + pad
  const vw = vx1 - vx0, vh = vy1 - vy0

  return (
    <svg viewBox={`${vx0} ${vy0} ${vw} ${vh}`} width={width} height={height}
      style={{ display: 'block' }}>
      {/* Фон-градиент через прямоугольник */}
      <defs>
        <linearGradient id={`g-${entry.user_id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c0c1a" />
          <stop offset="100%" stopColor="#13132a" />
        </linearGradient>
      </defs>
      <rect x={vx0} y={vy0} width={vw} height={vh} fill={`url(#g-${entry.user_id})`} />
      {positioned.map(({ tower, idx, col, row }) => {
        const bx = (col - row) * HW
        const by = (col + row) * HH
        const palette = tower.type === 'crowned' ? CROWN_PAL
                       : tower.type === 'building' ? BUILDING_PAL
                       : REGULAR_PAL
        return (
          <g key={idx}>
            {Array.from({ length: tower.height }).map((_, i) => (
              <Floor key={i} bx={bx} by={by} i={i} palette={palette} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
