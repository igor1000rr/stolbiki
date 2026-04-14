/**
 * Утилиты Game.jsx — звуки, haptic, title blink, share-картинка
 * Issue #5: generateShareImage — story-формат 1080×1920
 */

import { soundPlace as _sp, soundTransfer as _st, soundClose as _sc, soundWin as _sw, soundLose as _sl, soundSwap as _ss } from '../engine/sounds'
import * as haptics from '../engine/haptics'

// ─── Title blink (таб мигает когда ваш ход) ───
let _titleBlinkInterval = null
export function startTitleBlink(msg = 'Your turn!') {
  if (_titleBlinkInterval) return
  const original = document.title
  let on = false
  _titleBlinkInterval = setInterval(() => {
    document.title = (on = !on) ? `🔴 ${msg}` : original
  }, 800)
  const stop = () => { clearInterval(_titleBlinkInterval); _titleBlinkInterval = null; document.title = original }
  window.addEventListener('focus', stop, { once: true })
}

// ─── Haptic + Звуковая система ───
let _soundPack = 'classic'
export let _soundOn = true
export function setSoundOn(v) { _soundOn = v }

function playSound(fn, hapticFn) {
  if (!_soundOn || _soundPack === 'off') { hapticFn?.(); return }
  fn()
  hapticFn?.()
}

export const sp = () => playSound(_sp, haptics.tapLight)
export const st = () => playSound(_st, haptics.tapMedium)
export const sc = () => playSound(_sc, haptics.tapHeavy)
export const sw = () => playSound(_sw, haptics.notifySuccess)
export const sl = () => playSound(_sl, haptics.notifyError)
export const ss = () => playSound(_ss, haptics.notifyWarning)

// ─── Вспомогательные утилиты canvas ───
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─── Загрузка QR через api.qrserver.com с fallback ───
function loadQRCode(url, size = 240) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=8&format=png`
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = qrUrl
    // Safety timeout: если не загрузилось за 3 сек — резолвим null
    setTimeout(() => resolve(null), 3000)
  })
}

// ─── Генерация share-картинки результата — Story 1080×1920 ───
// Issue #5: Виральные share-картинки (async для загрузки QR)
export async function generateShareImage(gs, won, isDraw, s0, s1, extra = {}) {
  const { playerName, rating, ratingDelta, difficulty, moves, elapsed, mode, lang = 'ru', refLink } = extra
  const en = lang === 'en'
  const W = 1080, H = 1920
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')

  const accentColor = isDraw ? '#9b59b6' : won ? '#3dd68c' : '#ff6066'
  const accentRgb   = isDraw ? '155,89,182' : won ? '61,214,140' : '255,96,102'
  const P1 = '#4a9eff', P2 = '#ff6066'

  // ─── Фон с accent-тинтом ───
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, `rgba(${accentRgb},0.04)`)
  bg.addColorStop(0.3, '#11111e')
  bg.addColorStop(0.7, '#0d0d1a')
  bg.addColorStop(1, `rgba(${accentRgb},0.05)`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Тёмная база поверх (чтобы тинт не доминировал)
  ctx.fillStyle = 'rgba(10,10,20,0.7)'
  ctx.fillRect(0, 0, W, H)

  // Тонкая сетка (decorative)
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Glow-круг в центре
  const glow = ctx.createRadialGradient(W / 2, 780, 0, W / 2, 780, 500)
  glow.addColorStop(0, `rgba(${accentRgb},0.12)`)
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ─── Верхний акцент-бар ───
  ctx.fillStyle = accentColor
  ctx.fillRect(0, 0, W, 8)

  // Лого / заголовок
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('HIGHRISE HEIST', W / 2, 86)

  // ─── Результат ───
  ctx.fillStyle = accentColor
  ctx.font = `bold 88px sans-serif`
  const resultLabel = isDraw ? (en ? 'DRAW' : 'НИЧЬЯ') : won ? (en ? 'VICTORY' : 'ПОБЕДА') : (en ? 'DEFEAT' : 'ПОРАЖЕНИЕ')
  ctx.fillText(resultLabel, W / 2, 210)

  // Свечение под текстом результата
  ctx.shadowColor = accentColor
  ctx.shadowBlur = 40
  ctx.fillText(resultLabel, W / 2, 210)
  ctx.shadowBlur = 0

  // ─── Счёт ───
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 200px sans-serif`
  ctx.fillText(`${s0}`, W / 2 - 160, 440)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = 'bold 100px sans-serif'
  ctx.fillText(':', W / 2, 420)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 200px sans-serif`
  ctx.fillText(`${s1}`, W / 2 + 160, 440)

  // Подписи цветов
  ctx.font = 'bold 28px sans-serif'
  ctx.fillStyle = P1
  ctx.fillText(en ? 'Blue' : 'Синие', W / 2 - 160, 490)
  ctx.fillStyle = P2
  ctx.fillText(en ? 'Red' : 'Красные', W / 2 + 160, 490)

  // ─── Визуализация финальной доски — 10 стоек ───
  const boardY = 550
  const boardPad = 60
  const standW = (W - boardPad * 2) / 10 // ~96px
  const standH = 280
  const chipH = standH / 11

  // Рамка доски с accent-glow
  ctx.strokeStyle = `rgba(${accentRgb}, 0.35)`
  ctx.lineWidth = 2
  ctx.shadowColor = accentColor
  ctx.shadowBlur = 20
  roundRect(ctx, boardPad - 12, boardY - 12, W - boardPad * 2 + 24, standH + 24, 12)
  ctx.stroke()
  ctx.shadowBlur = 0

  for (let si = 0; si < 10; si++) {
    const x = boardPad + si * standW
    const chips = gs.stands?.[si] || []
    const owner = gs.closed?.[si]
    const isGolden = si === 0
    const closed = owner !== undefined

    // Фон стойки
    ctx.globalAlpha = 0.15
    roundRect(ctx, x + 4, boardY, standW - 8, standH, 6)
    ctx.fillStyle = closed ? (owner === 0 ? P1 : P2) : '#ffffff'
    ctx.fill()
    ctx.globalAlpha = 1

    // Блоки в стойке (снизу вверх)
    const chipsToShow = chips.slice(0, 11)
    for (let j = 0; j < chipsToShow.length; j++) {
      const cy = boardY + standH - (j + 1) * chipH
      const color = chipsToShow[j] === 0 ? P1 : P2
      ctx.fillStyle = color
      ctx.globalAlpha = closed ? 0.7 : 0.85
      roundRect(ctx, x + 6, cy, standW - 12, chipH - 2, 3)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Золотая звезда
    if (isGolden) {
      ctx.fillStyle = '#ffc145'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('★', x + standW / 2, boardY + standH + 30)
    }

    // Закрытая стойка — скорка сверху
    if (closed) {
      ctx.fillStyle = owner === 0 ? P1 : P2
      ctx.globalAlpha = 0.9
      roundRect(ctx, x + 4, boardY, standW - 8, 10, 4)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  // Подпись под доской
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '26px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(en ? 'Final Board' : 'Финальная доска', W / 2, boardY + standH + 70)

  // ─── Разделитель ───
  ctx.fillStyle = `rgba(${accentRgb}, 0.25)`
  ctx.fillRect(boardPad, boardY + standH + 95, W - boardPad * 2, 1)

  // ─── Статистика ───
  const statY = boardY + standH + 150
  const stats = []
  if (moves) stats.push([en ? 'Moves' : 'Ходов', String(moves)])
  if (elapsed) stats.push([en ? 'Time' : 'Время', `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`])
  const diffMap = { 50: 'Easy', 150: en ? 'Medium' : 'Средняя', 400: en ? 'Hard' : 'Сложная', 800: en ? 'Extreme' : 'Экстрим', 1500: 'Hardcore' }
  if (difficulty && mode !== 'online') stats.push(['AI', diffMap[difficulty] || String(difficulty)])
  if (mode === 'online') stats.push([en ? 'Mode' : 'Режим', en ? 'Online PvP' : 'Онлайн PvP'])

  const colW = (W - boardPad * 2) / Math.max(stats.length, 1)
  for (let i = 0; i < stats.length; i++) {
    const cx = boardPad + colW * i + colW / 2
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '26px sans-serif'
    ctx.fillText(stats[i][0], cx, statY)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px sans-serif'
    ctx.fillText(stats[i][1], cx, statY + 50)
  }

  // ─── Игрок ───
  const playerY = statY + 140
  if (playerName) {
    // Карточка игрока
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    roundRect(ctx, boardPad, playerY, W - boardPad * 2, 130, 16)
    ctx.fill()
    ctx.strokeStyle = `rgba(${accentRgb}, 0.2)`
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = `bold 48px sans-serif`
    ctx.fillText(playerName, W / 2, playerY + 58)

    if (rating || ratingDelta) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '30px sans-serif'
      let rLine = rating ? `${rating} ELO` : ''
      if (ratingDelta) {
        ctx.fillStyle = ratingDelta > 0 ? '#3dd68c' : '#ff6066'
        rLine += ratingDelta ? `  ${ratingDelta > 0 ? '+' : ''}${ratingDelta}` : ''
      }
      ctx.fillText(rLine, W / 2, playerY + 106)
    }
  }

  // ─── Большой ELO badge если нет имени ───
  if (!playerName && ratingDelta) {
    ctx.fillStyle = ratingDelta > 0 ? '#3dd68c' : '#ff6066'
    ctx.font = `bold 80px sans-serif`
    ctx.fillText(`${ratingDelta > 0 ? '+' : ''}${ratingDelta} ELO`, W / 2, playerY + 60)
  }

  // ─── Нижний блок: брендинг + QR ───
  const brandY = H - 260
  ctx.fillStyle = `rgba(${accentRgb}, 0.2)`
  ctx.fillRect(boardPad, brandY, W - boardPad * 2, 1)

  // URL для QR — реферальная ссылка если есть, иначе просто сайт
  const shareUrl = refLink || 'https://highriseheist.com'
  const qrImg = await loadQRCode(shareUrl, 240)

  if (qrImg) {
    // QR слева, бренд справа
    const qrSize = 180
    const qrX = boardPad + 20
    const qrY = brandY + 30

    // Белая подложка под QR (для контраста)
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12)
    ctx.fill()

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    // Подпись под QR
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(refLink
      ? (en ? 'Play with me' : 'Сыграй со мной')
      : (en ? 'Scan to play' : 'Сканируй — играй'),
      qrX + qrSize / 2, qrY + qrSize + 32)

    // Бренд справа
    ctx.textAlign = 'left'
    const brandTextX = qrX + qrSize + 50
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 52px sans-serif'
    ctx.fillText('HIGHRISE', brandTextX, qrY + 60)
    ctx.fillStyle = accentColor
    ctx.fillText('HEIST', brandTextX, qrY + 120)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '26px sans-serif'
    ctx.fillText('highriseheist.com', brandTextX, qrY + 160)
  } else {
    // Fallback без QR
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = 'bold 36px sans-serif'
    ctx.fillText('highriseheist.com', W / 2, brandY + 95)
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '26px sans-serif'
    ctx.fillText(en ? 'Strategy board game with AlphaZero AI' : 'Стратегическая настолка с AI AlphaZero', W / 2, brandY + 140)
  }

  ctx.textAlign = 'center' // reset для потенциальных последующих вызовов
  return c
}

// ─── Browser Notifications ───

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function showNotification(title, body, onClick) {
  if (!document.hidden) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: '/favicon.png', tag: 'snatch-' + Date.now(), requireInteraction: false })
    n.onclick = () => { window.focus(); n.close(); if (onClick) onClick() }
    setTimeout(() => n.close(), 8000)
  } catch {}
}
