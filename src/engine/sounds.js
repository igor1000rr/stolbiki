// Генерация звуков через Web Audio API — никаких файлов не нужно
let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
  } catch {}
}

export function soundPlace() {
  playTone(800, 0.08, 'sine', 0.1)
}

export function soundTransfer() {
  playTone(500, 0.1, 'triangle', 0.12)
  setTimeout(() => playTone(700, 0.1, 'triangle', 0.12), 80)
}

export function soundClose() {
  playTone(400, 0.15, 'square', 0.08)
  setTimeout(() => playTone(600, 0.15, 'square', 0.08), 100)
  setTimeout(() => playTone(800, 0.2, 'square', 0.08), 200)
}

export function soundWin() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.12), i * 120))
}

export function soundLose() {
  playTone(400, 0.2, 'sawtooth', 0.06)
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.06), 150)
}

export function soundClick() {
  playTone(1200, 0.03, 'sine', 0.05)
}

export function soundSwap() {
  playTone(600, 0.1, 'sine', 0.1)
  setTimeout(() => playTone(400, 0.1, 'sine', 0.1), 100)
  setTimeout(() => playTone(600, 0.1, 'sine', 0.1), 200)
}
