/**
 * Утилиты Game.jsx — звуки, haptic, title blink
 * Вынесены для декомпозиции
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

export const sp = () => playSound(_sp, haptics.tapLight)       // place
export const st = () => playSound(_st, haptics.tapMedium)      // transfer
export const sc = () => playSound(_sc, haptics.tapHeavy)       // close
export const sw = () => playSound(_sw, haptics.notifySuccess)  // win
export const sl = () => playSound(_sl, haptics.notifyError)    // lose
export const ss = () => playSound(_ss, haptics.notifyWarning)  // swap

// ─── Генерация share-картинки результата ───
export function generateShareImage(gs, won, isDraw, s0, s1, extra = {}) {
  const { playerName, rating, ratingDelta, difficulty, moves, elapsed, mode } = extra
  const c = document.createElement('canvas')
  c.width = 680; c.height = 400
  const ctx = c.getContext('2d')

  // Фон с градиентом
  const grad = ctx.createLinearGradient(0, 0, 0, 400)
  grad.addColorStop(0, '#0e0e18')
  grad.addColorStop(1, '#18182a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 680, 400)

  // Верхний акцент-бар
  const accentColor = isDraw ? '#9b59b6' : won ? '#3dd68c' : '#ff6066'
  ctx.fillStyle = accentColor
  ctx.fillRect(0, 0, 680, 4)

  // Результат
  ctx.fillStyle = accentColor
  ctx.font = 'bold 28px Outfit, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(isDraw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT', 340, 52)

  // Счёт
  ctx.fillStyle = '#eae8f2'
  ctx.font = 'bold 80px Outfit, sans-serif'
  ctx.fillText(`${s0} : ${s1}`, 340, 148)

  // Визуализация стоек
  const standY = 180
  for (let si = 0; si < 10; si++) {
    const x = 90 + si * 52
    const owner = gs.closed[si]
    const isGolden = si === 0

    // Фон стойки
    ctx.fillStyle = owner === 0 ? '#4a9eff' : owner === 1 ? '#ff6b6b' : '#2a2a3a'
    ctx.globalAlpha = owner !== undefined ? 0.9 : 0.25
    const r = 4
    ctx.beginPath()
    ctx.roundRect(x, standY, 40, 18, r)
    ctx.fill()
    ctx.globalAlpha = 1

    // Золотая звезда
    if (isGolden) {
      ctx.fillStyle = '#ffc145'
      ctx.font = '11px Outfit, sans-serif'
      ctx.fillText('★', x + 20, standY + 35)
    }
  }

  // Статистика
  ctx.fillStyle = '#6e6a82'
  ctx.font = '14px Outfit, sans-serif'
  const stats = []
  if (moves) stats.push(`${moves} ${moves === 1 ? 'move' : 'moves'}`)
  if (elapsed) stats.push(`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`)
  if (difficulty) {
    const diffNames = { 50: 'Easy', 100: 'Medium', 200: 'Hard', 400: 'Extreme', 600: 'Extreme', 800: 'Extreme' }
    stats.push(`AI: ${diffNames[difficulty] || difficulty}`)
  }
  if (mode === 'online') stats.push('Online')
  ctx.fillText(stats.join('  ·  '), 340, 245)

  // Игрок
  if (playerName) {
    ctx.fillStyle = '#eae8f2'
    ctx.font = 'bold 18px Outfit, sans-serif'
    ctx.fillText(playerName, 340, 290)

    if (rating) {
      ctx.fillStyle = '#a8a4b8'
      ctx.font = '14px Outfit, sans-serif'
      let ratingText = `${rating} ELO`
      if (ratingDelta) {
        const sign = ratingDelta > 0 ? '+' : ''
        ratingText += `  (${sign}${ratingDelta})`
      }
      ctx.fillText(ratingText, 340, 312)
    }
  }

  // Рейтинг-дельта (крупно, если есть)
  if (ratingDelta && !playerName) {
    ctx.fillStyle = ratingDelta > 0 ? '#3dd68c' : '#ff6066'
    ctx.font = 'bold 22px Outfit, sans-serif'
    ctx.fillText(`${ratingDelta > 0 ? '+' : ''}${ratingDelta} ELO`, 340, 290)
  }

  // Брендинг
  ctx.fillStyle = '#3d3d50'
  ctx.font = '13px Outfit, sans-serif'
  ctx.fillText('snatch-highrise.com', 340, 370)

  // Разделитель
  ctx.fillStyle = accentColor
  ctx.globalAlpha = 0.3
  ctx.fillRect(240, 348, 200, 1)
  ctx.globalAlpha = 1

  return c
}

// ─── Browser Notifications (таб в фоне) ───

/** Запросить разрешение на уведомления */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/** Показать уведомление (только если таб в фоне) */
export function showNotification(title, body, onClick) {
  if (!document.hidden) return // Таб активен — не нужно
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.png',
      tag: 'snatch-' + Date.now(), // Не группируем — каждое уведомление отдельно
      requireInteraction: false,
    })
    n.onclick = () => { window.focus(); n.close(); if (onClick) onClick() }
    // Автозакрытие через 8 сек
    setTimeout(() => n.close(), 8000)
  } catch {}
}
