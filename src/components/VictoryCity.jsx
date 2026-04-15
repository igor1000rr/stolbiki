/**
 * VictoryCity — Three.js 3D «Город побед»
 *
 * Каждая победа = здание. Цвет этажей = цвет скина игрока на момент победы.
 * Высота здания = реальные блоки + бонусные шпили за сложность AI.
 *
 * Управление: OrbitControls — drag/pinch для вращения, зум колёсиком.
 * Клик по зданию → плавный zoom + модалка с деталями.
 * Hover → подсветка здания + tooltip с именем соперника.
 *
 * Режимы:
 *  - Intro: камера приземляется сверху на изометрический ракурс (1.8с)
 *  - Grow: каскадное появление зданий из земли при первом рендере
 *  - Photo Mode: 3 пресета камеры (Iso, Top, Cinematic) + автоповорот
 *  - Day/Night: 4 пресета времени суток с плавным переходом всех параметров
 *    освещения. Окна зажигаются ночью.
 *  - Time-lapse: проигрывает постройку города по хронологии побед
 *  - Fullscreen: на весь экран
 *  - Snapshot: PNG / Web Share API + фильтры (Vivid/B&W/Sepia) + watermark
 *
 * Декорации:
 *  - Дороги между рядами и колонками с разметкой
 *  - Звёздное небо (opacity по timeOfDay)
 *  - Окна на гранях каждого этажа (InstancedMesh, fade с закатом)
 *  - ★ Sprite над «золотыми» победами
 *
 * Performance:
 *  - rafRef мутабельный объект — корректный cancel на cleanup
 *  - Шпили и окна кэшируются массивами, без traverse() per frame
 *  - IntersectionObserver — пауза вне viewport
 *  - document.visibilityState — пауза при свёрнутой вкладке
 *  - prefers-reduced-motion — отключает autoRotate и пульсации
 *
 * Fallback: при отсутствии WebGL подгружается VictoryCity2D (SVG 2.5D).
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useI18n } from '../engine/i18n'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))

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

const SPIRE_HEX = { 1: 0xd4a017, 2: 0xe8b830, 3: 0xffc845, 4: 0xffe080 }
const GOLDEN_HEX = 0xffd86e

function getDiffBonus(d) {
  if (!d) return 0
  d = typeof d === 'number' ? d : parseInt(d, 10) || 0
  if (d >= 1500) return 4
  if (d >= 800)  return 3
  if (d >= 400)  return 2
  if (d >= 150)  return 1
  return 0
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

function getChips(b) {
  const snap = b.stands_snapshot || []
  const closed = snap.filter(s => s.owner !== null && Array.isArray(s.chips) && s.chips.length)
  if (!closed.length) return []
  return closed.reduce((a, b) => b.chips.length > a.chips.length ? b : a).chips
}

function getFloorColor(skinId, chipColor) {
  const pal = SKIN_HEX[skinId] || SKIN_HEX.blocks_classic
  return pal[chipColor] ?? pal[0]
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

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function lerp(a, b, t) { return a + (b - a) * t }

const COLS = 5
const SPACING = 6
const FLOOR_H = 1.2
const BLOCK_W = 3
const SPIRE_W = 2.5
const INTRO_MS = 1800
const FOCUS_MS = 700
const PRESET_MS = 900
const GROW_MS = 500
const GROW_STAGGER = 60
const GROW_START_AT = 0.5
const TIME_MS = 800
const TIMELAPSE_STAGGER = 200    // мс между запуском роста соседних зданий
const TIMELAPSE_GROW_MS = 400    // длительность роста одного здания

// Пресеты времени суток — добавлено windowGlow для подсветки окон
const TIME_PRESETS = {
  night: {
    bg: 0x0a0a18, fogColor: 0x0a0a18, fogNear: 50, fogFar: 200,
    sunColor: 0xfff0c8, sunIntensity: 1.1, sunPosOffset: [25, 40, 15],
    ambientColor: 0x8080c0, ambientIntensity: 0.45,
    starsOpacity: 0.7, exposure: 1.1, windowGlow: 0.95,
  },
  morning: {
    bg: 0x7fa8cc, fogColor: 0x9ec0dc, fogNear: 70, fogFar: 260,
    sunColor: 0xfff0d0, sunIntensity: 1.0, sunPosOffset: [-30, 18, 10],
    ambientColor: 0xb0c8e0, ambientIntensity: 0.55,
    starsOpacity: 0.05, exposure: 1.15, windowGlow: 0.05,
  },
  day: {
    bg: 0x5ba7d9, fogColor: 0x8ec6ea, fogNear: 90, fogFar: 320,
    sunColor: 0xffffff, sunIntensity: 1.4, sunPosOffset: [20, 60, 15],
    ambientColor: 0xc0d8e8, ambientIntensity: 0.65,
    starsOpacity: 0, exposure: 1.25, windowGlow: 0,
  },
  sunset: {
    bg: 0x3a1a2e, fogColor: 0x6a3a4a, fogNear: 55, fogFar: 220,
    sunColor: 0xff8040, sunIntensity: 0.95, sunPosOffset: [40, 8, 15],
    ambientColor: 0xc06080, ambientIntensity: 0.4,
    starsOpacity: 0.25, exposure: 1.15, windowGlow: 0.6,
  },
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

// Текстура звезды для золотых зданий — рисуется один раз
function makeStarTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const ctx = c.getContext('2d')
  // halo
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60)
  grad.addColorStop(0, 'rgba(255,240,160,0.9)')
  grad.addColorStop(0.5, 'rgba(255,200,80,0.4)')
  grad.addColorStop(1, 'rgba(255,180,40,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  // звезда
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

// Текстура разметки дороги — белые штрихи на тёмном асфальте
function makeRoadTexture(THREE) {
  const c = document.createElement('canvas')
  c.width = 16; c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1a1a26'
  ctx.fillRect(0, 0, 16, 256)
  ctx.fillStyle = '#a0a0c0'
  // пунктир по центру
  for (let y = 20; y < 256; y += 40) {
    ctx.fillRect(7, y, 2, 20)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

export default function VictoryCity({ userId }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [selId, setSelId] = useState(null)
  const [webglOk] = useState(() => hasWebGL())
  const [forceSvg, setForceSvg] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState(null)
  const [currentPreset, setCurrentPreset] = useState('iso')
  const [autoRotate, setAutoRotate] = useState(false)
  const [timeOfDay, setTimeOfDay] = useState('night')
  // Новые состояния
  const [hoverInfo, setHoverInfo] = useState(null)         // {x, y, name, date, floors, golden}
  const [isTimelapsing, setIsTimelapsing] = useState(false)
  const [timelapseDate, setTimelapseDate] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shotFilter, setShotFilter] = useState('original') // original|vivid|bw|sepia
  const [showShotMenu, setShowShotMenu] = useState(false)

  const containerRef = useRef(null)
  const threeRef = useRef(null)

  // Fetch data
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.all([
      fetch(`/api/buildings/${userId}?limit=60`).then(r => r.json()),
      fetch(`/api/buildings/stats/${userId}`).then(r => r.json()),
    ])
      .then(([d, s]) => { setBuildings(d.buildings || []); setStats(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // ─── Fullscreen change listener ───
  useEffect(() => {
    const onFs = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      // Триггер resize для пересчёта размеров canvas
      const t = threeRef.current
      if (t?.onResize) {
        // Дать браузеру применить fullscreen layout
        setTimeout(() => t.onResize(), 50)
      }
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Init three.js
  useEffect(() => {
    if (!webglOk || forceSvg) return
    if (!containerRef.current || !buildings.length) return

    let disposed = false
    const reducedMotion = prefersReducedMotion()
    const rafRef = { current: 0 }
    const ioVisibleRef = { current: true }
    const tabVisibleRef = { current: typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true }
    // hoverRef живёт в animate loop, обновляется из pointermove
    const hoverRef = { current: { id: null, group: null } }

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

        const rows = Math.max(1, Math.ceil(buildings.length / COLS))
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
          antialias: true, alpha: false, powerPreference: 'default',
          preserveDrawingBuffer: true,
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(w, h)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1
        container.appendChild(renderer.domElement)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.borderRadius = '12px'
        renderer.domElement.style.touchAction = 'none'

        // Освещение
        const ambient = new THREE.AmbientLight(0x8080c0, 0.45)
        scene.add(ambient)

        const sun = new THREE.DirectionalLight(0xfff0c8, 1.1)
        sun.position.set(centerX + 25, 40, centerZ + 15)
        sun.target.position.set(centerX, 0, centerZ)
        sun.castShadow = true
        sun.shadow.mapSize.set(1024, 1024)
        sun.shadow.camera.left = -50
        sun.shadow.camera.right = 50
        sun.shadow.camera.top = 50
        sun.shadow.camera.bottom = -50
        sun.shadow.camera.near = 1
        sun.shadow.camera.far = 100
        sun.shadow.bias = -0.0003
        scene.add(sun)
        scene.add(sun.target)

        const rim = new THREE.DirectionalLight(0x6050a0, 0.4)
        rim.position.set(centerX - 20, 15, centerZ - 20)
        scene.add(rim)

        // Земля
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({ color: 0x0d0d22, roughness: 0.85, metalness: 0.1 }),
        )
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        scene.add(ground)

        // ─── Дороги (заменяют GridHelper) ───
        const roadTex = makeRoadTexture(THREE)
        const roadMat = new THREE.MeshStandardMaterial({
          map: roadTex, color: 0x222230, roughness: 0.95, metalness: 0,
        })
        const roadsGroup = new THREE.Group()
        const roadW = 2.6
        const roadLen = Math.max(rows, COLS) * SPACING + SPACING * 2
        // горизонтальные дороги между рядами
        for (let r = -1; r < rows; r++) {
          const z = r * SPACING + SPACING / 2
          const m = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, roadW), roadMat.clone())
          m.material.map = roadTex.clone()
          m.material.map.repeat.set(roadLen / 4, 1)
          m.material.map.needsUpdate = true
          m.material.needsUpdate = true
          m.rotation.x = -Math.PI / 2
          m.rotation.z = Math.PI / 2
          m.position.set(centerX, 0.005, z)
          m.receiveShadow = true
          roadsGroup.add(m)
        }
        // вертикальные дороги между колонками
        for (let c = -1; c < COLS; c++) {
          const x = c * SPACING + SPACING / 2
          const m = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, roadW), roadMat.clone())
          m.material.map = roadTex.clone()
          m.material.map.repeat.set(roadLen / 4, 1)
          m.material.map.needsUpdate = true
          m.material.needsUpdate = true
          m.rotation.x = -Math.PI / 2
          m.position.set(x, 0.005, centerZ)
          m.receiveShadow = true
          roadsGroup.add(m)
        }
        scene.add(roadsGroup)

        // Звёздный купол
        const starGeo = new THREE.BufferGeometry()
        const starPositions = new Float32Array(400 * 3)
        for (let i = 0; i < 400; i++) {
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

        // Группа всех зданий
        const cityGroup = new THREE.Group()
        scene.add(cityGroup)

        const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W)
        const spireGeo = new THREE.BoxGeometry(SPIRE_W, FLOOR_H, SPIRE_W)

        const buildingPositions = new Map()
        const spireMeshes = []
        const goldenSprites = []                  // звёзды над golden зданиями
        const buildingGroups = []                 // для timelapse и hover

        // ─── Окна: заранее посчитаем сколько instance нужно ───
        // 4 окна на этаж × сумма этажей всех зданий
        let totalFloors = 0
        for (const b of buildings) {
          const chips = getChips(b)
          if (!chips.length) continue
          totalFloors += chips.length
        }
        const windowsPerFloor = 4
        const totalWindows = totalFloors * windowsPerFloor
        const windowGeo = new THREE.PlaneGeometry(0.55, 0.55)
        const windowMat = new THREE.MeshBasicMaterial({
          color: 0xffe49a,
          transparent: true,
          opacity: 0,                              // сначала выкл, включаются по timeOfDay
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const windowsMesh = totalWindows > 0
          ? new THREE.InstancedMesh(windowGeo, windowMat, totalWindows)
          : null
        if (windowsMesh) {
          windowsMesh.frustumCulled = false      // здания двигаются (grow scale.y), instance bbox не пересчитывается
          windowsMesh.matrixAutoUpdate = false
          scene.add(windowsMesh)
        }
        let windowIdx = 0
        const tmpMat = new THREE.Matrix4()
        const tmpQuat = new THREE.Quaternion()
        const tmpEul = new THREE.Euler()
        const tmpVec = new THREE.Vector3()
        const tmpScale = new THREE.Vector3(1, 1, 1)

        const starTex = goldenSprites && makeStarTexture(THREE)

        buildings.forEach((b, idx) => {
          const chips = getChips(b)
          if (!chips.length) return

          const col = idx % COLS
          const row = Math.floor(idx / COLS)
          const extraFloors = b.is_ai ? getDiffBonus(b.ai_difficulty) : 0
          const skinId = b.player_skin_id || 'blocks_classic'
          const golden = b.result === 'draw_won'
          const emissiveIntensity = SKIN_EMISSIVE[skinId] || 0

          const bGroup = new THREE.Group()
          const bx = col * SPACING
          const bz = row * SPACING
          bGroup.position.set(bx, 0, bz)
          bGroup.userData.buildingId = b.id
          bGroup.userData.idx = idx
          bGroup.userData.created_at = b.created_at || 0
          bGroup.scale.y = 0
          bGroup.userData.growDelay = idx * GROW_STAGGER
          bGroup.userData.targetScaleXZ = 1     // для hover lerp
          buildingPositions.set(b.id, { x: bx, z: bz, height: (chips.length + extraFloors) * FLOOR_H })

          chips.forEach((c, i) => {
            const isTop = i === chips.length - 1 && extraFloors === 0
            const colorHex = (isTop && golden) ? GOLDEN_HEX : getFloorColor(skinId, c)
            const mat = new THREE.MeshStandardMaterial({
              color: colorHex,
              roughness: skinId === 'blocks_metal' ? 0.3 : 0.55,
              metalness: skinId === 'blocks_metal' ? 0.7 : 0.15,
              emissive: colorHex,
              emissiveIntensity,
            })
            const mesh = new THREE.Mesh(floorGeo, mat)
            mesh.position.y = FLOOR_H / 2 + i * FLOOR_H
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.userData.buildingId = b.id
            bGroup.add(mesh)

            // ─── Окна на 4 гранях этажа ───
            if (windowsMesh) {
              const fy = FLOOR_H / 2 + i * FLOOR_H
              const half = BLOCK_W / 2 + 0.01
              // 4 грани: front, back, right, left
              const faces = [
                { x: 0, z: half, ry: 0 },
                { x: 0, z: -half, ry: Math.PI },
                { x: half, z: 0, ry: Math.PI / 2 },
                { x: -half, z: 0, ry: -Math.PI / 2 },
              ]
              for (const f of faces) {
                tmpVec.set(bx + f.x, fy, bz + f.z)
                tmpEul.set(0, f.ry, 0)
                tmpQuat.setFromEuler(tmpEul)
                tmpMat.compose(tmpVec, tmpQuat, tmpScale)
                windowsMesh.setMatrixAt(windowIdx, tmpMat)
                // ~30% окон тёмные — рандомно красим в базовый темный цвет через instanceColor
                // Для простоты: оставляем все instance, но через instanceColor затемняем часть
                windowIdx++
              }
            }
          })

          // Шпили за сложность
          for (let k = 0; k < extraFloors; k++) {
            const spireLvl = Math.max(1, Math.min(4, extraFloors - k))
            const color = SPIRE_HEX[spireLvl]
            const mat = new THREE.MeshStandardMaterial({
              color, roughness: 0.25, metalness: 0.8,
              emissive: color, emissiveIntensity: 0.35,
            })
            const mesh = new THREE.Mesh(spireGeo, mat)
            mesh.position.y = FLOOR_H / 2 + (chips.length + k) * FLOOR_H
            mesh.castShadow = true
            mesh.userData.buildingId = b.id
            bGroup.add(mesh)
            spireMeshes.push(mesh)
          }

          // ─── Звезда над golden зданиями (Sprite, всегда лицом к камере) ───
          if (golden && starTex) {
            const sMat = new THREE.SpriteMaterial({
              map: starTex,
              color: 0xffffff,
              transparent: true,
              opacity: 0.95,
              depthWrite: false,
            })
            const sprite = new THREE.Sprite(sMat)
            sprite.scale.set(2.5, 2.5, 1)
            sprite.position.y = (chips.length + extraFloors) * FLOOR_H + 1.6
            sprite.userData.buildingId = b.id
            bGroup.add(sprite)
            goldenSprites.push(sprite)
          }

          cityGroup.add(bGroup)
          buildingGroups.push(bGroup)
        })

        if (windowsMesh) windowsMesh.instanceMatrix.needsUpdate = true

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.minDistance = 10
        controls.maxDistance = 150
        controls.maxPolarAngle = Math.PI / 2.1
        controls.target.copy(introStartTarget)
        controls.enablePan = true
        controls.panSpeed = 0.6
        controls.rotateSpeed = 0.7
        controls.zoomSpeed = 0.8
        controls.autoRotateSpeed = 0.5
        controls.enabled = false
        controls.update()

        const CAMERA_PRESETS = {
          iso: {
            pos: finalCamPos.clone(),
            target: finalTarget.clone(),
          },
          top: {
            pos: new THREE.Vector3(centerX, dist * 1.3, centerZ + 4),
            target: new THREE.Vector3(centerX, 0, centerZ),
          },
          cinematic: {
            pos: new THREE.Vector3(centerX + dist * 1.1, dist * 0.18, centerZ + dist * 0.55),
            target: new THREE.Vector3(centerX, 4, centerZ),
          },
        }

        const animRef = {
          focusAnim: null,
          focusDuration: FOCUS_MS,
          autoRotate: false,
          timeAnim: null,
          // Time-lapse state
          timelapse: null,        // { sortedGroups, start, currentIdx } | null
        }

        function startCamAnim(toPos, toTarget, duration) {
          animRef.focusAnim = {
            fromPos: camera.position.clone(),
            toPos: toPos.clone(),
            fromTarget: controls.target.clone(),
            toTarget: toTarget.clone(),
            start: performance.now(),
          }
          animRef.focusDuration = duration || FOCUS_MS
          controls.enabled = false
          controls.autoRotate = false
        }

        function startFocusAnim(buildingId) {
          const p = buildingPositions.get(buildingId)
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
              fogNear: target.fogNear,
              fogFar: target.fogFar,
              sunColor: new THREE.Color(target.sunColor),
              sunIntensity: target.sunIntensity,
              sunPos: new THREE.Vector3(centerX + target.sunPosOffset[0], target.sunPosOffset[1], centerZ + target.sunPosOffset[2]),
              ambientColor: new THREE.Color(target.ambientColor),
              ambientIntensity: target.ambientIntensity,
              starsOpacity: target.starsOpacity,
              exposure: target.exposure,
              windowGlow: target.windowGlow,
            },
            start: performance.now(),
          }
        }

        // ─── Time-lapse: проиграть постройку города по хронологии ───
        function startTimelapse() {
          // Сортируем группы по дате (ASC = старые первыми)
          const sorted = [...buildingGroups].sort((a, b) => (a.userData.created_at || 0) - (b.userData.created_at || 0))
          // Сбрасываем все scale.y = 0
          for (const g of sorted) g.scale.y = 0
          animRef.timelapse = {
            sortedGroups: sorted,
            start: performance.now(),
          }
          setIsTimelapsing(true)
          // Скрываем подсвеченное здание / hover на время
          hoverRef.current = { id: null, group: null }
          setHoverInfo(null)
          // Гарантируем что цикл бежит
          if (rafRef.current === 0 && ioVisibleRef.current && tabVisibleRef.current) animate()
        }

        function stopTimelapse() {
          // Восстанавливаем все scale.y = 1
          if (animRef.timelapse) {
            for (const g of animRef.timelapse.sortedGroups) g.scale.y = 1
          }
          animRef.timelapse = null
          setIsTimelapsing(false)
          setTimelapseDate(null)
        }

        const introStart = performance.now()

        // Raycaster для click + hover
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
          if (animRef.timelapse) return                  // во время time-lapse клики игнорируем
          const rect = renderer.domElement.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const hits = raycaster.intersectObjects(cityGroup.children, true)
          if (hits.length) {
            const id = hits[0].object.userData.buildingId
            if (id != null) {
              setSelId(prev => {
                const next = prev === id ? null : id
                if (next != null) startFocusAnim(next)
                return next
              })
            }
          }
        })

        // ─── pointermove → hover effect ───
        const onPointerMove = (e) => {
          if (animRef.timelapse) return
          if (performance.now() - introStart < INTRO_MS) return
          const rect = renderer.domElement.getBoundingClientRect()
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, camera)
          const hits = raycaster.intersectObjects(cityGroup.children, true)
          let found = null
          if (hits.length) {
            const obj = hits[0].object
            const id = obj.userData.buildingId
            // ищем bGroup
            let g = obj
            while (g && !g.userData?.idx && g.userData?.idx !== 0) {
              if (g.userData?.buildingId != null && buildingGroups.includes(g)) break
              g = g.parent
            }
            found = { id, group: g }
          }
          // Обновляем hoverRef
          if (found && found.id != null) {
            if (hoverRef.current.id !== found.id) {
              hoverRef.current = found
              const b = buildings.find(bb => bb.id === found.id)
              if (b) {
                const chips = getChips(b)
                setHoverInfo({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  name: b.opponent_name || (b.is_ai ? 'Snappy' : (en ? 'Player' : 'Игрок')),
                  date: b.created_at,
                  floors: chips.length,
                  golden: b.result === 'draw_won',
                  diff: b.is_ai ? getDiffLabel(b.ai_difficulty, en) : null,
                })
              }
            } else if (hoverInfo) {
              // Обновляем только координаты
              setHoverInfo(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev)
            }
          } else {
            if (hoverRef.current.id != null) {
              hoverRef.current = { id: null, group: null }
              setHoverInfo(null)
            }
          }
        }
        const onPointerLeave = () => {
          hoverRef.current = { id: null, group: null }
          setHoverInfo(null)
        }
        renderer.domElement.addEventListener('pointermove', onPointerMove)
        renderer.domElement.addEventListener('pointerleave', onPointerLeave)

        let resizeRaf = 0
        const onResize = () => {
          cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(() => {
            if (!container) return
            // В fullscreen используем window dims, иначе container
            const fs = !!document.fullscreenElement
            const w2 = fs ? window.innerWidth : container.clientWidth
            const h2 = fs ? window.innerHeight : Math.min(480, Math.max(320, w2 * 0.7))
            camera.aspect = w2 / h2
            camera.updateProjectionMatrix()
            renderer.setSize(w2, h2)
          })
        }
        window.addEventListener('resize', onResize)

        // Animate loop
        let growComplete = false
        const clock = new THREE.Clock()
        const animate = () => {
          if (!ioVisibleRef.current || !tabVisibleRef.current) {
            rafRef.current = 0
            return
          }
          rafRef.current = requestAnimationFrame(animate)
          const t = clock.getElapsedTime()
          const now = performance.now()

          // Intro
          const introElapsed = now - introStart
          if (introElapsed < INTRO_MS) {
            const p = introElapsed / INTRO_MS
            const e = easeOutCubic(p)
            camera.position.lerpVectors(introStartPos, finalCamPos, e)
            controls.target.lerpVectors(introStartTarget, finalTarget, e)
            camera.lookAt(controls.target)
          } else if (controls.enabled === false && !animRef.focusAnim) {
            controls.enabled = true
            controls.autoRotate = animRef.autoRotate && !reducedMotion
          }

          // Focus / preset cam
          if (animRef.focusAnim) {
            const p = Math.min(1, (now - animRef.focusAnim.start) / animRef.focusDuration)
            const e = easeOutCubic(p)
            camera.position.lerpVectors(animRef.focusAnim.fromPos, animRef.focusAnim.toPos, e)
            controls.target.lerpVectors(animRef.focusAnim.fromTarget, animRef.focusAnim.toTarget, e)
            camera.lookAt(controls.target)
            if (p >= 1) {
              animRef.focusAnim = null
              controls.enabled = true
              controls.autoRotate = animRef.autoRotate && !reducedMotion
            }
          }

          // Time-of-day переход
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
            // Окна
            if (windowMat) windowMat.opacity = lerp(ta.from.windowGlow, ta.to.windowGlow, e)
            if (p >= 1) animRef.timeAnim = null
          }

          // Grow при первом рендере
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

          // Time-lapse playback
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
              // Текущее "строящееся" — последнее с p<1
              if (p2 > 0 && p2 < 1) currentDateForUI = g.userData.created_at
              else if (p2 >= 1 && currentDateForUI === null) currentDateForUI = g.userData.created_at
            }
            // Throttle setState — обновляем дату не чаще раз в 100мс
            if (currentDateForUI && (!tl._lastUiAt || now - tl._lastUiAt > 100)) {
              tl._lastUiAt = now
              setTimelapseDate(currentDateForUI)
            }
            if (allDone) {
              // Подержим финальный кадр 1 секунду, потом завершим
              if (!tl._doneAt) tl._doneAt = now
              if (now - tl._doneAt > 1000) {
                animRef.timelapse = null
                setIsTimelapsing(false)
                setTimelapseDate(null)
              }
            }
          }

          // Пульсация шпилей (по кэшу)
          if (!reducedMotion) {
            for (let i = 0; i < spireMeshes.length; i++) {
              const m = spireMeshes[i]
              m.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + m.position.y) * 0.1
            }
            // Пульсация золотых звёзд
            for (let i = 0; i < goldenSprites.length; i++) {
              const s = goldenSprites[i]
              s.material.opacity = 0.85 + Math.sin(t * 1.5 + i) * 0.15
              s.scale.setScalar(2.5 + Math.sin(t * 1.5 + i) * 0.2)
            }
          }

          // Hover scale lerp — мягкая подсветка
          for (let i = 0; i < buildingGroups.length; i++) {
            const g = buildingGroups[i]
            const target = (hoverRef.current.group === g) ? 1.06 : 1.0
            const cur = g.scale.x
            if (Math.abs(cur - target) > 0.001) {
              const next = lerp(cur, target, 0.15)
              g.scale.x = next
              g.scale.z = next
            }
          }

          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // IntersectionObserver
        const io = new IntersectionObserver(([entry]) => {
          ioVisibleRef.current = entry.isIntersecting
          if (entry.isIntersecting && rafRef.current === 0 && tabVisibleRef.current) animate()
        }, { threshold: 0.05 })
        io.observe(renderer.domElement)

        // visibilitychange
        const onVisibility = () => {
          tabVisibleRef.current = document.visibilityState !== 'hidden'
          if (tabVisibleRef.current && rafRef.current === 0 && ioVisibleRef.current) animate()
        }
        document.addEventListener('visibilitychange', onVisibility)

        threeRef.current = {
          scene, camera, renderer, controls, onResize, onVisibility, io,
          floorGeo, spireGeo, windowGeo, windowMat, windowsMesh,
          starTex, roadTex,
          rafRef,
          cameraPresets: CAMERA_PRESETS,
          animRef,
          startCamAnim, startTimeAnim, startTimelapse, stopTimelapse,
          onPointerMove, onPointerLeave,
          _sceneObjects: { sun, ambient, stars, centerX, centerZ },
          THREE_MOD: THREE,
        }
      } catch (e) {
        console.error('[VictoryCity] WebGL init error:', e)
        if (!disposed) setForceSvg(true)
      }
    })()

    return () => {
      disposed = true
      ioVisibleRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
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
        t.floorGeo?.dispose()
        t.spireGeo?.dispose()
        t.windowGeo?.dispose()
        t.windowMat?.dispose()
        t.starTex?.dispose()
        t.roadTex?.dispose()
        t.renderer?.dispose()
        if (t.renderer?.domElement?.parentNode) {
          t.renderer.domElement.parentNode.removeChild(t.renderer.domElement)
        }
        threeRef.current = null
      }
    }
  }, [buildings, webglOk, forceSvg])

  // ─── Public API ───
  function applyCameraPreset(name) {
    const t = threeRef.current
    if (!t?.cameraPresets || !t?.startCamAnim) return
    const preset = t.cameraPresets[name]
    if (!preset) return
    setCurrentPreset(name)
    t.startCamAnim(preset.pos, preset.target, PRESET_MS)
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
    if (isTimelapsing) {
      t.stopTimelapse?.()
    } else {
      t.startTimelapse?.()
    }
  }

  function handleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {})
    }
  }

  // ─── Скриншот с фильтром и watermark ───
  function downloadScreenshot() {
    const t = threeRef.current
    if (!t?.renderer || !t?.scene || !t?.camera) return
    t.renderer.render(t.scene, t.camera)
    const src = t.renderer.domElement
    const w = src.width
    const h = src.height
    // Промежуточный canvas с фильтром + watermark
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    // Применяем CSS-фильтр
    const filterMap = {
      original: 'none',
      vivid: 'saturate(1.4) contrast(1.1)',
      bw: 'grayscale(1) contrast(1.1)',
      sepia: 'sepia(0.8) contrast(1.05)',
    }
    ctx.filter = filterMap[shotFilter] || 'none'
    ctx.drawImage(src, 0, 0, w, h)
    ctx.filter = 'none'
    // Watermark
    const profile = (() => {
      try { return JSON.parse(localStorage.getItem('stolbiki_profile') || '{}') }
      catch { return {} }
    })()
    const playerName = profile?.name || (en ? 'Player' : 'Игрок')
    const winsCount = stats?.total || 0
    const wmText = `Highrise Heist · ${playerName} · ${winsCount} ${en ? 'wins' : 'побед'}`
    const fontSize = Math.max(18, Math.round(w * 0.022))
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`
    const textMetrics = ctx.measureText(wmText)
    const padX = fontSize * 0.7
    const padY = fontSize * 0.4
    const boxW = textMetrics.width + padX * 2
    const boxH = fontSize + padY * 2
    const boxX = w - boxW - 20
    const boxY = h - boxH - 20
    // Backdrop
    ctx.fillStyle = 'rgba(10, 10, 24, 0.7)'
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxW, boxH, 12)
    ctx.fill()
    // Текст с золотым градиентом
    const grad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY)
    grad.addColorStop(0, '#ffd86e')
    grad.addColorStop(1, '#ff9020')
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
          .then(() => {
            setSnapshotMsg(en ? 'Shared!' : 'Отправлено!')
            setTimeout(() => setSnapshotMsg(null), 2000)
          })
          .catch(() => {})
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
        setSnapshotMsg(en ? 'Downloaded!' : 'Скачано!')
        setTimeout(() => setSnapshotMsg(null), 2000)
      }
      setShowShotMenu(false)
    }, 'image/png')
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontSize: 13 }}>
      {en ? 'Loading city...' : 'Загружаю город...'}
    </div>
  )

  if (!buildings.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏙️</div>
      <div style={{ fontSize: 14, color: 'var(--ink3)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
        {en
          ? 'Win games to build your Victory City — each win adds a new skyscraper!'
          : 'Побеждайте — и стройте Город побед! Каждая победа — новая высотка.'}
      </div>
    </div>
  )

  const selB = selId ? buildings.find(b => b.id === selId) : null
  const useFallback = !webglOk || forceSvg

  const CAMERA_PRESETS_UI = [
    { id: 'iso', emoji: '📐', label_ru: 'Изо', label_en: 'Iso' },
    { id: 'top', emoji: '🚁', label_ru: 'Сверху', label_en: 'Top' },
    { id: 'cinematic', emoji: '🎬', label_ru: 'Кино', label_en: 'Cine' },
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

  return (
    <div>
      {stats && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            [stats.total,       en ? 'Buildings' : 'Зданий',       'var(--ink)'],
            [stats.vs_ai,       'vs AI',                            'var(--p1)'],
            [stats.vs_human,    en ? 'vs Human' : 'vs Живой',       'var(--green)'],
            [stats.golden_wins, '★ ' + (en ? 'Golden' : 'Золотых'), 'var(--gold)'],
          ].map(([v, l, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--surface2)', borderRadius: 8, minWidth: 54 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          [en ? 'Easy' : 'Лёгкая', 'var(--ink3)', 0],
          [en ? 'Medium' : 'Средняя', '#d4a017', 1],
          [en ? 'Hard' : 'Сложная', '#e8b830', 2],
          [en ? 'Extreme' : 'Экстрим', '#ffc845', 3],
          [en ? 'Impossible' : 'Невозможно', '#ffe080', 4],
        ].map(([label, color, bonus]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ink3)' }}>
            <span style={{ color, fontWeight: 700 }}>▲</span>
            <span style={{ color }}>{label}</span>
            {bonus > 0 && <span style={{ color: 'var(--ink3)', opacity: 0.5 }}>+{bonus}</span>}
          </div>
        ))}
      </div>

      {/* 3D рендер или fallback */}
      {useFallback ? (
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontSize: 12 }}>
            {en ? 'Loading 2D view…' : 'Загрузка 2D-вида…'}
          </div>
        }>
          <VictoryCity2D buildings={buildings} stats={stats} en={en} />
        </Suspense>
      ) : (
        <div
          ref={containerRef}
          style={{
            background: 'linear-gradient(180deg, #06060f 0%, #0a0a18 100%)',
            borderRadius: isFullscreen ? 0 : 12,
            border: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden',
            minHeight: 320,
            position: 'relative',
          }}
        >
          {/* Hover tooltip */}
          {hoverInfo && !isTimelapsing && (
            <div style={{
              position: 'absolute',
              left: hoverInfo.x + 14,
              top: hoverInfo.y + 14,
              pointerEvents: 'none',
              background: 'rgba(10,10,24,0.92)',
              border: `1px solid ${hoverInfo.golden ? 'var(--gold)' : 'var(--accent)'}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--ink)',
              minWidth: 140,
              boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
              zIndex: 5,
              whiteSpace: 'nowrap',
            }}>
              <div style={{ fontWeight: 700, color: hoverInfo.golden ? 'var(--gold)' : 'var(--ink)', marginBottom: 3 }}>
                {hoverInfo.golden && '★ '}{hoverInfo.name}
              </div>
              <div style={{ color: 'var(--ink3)', fontSize: 10 }}>
                {hoverInfo.floors} {en ? 'floors' : 'этажей'}
                {hoverInfo.diff && ` · ${hoverInfo.diff}`}
              </div>
              {hoverInfo.date && (
                <div style={{ color: 'var(--ink3)', fontSize: 10, marginTop: 2 }}>
                  {new Date(hoverInfo.date * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>
          )}

          {/* Time-lapse overlay */}
          {isTimelapsing && timelapseDate && (
            <div style={{
              position: 'absolute',
              top: 16, left: 16,
              background: 'rgba(10,10,24,0.85)',
              border: '1px solid var(--gold)',
              borderRadius: 10,
              padding: '10px 16px',
              color: 'var(--gold)',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
              zIndex: 5,
            }}>
              {new Date(timelapseDate * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}

          {/* Fullscreen exit hint */}
          {isFullscreen && (
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(10,10,24,0.85)',
              borderRadius: 8, padding: '6px 10px',
              fontSize: 11, color: 'var(--ink3)',
              zIndex: 5,
            }}>
              {en ? 'Press ESC to exit' : 'ESC чтобы выйти'}
            </div>
          )}
        </div>
      )}

      {/* Photo Mode */}
      {!useFallback && (
        <div style={{
          display: 'flex', justifyContent: 'center', marginTop: 10, gap: 6,
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{
            display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {CAMERA_PRESETS_UI.map(p => {
              const active = currentPreset === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => applyCameraPreset(p.id)}
                  disabled={isTimelapsing}
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 6,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#0a0a12' : 'var(--ink2)',
                    border: 'none', cursor: isTimelapsing ? 'default' : 'pointer',
                    opacity: isTimelapsing ? 0.5 : 1,
                    fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  aria-label={en ? p.label_en : p.label_ru}
                  aria-pressed={active}
                >
                  <span>{p.emoji}</span>
                  <span>{en ? p.label_en : p.label_ru}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={toggleAutoRotate}
            disabled={isTimelapsing}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: autoRotate ? 'rgba(61,214,140,0.15)' : 'var(--surface2)',
              color: autoRotate ? 'var(--green)' : 'var(--ink3)',
              border: `1px solid ${autoRotate ? 'var(--green)' : 'rgba(255,255,255,0.05)'}`,
              cursor: isTimelapsing ? 'default' : 'pointer',
              opacity: isTimelapsing ? 0.5 : 1,
              fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            aria-pressed={autoRotate}
          >
            <span>🔄</span>
            <span>{en ? 'Rotate' : 'Авто'}</span>
          </button>

          {/* Time-lapse */}
          <button
            onClick={handleTimelapse}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: isTimelapsing ? 'rgba(255,193,69,0.18)' : 'var(--surface2)',
              color: isTimelapsing ? 'var(--gold)' : 'var(--ink3)',
              border: `1px solid ${isTimelapsing ? 'var(--gold)' : 'rgba(255,255,255,0.05)'}`,
              cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span>{isTimelapsing ? '⏹' : '⏯'}</span>
            <span>{isTimelapsing ? (en ? 'Stop' : 'Стоп') : (en ? 'Time-lapse' : 'История')}</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: 'var(--surface2)', color: 'var(--ink3)',
              border: '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span>{isFullscreen ? '🗗' : '⛶'}</span>
            <span>{isFullscreen ? (en ? 'Exit' : 'Свернуть') : (en ? 'Full' : 'Полный')}</span>
          </button>

          {/* Snapshot с меню фильтров */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowShotMenu(s => !s)}
              style={{
                fontSize: 11, padding: '6px 12px', borderRadius: 8,
                border: '1px solid var(--accent)',
                background: showShotMenu ? 'rgba(74,158,255,0.15)' : 'transparent',
                color: 'var(--accent)',
                cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s ease',
              }}
            >
              <span>📸</span>
              <span>{en ? 'Snapshot' : 'Снимок'}</span>
            </button>
            {showShotMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 8,
                minWidth: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 10,
              }}>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 6, padding: '0 4px' }}>
                  {en ? 'Filter' : 'Фильтр'}
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                  {FILTERS_UI.map(f => {
                    const active = shotFilter === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => setShotFilter(f.id)}
                        style={{
                          fontSize: 11, padding: '5px 10px', borderRadius: 6,
                          background: active ? 'var(--accent)' : 'var(--surface2)',
                          color: active ? '#0a0a12' : 'var(--ink2)',
                          border: 'none', cursor: 'pointer',
                          fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                        }}
                        aria-pressed={active}
                      >
                        {en ? f.label_en : f.label_ru}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={downloadScreenshot}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: 'var(--accent)', color: '#0a0a12',
                    border: 'none', cursor: 'pointer', fontWeight: 700,
                    fontSize: 12, fontFamily: 'inherit',
                  }}
                >
                  {en ? 'Save / Share' : 'Сохранить'}
                </button>
              </div>
            )}
          </div>
          {snapshotMsg && (
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, animation: 'fadeIn 0.3s ease' }}>
              {snapshotMsg}
            </span>
          )}
        </div>
      )}

      {/* Day/Night */}
      {!useFallback && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{
            display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {TIME_PRESETS_UI.map(p => {
              const active = timeOfDay === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => applyTimeOfDay(p.id)}
                  disabled={isTimelapsing}
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 6,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#0a0a12' : 'var(--ink2)',
                    border: 'none', cursor: isTimelapsing ? 'default' : 'pointer',
                    opacity: isTimelapsing ? 0.5 : 1,
                    fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  aria-label={en ? p.label_en : p.label_ru}
                  aria-pressed={active}
                >
                  <span>{p.emoji}</span>
                  <span>{en ? p.label_en : p.label_ru}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Building modal */}
      {selB && (() => {
        const diffBonus = selB.is_ai ? getDiffBonus(selB.ai_difficulty) : 0
        const diffLabel = getDiffLabel(selB.ai_difficulty, en)
        return (
          <div style={{
            marginTop: 10, padding: '14px 16px',
            background: 'var(--surface)', borderRadius: 10,
            border: '1px solid rgba(255,193,69,0.22)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: selB.result === 'draw_won' ? 'var(--gold)' : 'var(--green)' }}>
                  {selB.result === 'draw_won' ? '★ ' : '🏆 '}
                  {selB.result === 'draw_won'
                    ? (en ? 'Golden victory' : 'Победа по золотой')
                    : (en ? 'Victory' : 'Победа')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                  {new Date(selB.created_at * 1000).toLocaleDateString(
                    en ? 'en-US' : 'ru',
                    { day: 'numeric', month: 'long', year: 'numeric' }
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
              >✕</button>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Opponent' : 'Соперник'}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                  {selB.opponent_name || (selB.is_ai ? 'Snappy' : (en ? 'Player' : 'Игрок'))}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Floors' : 'Этажей'}</div>
                <div style={{ fontWeight: 700, color: 'var(--gold)', marginTop: 2, fontSize: 16 }}>
                  {getChips(selB).length}
                  {diffBonus > 0 && <span style={{ fontSize: 11, color: '#ffc845', marginLeft: 4 }}>+{diffBonus}▲</span>}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--ink3)' }}>{en ? 'Closed' : 'Достроено'}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                  {(selB.stands_snapshot || []).filter(s => s.owner !== null).length} / 10
                </div>
              </div>
              {diffLabel && (
                <div>
                  <div style={{ color: 'var(--ink3)' }}>{en ? 'Difficulty' : 'Сложность'}</div>
                  <div style={{ fontWeight: 600, color: diffBonus >= 3 ? '#ffc845' : diffBonus >= 1 ? '#e8b830' : 'var(--ink)', marginTop: 2 }}>
                    {diffLabel} {diffBonus > 0 && '⭐'.repeat(diffBonus)}
                  </div>
                </div>
              )}
              {selB.player_skin_id && selB.player_skin_id !== 'blocks_classic' && (
                <div>
                  <div style={{ color: 'var(--ink3)' }}>{en ? 'Skin' : 'Скин'}</div>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginTop: 2, fontSize: 11 }}>
                    {selB.player_skin_id.replace('blocks_', '')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', marginTop: 8, opacity: 0.6 }}>
        {useFallback
          ? (en ? 'Scroll to zoom · Drag to pan · Tap a building for details' : 'Колёсико — зум · Тащи — пан · Тап — детали')
          : (en ? 'Drag to rotate · Pinch/scroll to zoom · Hover for info · Tap a building to focus'
                : 'Тащи — вращай · Щипок/колёсико — зум · Наведи — инфо · Тап — фокус')}
      </div>
    </div>
  )
}
