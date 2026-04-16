/**
 * Фабрики Three.js текстур для VictoryCity.
 * Вынесено из VictoryCity.jsx ради распила.
 * Каждая функция принимает THREE модуль и возвращает текстуру.
 */

export function makeStarTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60)
  grad.addColorStop(0, 'rgba(255,240,160,0.9)')
  grad.addColorStop(0.5, 'rgba(255,200,80,0.4)')
  grad.addColorStop(1, 'rgba(255,180,40,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#fff4b0'
  ctx.strokeStyle = '#ffaa20'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 36 : 16
    const a = (Math.PI * 2 / 10) * i - Math.PI / 2
    const x = 64 + Math.cos(a) * r
    const y = 64 + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

export function makeRoadTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 16; c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1a1a26'
  ctx.fillRect(0, 0, 16, 256)
  ctx.fillStyle = '#a0a0c0'
  for (let y = 20; y < 256; y += 40) ctx.fillRect(7, y, 2, 20)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
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
