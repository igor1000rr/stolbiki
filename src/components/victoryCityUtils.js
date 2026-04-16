/**
 * Утилиты и константы для VictoryCity.
 * Вынесено из VictoryCity.jsx ради распила.
 */

// ─── Скины и цвета ───
export const SKIN_HEX = {
  blocks_classic: { 0: 0x6db4ff, 1: 0xff8888 },
  blocks_flat:    { 0: 0x4a9eff, 1: 0xff6066 },
  blocks_round:   { 0: 0x4a9eff, 1: 0xff6066 },
  blocks_glass:   { 0: 0x6ab4ff, 1: 0xff7c80 },
  blocks_metal:   { 0: 0xb8d4f0, 1: 0xf0b8b8 },
  blocks_candy:   { 0: 0x80d0ff, 1: 0xff80b0 },
  blocks_pixel:   { 0: 0x4a9eff, 1: 0xff6066 },
  blocks_neon:    { 0: 0x00e5ff, 1: 0xff3090 },
  blocks_glow:    { 0: 0x7ec8ff, 1: 0xff9090 },
}

export const SKIN_EMISSIVE = {
  blocks_neon:  0.35,
  blocks_glow:  0.25,
  blocks_glass: 0.10,
}

export const GOLDEN_HEX = 0xffd86e
export const CROWN_HEX  = 0xffc845

// ─── Размеры и тайминги ───
export const SAVED_VIEWS_KEY = 'stolbiki_city_views'
export const MAX_SAVED_VIEWS = 6
export const TOWER_HEIGHT = 11
export const VIDEO_DURATION_MS = 8000
export const VIDEO_FPS = 30
export const VIDEO_BITRATE = 4_000_000

export const COLS = 5
export const SPACING = 6
export const FLOOR_H = 1.2
export const BLOCK_W = 3
export const CROWN_W = 2.5
export const INTRO_MS = 1800
export const FOCUS_MS = 700
export const PRESET_MS = 900
export const GROW_MS = 500
export const GROW_STAGGER = 60
export const GROW_START_AT = 0.5
export const TIME_MS = 800
export const TIMELAPSE_STAGGER = 200
export const TIMELAPSE_GROW_MS = 400
export const SMOKE_PER_BUILDING = 6
export const WEATHER_COUNT_HIGH = 600
export const WEATHER_COUNT_LOW = 250

// ─── Время суток ───
export const TIME_PRESETS = {
  night:   { bg:0x0a0a18, fogColor:0x0a0a18, fogNear:50, fogFar:200, sunColor:0xfff0c8, sunIntensity:1.1, sunPosOffset:[25,40,15],   ambientColor:0x8080c0, ambientIntensity:0.45, starsOpacity:0.7,  exposure:1.1,  windowGlow:0.95 },
  morning: { bg:0x7fa8cc, fogColor:0x9ec0dc, fogNear:70, fogFar:260, sunColor:0xfff0d0, sunIntensity:1.0, sunPosOffset:[-30,18,10],  ambientColor:0xb0c8e0, ambientIntensity:0.55, starsOpacity:0.05, exposure:1.15, windowGlow:0.05 },
  day:     { bg:0x5ba7d9, fogColor:0x8ec6ea, fogNear:90, fogFar:320, sunColor:0xffffff, sunIntensity:1.4, sunPosOffset:[20,60,15],   ambientColor:0xc0d8e8, ambientIntensity:0.65, starsOpacity:0,    exposure:1.25, windowGlow:0    },
  sunset:  { bg:0x3a1a2e, fogColor:0x6a3a4a, fogNear:55, fogFar:220, sunColor:0xff8040, sunIntensity:0.95,sunPosOffset:[40,8,15],    ambientColor:0xc06080, ambientIntensity:0.4,  starsOpacity:0.25, exposure:1.15, windowGlow:0.6  },
}

// ─── Погода ───
export const WEATHER_PARAMS = {
  winter: { color: 0xffffff, size: 0.45, fallSpeed: 1.2, sway: 0.6, opacity: 0.85 },
  spring: { color: 0x88aaff, size: 0.18, fallSpeed: 8.0, sway: 0.1, opacity: 0.6 },
  autumn: { color: 0xffaa30, size: 0.55, fallSpeed: 0.9, sway: 1.4, opacity: 0.85 },
  summer: null,
}

// ─── Функции ───
export function pieceColor(piece) {
  const pal = SKIN_HEX[piece.skin_id] || SKIN_HEX.blocks_classic
  return pal[0]
}

export function pieceEmissive(piece) {
  return SKIN_EMISSIVE[piece.skin_id] || 0
}

export function getDiffLabel(d, en) {
  if (!d) return null
  d = typeof d === 'number' ? d : parseInt(d, 10) || 0
  if (d >= 1500) return en ? 'Impossible' : 'Невозможно'
  if (d >= 800)  return en ? 'Extreme' : 'Экстрим'
  if (d >= 400)  return en ? 'Hard' : 'Сложно'
  if (d >= 150)  return en ? 'Medium' : 'Средняя'
  return en ? 'Easy' : 'Лёгкая'
}

export function hasWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function hasLowPower() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua)
  const fewCores = (navigator.hardwareConcurrency || 8) <= 4
  const lowDpr = (window.devicePixelRatio || 1) < 1.5
  return isMobile || (fewCores && lowDpr)
}

export function getSeason() {
  const m = new Date().getMonth()
  if (m === 11 || m <= 1) return 'winter'
  if (m >= 2 && m <= 4)  return 'spring'
  if (m >= 5 && m <= 7)  return 'summer'
  return 'autumn'
}

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
export function lerp(a, b, t) { return a + (b - a) * t }

export function pickVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264',
    'video/mp4',
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return null
}

export function towerMatchesFilter(tower, filter) {
  if (filter === 'all') return true
  if (filter === 'golden') return tower.is_closed && tower.golden_top
  if (filter === 'impossible') {
    return tower.pieces.some(p =>
      p.is_ai && (parseInt(p.ai_difficulty, 10) || 0) >= 1500
    )
  }
  if (filter === 'week') {
    const weekAgo = Date.now() / 1000 - 7 * 24 * 3600
    return tower.pieces.some(p => (p.date || 0) >= weekAgo)
  }
  return true
}

export function uniqueWinsInTower(tower) {
  const seen = new Map()
  for (const p of tower.pieces) {
    if (!seen.has(p.source_id)) {
      seen.set(p.source_id, {
        source_id: p.source_id,
        opponent: p.opponent,
        date: p.date,
        is_ai: p.is_ai,
        ai_difficulty: p.ai_difficulty,
        golden: p.golden,
        bricks: 1,
      })
    } else {
      seen.get(p.source_id).bricks++
    }
  }
  return [...seen.values()]
}

export function snapshotSceneTimeState(scene, sun, ambient, stars, renderer, windowMat) {
  return {
    bg: scene.background.clone(),
    fogColor: scene.fog.color.clone(),
    fogNear: scene.fog.near,
    fogFar: scene.fog.far,
    sunColor: sun.color.clone(),
    sunIntensity: sun.intensity,
    sunPos: sun.position.clone(),
    ambientColor: ambient.color.clone(),
    ambientIntensity: ambient.intensity,
    starsOpacity: stars.material.opacity,
    exposure: renderer.toneMappingExposure,
    windowGlow: windowMat ? windowMat.opacity : 0,
  }
}

export function loadSavedViews() {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, MAX_SAVED_VIEWS) : []
  } catch { return [] }
}

export function persistSavedViews(views) {
  try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, MAX_SAVED_VIEWS))) }
  catch { /* quota */ }
}
