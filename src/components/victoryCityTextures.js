/**
 * Фабрики Three.js текстур для VictoryCity.
 * Вынесено из VictoryCity.jsx ради распила.
 * Каждая функция принимает THREE модуль и возвращает текстуру.
 *
 * Состав:
 *   makeStarTexture       — сияющая 5-конечная звезда для sprite-ов (корона)
 *   makeRoadTexture       — дорожное полотно с двойной разметкой + бордюры
 *   makeSoftDotTexture    — мягкая круглая точка для particles (дым/облака)
 *   makeFacadeTexture     — фасад небоскрёба с окнами (diffuse + emissiveMap)
 *   makeCrosswalkTexture  — зебра-переход на перекрёстках
 *   makeMoonTexture       — луна с кратерами для неба
 */

/**
 * Звезда-корона: белая 5-конечная звезда на мягком теплом ореоле с лучами-sparkle.
 */
export function makeStarTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')

  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
  glow.addColorStop(0, 'rgba(255,240,200,0.65)')
  glow.addColorStop(0.35, 'rgba(255,220,160,0.28)')
  glow.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 128)

  ctx.save()
  ctx.translate(64, 64)
  ctx.globalAlpha = 0.6
  const rayGrad = ctx.createLinearGradient(-50, 0, 50, 0)
  rayGrad.addColorStop(0, 'rgba(255,255,255,0)')
  rayGrad.addColorStop(0.5, 'rgba(255,255,255,0.85)')
  rayGrad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = rayGrad
  ctx.fillRect(-50, -1, 100, 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillRect(-50, -1, 100, 2)
  ctx.rotate(Math.PI / 4)
  ctx.globalAlpha = 0.3
  ctx.fillRect(-38, -1, 76, 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillRect(-38, -1, 76, 2)
  ctx.restore()
  ctx.globalAlpha = 1

  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(255,240,180,0.9)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 28 : 11
    const a = (Math.PI * 2 / 10) * i - Math.PI / 2
    const x = 64 + Math.cos(a) * r
    const y = 64 + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  const core = ctx.createRadialGradient(64, 64, 0, 64, 64, 14)
  core.addColorStop(0, 'rgba(255,255,255,0.95)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.fillRect(50, 50, 28, 28)

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Дорожное полотно 256×256 — 1 SPACING (6 метров).
 * Используется с MeshBasicMaterial — warm light не перекрашивает асфальт.
 *
 * Содержит: темно-синий асфальт, зернистость, бордюры-тротуары, двойную
 * центральную разметку, lane edge lines, мелкие трещины.
 */
export function makeRoadTexture(THREE) {
  const W = 256, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')

  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, '#0c0c14')
  base.addColorStop(0.1, '#151520')
  base.addColorStop(0.5, '#1c1c28')
  base.addColorStop(0.9, '#151520')
  base.addColorStop(1, '#0c0c14')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const s = Math.random() * 1.4 + 0.3
    const shade = 24 + Math.random() * 45
    const alpha = 0.18 + Math.random() * 0.35
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 8},${alpha})`
    ctx.fillRect(x, y, s, s)
  }

  ctx.strokeStyle = 'rgba(8,8,12,0.5)'
  ctx.lineWidth = 0.8
  for (let i = 0; i < 3; i++) {
    const y = 30 + Math.random() * (H - 60)
    ctx.beginPath()
    ctx.moveTo(Math.random() * W, y)
    for (let k = 0; k < 4; k++) {
      ctx.lineTo(Math.random() * W, y + (Math.random() - 0.5) * 12)
    }
    ctx.stroke()
  }

  const curbTop = ctx.createLinearGradient(0, 0, 0, 7)
  curbTop.addColorStop(0, '#525263')
  curbTop.addColorStop(0.6, '#3a3a48')
  curbTop.addColorStop(1, '#262632')
  ctx.fillStyle = curbTop
  ctx.fillRect(0, 0, W, 5)
  const curbBot = ctx.createLinearGradient(0, H - 7, 0, H)
  curbBot.addColorStop(0, '#262632')
  curbBot.addColorStop(0.4, '#3a3a48')
  curbBot.addColorStop(1, '#525263')
  ctx.fillStyle = curbBot
  ctx.fillRect(0, H - 5, W, 5)

  ctx.strokeStyle = 'rgba(20,20,28,0.6)'
  ctx.lineWidth = 0.5
  for (let x = 0; x < W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, H - 5); ctx.lineTo(x, H); ctx.stroke()
  }

  ctx.fillStyle = '#9b9ba8'
  const dashLen = 24, gap = 28, y1 = H / 2 - 6, y2 = H / 2 + 4
  for (let x = 0; x < W; x += dashLen + gap) {
    ctx.fillRect(x, y1, dashLen, 2)
    ctx.fillRect(x, y2, dashLen, 2)
  }

  ctx.fillStyle = 'rgba(130,130,145,0.38)'
  ctx.fillRect(0, 10, W, 1)
  ctx.fillRect(0, H - 11, W, 1)

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

export function makeSoftDotTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 32; c.height = 32
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

/**
 * Фасад небоскрёба 256×256 = 1 этаж.
 * Возвращает { diffuse, emissive } — пару canvas-текстур для MeshStandardMaterial:
 *   material.map          = diffuse  (стена + тёмные незажжённые окна)
 *   material.emissiveMap  = emissive (только светящиеся окна — чёрный фон)
 *
 * Окна в сетке cols×rows со случайным состоянием: off ~15%, dim ~25%, bright ~60%.
 *
 * Параметры:
 *   baseHex   — базовый цвет фасада (0xrrggbb)
 *   cols      — колонок окон (default 3)
 *   rows      — рядов окон (default 3)
 *   seed      — детерминизм (фасад не мерцает между рендерами)
 *   metallic  — true добавляет горизонтальные «панели» перекрытий
 */
export function makeFacadeTexture(THREE, { baseHex = 0x4a9eff, cols = 3, rows = 3, seed = 1, metallic = false } = {}) {
  const W = 256, H = 256
  const diff = document.createElement('canvas')
  diff.width = W; diff.height = H
  const dctx = diff.getContext('2d')

  const emit = document.createElement('canvas')
  emit.width = W; emit.height = H
  const ectx = emit.getContext('2d')

  const r = (baseHex >> 16) & 0xff
  const g = (baseHex >> 8) & 0xff
  const b = baseHex & 0xff
  const baseCSS = `rgb(${r},${g},${b})`

  const wallGrad = dctx.createLinearGradient(0, 0, 0, H)
  wallGrad.addColorStop(0, `rgb(${Math.min(255, r + 12)},${Math.min(255, g + 12)},${Math.min(255, b + 12)})`)
  wallGrad.addColorStop(0.5, baseCSS)
  wallGrad.addColorStop(1, `rgb(${Math.max(0, r - 18)},${Math.max(0, g - 18)},${Math.max(0, b - 18)})`)
  dctx.fillStyle = wallGrad
  dctx.fillRect(0, 0, W, H)

  ectx.fillStyle = '#000000'
  ectx.fillRect(0, 0, W, H)

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const shade = Math.random() < 0.5 ? -8 : 8
    dctx.fillStyle = `rgba(${Math.max(0, Math.min(255, r + shade))},${Math.max(0, Math.min(255, g + shade))},${Math.max(0, Math.min(255, b + shade))},0.22)`
    dctx.fillRect(x, y, 1, 1)
  }

  if (metallic) {
    dctx.strokeStyle = `rgba(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)},0.5)`
    dctx.lineWidth = 0.8
    for (let y = 32; y < H; y += 32) {
      dctx.beginPath(); dctx.moveTo(0, y); dctx.lineTo(W, y); dctx.stroke()
    }
  }

  let s = seed * 9999
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }

  const padX = 18
  const padY = 10
  const cellW = (W - padX * 2) / cols
  const cellH = (H - padY * 2) / rows
  const winW = cellW * 0.68
  const winH = cellH * 0.78

  const darkFrame = `rgba(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)},0.95)`
  const glassCool = 'rgba(14,18,30,0.92)'
  const lightWarm = '#fff4c2'
  const lightDim = '#d4aa55'

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = padX + col * cellW + (cellW - winW) / 2
      const wy = padY + row * cellH + (cellH - winH) / 2
      const roll = rand()

      dctx.fillStyle = darkFrame
      dctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4)

      dctx.fillStyle = glassCool
      dctx.fillRect(wx, wy, winW, winH)

      dctx.fillStyle = darkFrame
      dctx.fillRect(wx, wy + winH / 2 - 0.5, winW, 1)
      dctx.fillRect(wx + winW / 2 - 0.5, wy, 1, winH)

      if (roll < 0.15) {
        const refl = dctx.createLinearGradient(wx, wy, wx + winW, wy + winH)
        refl.addColorStop(0, 'rgba(60,70,90,0.35)')
        refl.addColorStop(0.5, 'rgba(30,40,60,0.1)')
        refl.addColorStop(1, 'rgba(80,90,120,0.3)')
        dctx.fillStyle = refl
        dctx.fillRect(wx + 1, wy + 1, winW - 2, winH - 2)
      } else if (roll < 0.4) {
        const g2 = dctx.createLinearGradient(wx, wy, wx, wy + winH)
        g2.addColorStop(0, 'rgba(255,200,120,0.9)')
        g2.addColorStop(1, 'rgba(200,140,60,0.75)')
        dctx.fillStyle = g2
        dctx.fillRect(wx + 1, wy + 1, winW - 2, winH - 2)
        ectx.fillStyle = lightDim
        ectx.fillRect(wx + 1, wy + 1, winW - 2, winH - 2)
      } else {
        const gb = dctx.createLinearGradient(wx, wy, wx, wy + winH)
        gb.addColorStop(0, 'rgba(255,248,210,1)')
        gb.addColorStop(0.6, 'rgba(255,235,170,0.95)')
        gb.addColorStop(1, 'rgba(255,220,140,0.9)')
        dctx.fillStyle = gb
        dctx.fillRect(wx + 1, wy + 1, winW - 2, winH - 2)
        const hi = dctx.createRadialGradient(wx + winW * 0.3, wy + winH * 0.3, 0, wx + winW * 0.3, wy + winH * 0.3, winW * 0.4)
        hi.addColorStop(0, 'rgba(255,255,255,0.7)')
        hi.addColorStop(1, 'rgba(255,255,255,0)')
        dctx.fillStyle = hi
        dctx.fillRect(wx, wy, winW, winH)
        ectx.fillStyle = lightWarm
        ectx.fillRect(wx + 1, wy + 1, winW - 2, winH - 2)
      }
    }
  }

  dctx.fillStyle = `rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},0.6)`
  dctx.fillRect(0, 0, W, 2)
  dctx.fillRect(0, H - 2, W, 2)

  const leftBevel = dctx.createLinearGradient(0, 0, 8, 0)
  leftBevel.addColorStop(0, 'rgba(255,255,255,0.12)')
  leftBevel.addColorStop(1, 'rgba(255,255,255,0)')
  dctx.fillStyle = leftBevel
  dctx.fillRect(0, 0, 8, H)
  const rightBevel = dctx.createLinearGradient(W - 8, 0, W, 0)
  rightBevel.addColorStop(0, 'rgba(0,0,0,0)')
  rightBevel.addColorStop(1, 'rgba(0,0,0,0.25)')
  dctx.fillStyle = rightBevel
  dctx.fillRect(W - 8, 0, 8, H)

  const diffuse = new THREE.CanvasTexture(diff)
  diffuse.needsUpdate = true
  diffuse.anisotropy = 4

  const emissive = new THREE.CanvasTexture(emit)
  emissive.needsUpdate = true

  return { diffuse, emissive }
}

export function makeCrosswalkTexture(THREE) {
  const W = 128, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const stripeW = 12
  const gap = 8
  const marginX = 12
  const marginY = 20
  ctx.fillStyle = 'rgba(210,210,218,0.92)'
  const stripeH = H - marginY * 2
  let x = marginX
  while (x + stripeW < W - marginX) {
    ctx.fillRect(x, marginY, stripeW, stripeH)
    x += stripeW + gap
  }
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

export function makeMoonTexture(THREE) {
  const W = 128, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')

  const halo = ctx.createRadialGradient(64, 64, 24, 64, 64, 64)
  halo.addColorStop(0, 'rgba(255,248,220,0.5)')
  halo.addColorStop(0.5, 'rgba(220,220,240,0.12)')
  halo.addColorStop(1, 'rgba(180,190,220,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  const disc = ctx.createRadialGradient(58, 58, 0, 64, 64, 34)
  disc.addColorStop(0, 'rgba(255,255,250,1)')
  disc.addColorStop(0.7, 'rgba(240,238,230,1)')
  disc.addColorStop(1, 'rgba(200,200,210,0.9)')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(64, 64, 34, 0, Math.PI * 2)
  ctx.fill()

  const craters = [
    { x: 55, y: 55, r: 4 },
    { x: 72, y: 62, r: 3 },
    { x: 60, y: 75, r: 5 },
    { x: 75, y: 48, r: 2.5 },
  ]
  for (const cr of craters) {
    const g = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, cr.r)
    g.addColorStop(0, 'rgba(180,180,190,0.7)')
    g.addColorStop(1, 'rgba(200,200,210,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2)
    ctx.fill()
  }

  const term = ctx.createRadialGradient(78, 72, 0, 78, 72, 50)
  term.addColorStop(0, 'rgba(0,0,10,0)')
  term.addColorStop(0.6, 'rgba(0,0,10,0)')
  term.addColorStop(1, 'rgba(0,0,10,0.35)')
  ctx.fillStyle = term
  ctx.beginPath()
  ctx.arc(64, 64, 34, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}
