/**
 * Фабрики Three.js текстур для VictoryCity.
 * Вынесено из VictoryCity.jsx ради распила.
 * Каждая функция принимает THREE модуль и возвращает текстуру.
 */

/**
 * Звезда-корона: маленькая белая 5-конечная звезда на мягком тёплом ореоле.
 * Раньше была большая жёлтая клякса — доминировала в кадре.
 */
export function makeStarTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')

  // Ореол — мягкий тёплый, слабее жёлтого (было #fff4b0 / #ffaa20)
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 56)
  glow.addColorStop(0, 'rgba(255,240,200,0.55)')
  glow.addColorStop(0.4, 'rgba(255,220,160,0.22)')
  glow.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 128)

  // Сама звезда — компактнее (28/11 вместо 36/16) и без жёлтой обводки
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(255,240,180,0.8)'
  ctx.shadowBlur = 8
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

  // Центральный highlight для резкости
  const core = ctx.createRadialGradient(64, 64, 0, 64, 64, 14)
  core.addColorStop(0, 'rgba(255,255,255,0.9)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.fillRect(50, 50, 28, 28)

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Дорожное полотно: квадратный тайл 256×256 = 1 SPACING (6 метров).
 *
 * Было 16×256 с почти белыми штрихами на тусклом фоне — «матрасная» полоса,
 * на ночной сцене выглядела ярче зданий из-за дефолтного освещения.
 *
 * Теперь: тёмный асфальт с лёгкой зернистостью, тонкие светло-серые бордюры,
 * двойная белая пунктирная разметка по центру.
 *
 * В вызывающем коде material color должен быть 0xffffff — иначе текстура
 * умножается на тёмный и цвета гасятся.
 */
export function makeRoadTexture(THREE) {
  const W = 256, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')

  // База — тёмный асфальт с мягким vertical-градиентом (края темнее — fake AO у бордюров)
  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, '#0f0f18')
  base.addColorStop(0.15, '#15151f')
  base.addColorStop(0.5, '#1a1a26')
  base.addColorStop(0.85, '#15151f')
  base.addColorStop(1, '#0f0f18')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  // Зернистость асфальта — тусклый шум
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const s = Math.random() * 1.6 + 0.4
    const shade = 20 + Math.random() * 35
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 6},${0.25 + Math.random() * 0.35})`
    ctx.fillRect(x, y, s, s)
  }

  // Бордюры — светло-серые полосы сверху/снизу
  const curbTop = ctx.createLinearGradient(0, 0, 0, 6)
  curbTop.addColorStop(0, '#4a4a58')
  curbTop.addColorStop(1, '#2a2a36')
  ctx.fillStyle = curbTop
  ctx.fillRect(0, 0, W, 4)
  const curbBot = ctx.createLinearGradient(0, H - 6, 0, H)
  curbBot.addColorStop(0, '#2a2a36')
  curbBot.addColorStop(1, '#4a4a58')
  ctx.fillStyle = curbBot
  ctx.fillRect(0, H - 4, W, 4)

  // Двойная центральная разметка — холодный белый, без жёлтого
  ctx.fillStyle = '#b8b8c8'
  const dashLen = 32, gap = 22, y1 = H / 2 - 6, y2 = H / 2 + 4
  for (let x = 0; x < W; x += dashLen + gap) {
    ctx.fillRect(x, y1, dashLen, 2)
    ctx.fillRect(x, y2, dashLen, 2)
  }

  // Тонкие lane edge lines у бордюров
  ctx.fillStyle = 'rgba(140,140,160,0.5)'
  ctx.fillRect(0, 10, W, 1)
  ctx.fillRect(0, H - 11, W, 1)

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
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
