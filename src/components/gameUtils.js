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
export function generateShareImage(gs, won, isDraw, s0, s1) {
  const c = document.createElement('canvas')
  c.width = 600; c.height = 320
  const ctx = c.getContext('2d')
  // Фон
  ctx.fillStyle = '#14141e'
  ctx.fillRect(0, 0, 600, 320)
  ctx.fillStyle = '#1e1e28'
  ctx.fillRect(0, 0, 600, 6)
  // Заголовок
  ctx.fillStyle = isDraw ? '#9b59b6' : won ? '#3dd68c' : '#ff6066'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(isDraw ? 'Draw' : won ? 'Victory!' : 'Defeat', 300, 60)
  // Счёт
  ctx.fillStyle = '#e8e6f0'
  ctx.font = 'bold 72px sans-serif'
  ctx.fillText(`${s0} : ${s1}`, 300, 150)
  // Визуализация стоек
  for (let si = 0; si < 10; si++) {
    const x = 60 + si * 52
    const owner = gs.closed[si]
    ctx.fillStyle = owner === 0 ? '#4a9eff' : owner === 1 ? '#ff6b6b' : '#2a2a38'
    ctx.globalAlpha = owner !== undefined ? 0.9 : 0.3
    ctx.fillRect(x, 185, 40, 16)
    ctx.globalAlpha = 1
    if (si === 0) { ctx.fillStyle = '#ffc145'; ctx.font = '10px sans-serif'; ctx.fillText('★', x + 20, 218) }
  }
  // Инфо
  ctx.fillStyle = '#6b6880'
  ctx.font = '14px sans-serif'
  ctx.fillText(`${gs.turn} moves`, 300, 260)
  // Брендинг
  ctx.fillStyle = '#3d3d50'
  ctx.font = '12px sans-serif'
  ctx.fillText('snatch-highrise.com', 300, 300)
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
      icon: '/favicon.svg',
      tag: 'snatch-' + Date.now(), // Не группируем — каждое уведомление отдельно
      requireInteraction: false,
    })
    n.onclick = () => { window.focus(); n.close(); if (onClick) onClick() }
    // Автозакрытие через 8 сек
    setTimeout(() => n.close(), 8000)
  } catch {}
}
