/**
 * VictoryCity — Three.js 3D «Город побед»
 *
 * НОВАЯ КОНЦЕПЦИЯ (после v5.8):
 * 1 победа = N кирпичей. Кирпичи укладываются хронологически в стойки по 11 —
 * как в самой игре. Закрытая стойка (11 кирпичей) = небоскрёб.
 *
 * Backend: GET /api/buildings/city/:userId возвращает {towers, total_bricks,
 * total_wins, next_tower_progress}.
 *
 * Цвет кирпича = скин игрока на момент той победы. piece.special — золотой кирпич.
 * tower.golden_top — над высоткой висит шпиль-корона.
 *
 * Режимы:
 *  - Photo Mode: 4 пресета (Iso, Top, Cinematic, FPV) + автоповорот
 *  - Day/Night: 4 пресета времени суток, окна зажигаются ночью
 *  - Time-lapse: проигрывает постройку города tower за tower
 *  - Filter: всё / золотые шпили / содержит Impossible / последняя неделя
 *  - Weather: снег зимой, дождь весной, листья осенью
 *  - Minimap, Fullscreen, Snapshot+watermark+filter, Saved views (6 слотов)
 *  - MP4 video record: 8-сек FPV-облёт через MediaRecorder, .webm файл
 *  - Hall of Fame: кнопка-ссылка открывает топ-городов модалкой
 *
 * Performance: rafRef, кэш мешей, IntersectionObserver, visibilityState,
 * prefers-reduced-motion, mobile-режим (упрощённая графика на слабых).
 *
 * Fallback: WebGL error → VictoryCity2D с теми же towers данными.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useI18n } from '../engine/i18n'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))
const HallOfFame = lazy(() => import('./HallOfFame'))

const SKIN_HEX = {
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

const SKIN_EMISSIVE = {
  blocks_neon:  0.35,
  blocks_glow:  0.25,
  blocks_glass: 0.10,
}

const GOLDEN_HEX = 0xffd86e
const CROWN_HEX  = 0xffc845

const SAVED_VIEWS_KEY = 'stolbiki_city_views'
const MAX_SAVED_VIEWS = 6
const TOWER_HEIGHT = 11
const VIDEO_DURATION_MS = 8000      // длительность MP4-видео
const VIDEO_FPS = 30
const VIDEO_BITRATE = 4_000_000     // 4 Mbps — норм для 720p облёта

function pieceColor(piece) {
  const pal = SKIN_HEX[piece.skin_id] || SKIN_HEX.blocks_classic
  return pal[0]
}

function pieceEmissive(piece) {
  return SKIN_EMISSIVE[piece.skin_id] || 0
}

function getDiffLabel(d, en) {
  if (!d) return null
  d = typeof d === 'number' ? d : parseInt(d, 10) || 0
  if (d >= 1500) return en ? 'Impossible' : 'Невозможно'
  if (d >= 800)  return en ? 'Extreme' : 'Экстрим'
  if (d >= 400)  return en ? 'Hard' : 'Сложно'
  if (d >= 150)  return en ? 'Medium' : 'Средняя'
  return en ? 'Easy' : 'Лёгкая'
}

function hasWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function hasLowPower() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua)
  const fewCores = (navigator.hardwareConcurrency || 8) <= 4
  const lowDpr = (window.devicePixelRatio || 1) < 1.5
  return isMobile || (fewCores && lowDpr)
}

function getSeason() {
  const m = new Date().getMonth()
  if (m === 11 || m <= 1) return 'winter'
  if (m >= 2 && m <= 4)  return 'spring'
  if (m >= 5 && m <= 7)  return 'summer'
  return 'autumn'
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function lerp(a, b, t) { return a + (b - a) * t }

// Пробуем подобрать поддерживаемый MIME для MediaRecorder.
// Safari не умеет vp9, Chrome умеет всё, Firefox — vp8/vp9.
function pickVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264',  // Safari
    'video/mp4',
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return null
}

function towerMatchesFilter(tower, filter) {
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

function uniqueWinsInTower(tower) {
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

const COLS = 5
const SPACING = 6
const FLOOR_H = 1.2
const BLOCK_W = 3
const CROWN_W = 2.5
const INTRO_MS = 1800
const FOCUS_MS = 700
const PRESET_MS = 900
const GROW_MS = 500
const GROW_STAGGER = 60
const GROW_START_AT = 0.5
const TIME_MS = 800
const TIMELAPSE_STAGGER = 200
const TIMELAPSE_GROW_MS = 400
const SMOKE_PER_BUILDING = 6
const WEATHER_COUNT_HIGH = 600
const WEATHER_COUNT_LOW = 250

const TIME_PRESETS = {
  night:   { bg:0x0a0a18, fogColor:0x0a0a18, fogNear:50, fogFar:200, sunColor:0xfff0c8, sunIntensity:1.1, sunPosOffset:[25,40,15],   ambientColor:0x8080c0, ambientIntensity:0.45, starsOpacity:0.7,  exposure:1.1,  windowGlow:0.95 },
  morning: { bg:0x7fa8cc, fogColor:0x9ec0dc, fogNear:70, fogFar:260, sunColor:0xfff0d0, sunIntensity:1.0, sunPosOffset:[-30,18,10],  ambientColor:0xb0c8e0, ambientIntensity:0.55, starsOpacity:0.05, exposure:1.15, windowGlow:0.05 },
  day:     { bg:0x5ba7d9, fogColor:0x8ec6ea, fogNear:90, fogFar:320, sunColor:0xffffff, sunIntensity:1.4, sunPosOffset:[20,60,15],   ambientColor:0xc0d8e8, ambientIntensity:0.65, starsOpacity:0,    exposure:1.25, windowGlow:0    },
  sunset:  { bg:0x3a1a2e, fogColor:0x6a3a4a, fogNear:55, fogFar:220, sunColor:0xff8040, sunIntensity:0.95,sunPosOffset:[40,8,15],    ambientColor:0xc06080, ambientIntensity:0.4,  starsOpacity:0.25, exposure:1.15, windowGlow:0.6  },
}

const WEATHER_PARAMS = {
  winter: { color: 0xffffff, size: 0.45, fallSpeed: 1.2, sway: 0.6, opacity: 0.85 },
  spring: { color: 0x88aaff, size: 0.18, fallSpeed: 8.0, sway: 0.1, opacity: 0.6 },
  autumn: { color: 0xffaa30, size: 0.55, fallSpeed: 0.9, sway: 1.4, opacity: 0.85 },
  summer: null,
}

function snapshotSceneTimeState(scene, sun, ambient, stars, renderer, windowMat) {
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

function makeStarTexture(THREE) {
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

function makeRoadTexture(THREE) {
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

function makeSoftDotTexture(THREE) {
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

function loadSavedViews() {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, MAX_SAVED_VIEWS) : []
  } catch { return [] }
}

function persistSavedViews(views) {
  try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, MAX_SAVED_VIEWS))) }
  catch { /* quota */ }
}

export default function VictoryCity({ userId }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [cityData, setCityData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selTowerIdx, setSelTowerIdx] = useState(null)
  const [webglOk] = useState(() => hasWebGL())
  const [forceSvg, setForceSvg] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState(null)
  const [currentPreset, setCurrentPreset] = useState('iso')
  const [autoRotate, setAutoRotate] = useState(false)
  const [timeOfDay, setTimeOfDay] = useState('night')
  const [hoverInfo, setHoverInfo] = useState(null)
  const [isTimelapsing, setIsTimelapsing] = useState(false)
  const [timelapseDate, setTimelapseDate] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shotFilter, setShotFilter] = useState('original')
  const [showShotMenu, setShowShotMenu] = useState(false)
  const [savedViews, setSavedViews] = useState(() => loadSavedViews())
  const [weatherEnabled, setWeatherEnabled] = useState(true)
  const [season] = useState(() => getSeason())
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  // Новые
  const [isRecording, setIsRecording] = useState(false)
  const [recordProgress, setRecordProgress] = useState(0)
  const [showHallOfFame, setShowHallOfFame] = useState(false)

  const containerRef = useRef(null)
  const threeRef = useRef(null)
  const recorderRef = useRef(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.all([
      fetch(`/api/buildings/city/${userId}`).then(r => r.json()),
      fetch(`/api/buildings/stats/${userId}`).then(r => r.json()),
    ])
      .then(([city, s]) => {
        setCityData(city || { towers: [], total_bricks: 0, total_wins: 0, next_tower_progress: 0 })
        setStats(s)
      })
      .catch(() => setCityData({ towers: [], total_bricks: 0, total_wins: 0, next_tower_progress: 0 }))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    const onFs = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      const t = threeRef.current
      if (t?.onResize) setTimeout(() => t.onResize(), 50)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    const t = threeRef.current
    if (!t?.applyFilter) return
    t.applyFilter(buildingFilter)
  }, [buildingFilter])

  useEffect(() => {
    const t = threeRef.current
    if (!t?.setWeatherEnabled) return
    t.setWeatherEnabled(weatherEnabled)
  }, [weatherEnabled])

  useEffect(() => {
    if (!webglOk || forceSvg) return
    if (!containerRef.current || !cityData?.towers?.length) return
    const towers = cityData.towers

    let disposed = false
    const reducedMotion = prefersReducedMotion()
    const lowPower = hasLowPower()
    const rafRef = { current: 0 }
    const ioVisibleRef = { current: true }
    const tabVisibleRef = { current: typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true }
    const hoverRef = { current: { towerIdx: null, group: null, pieceIdx: null } }
    const filterRef = { current: null }

    ;(async () => {
      try {
        const [THREE, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/addons/controls/OrbitControls.js'),
        ])
        if (disposed) return
        const container = containerRef.current
        if (!container) return

        const w = container.clientWidth
        const h = Math.min(480, Math.max(320, w * 0.7))

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0a18)
        scene.fog = new THREE.Fog(0x0a0a18, 50, 200)

        const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500)

        const rows = Math.max(1, Math.ceil(towers.length / COLS))
        const centerX = ((COLS - 1) / 2) * SPACING
        const centerZ = ((rows - 1) / 2) * SPACING
        const dist = Math.max(25, Math.max(COLS, rows) * SPACING * 1.4)

        const finalCamPos = new THREE.Vector3(centerX + dist * 0.7, dist * 0.6, centerZ + dist * 0.7)
        const finalTarget = new THREE.Vector3(centerX, 3, centerZ)

        camera.position.set(centerX, dist * 1.8, centerZ + 2)
        camera.lookAt(centerX, 0, centerZ)
        const introStartPos = camera.position.clone()
        const introStartTarget = new THREE.Vector3(centerX, 0, centerZ)

        const renderer = new THREE.WebGLRenderer({
          antialias: !lowPower, alpha: false,
          powerPreference: lowPower ? 'low-power' : 'default',
          preserveDrawingBuffer: true,
        })
        renderer.setPixelRatio(lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(w, h)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = lowPower ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap
        renderer.toneMapping = lowPower ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1
        container.appendChild(renderer.domElement)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.borderRadius = '12px'
        renderer.domElement.style.touchAction = 'none'

        const ambient = new THREE.AmbientLight(0x8080c0, 0.45)
        scene.add(ambient)
        const sun = new THREE.DirectionalLight(0xfff0c8, 1.1)
        sun.position.set(centerX + 25, 40, centerZ + 15)
        sun.target.position.set(centerX, 0, centerZ)
        sun.castShadow = true
        sun.shadow.mapSize.set(lowPower ? 512 : 1024, lowPower ? 512 : 1024)
        sun.shadow.camera.left = -50; sun.shadow.camera.right = 50
        sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 100
        sun.shadow.bias = -0.0003
        scene.add(sun); scene.add(sun.target)
        const rim = new THREE.DirectionalLight(0x6050a0, 0.4)
        rim.position.set(centerX - 20, 15, centerZ - 20)
        scene.add(rim)

        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({ color: 0x0d0d22, roughness: 0.85, metalness: 0.1 }),
        )
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        scene.add(ground)

        const roadTex = makeRoadTexture(THREE)
        const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, color: 0x222230, roughness: 0.95, metalness: 0 })
        const roadsGroup = new THREE.Group()
        const roadW = 2.6
        const roadLen = Math.max(rows, COLS) * SPACING + SPACING * 2
        for (let r = -1; r < rows; r++) {
          const z = r * SPACING + SPACING / 2
          const m = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, roadW), roadMat.clone())
          m.material.map = roadTex.clone()
          m.material.map.repeat.set(roadLen / 4, 1)
          m.material.map.needsUpdate = true; m.material.needsUpdate = true
          m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2
          m.position.set(centerX, 0.005, z); m.receiveShadow = true
          roadsGroup.add(m)
        }
        for (let c = -1; c < COLS; c++) {
          const x = c * SPACING + SPACING / 2
          const m = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, roadW), roadMat.clone())
          m.material.map = roadTex.clone()
          m.material.map.repeat.set(roadLen / 4, 1)
          m.material.map.needsUpdate = true; m.material.needsUpdate = true
          m.rotation.x = -Math.PI / 2
          m.position.set(x, 0.005, centerZ); m.receiveShadow = true
          roadsGroup.add(m)
        }
        scene.add(roadsGroup)

        const starCount = lowPower ? 200 : 400
        const starGeo = new THREE.BufferGeometry()
        const starPositions = new Float32Array(starCount * 3)
        for (let i = 0; i < starCount; i++) {
          const r = 150
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(Math.random() * 0.6)
          starPositions[i * 3]     = centerX + r * Math.sin(phi) * Math.cos(theta)
          starPositions[i * 3 + 1] = r * Math.cos(phi) + 20
          starPositions[i * 3 + 2] = centerZ + r * Math.sin(phi) * Math.sin(theta)
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.7 })
        const stars = new THREE.Points(starGeo, starMat)
        scene.add(stars)

        const cityGroup = new THREE.Group()
        scene.add(cityGroup)

        const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W)
        const crownGeo = new THREE.BoxGeometry(CROWN_W, FLOOR_H, CROWN_W)

        const towerPositions = new Map()
        const crownMeshes = []
        const goldenSprites = []
        const towerGroups = []
        const towerMaterials = new Map()

        const windowsPerFloor = lowPower ? 2 : 4
        let totalFloors = 0
        for (const t of towers) totalFloors += t.pieces.length
        const totalWindows = totalFloors * windowsPerFloor
        const windowGeo = new THREE.PlaneGeometry(0.55, 0.55)
        // Initial opacity сразу выставляем по текущему timeOfDay чтобы окна светились
        // ночью при первой загрузке — без необходимости кликать на time-preset.
        const initialWindowGlow = TIME_PRESETS[timeOfDay]?.windowGlow ?? 0
        const windowMat = new THREE.MeshBasicMaterial({
          color: 0xffe49a, transparent: true, opacity: initialWindowGlow,
          side: THREE.DoubleSide, depthWrite: false,
        })
        const windowsMesh = totalWindows > 0
          ? new THREE.InstancedMesh(windowGeo, windowMat, totalWindows)
          : null
        if (windowsMesh) {
          windowsMesh.frustumCulled = false
          windowsMesh.matrixAutoUpdate = false
          scene.add(windowsMesh)
        }
        let windowIdx = 0
        const tmpMat = new THREE.Matrix4()
        const tmpQuat = new THREE.Quaternion()
        const tmpEul = new THREE.Euler()
        const tmpVec = new THREE.Vector3()
        const tmpScale = new THREE.Vector3(1, 1, 1)

        const starTex = makeStarTexture(THREE)
        const dotTex = makeSoftDotTexture(THREE)

        let totalSmoke = 0
        for (const t of towers) {
          if (t.is_closed && t.golden_top) totalSmoke += SMOKE_PER_BUILDING
        }
        let smokeGeo = null, smokeMat = null, smoke = null, smokeData = null
        if (totalSmoke > 0) {
          smokeGeo = new THREE.BufferGeometry()
          const sp = new Float32Array(totalSmoke * 3)
          smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
          smokeMat = new THREE.PointsMaterial({
            map: dotTex, color: 0xc0c0d0, size: 0.9, sizeAttenuation: true,
            transparent: true, opacity: 0.4, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
          smoke = new THREE.Points(smokeGeo, smokeMat)
          scene.add(smoke)
          smokeData = new Float32Array(totalSmoke * 5)
        }

        const weatherCfg = WEATHER_PARAMS[season]
        let weatherGeo = null, weatherMat = null, weather = null, weatherData = null
        const weatherCount = lowPower ? WEATHER_COUNT_LOW : WEATHER_COUNT_HIGH
        const weatherSpread = Math.max(60, dist * 1.5)
        if (weatherCfg) {
          weatherGeo = new THREE.BufferGeometry()
          const wp = new Float32Array(weatherCount * 3)
          for (let i = 0; i < weatherCount; i++) {
            wp[i * 3]     = centerX + (Math.random() - 0.5) * weatherSpread
            wp[i * 3 + 1] = Math.random() * 50 + 5
            wp[i * 3 + 2] = centerZ + (Math.random() - 0.5) * weatherSpread
          }
          weatherGeo.setAttribute('position', new THREE.BufferAttribute(wp, 3))
          weatherMat = new THREE.PointsMaterial({
            map: dotTex, color: weatherCfg.color, size: weatherCfg.size,
            sizeAttenuation: true, transparent: true, opacity: weatherCfg.opacity,
            depthWrite: false,
          })
          weather = new THREE.Points(weatherGeo, weatherMat)
          scene.add(weather)
          weatherData = new Float32Array(weatherCount * 4)
          for (let i = 0; i < weatherCount; i++) {
            weatherData[i * 4]     = (Math.random() - 0.5) * weatherCfg.sway
            weatherData[i * 4 + 1] = -weatherCfg.fallSpeed * (0.7 + Math.random() * 0.6)
            weatherData[i * 4 + 2] = (Math.random() - 0.5) * weatherCfg.sway
            weatherData[i * 4 + 3] = Math.random() * Math.PI * 2
          }
        }

        let smokeFillIdx = 0
        towers.forEach((tower, idx) => {
          const col = idx % COLS
          const row = Math.floor(idx / COLS)
          const bx = col * SPACING
          const bz = row * SPACING
          const heightFloors = tower.pieces.length

          const bGroup = new THREE.Group()
          bGroup.position.set(bx, 0, bz)
          bGroup.userData.towerIdx = idx
          bGroup.userData.is_closed = tower.is_closed
          bGroup.userData.created_at_first = tower.period_from
          bGroup.scale.y = 0
          bGroup.userData.growDelay = idx * GROW_STAGGER
          towerPositions.set(idx, {
            x: bx, z: bz,
            height: (heightFloors + (tower.golden_top ? 1 : 0)) * FLOOR_H,
            isClosed: tower.is_closed,
            goldenTop: tower.golden_top,
          })

          const matList = []

          tower.pieces.forEach((piece, i) => {
            const colorHex = piece.special ? GOLDEN_HEX : pieceColor(piece)
            const emissiveInt = piece.special ? 0.4 : pieceEmissive(piece)
            const mat = new THREE.MeshStandardMaterial({
              color: colorHex,
              roughness: piece.skin_id === 'blocks_metal' ? 0.3 : 0.55,
              metalness: piece.skin_id === 'blocks_metal' ? 0.7 : 0.15,
              emissive: colorHex,
              emissiveIntensity: emissiveInt,
              transparent: false, opacity: 1,
            })
            matList.push(mat)
            const mesh = new THREE.Mesh(floorGeo, mat)
            mesh.position.y = FLOOR_H / 2 + i * FLOOR_H
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.userData.towerIdx = idx
            mesh.userData.pieceIdx = i
            bGroup.add(mesh)

            if (windowsMesh) {
              const fy = FLOOR_H / 2 + i * FLOOR_H
              const half = BLOCK_W / 2 + 0.01
              const allFaces = [
                { x: 0, z: half, ry: 0 },
                { x: 0, z: -half, ry: Math.PI },
                { x: half, z: 0, ry: Math.PI / 2 },
                { x: -half, z: 0, ry: -Math.PI / 2 },
              ]
              const faces = lowPower ? allFaces.slice(0, 2) : allFaces
              for (const f of faces) {
                tmpVec.set(bx + f.x, fy, bz + f.z)
                tmpEul.set(0, f.ry, 0)
                tmpQuat.setFromEuler(tmpEul)
                tmpMat.compose(tmpVec, tmpQuat, tmpScale)
                windowsMesh.setMatrixAt(windowIdx, tmpMat)
                windowIdx++
              }
            }
          })

          if (tower.is_closed && tower.golden_top) {
            const crownMat = new THREE.MeshStandardMaterial({
              color: CROWN_HEX, roughness: 0.25, metalness: 0.85,
              emissive: CROWN_HEX, emissiveIntensity: 0.4,
              transparent: false, opacity: 1,
            })
            matList.push(crownMat)
            const crownMesh = new THREE.Mesh(crownGeo, crownMat)
            crownMesh.position.y = FLOOR_H / 2 + heightFloors * FLOOR_H
            crownMesh.castShadow = true
            crownMesh.userData.towerIdx = idx
            bGroup.add(crownMesh)
            crownMeshes.push(crownMesh)

            const sMat = new THREE.SpriteMaterial({
              map: starTex, color: 0xffffff, transparent: true,
              opacity: 0.95, depthWrite: false,
            })
            const sprite = new THREE.Sprite(sMat)
            sprite.scale.set(2.5, 2.5, 1)
            sprite.position.y = (heightFloors + 1) * FLOOR_H + 1.6
            sprite.userData.towerIdx = idx
            bGroup.add(sprite)
            goldenSprites.push(sprite)

            if (smoke) {
              const topY = (heightFloors + 1) * FLOOR_H + 1
              for (let s = 0; s < SMOKE_PER_BUILDING; s++) {
                const i = smokeFillIdx
                smokeData[i * 5]     = bx
                smokeData[i * 5 + 1] = bz
                smokeData[i * 5 + 2] = Math.random() * 3
                smokeData[i * 5 + 3] = 3 + Math.random() * 2
                smokeData[i * 5 + 4] = topY
                const pos = smokeGeo.attributes.position.array
                pos[i * 3]     = bx + (Math.random() - 0.5) * 0.5
                pos[i * 3 + 1] = topY
                pos[i * 3 + 2] = bz + (Math.random() - 0.5) * 0.5
                smokeFillIdx++
              }
            }
          }

          cityGroup.add(bGroup)
          towerGroups.push(bGroup)
          towerMaterials.set(idx, matList)
        })

        if (windowsMesh) windowsMesh.instanceMatrix.needsUpdate = true
        if (smokeGeo) smokeGeo.attributes.position.needsUpdate = true

        // Initial sync с timeOfDay: stars opacity тоже выставляем сразу,
        // чтобы небо ночью было звёздное без анимации (она не запущена пока юзер
        // не кликнет time-preset). Цвета scene.background/fog/sun уже соответствуют
        // ночи через начальные значения выше.
        const initialPreset = TIME_PRESETS[timeOfDay]
        if (initialPreset) {
          stars.material.opacity = initialPreset.starsOpacity
          renderer.toneMappingExposure = initialPreset.exposure
        }

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true; controls.dampingFactor = 0.08
        controls.minDistance = 10; controls.maxDistance = 150
        controls.maxPolarAngle = Math.PI / 2.1
        controls.target.copy(introStartTarget)
        controls.enablePan = true; controls.panSpeed = 0.6
        controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.8
        controls.autoRotateSpeed = 0.5; controls.enabled = false
        controls.update()

        const CAMERA_PRESETS = {
          iso:       { pos: finalCamPos.clone(), target: finalTarget.clone() },
          top:       { pos: new THREE.Vector3(centerX, dist * 1.3, centerZ + 4), target: new THREE.Vector3(centerX, 0, centerZ) },
          cinematic: { pos: new THREE.Vector3(centerX + dist * 1.1, dist * 0.18, centerZ + dist * 0.55), target: new THREE.Vector3(centerX, 4, centerZ) },
          fpv:       { pos: new THREE.Vector3(centerX + dist * 0.6, 4, centerZ + dist * 0.6), target: new THREE.Vector3(centerX, 4, centerZ), autoRotate: true },
        }

        const animRef = {
          focusAnim: null, focusDuration: FOCUS_MS,
          autoRotate: false, timeAnim: null,
          timelapse: null, weatherEnabled: true,
          // Кастомная орбита для записи видео: { start, durationMs, centerX, centerZ, radius, height, lookAt }
          recordOrbit: null,
        }

        function startCamAnim(toPos, toTarget, duration) {
          animRef.focusAnim = {
            fromPos: camera.position.clone(), toPos: toPos.clone(),
            fromTarget: controls.target.clone(), toTarget: toTarget.clone(),
            start: performance.now(),
          }
          animRef.focusDuration = duration || FOCUS_MS
          controls.enabled = false; controls.autoRotate = false
        }

        function startFocusAnim(towerIdx) {
          const p = towerPositions.get(towerIdx)
          if (!p) return
          const offset = Math.max(8, p.height + 6)
          startCamAnim(
            new THREE.Vector3(p.x + offset * 0.8, p.height + offset * 0.5, p.z + offset * 0.8),
            new THREE.Vector3(p.x, p.height / 2, p.z),
            FOCUS_MS,
          )
        }

        function startTimeAnim(presetName) {
          const target = TIME_PRESETS[presetName]
          if (!target) return
          animRef.timeAnim = {
            from: snapshotSceneTimeState(scene, sun, ambient, stars, renderer, windowMat),
            to: {
              bg: new THREE.Color(target.bg),
              fogColor: new THREE.Color(target.fogColor),
              fogNear: target.fogNear, fogFar: target.fogFar,
              sunColor: new THREE.Color(target.sunColor),
              sunIntensity: target.sunIntensity,
              sunPos: new THREE.Vector3(centerX + target.sunPosOffset[0], target.sunPosOffset[1], centerZ + target.sunPosOffset[2]),
              ambientColor: new THREE.Color(target.ambientColor),
              ambientIntensity: target.ambientIntensity,
              starsOpacity: target.starsOpacity,
              exposure: target.exposure, windowGlow: target.windowGlow,
            },
            start: performance.now(),
          }
        }

        function startTimelapse() {
          const sorted = [...towerGroups]
          for (const g of sorted) g.scale.y = 0
          animRef.timelapse = { sortedGroups: sorted, start: performance.now() }
          setIsTimelapsing(true)
          hoverRef.current = { towerIdx: null, group: null, pieceIdx: null }
          setHoverInfo(null)
          if (rafRef.current === 0 && ioVisibleRef.current && tabVisibleRef.current) animate()
        }

        function stopTimelapse() {
          if (animRef.timelapse) {
            for (const g of animRef.timelapse.sortedGroups) g.scale.y = 1
          }
          animRef.timelapse = null
          setIsTimelapsing(false)
          setTimelapseDate(null)
        }

        function applyFilter(filter) {
          if (filter === 'all') {
            filterRef.current = null
          } else {
            const matchSet = new Set()
            towers.forEach((t, i) => { if (towerMatchesFilter(t, filter)) matchSet.add(i) })
            filterRef.current = matchSet
          }
          for (const bGroup of towerGroups) {
            const idx = bGroup.userData.towerIdx
            const visible = filterRef.current === null || filterRef.current.has(idx)
            const opacity = visible ? 1.0 : 0.15
            const mats = towerMaterials.get(idx) || []
            for (const m of mats) {
              m.transparent = !visible || m.transparent
              m.opacity = opacity
              m.depthWrite = visible
              m.needsUpdate = true
            }
            for (const ch of bGroup.children) {
              if (ch.material instanceof THREE.SpriteMaterial) {
                ch.material.opacity = visible ? 0.95 : 0.1
              }
            }
          }
          if (rafRef.current === 0 && ioVisibleRef.current && tabVisibleRef.current) animate()
        }

        function setWeatherEnabled(on) {
          animRef.weatherEnabled = on
          if (weather) weather.visible = on
          if (rafRef.current === 0 && ioVisibleRef.current && tabVisibleRef.current) animate()
        }

        // ─── Кастомная FPV-орбита для записи видео ───
        // Камера летит по кругу вокруг центра города на высоте dist*0.18,
        // полный оборот за durationMs. Время даёт детерминированный запись.
        function startRecordOrbit(durationMs) {
          animRef.focusAnim = null
          animRef.recordOrbit = {
            start: performance.now(),
            durationMs,
            centerX, centerZ,
            radius: dist * 0.85,
            height: dist * 0.25,
            lookHeight: 4,
          }
          controls.enabled = false
          controls.autoRotate = false
        }
        function stopRecordOrbit() {
          animRef.recordOrbit = null
          controls.enabled = true
        }

        const introStart = performance.now()

        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()
        let clickStart = null
        renderer.domElement.addEventListener('pointerdown', (e) => {
          clickStart = { x: e.clientX, y: e.clientY }
        })
        renderer.domElement.addEventListener('pointerup', (e) => {
          if (!clickStart) return
          const dx = Math.abs(e.clientX - clickStart.x)
          const dy = Math.abs(e.clientY - clickStart.y)
          clickStart = null
          if (dx > 5 || dy > 5) return
          if (performance.now() - introStart < INTRO_MS) return
          if (animRef.timelapse || animRef.recordOrbit) return
          const rect = renderer.domElement.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const hits = raycaster.intersectObjects(cityGroup.children, true)
          if (hits.length) {
            const towerIdx = hits[0].object.userData.towerIdx
            if (towerIdx != null && (filterRef.current === null || filterRef.current.has(towerIdx))) {
              setSelTowerIdx(prev => {
                const next = prev === towerIdx ? null : towerIdx
                if (next != null) startFocusAnim(next)
                return next
              })
            }
          }
        })

        const onPointerMove = (e) => {
          if (animRef.timelapse || animRef.recordOrbit) return
          if (performance.now() - introStart < INTRO_MS) return
          const rect = renderer.domElement.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const hits = raycaster.intersectObjects(cityGroup.children, true)
          let found = null
          if (hits.length) {
            const obj = hits[0].object
            const towerIdx = obj.userData.towerIdx
            if (towerIdx != null && (filterRef.current === null || filterRef.current.has(towerIdx))) {
              let g = obj
              while (g && !towerGroups.includes(g)) g = g.parent
              found = { towerIdx, group: g, pieceIdx: obj.userData.pieceIdx }
            }
          }
          if (found && found.towerIdx != null) {
            const tower = towers[found.towerIdx]
            const piece = found.pieceIdx != null ? tower.pieces[found.pieceIdx] : null
            if (hoverRef.current.towerIdx !== found.towerIdx || hoverRef.current.pieceIdx !== found.pieceIdx) {
              hoverRef.current = found
              setHoverInfo({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                towerIdx: found.towerIdx,
                height: tower.height,
                isClosed: tower.is_closed,
                goldenTop: tower.golden_top,
                sourceWins: tower.source_wins,
                periodFrom: tower.period_from,
                periodTo: tower.period_to,
                piece,
              })
            } else {
              setHoverInfo(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev)
            }
          } else {
            if (hoverRef.current.towerIdx != null) {
              hoverRef.current = { towerIdx: null, group: null, pieceIdx: null }
              setHoverInfo(null)
            }
          }
        }
        const onPointerLeave = () => {
          hoverRef.current = { towerIdx: null, group: null, pieceIdx: null }
          setHoverInfo(null)
        }
        renderer.domElement.addEventListener('pointermove', onPointerMove)
        renderer.domElement.addEventListener('pointerleave', onPointerLeave)

        let resizeRaf = 0
        const onResize = () => {
          cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(() => {
            if (!container) return
            const fs = !!document.fullscreenElement
            const w2 = fs ? window.innerWidth : container.clientWidth
            const h2 = fs ? window.innerHeight : Math.min(480, Math.max(320, w2 * 0.7))
            camera.aspect = w2 / h2
            camera.updateProjectionMatrix()
            renderer.setSize(w2, h2)
          })
        }
        window.addEventListener('resize', onResize)

        let growComplete = false
        const clock = new THREE.Clock()
        let lastFrameTime = performance.now()
        const animate = () => {
          if (!ioVisibleRef.current || !tabVisibleRef.current) {
            rafRef.current = 0
            return
          }
          rafRef.current = requestAnimationFrame(animate)
          const t = clock.getElapsedTime()
          const now = performance.now()
          const dt = Math.min(0.1, (now - lastFrameTime) / 1000)
          lastFrameTime = now

          const introElapsed = now - introStart
          if (introElapsed < INTRO_MS) {
            const p = introElapsed / INTRO_MS
            const e = easeOutCubic(p)
            camera.position.lerpVectors(introStartPos, finalCamPos, e)
            controls.target.lerpVectors(introStartTarget, finalTarget, e)
            camera.lookAt(controls.target)
          } else if (controls.enabled === false && !animRef.focusAnim && !animRef.recordOrbit) {
            controls.enabled = true
            controls.autoRotate = animRef.autoRotate && !reducedMotion
          }

          if (animRef.focusAnim) {
            const p = Math.min(1, (now - animRef.focusAnim.start) / animRef.focusDuration)
            const e = easeOutCubic(p)
            camera.position.lerpVectors(animRef.focusAnim.fromPos, animRef.focusAnim.toPos, e)
            controls.target.lerpVectors(animRef.focusAnim.fromTarget, animRef.focusAnim.toTarget, e)
            camera.lookAt(controls.target)
            if (p >= 1) {
              animRef.focusAnim = null
              if (!animRef.recordOrbit) {
                controls.enabled = true
                controls.autoRotate = animRef.autoRotate && !reducedMotion
              }
            }
          }

          // ─── Record orbit: камера летит по кругу детерминированно ───
          if (animRef.recordOrbit) {
            const ro = animRef.recordOrbit
            const elapsed = now - ro.start
            const p = Math.min(1, elapsed / ro.durationMs)
            // Полный оборот 360° за все 8 сек. easing убрали — линейная скорость для плавности видео.
            const angle = p * Math.PI * 2 + Math.PI / 4   // +45° стартовый
            const px = ro.centerX + Math.cos(angle) * ro.radius
            const pz = ro.centerZ + Math.sin(angle) * ro.radius
            // Высота немного колышется — добавляет дыхание в кадр
            const h = ro.height + Math.sin(p * Math.PI * 2) * 2
            camera.position.set(px, h, pz)
            controls.target.set(ro.centerX, ro.lookHeight, ro.centerZ)
            camera.lookAt(controls.target)
          }

          if (animRef.timeAnim) {
            const ta = animRef.timeAnim
            const p = Math.min(1, (now - ta.start) / TIME_MS)
            const e = easeOutCubic(p)
            scene.background.lerpColors(ta.from.bg, ta.to.bg, e)
            scene.fog.color.lerpColors(ta.from.fogColor, ta.to.fogColor, e)
            scene.fog.near = lerp(ta.from.fogNear, ta.to.fogNear, e)
            scene.fog.far = lerp(ta.from.fogFar, ta.to.fogFar, e)
            sun.color.lerpColors(ta.from.sunColor, ta.to.sunColor, e)
            sun.intensity = lerp(ta.from.sunIntensity, ta.to.sunIntensity, e)
            sun.position.lerpVectors(ta.from.sunPos, ta.to.sunPos, e)
            ambient.color.lerpColors(ta.from.ambientColor, ta.to.ambientColor, e)
            ambient.intensity = lerp(ta.from.ambientIntensity, ta.to.ambientIntensity, e)
            stars.material.opacity = lerp(ta.from.starsOpacity, ta.to.starsOpacity, e)
            renderer.toneMappingExposure = lerp(ta.from.exposure, ta.to.exposure, e)
            if (windowMat) windowMat.opacity = lerp(ta.from.windowGlow, ta.to.windowGlow, e)
            if (p >= 1) animRef.timeAnim = null
          }

          if (!growComplete && !animRef.timelapse) {
            const growStartMs = introStart + INTRO_MS * GROW_START_AT
            if (now >= growStartMs) {
              let allDone = true
              for (const g of cityGroup.children) {
                if (g.scale.y >= 1) continue
                const e2 = now - growStartMs - (g.userData.growDelay || 0)
                if (e2 < 0) { allDone = false; continue }
                const p2 = Math.min(1, e2 / GROW_MS)
                g.scale.y = easeOutCubic(p2)
                if (p2 < 1) allDone = false
              }
              if (allDone) growComplete = true
            }
          }

          if (animRef.timelapse) {
            const tl = animRef.timelapse
            const elapsed = now - tl.start
            let allDone = true
            let currentDateForUI = null
            for (let i = 0; i < tl.sortedGroups.length; i++) {
              const g = tl.sortedGroups[i]
              const startMs = i * TIMELAPSE_STAGGER
              const localElapsed = elapsed - startMs
              if (localElapsed < 0) { g.scale.y = 0; allDone = false; continue }
              const p2 = Math.min(1, localElapsed / TIMELAPSE_GROW_MS)
              g.scale.y = easeOutCubic(p2)
              if (p2 < 1) allDone = false
              if (p2 > 0) currentDateForUI = g.userData.created_at_first
            }
            if (currentDateForUI && (!tl._lastUiAt || now - tl._lastUiAt > 100)) {
              tl._lastUiAt = now
              setTimelapseDate(currentDateForUI)
            }
            if (allDone) {
              if (!tl._doneAt) tl._doneAt = now
              if (now - tl._doneAt > 1000) {
                animRef.timelapse = null
                setIsTimelapsing(false)
                setTimelapseDate(null)
              }
            }
          }

          if (!reducedMotion) {
            for (let i = 0; i < crownMeshes.length; i++) {
              const m = crownMeshes[i]
              m.material.emissiveIntensity = 0.35 + Math.sin(t * 2 + m.position.y) * 0.12
            }
            for (let i = 0; i < goldenSprites.length; i++) {
              const s = goldenSprites[i]
              s.material.opacity = 0.85 + Math.sin(t * 1.5 + i) * 0.15
              s.scale.setScalar(2.5 + Math.sin(t * 1.5 + i) * 0.2)
            }
          }

          if (smoke && !reducedMotion) {
            const pos = smokeGeo.attributes.position.array
            for (let i = 0; i < smokeFillIdx; i++) {
              smokeData[i * 5 + 2] += dt
              const life = smokeData[i * 5 + 2]
              const lifeTotal = smokeData[i * 5 + 3]
              if (life >= lifeTotal) {
                smokeData[i * 5 + 2] = 0
                pos[i * 3]     = smokeData[i * 5]     + (Math.random() - 0.5) * 0.5
                pos[i * 3 + 1] = smokeData[i * 5 + 4]
                pos[i * 3 + 2] = smokeData[i * 5 + 1] + (Math.random() - 0.5) * 0.5
              } else {
                const phase = life / lifeTotal
                pos[i * 3 + 1] += dt * (1.5 + phase * 1.0)
                pos[i * 3]     += dt * Math.sin(t + i) * 0.3
                pos[i * 3 + 2] += dt * Math.cos(t + i) * 0.3
              }
            }
            smokeGeo.attributes.position.needsUpdate = true
          }

          if (weather && animRef.weatherEnabled && !reducedMotion) {
            const pos = weatherGeo.attributes.position.array
            const halfSpread = weatherSpread / 2
            for (let i = 0; i < weatherCount; i++) {
              weatherData[i * 4 + 3] += dt * 2
              const phase = weatherData[i * 4 + 3]
              pos[i * 3]     += dt * weatherData[i * 4]     + dt * Math.sin(phase) * 0.3
              pos[i * 3 + 1] += dt * weatherData[i * 4 + 1]
              pos[i * 3 + 2] += dt * weatherData[i * 4 + 2] + dt * Math.cos(phase) * 0.3
              if (pos[i * 3 + 1] < -1) {
                pos[i * 3]     = centerX + (Math.random() - 0.5) * weatherSpread
                pos[i * 3 + 1] = 50
                pos[i * 3 + 2] = centerZ + (Math.random() - 0.5) * weatherSpread
              }
              if (Math.abs(pos[i * 3] - centerX) > halfSpread) pos[i * 3] = centerX + (Math.random() - 0.5) * weatherSpread
              if (Math.abs(pos[i * 3 + 2] - centerZ) > halfSpread) pos[i * 3 + 2] = centerZ + (Math.random() - 0.5) * weatherSpread
            }
            weatherGeo.attributes.position.needsUpdate = true
          }

          for (let i = 0; i < towerGroups.length; i++) {
            const g = towerGroups[i]
            const target = (hoverRef.current.group === g) ? 1.06 : 1.0
            const cur = g.scale.x
            if (Math.abs(cur - target) > 0.001) {
              const next = lerp(cur, target, 0.15)
              g.scale.x = next
              g.scale.z = next
            }
          }

          if (!animRef.recordOrbit) controls.update()
          renderer.render(scene, camera)
        }
        animate()

        const io = new IntersectionObserver(([entry]) => {
          ioVisibleRef.current = entry.isIntersecting
          if (entry.isIntersecting && rafRef.current === 0 && tabVisibleRef.current) animate()
        }, { threshold: 0.05 })
        io.observe(renderer.domElement)

        const onVisibility = () => {
          tabVisibleRef.current = document.visibilityState !== 'hidden'
          if (tabVisibleRef.current && rafRef.current === 0 && ioVisibleRef.current) animate()
        }
        document.addEventListener('visibilitychange', onVisibility)

        const minimapBounds = {
          minX: -SPACING / 2, maxX: (COLS - 1) * SPACING + SPACING / 2,
          minZ: -SPACING / 2, maxZ: (rows - 1) * SPACING + SPACING / 2,
        }

        threeRef.current = {
          scene, camera, renderer, controls, onResize, onVisibility, io,
          floorGeo, crownGeo, windowGeo, windowMat, windowsMesh,
          starTex, roadTex, dotTex, smoke, smokeGeo, smokeMat,
          weather, weatherGeo, weatherMat, rafRef,
          cameraPresets: CAMERA_PRESETS, animRef,
          startCamAnim, startTimeAnim, startTimelapse, stopTimelapse, startFocusAnim,
          startRecordOrbit, stopRecordOrbit,
          applyFilter, setWeatherEnabled,
          minimapBounds, towerPositions,
          onPointerMove, onPointerLeave,
          THREE_MOD: THREE,
        }

        if (weather) weather.visible = weatherEnabled
        if (buildingFilter !== 'all') applyFilter(buildingFilter)
      } catch (e) {
        console.error('[VictoryCity] WebGL init error:', e)
        if (!disposed) setForceSvg(true)
      }
    })()

    return () => {
      disposed = true
      ioVisibleRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Гарантированный stop записи при unmount
      if (recorderRef.current) {
        try { recorderRef.current.stop() } catch {}
        recorderRef.current = null
      }
      if (threeRef.current) {
        const t = threeRef.current
        t.io?.disconnect()
        if (t.onVisibility) document.removeEventListener('visibilitychange', t.onVisibility)
        window.removeEventListener('resize', t.onResize)
        if (t.renderer?.domElement) {
          if (t.onPointerMove) t.renderer.domElement.removeEventListener('pointermove', t.onPointerMove)
          if (t.onPointerLeave) t.renderer.domElement.removeEventListener('pointerleave', t.onPointerLeave)
        }
        t.controls?.dispose()
        t.scene?.traverse(o => {
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
            else o.material.dispose()
          }
        })
        t.floorGeo?.dispose(); t.crownGeo?.dispose()
        t.windowGeo?.dispose(); t.windowMat?.dispose()
        t.starTex?.dispose(); t.roadTex?.dispose(); t.dotTex?.dispose()
        t.smokeGeo?.dispose(); t.smokeMat?.dispose()
        t.weatherGeo?.dispose(); t.weatherMat?.dispose()
        t.renderer?.dispose()
        if (t.renderer?.domElement?.parentNode) {
          t.renderer.domElement.parentNode.removeChild(t.renderer.domElement)
        }
        threeRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityData, webglOk, forceSvg])

  function applyCameraPreset(name) {
    const t = threeRef.current
    if (!t?.cameraPresets || !t?.startCamAnim) return
    const preset = t.cameraPresets[name]
    if (!preset) return
    setCurrentPreset(name)
    t.startCamAnim(preset.pos, preset.target, PRESET_MS)
    if (preset.autoRotate && !autoRotate) {
      setAutoRotate(true)
      if (t.animRef) t.animRef.autoRotate = true
    }
  }

  function toggleAutoRotate() {
    setAutoRotate(prev => {
      const next = !prev
      const t = threeRef.current
      if (t?.animRef && t?.controls) {
        t.animRef.autoRotate = next
        if (t.controls.enabled) t.controls.autoRotate = next
      }
      return next
    })
  }

  function applyTimeOfDay(name) {
    setTimeOfDay(name)
    const t = threeRef.current
    if (t?.startTimeAnim) t.startTimeAnim(name)
  }

  function handleTimelapse() {
    const t = threeRef.current
    if (!t) return
    if (isTimelapsing) t.stopTimelapse?.()
    else t.startTimelapse?.()
  }

  function handleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else containerRef.current?.requestFullscreen?.().catch(() => {})
  }

  function saveCurrentView() {
    const t = threeRef.current
    if (!t?.camera || !t?.controls) return
    if (savedViews.length >= MAX_SAVED_VIEWS) {
      setSnapshotMsg(en ? `Max ${MAX_SAVED_VIEWS} views` : `Максимум ${MAX_SAVED_VIEWS}`)
      setTimeout(() => setSnapshotMsg(null), 2000)
      return
    }
    const name = window.prompt(en ? 'Name this view:' : 'Название ракурса:', `View ${savedViews.length + 1}`)
    if (!name) return
    const view = {
      name: name.slice(0, 20),
      pos: [t.camera.position.x, t.camera.position.y, t.camera.position.z],
      target: [t.controls.target.x, t.controls.target.y, t.controls.target.z],
    }
    const next = [...savedViews, view]
    setSavedViews(next); persistSavedViews(next)
    setSnapshotMsg(en ? 'View saved!' : 'Сохранено!')
    setTimeout(() => setSnapshotMsg(null), 1500)
  }

  function loadView(view) {
    const t = threeRef.current
    if (!t?.startCamAnim || !t?.THREE_MOD) return
    const THREE = t.THREE_MOD
    t.startCamAnim(
      new THREE.Vector3(view.pos[0], view.pos[1], view.pos[2]),
      new THREE.Vector3(view.target[0], view.target[1], view.target[2]),
      PRESET_MS,
    )
    setCurrentPreset(null)
  }

  function deleteView(idx) {
    const next = savedViews.filter((_, i) => i !== idx)
    setSavedViews(next); persistSavedViews(next)
  }

  function downloadScreenshot() {
    const t = threeRef.current
    if (!t?.renderer || !t?.scene || !t?.camera) return
    t.renderer.render(t.scene, t.camera)
    const src = t.renderer.domElement
    const w = src.width, h = src.height
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    const filterMap = {
      original: 'none', vivid: 'saturate(1.4) contrast(1.1)',
      bw: 'grayscale(1) contrast(1.1)', sepia: 'sepia(0.8) contrast(1.05)',
    }
    ctx.filter = filterMap[shotFilter] || 'none'
    ctx.drawImage(src, 0, 0, w, h)
    ctx.filter = 'none'
    const profile = (() => {
      try { return JSON.parse(localStorage.getItem('stolbiki_profile') || '{}') } catch { return {} }
    })()
    const playerName = profile?.name || (en ? 'Player' : 'Игрок')
    const winsCount = stats?.total || 0
    const wmText = `Highrise Heist · ${playerName} · ${winsCount} ${en ? 'wins' : 'побед'}`
    const fontSize = Math.max(18, Math.round(w * 0.022))
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`
    const tm = ctx.measureText(wmText)
    const padX = fontSize * 0.7, padY = fontSize * 0.4
    const boxW = tm.width + padX * 2, boxH = fontSize + padY * 2
    const boxX = w - boxW - 20, boxY = h - boxH - 20
    ctx.fillStyle = 'rgba(10, 10, 24, 0.7)'
    ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 12); ctx.fill()
    const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY)
    grad.addColorStop(0, '#ffd86e'); grad.addColorStop(1, '#ff9020')
    ctx.fillStyle = grad
    ctx.fillText(wmText, boxX + padX, boxY + padY + fontSize * 0.85)

    canvas.toBlob((blob) => {
      if (!blob) return
      const filename = `highrise-heist-city-${Date.now()}.png`
      const file = new File([blob], filename, { type: 'image/png' })
      const shareText = en
        ? `My Victory City in Highrise Heist — ${winsCount} wins!`
        : `Мой Город побед в Highrise Heist — ${winsCount} побед!`
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        navigator.share({ text: shareText, files: [file] })
          .then(() => { setSnapshotMsg(en ? 'Shared!' : 'Отправлено!'); setTimeout(() => setSnapshotMsg(null), 2000) })
          .catch(() => {})
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
        setSnapshotMsg(en ? 'Downloaded!' : 'Скачано!'); setTimeout(() => setSnapshotMsg(null), 2000)
      }
      setShowShotMenu(false)
    }, 'image/png')
  }

  // ─── MP4-видео: 8-сек FPV-облёт через MediaRecorder + canvas.captureStream ───
  function recordVideo() {
    const t = threeRef.current
    if (!t?.renderer || !t?.startRecordOrbit || isRecording) return

    const mime = pickVideoMimeType()
    if (!mime || typeof MediaRecorder === 'undefined') {
      setSnapshotMsg(en ? 'Video not supported in this browser' : 'Запись видео не поддерживается')
      setTimeout(() => setSnapshotMsg(null), 3000)
      return
    }

    let stream
    try {
      stream = t.renderer.domElement.captureStream(VIDEO_FPS)
    } catch (e) {
      setSnapshotMsg(en ? 'Could not capture canvas' : 'Не удалось захватить canvas')
      setTimeout(() => setSnapshotMsg(null), 3000)
      return
    }

    let recorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: VIDEO_BITRATE,
      })
    } catch (e) {
      console.error('[VictoryCity] MediaRecorder failed:', e)
      setSnapshotMsg(en ? 'Recorder error' : 'Ошибка записи')
      setTimeout(() => setSnapshotMsg(null), 3000)
      return
    }

    recorderRef.current = recorder
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      try {
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunks, { type: mime })
        const filename = `highrise-heist-flythrough-${Date.now()}.${ext}`
        const file = new File([blob], filename, { type: mime })
        const shareText = en
          ? `Flythrough of my Victory City in Highrise Heist!`
          : `Облёт моего Города побед в Highrise Heist!`
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          navigator.share({ text: shareText, files: [file] })
            .then(() => { setSnapshotMsg(en ? 'Shared!' : 'Отправлено!'); setTimeout(() => setSnapshotMsg(null), 2000) })
            .catch(() => {})
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = filename; a.click()
          URL.revokeObjectURL(url)
          setSnapshotMsg(en ? `Downloaded! (${ext.toUpperCase()})` : `Скачано! (${ext.toUpperCase()})`)
          setTimeout(() => setSnapshotMsg(null), 3000)
        }
      } catch (e) {
        console.error('[VictoryCity] video save error:', e)
      } finally {
        recorderRef.current = null
        try { stream.getTracks().forEach(tr => tr.stop()) } catch {}
        const tt = threeRef.current
        if (tt?.stopRecordOrbit) tt.stopRecordOrbit()
        setIsRecording(false)
        setRecordProgress(0)
      }
    }

    // Начинаем орбиту и запись одновременно
    setIsRecording(true)
    setRecordProgress(0)
    setShowShotMenu(false)
    setHoverInfo(null)
    t.startRecordOrbit(VIDEO_DURATION_MS)
    recorder.start()

    // Прогресс UI обновляем каждые 100мс
    const progressStart = performance.now()
    const progressTimer = setInterval(() => {
      const elapsed = performance.now() - progressStart
      const p = Math.min(1, elapsed / VIDEO_DURATION_MS)
      setRecordProgress(p)
      if (p >= 1) clearInterval(progressTimer)
    }, 100)

    // Остановка точно через VIDEO_DURATION_MS
    setTimeout(() => {
      clearInterval(progressTimer)
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try { recorderRef.current.stop() } catch (e) { console.error(e) }
      }
    }, VIDEO_DURATION_MS + 100)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontSize: 13 }}>
      {en ? 'Loading city...' : 'Загружаю город...'}
    </div>
  )

  if (!cityData?.towers?.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🧱</div>
      <div style={{ fontSize: 14, color: 'var(--ink3)', maxWidth: 320, margin: '0 auto', lineHeight: 1.6, marginBottom: 16 }}>
        {en
          ? 'Win games to start building. 1 win = at least 1 brick. 11 bricks make a closed highrise!'
          : 'Побеждайте — каждая победа добавляет хотя бы 1 кирпич. 11 кирпичей закрывают высотку.'}
      </div>
      <button onClick={() => setShowHallOfFame(true)}
        style={{
          padding: '8px 16px', borderRadius: 8,
          background: 'var(--surface2)', color: 'var(--gold)',
          border: '1px solid rgba(255,193,69,0.3)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600,
          fontFamily: 'inherit',
        }}>
        🏆 {en ? 'See top cities' : 'Посмотреть топ городов'}
      </button>
      {showHallOfFame && (
        <Suspense fallback={null}>
          <HallOfFame onClose={() => setShowHallOfFame(false)} en={en} currentUserId={userId} />
        </Suspense>
      )}
    </div>
  )

  const towers = cityData.towers
  const selTower = selTowerIdx != null ? towers[selTowerIdx] : null
  const useFallback = !webglOk || forceSvg

  const CAMERA_PRESETS_UI = [
    { id: 'iso', emoji: '📐', label_ru: 'Изо', label_en: 'Iso' },
    { id: 'top', emoji: '🚁', label_ru: 'Сверху', label_en: 'Top' },
    { id: 'cinematic', emoji: '🎬', label_ru: 'Кино', label_en: 'Cine' },
    { id: 'fpv', emoji: '🛸', label_ru: 'Облёт', label_en: 'FPV' },
  ]
  const TIME_PRESETS_UI = [
    { id: 'night',   emoji: '🌙', label_ru: 'Ночь',  label_en: 'Night' },
    { id: 'morning', emoji: '🌅', label_ru: 'Утро',  label_en: 'Morn' },
    { id: 'day',     emoji: '☀️', label_ru: 'День',  label_en: 'Day' },
    { id: 'sunset',  emoji: '🌇', label_ru: 'Закат', label_en: 'Dusk' },
  ]
  const FILTERS_UI = [
    { id: 'original', label_ru: 'Ориг',  label_en: 'Orig' },
    { id: 'vivid',    label_ru: 'Vivid', label_en: 'Vivid' },
    { id: 'bw',       label_ru: 'Ч/Б',   label_en: 'B&W' },
    { id: 'sepia',    label_ru: 'Сепия', label_en: 'Sepia' },
  ]
  const BUILDING_FILTERS_UI = [
    { id: 'all',        label_ru: 'Все',          label_en: 'All',     emoji: '🏙' },
    { id: 'golden',     label_ru: 'С короной',    label_en: 'Crowned', emoji: '★' },
    { id: 'impossible', label_ru: 'С Impossible', label_en: 'Imposs.', emoji: '⚡' },
    { id: 'week',       label_ru: 'За неделю',    label_en: 'Week',    emoji: '🗓' },
  ]
  const seasonEmoji = { winter: '❄️', spring: '🌧', autumn: '🍂', summer: null }[season]
  const seasonLabel = {
    winter: en ? 'Snow' : 'Снег', spring: en ? 'Rain' : 'Дождь',
    autumn: en ? 'Leaves' : 'Листья', summer: null,
  }[season]

  const minimapData = (() => {
    if (!showMinimap || useFallback) return null
    const t = threeRef.current
    if (!t?.minimapBounds || !t?.towerPositions) return null
    const { minX, maxX, minZ, maxZ } = t.minimapBounds
    const w = maxX - minX, h = maxZ - minZ
    const padding = 6, svgSize = 100
    const dots = []
    t.towerPositions.forEach((p, idx) => {
      const sx = padding + ((p.x - minX) / w) * (svgSize - padding * 2)
      const sy = padding + ((p.z - minZ) / h) * (svgSize - padding * 2)
      const tower = towers[idx]
      const isFiltered = buildingFilter !== 'all' && !towerMatchesFilter(tower, buildingFilter)
      let color = '#4a9eff'
      if (p.goldenTop) color = '#ffd86e'
      else if (!p.isClosed) color = '#9b59b6'
      dots.push({ idx, x: sx, y: sy, color, dim: isFiltered })
    })
    return { svgSize, dots }
  })()

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          [cityData.total_wins,    en ? 'Wins'      : 'Побед',     'var(--green)'],
          [cityData.total_bricks,  en ? 'Bricks'    : 'Кирпичей',  'var(--accent)'],
          [towers.filter(t => t.is_closed).length, en ? 'Closed' : 'Высоток',  'var(--ink)'],
          [towers.filter(t => t.golden_top).length, '★ ' + (en ? 'Crowned' : 'С короной'), 'var(--gold)'],
        ].map(([v, l, c]) => (
          <div key={l} style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--surface2)', borderRadius: 8, minWidth: 60 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{l}</div>
          </div>
        ))}
      </div>

      {cityData.next_tower_progress > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 11, color: 'var(--ink3)' }}>
          {en ? 'Next highrise: ' : 'Следующая высотка: '}
          <strong style={{ color: 'var(--accent)' }}>{cityData.next_tower_progress}/{TOWER_HEIGHT}</strong>
          <span> {en ? 'bricks laid' : 'кирпичей'}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap', fontSize: 10, color: 'var(--ink3)' }}>
        <div><span style={{ color: 'var(--accent)' }}>■</span> {en ? 'Regular brick' : 'Обычный кирпич'}</div>
        <div><span style={{ color: 'var(--gold)' }}>■</span> {en ? 'Special (Imposs/Golden)' : 'Особый (Imp/Золотая)'}</div>
        <div><span style={{ color: 'var(--gold)' }}>★</span> {en ? 'Crowned tower' : 'Высотка с короной'}</div>
      </div>

      {useFallback ? (
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontSize: 12 }}>
            {en ? 'Loading 2D view…' : 'Загрузка 2D-вида…'}
          </div>
        }>
          <VictoryCity2D towers={towers} stats={stats} en={en} />
        </Suspense>
      ) : (
        <div
          ref={containerRef}
          style={{
            background: 'linear-gradient(180deg, #06060f 0%, #0a0a18 100%)',
            borderRadius: isFullscreen ? 0 : 12,
            border: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden', minHeight: 320, position: 'relative',
          }}
        >
          {hoverInfo && !isTimelapsing && !isRecording && (
            <div style={{
              position: 'absolute', left: hoverInfo.x + 14, top: hoverInfo.y + 14,
              pointerEvents: 'none',
              background: 'rgba(10,10,24,0.92)',
              border: `1px solid ${hoverInfo.goldenTop ? 'var(--gold)' : 'var(--accent)'}`,
              borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--ink)',
              minWidth: 160, boxShadow: '0 6px 24px rgba(0,0,0,0.6)', zIndex: 5,
            }}>
              <div style={{ fontWeight: 700, color: hoverInfo.goldenTop ? 'var(--gold)' : 'var(--ink)', marginBottom: 3 }}>
                {hoverInfo.goldenTop && '★ '}{en ? 'Tower' : 'Высотка'} #{hoverInfo.towerIdx + 1}
                {' '}<span style={{ color: 'var(--ink3)', fontWeight: 400 }}>{hoverInfo.height}/{TOWER_HEIGHT}</span>
              </div>
              <div style={{ color: 'var(--ink3)', fontSize: 10 }}>
                {hoverInfo.isClosed ? (en ? 'Closed' : 'Закрыта') : (en ? 'Building...' : 'Строится...')}
                {' · '}{hoverInfo.sourceWins} {en ? 'wins' : 'побед'}
              </div>
              {hoverInfo.periodFrom && (
                <div style={{ color: 'var(--ink3)', fontSize: 10, marginTop: 2 }}>
                  {new Date(hoverInfo.periodFrom * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
                  {hoverInfo.periodTo !== hoverInfo.periodFrom && ' — ' +
                    new Date(hoverInfo.periodTo * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
                </div>
              )}
              {hoverInfo.piece && (
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: 'var(--ink2)' }}>
                  {en ? 'Brick' : 'Кирпич'}: vs {hoverInfo.piece.opponent || (en ? 'Player' : 'Игрок')}
                  {hoverInfo.piece.is_ai && hoverInfo.piece.ai_difficulty && ` (${getDiffLabel(hoverInfo.piece.ai_difficulty, en)})`}
                  {hoverInfo.piece.special && <span style={{ color: 'var(--gold)' }}> ★</span>}
                </div>
              )}
            </div>
          )}

          {isTimelapsing && timelapseDate && (
            <div style={{
              position: 'absolute', top: 16, left: 16,
              background: 'rgba(10,10,24,0.85)', border: '1px solid var(--gold)',
              borderRadius: 10, padding: '10px 16px', color: 'var(--gold)',
              fontSize: 14, fontWeight: 700, fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 6px 24px rgba(0,0,0,0.6)', zIndex: 5,
            }}>
              {new Date(timelapseDate * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}

          {/* REC indicator во время записи */}
          {isRecording && (
            <div style={{
              position: 'absolute', top: 16, left: 16,
              background: 'rgba(10,10,24,0.85)', border: '1px solid #ff5050',
              borderRadius: 10, padding: '8px 14px', display: 'flex',
              alignItems: 'center', gap: 10, zIndex: 5,
              boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: '#ff5050',
                animation: 'pulse 1s ease-in-out infinite',
              }}></span>
              <span style={{ color: '#ff8080', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui' }}>
                REC {Math.ceil((1 - recordProgress) * VIDEO_DURATION_MS / 1000)}s
              </span>
              {/* Прогресс-бар */}
              <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${recordProgress * 100}%`, height: '100%',
                  background: '#ff5050', transition: 'width 0.1s linear',
                }}></div>
              </div>
            </div>
          )}

          {isFullscreen && (
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(10,10,24,0.85)', borderRadius: 8, padding: '6px 10px',
              fontSize: 11, color: 'var(--ink3)', zIndex: 5,
            }}>{en ? 'Press ESC to exit' : 'ESC чтобы выйти'}</div>
          )}

          {minimapData && !isTimelapsing && !isRecording && towers.length >= 4 && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              width: 100, height: 100, background: 'rgba(10,10,24,0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, overflow: 'hidden', zIndex: 5,
            }}>
              <svg viewBox={`0 0 ${minimapData.svgSize} ${minimapData.svgSize}`} width="100" height="100">
                {minimapData.dots.map(d => (
                  <rect key={d.idx} x={d.x - 2.5} y={d.y - 2.5} width={5} height={5} rx={1}
                    fill={d.color} opacity={d.dim ? 0.2 : 0.95}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const t = threeRef.current
                      if (t?.startFocusAnim) { t.startFocusAnim(d.idx); setSelTowerIdx(d.idx) }
                    }}
                  />
                ))}
              </svg>
              <button onClick={() => setShowMinimap(false)}
                style={{
                  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 4,
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--ink3)',
                  cursor: 'pointer', fontSize: 10, padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} aria-label="hide minimap">×</button>
            </div>
          )}
          {!showMinimap && !useFallback && towers.length >= 4 && (
            <button onClick={() => setShowMinimap(true)}
              style={{
                position: 'absolute', bottom: 12, right: 12,
                background: 'rgba(10,10,24,0.7)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '4px 8px', fontSize: 11,
                color: 'var(--ink3)', cursor: 'pointer', zIndex: 5,
              }}>🗺</button>
          )}
        </div>
      )}

      {/* Photo Mode buttons */}
      {!useFallback && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            {CAMERA_PRESETS_UI.map(p => {
              const active = currentPreset === p.id
              return (
                <button key={p.id} onClick={() => applyCameraPreset(p.id)} disabled={isTimelapsing || isRecording}
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 6,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                    cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
                    opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontWeight: active ? 700 : 500,
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                  }} aria-pressed={active}>
                  <span>{p.emoji}</span><span>{en ? p.label_en : p.label_ru}</span>
                </button>
              )
            })}
          </div>

          <button onClick={toggleAutoRotate} disabled={isTimelapsing || isRecording}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: autoRotate ? 'rgba(61,214,140,0.15)' : 'var(--surface2)',
              color: autoRotate ? 'var(--green)' : 'var(--ink3)',
              border: `1px solid ${autoRotate ? 'var(--green)' : 'rgba(255,255,255,0.05)'}`,
              cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
              opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }} aria-pressed={autoRotate}>
            <span>🔄</span><span>{en ? 'Rotate' : 'Авто'}</span>
          </button>

          <button onClick={handleTimelapse} disabled={isRecording}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: isTimelapsing ? 'rgba(255,193,69,0.18)' : 'var(--surface2)',
              color: isTimelapsing ? 'var(--gold)' : 'var(--ink3)',
              border: `1px solid ${isTimelapsing ? 'var(--gold)' : 'rgba(255,255,255,0.05)'}`,
              cursor: isRecording ? 'default' : 'pointer',
              opacity: isRecording ? 0.5 : 1,
              fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>{isTimelapsing ? '⏹' : '⏯'}</span>
            <span>{isTimelapsing ? (en ? 'Stop' : 'Стоп') : (en ? 'Time-lapse' : 'История')}</span>
          </button>

          <button onClick={handleFullscreen} disabled={isRecording}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: 'var(--surface2)', color: 'var(--ink3)',
              border: '1px solid rgba(255,255,255,0.05)',
              cursor: isRecording ? 'default' : 'pointer',
              opacity: isRecording ? 0.5 : 1,
              fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>{isFullscreen ? '🗗' : '⛶'}</span>
            <span>{isFullscreen ? (en ? 'Exit' : 'Свернуть') : (en ? 'Full' : 'Полный')}</span>
          </button>

          {seasonEmoji && (
            <button onClick={() => setWeatherEnabled(v => !v)} disabled={isTimelapsing || isRecording}
              style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 8,
                background: weatherEnabled ? 'rgba(74,158,255,0.15)' : 'var(--surface2)',
                color: weatherEnabled ? 'var(--accent)' : 'var(--ink3)',
                border: `1px solid ${weatherEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`,
                cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
                opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }} aria-pressed={weatherEnabled}>
              <span>{seasonEmoji}</span><span>{seasonLabel}</span>
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowFilterMenu(s => !s)} disabled={isTimelapsing || isRecording}
              style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 8,
                background: buildingFilter !== 'all' ? 'rgba(155,89,182,0.15)' : (showFilterMenu ? 'rgba(255,255,255,0.05)' : 'var(--surface2)'),
                color: buildingFilter !== 'all' ? '#cf9cff' : 'var(--ink3)',
                border: `1px solid ${buildingFilter !== 'all' ? '#9b59b6' : 'rgba(255,255,255,0.05)'}`,
                cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
                opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <span>🔍</span><span>{en ? 'Filter' : 'Фильтр'}</span>
            </button>
            {showFilterMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: 6, minWidth: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 10,
              }}>
                {BUILDING_FILTERS_UI.map(f => {
                  const active = buildingFilter === f.id
                  return (
                    <button key={f.id}
                      onClick={() => { setBuildingFilter(f.id); setShowFilterMenu(false) }}
                      style={{
                        width: '100%', padding: '7px 10px', borderRadius: 6,
                        background: active ? 'var(--accent)' : 'transparent',
                        color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                        cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: 12,
                        fontFamily: 'inherit', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                      }}>
                      <span style={{ width: 16 }}>{f.emoji}</span>
                      <span>{en ? f.label_en : f.label_ru}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowShotMenu(s => !s)} disabled={isRecording}
              style={{
                fontSize: 11, padding: '6px 12px', borderRadius: 8,
                border: '1px solid var(--accent)',
                background: showShotMenu ? 'rgba(74,158,255,0.15)' : 'transparent',
                color: 'var(--accent)',
                cursor: isRecording ? 'default' : 'pointer',
                opacity: isRecording ? 0.5 : 1,
                fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <span>📸</span><span>{en ? 'Snapshot' : 'Снимок'}</span>
            </button>
            {showShotMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: 8, minWidth: 220,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 10,
              }}>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 6, padding: '0 4px' }}>
                  {en ? 'Filter' : 'Фильтр'}
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                  {FILTERS_UI.map(f => {
                    const active = shotFilter === f.id
                    return (
                      <button key={f.id} onClick={() => setShotFilter(f.id)}
                        style={{
                          fontSize: 11, padding: '5px 10px', borderRadius: 6,
                          background: active ? 'var(--accent)' : 'var(--surface2)',
                          color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                          cursor: 'pointer', fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                        }}>{en ? f.label_en : f.label_ru}</button>
                    )
                  })}
                </div>
                <button onClick={downloadScreenshot}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--accent)', color: '#0a0a12', border: 'none',
                    cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                    marginBottom: 6,
                  }}>📷 {en ? 'Save photo' : 'Сохранить фото'}</button>
                <button onClick={recordVideo}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'linear-gradient(90deg, #ff5050 0%, #ff7060 100%)', color: '#fff', border: 'none',
                    cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                  }}>🎥 {en ? 'Record 8s flythrough' : 'Записать 8с облёт'}</button>
              </div>
            )}
          </div>

          {/* Hall of Fame button */}
          <button onClick={() => setShowHallOfFame(true)} disabled={isRecording}
            style={{
              fontSize: 11, padding: '6px 12px', borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(255,193,69,0.15) 0%, rgba(255,140,40,0.15) 100%)',
              color: 'var(--gold)',
              border: '1px solid rgba(255,193,69,0.4)',
              cursor: isRecording ? 'default' : 'pointer',
              opacity: isRecording ? 0.5 : 1,
              fontWeight: 700, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>🏆</span><span>{en ? 'Top' : 'Топ'}</span>
          </button>

          {snapshotMsg && (
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{snapshotMsg}</span>
          )}
        </div>
      )}

      {/* Saved views */}
      {!useFallback && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {savedViews.map((v, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', background: 'var(--surface2)',
              borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden',
            }}>
              <button onClick={() => loadView(v)} disabled={isTimelapsing || isRecording}
                style={{
                  fontSize: 11, padding: '5px 10px', background: 'transparent',
                  color: 'var(--ink2)', border: 'none',
                  cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
                  opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontFamily: 'inherit', fontWeight: 500,
                }}>📍 {v.name}</button>
              <button onClick={() => deleteView(i)} disabled={isRecording}
                style={{
                  fontSize: 12, padding: '5px 8px', background: 'transparent',
                  color: 'var(--ink3)', border: 'none',
                  borderLeft: '1px solid rgba(255,255,255,0.05)',
                  cursor: isRecording ? 'default' : 'pointer', fontFamily: 'inherit',
                  opacity: isRecording ? 0.5 : 1,
                }} aria-label="delete view">×</button>
            </div>
          ))}
          {savedViews.length < MAX_SAVED_VIEWS && (
            <button onClick={saveCurrentView} disabled={isTimelapsing || isRecording}
              style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 6,
                background: 'transparent', color: 'var(--ink3)',
                border: '1px dashed rgba(255,255,255,0.15)',
                cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
                opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontFamily: 'inherit', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <span>+</span><span>{en ? 'Save view' : 'Сохранить ракурс'}</span>
            </button>
          )}
        </div>
      )}

      {!useFallback && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            {TIME_PRESETS_UI.map(p => {
              const active = timeOfDay === p.id
              return (
                <button key={p.id} onClick={() => applyTimeOfDay(p.id)} disabled={isTimelapsing || isRecording}
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 6,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                    cursor: (isTimelapsing || isRecording) ? 'default' : 'pointer',
                    opacity: (isTimelapsing || isRecording) ? 0.5 : 1, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }} aria-pressed={active}>
                  <span>{p.emoji}</span><span>{en ? p.label_en : p.label_ru}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selTower && (() => {
        const wins = uniqueWinsInTower(selTower)
        return (
          <div style={{
            marginTop: 10, padding: '14px 16px',
            background: 'var(--surface)', borderRadius: 10,
            border: '1px solid rgba(255,193,69,0.22)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: selTower.golden_top ? 'var(--gold)' : 'var(--ink)' }}>
                  {selTower.golden_top ? '★ ' : '🏢 '}
                  {en ? 'Highrise' : 'Высотка'} #{selTowerIdx + 1} <span style={{ color: 'var(--ink3)', fontSize: 12, fontWeight: 400 }}>({selTower.height}/{TOWER_HEIGHT})</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                  {selTower.is_closed
                    ? (en ? 'Closed' : 'Закрыта') + (selTower.golden_top ? ' · ' + (en ? 'Crowned' : 'С короной') : '')
                    : (en ? `Building... ${TOWER_HEIGHT - selTower.height} bricks to go` : `Строится... ещё ${TOWER_HEIGHT - selTower.height} кирпичей`)}
                </div>
              </div>
              <button onClick={() => setSelTowerIdx(null)}
                style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
              {en ? 'Built from' : 'Построено из'} <strong style={{ color: 'var(--accent)' }}>{wins.length}</strong> {en ? 'wins' : 'побед'}
              {' · '}{new Date(selTower.period_from * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
              {selTower.period_to !== selTower.period_from && ' — ' +
                new Date(selTower.period_to * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
              {wins.map(w => (
                <div key={w.source_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11,
                }}>
                  <div>
                    <span style={{ color: 'var(--ink)' }}>vs {w.opponent || (w.is_ai ? 'Snappy' : (en ? 'Player' : 'Игрок'))}</span>
                    {w.golden && <span style={{ color: 'var(--gold)', marginLeft: 4 }}>★</span>}
                    {w.is_ai && w.ai_difficulty && (
                      <span style={{ color: 'var(--ink3)', marginLeft: 6, fontSize: 10 }}>
                        {getDiffLabel(w.ai_difficulty, en)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{w.bricks}🧱</span>
                    <span style={{ color: 'var(--ink3)', fontSize: 10 }}>
                      {new Date(w.date * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', marginTop: 8, opacity: 0.6 }}>
        {useFallback
          ? (en ? 'Scroll to zoom · Drag to pan · Tap a building for details' : 'Колёсико — зум · Тащи — пан · Тап — детали')
          : (en ? 'Drag to rotate · Pinch/scroll to zoom · Hover for info · Tap a tower for wins list'
                : 'Тащи — вращай · Щипок/колёсико — зум · Наведи — инфо · Тап — список побед')}
      </div>

      {/* Hall of Fame модалка */}
      {showHallOfFame && (
        <Suspense fallback={null}>
          <HallOfFame onClose={() => setShowHallOfFame(false)} en={en} currentUserId={userId} />
        </Suspense>
      )}

      {/* Inline keyframes для REC pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
