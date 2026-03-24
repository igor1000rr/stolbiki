// Утилиты настроек — общий модуль для Game.jsx и Settings.jsx
const DEFAULTS = {
  chipStyle: 'classic',
  boardDensity: 'normal',
  animSpeed: 'normal',
  soundPack: 'classic',
  timer: 'off',
  autoConfirm: false,
  boardFlip: false,
  colorblind: false,
  reducedMotion: false,
  largeText: false,
  highContrast: false,
  showCoords: true,
  showFillBar: true,
  showChipCount: true,
  confirmClose: true,
}

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('stolbiki_settings') || '{}') } }
  catch { return { ...DEFAULTS } }
}

export function getSetting(key) { return getSettings()[key] }

export function saveSettings(s) { localStorage.setItem('stolbiki_settings', JSON.stringify(s)) }

export function applySettings(s) {
  const root = document.documentElement
  root.classList.toggle('chip-flat', s.chipStyle === 'flat')
  root.classList.toggle('chip-rounded', s.chipStyle === 'rounded')
  root.classList.toggle('board-compact', s.boardDensity === 'compact')
  root.classList.toggle('board-wide', s.boardDensity === 'wide')
  root.classList.toggle('anim-slow', s.animSpeed === 'slow')
  root.classList.toggle('anim-fast', s.animSpeed === 'fast')
  root.classList.toggle('anim-off', s.animSpeed === 'off')
  root.classList.toggle('colorblind', s.colorblind)
  root.classList.toggle('reduced-motion', s.reducedMotion)
  root.classList.toggle('large-text', s.largeText)
  root.classList.toggle('high-contrast', s.highContrast)
}

export { DEFAULTS }
