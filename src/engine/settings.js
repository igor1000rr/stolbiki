// Утилиты настроек — общий модуль для Game.jsx и Settings.jsx
const DEFAULTS = {
  chipStyle: 'classic',
  standStyle: 'classic',
  bgStyle: 'bg_city_day',        // v5.9.22 — скин фона сцены
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
  defaultDifficulty: 'medium',
  defaultMode: 'landing',
  autoRematch: false,
  confirmResign: true,
  zenMode: false,
  showMoveLog: true,
  standLabels: 'letters',
  profileVisibility: 'public',
  autoSaveReplay: false,
  showPreRating: true,
}

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('stolbiki_settings') || '{}') } }
  catch { return { ...DEFAULTS } }
}

export function getSetting(key) { return getSettings()[key] }

export function saveSettings(s) { localStorage.setItem('stolbiki_settings', JSON.stringify(s)) }

export function applySettings(s) {
  const root = document.documentElement
  root.setAttribute('data-chip', s.chipStyle || 'classic')
  root.setAttribute('data-stand', s.standStyle || 'classic')
  // v5.9.22 — фон сцены через data-skin-bg, CSS в scene-background.css подхватывает
  root.setAttribute('data-skin-bg', s.bgStyle || 'bg_city_day')
  root.setAttribute('data-density', s.boardDensity || 'normal')
  root.setAttribute('data-anim', s.animSpeed || 'normal')
  const classes = []
  if (s.colorblind) classes.push('colorblind')
  if (s.reducedMotion) classes.push('reduced-motion')
  if (s.largeText) classes.push('large-text')
  if (s.highContrast) classes.push('high-contrast')
  if (s.chipStyle && s.chipStyle !== 'classic') classes.push(`chip-${s.chipStyle}`)
  if (s.standStyle && s.standStyle !== 'classic') classes.push(`stand-${s.standStyle}`)
  if (s.boardDensity === 'compact') classes.push('board-compact')
  if (s.boardDensity === 'wide') classes.push('board-wide')
  if (s.animSpeed === 'slow') classes.push('anim-slow')
  if (s.animSpeed === 'fast') classes.push('anim-fast')
  if (s.animSpeed === 'off') classes.push('anim-off')
  const keep = Array.from(root.classList).filter(c =>
    !c.startsWith('chip-') && !c.startsWith('stand-') && !c.startsWith('board-') &&
    !c.startsWith('anim-') && c !== 'colorblind' && c !== 'reduced-motion' &&
    c !== 'large-text' && c !== 'high-contrast'
  )
  root.className = [...keep, ...classes].join(' ')
}

// Вызываем applySettings при загрузке модуля, чтобы до рендера React
// data-skin-bg уже стоял на html и CSS показал нужный фон без мигания.
// Позже в SkinShop/Settings перевызов с обновлёнными значениями.
try { applySettings(getSettings()) } catch {}

export { DEFAULTS }
