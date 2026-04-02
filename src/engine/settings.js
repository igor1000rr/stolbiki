// Утилиты настроек — общий модуль для Game.jsx и Settings.jsx
const DEFAULTS = {
  chipStyle: 'classic',
  standStyle: 'classic',
  boardDensity: 'normal',
  animSpeed: 'normal',
  soundPack: 'classic',
  timer: 'off',
  autoConfirm: false,
  boardFlip: false,
  colorblind: false,
  reducedMotion: false,
  largeText: true,
  highContrast: false,
  showCoords: true,
  showFillBar: true,
  showChipCount: true,
  confirmClose: true,
  // v4.3 — новые настройки
  defaultDifficulty: 'medium',   // easy/medium/hard/extreme
  defaultMode: 'landing',        // landing/game/online/puzzles
  autoRematch: false,            // авто-реванш после партии
  confirmResign: true,           // подтверждение сдачи
  zenMode: false,                // минимальный UI
  showMoveLog: true,             // лог ходов
  standLabels: 'letters',        // letters/numbers/off
  profileVisibility: 'public',   // public/friends/private
  autoSaveReplay: false,         // авто-сохранение реплеев
  showPreRating: true,           // показывать рейтинг до матча
}

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('stolbiki_settings') || '{}') } }
  catch { return { ...DEFAULTS } }
}

export function getSetting(key) { return getSettings()[key] }

export function saveSettings(s) { localStorage.setItem('stolbiki_settings', JSON.stringify(s)) }

export function applySettings(s) {
  const root = document.documentElement
  // Data-attributes для одиночных значений (1 setAttribute вместо 7+ classList.toggle)
  root.setAttribute('data-chip', s.chipStyle || 'classic')
  root.setAttribute('data-stand', s.standStyle || 'classic')
  root.setAttribute('data-density', s.boardDensity || 'normal')
  root.setAttribute('data-anim', s.animSpeed || 'normal')
  // Boolean классы — собираем список и применяем за один раз
  const classes = []
  if (s.colorblind) classes.push('colorblind')
  if (s.reducedMotion) classes.push('reduced-motion')
  if (s.largeText) classes.push('large-text')
  if (s.highContrast) classes.push('high-contrast')
  // Backward-compat: CSS всё ещё может использовать классы chip-*, stand-* и т.д.
  if (s.chipStyle && s.chipStyle !== 'classic') classes.push(`chip-${s.chipStyle}`)
  if (s.standStyle && s.standStyle !== 'classic') classes.push(`stand-${s.standStyle}`)
  if (s.boardDensity === 'compact') classes.push('board-compact')
  if (s.boardDensity === 'wide') classes.push('board-wide')
  if (s.animSpeed === 'slow') classes.push('anim-slow')
  if (s.animSpeed === 'fast') classes.push('anim-fast')
  if (s.animSpeed === 'off') classes.push('anim-off')
  // Сохраняем data-theme и другие внешние классы
  const keep = Array.from(root.classList).filter(c =>
    !c.startsWith('chip-') && !c.startsWith('stand-') && !c.startsWith('board-') &&
    !c.startsWith('anim-') && c !== 'colorblind' && c !== 'reduced-motion' &&
    c !== 'large-text' && c !== 'high-contrast'
  )
  root.className = [...keep, ...classes].join(' ')
}

export { DEFAULTS }
