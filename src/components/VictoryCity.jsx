/**
 * VictoryCity — Three.js 3D «Город побед»
 * Каждая победа = здание. Цвет этажей = цвет скина игрока на момент победы.
 * Высота здания = реальные блоки + бонусные шпили за сложность AI.
 *
 * Управление: OrbitControls — drag/pinch/mouse для вращения, зум колёсиком.
 * Клик по зданию → плавный zoom к нему + модалка с деталями.
 *
 * Intro-анимация: при первом рендере камера плавно "приземляется" сверху
 * на изометрический ракурс за 1.8 сек (easeOutCubic).
 * + Каскадное появление зданий из земли (grow scale.y 0→1 с задержкой idx*60ms)
 *
 * Photo Mode: 3 пресета ракурса (Iso, Top, Cinematic) + автоповорот камеры
 * Day/Night: 4 пресета времени суток с плавным 800ms переходом
 * Screenshot: PNG / Web Share API
 *
 * Performance:
 *  - rafId хранится в rafRef мутабельном объекте, обновляется каждый кадр —
 *    cleanup реально завершает цикл (раньше rafId сохранялся раз со значением 0,
 *    cancelAnimationFrame ничего не делал, animate крутился до dispose).
 *  - Шпили кэшируются в spireMeshes[] — пульсация emissive без traverse() сцены
 *    каждый кадр (на 60+ зданиях это были сотни итераций per frame).
 *  - IntersectionObserver — пауза цикла когда канвас вне viewport.
 *  - document.visibilityState — пауза при сворачивании вкладки браузера.
 *  - prefers-reduced-motion — отключает autoRotate и пульсацию шпилей.
 *
 * Fallback: при отсутствии WebGL / ошибке инициализации подгружается
 * VictoryCity2D (SVG 2.5D) через lazy import.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useI18n } from '../engine/i18n'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))

// Палитры скинов → hex для three.js
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

function getDiffBonus(aiDifficulty) {
  if (!aiDifficulty) return 0
  const d = typeof aiDifficulty === 'number' ? aiDifficulty : parseInt(aiDifficulty, 10) || 0
  if (d >= 1500) return 4
  if (d >= 800)  return 3
  if (d >= 400)  return 2
  if (d >= 150)  return 1
  return 0
}

function getDiffLabel(aiDifficulty, en) {
  if (!aiDifficulty) return null
  const d = typeof aiDifficulty === 'number' ? aiDifficulty : parseInt(aiDifficulty, 10) || 0
  if (d >= 1500) return en ? 'Impossible' : 'Невозможно'
  if (d >= 800)  return en ? 'Extreme' : 'Экстрим'
  if (d >= 400)  return en ? 'Hard' : 'Сложно'
  if (d >= 150)  return en ? 'Medium' : 'Средняя'
  return en ? 'Easy' : 'Лёгкая'
}

function getChips(building) {
  const snap = building.stands_snapshot || []
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
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch { return false }
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

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

const TIME_PRESETS = {
  night: {
    bg: 0x0a0a18, fogColor: 0x0a0a18, fogNear: 50, fogFar: 200,
    sunColor: 0xfff0c8, sunIntensity: 1.1, sunPosOffset: [25, 40, 15],
    ambientColor: 0x8080c0, ambientIntensity: 0.45,
    starsOpacity: 0.7, exposure: 1.1,
  },
  morning: {
    bg: 0x7fa8cc, fogColor: 0x9ec0dc, fogNear: 70, fogFar: 260,
    sunColor: 0xfff0d0, sunIntensity: 1.0, sunPosOffset: [-30, 18, 10],
    ambientColor: 0xb0c8e0, ambientIntensity: 0.55,
    starsOpacity: 0.05, exposure: 1.15,
  },
  day: {
    bg: 0x5ba7d9, fogColor: 0x8ec6ea, fogNear: 90, fogFar: 320,
    sunColor: 0xffffff, sunIntensity: 1.4, sunPosOffset: [20, 60, 15],
    ambientColor: 0xc0d8e8, ambientIntensity: 0.65,
    starsOpacity: 0, exposure: 1.25,
  },
  sunset: {
    bg: 0x3a1a2e, fogColor: 0x6a3a4a, fogNear: 55, fogFar: 220,
    sunColor: 0xff8040, sunIntensity: 0.95, sunPosOffset: [40, 8, 15],
    ambientColor: 0xc06080, ambientIntensity: 0.4,
    starsOpacity: 0.25, exposure: 1.15,
  },
}

function snapshotSceneTimeState(scene, sun, ambient, stars, renderer) {
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
  }
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

  // Init three.js — один раз при появлении buildings и наличии WebGL
  useEffect(() => {
    if (!webglOk || forceSvg) return
    if (!containerRef.current || !buildings.length) return

    let disposed = false
    const reducedMotion = prefersReducedMotion()
    // Мутабельные ref'ы для интеграции с React-колбеками и cleanup
    const rafRef = { current: 0 }
    const visibleRef = { current: true }    // viewport + tab visibility
    const tabVisibleRef = { current: typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true }
    const ioVisibleRef = { current: true }

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

        const finalCamPos = new THREE.Vector3(
          centerX + dist * 0.7, dist * 0.6, centerZ + dist * 0.7,
        )
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
        const groundMat = new THREE.MeshStandardMaterial({
          color: 0x0d0d22,
          roughness: 0.85,
          metalness: 0.1,
        })
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat)
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        scene.add(ground)

        const grid = new THREE.GridHelper(120, 40, 0x2a2a4a, 0x15152a)
        grid.position.y = 0
        scene.add(grid)

        // Звёздный купол (opacity управляется time-of-day)
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
        // Кэш всех spire-mesh'ей чтобы пульсировать без traverse() per frame.
        const spireMeshes = []

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
          bGroup.scale.y = 0
          bGroup.userData.growDelay = idx * GROW_STAGGER
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
          })

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

          cityGroup.add(bGroup)
        })

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
            from: snapshotSceneTimeState(scene, sun, ambient, stars, renderer),
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
            },
            start: performance.now(),
          }
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

        let resizeRaf = 0
        const onResize = () => {
          cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(() => {
            if (!container) return
            const w2 = container.clientWidth
            const h2 = Math.min(480, Math.max(320, w2 * 0.7))
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
          // Пауза если канвас вне viewport ИЛИ вкладка свёрнута.
          if (!ioVisibleRef.current || !tabVisibleRef.current) {
            rafRef.current = 0
            return
          }
          rafRef.current = requestAnimationFrame(animate)
          const t = clock.getElapsedTime()
          const now = performance.now()

          // Intro-анимация
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

          // Focus/Preset анимация
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
            scene.fog.near = ta.from.fogNear + (ta.to.fogNear - ta.from.fogNear) * e
            scene.fog.far = ta.from.fogFar + (ta.to.fogFar - ta.from.fogFar) * e
            sun.color.lerpColors(ta.from.sunColor, ta.to.sunColor, e)
            sun.intensity = ta.from.sunIntensity + (ta.to.sunIntensity - ta.from.sunIntensity) * e
            sun.position.lerpVectors(ta.from.sunPos, ta.to.sunPos, e)
            ambient.color.lerpColors(ta.from.ambientColor, ta.to.ambientColor, e)
            ambient.intensity = ta.from.ambientIntensity + (ta.to.ambientIntensity - ta.from.ambientIntensity) * e
            stars.material.opacity = ta.from.starsOpacity + (ta.to.starsOpacity - ta.from.starsOpacity) * e
            renderer.toneMappingExposure = ta.from.exposure + (ta.to.exposure - ta.from.exposure) * e
            if (p >= 1) animRef.timeAnim = null
          }

          // Grow-анимация
          if (!growComplete) {
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

          // Пульсация emissive у шпилей — по кэшу, без traverse() сцены.
          if (!reducedMotion) {
            for (let i = 0; i < spireMeshes.length; i++) {
              const m = spireMeshes[i]
              m.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + m.position.y) * 0.1
            }
          }

          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // IntersectionObserver — пауза цикла когда канвас вне viewport.
        const io = new IntersectionObserver(([entry]) => {
          ioVisibleRef.current = entry.isIntersecting
          if (entry.isIntersecting && rafRef.current === 0 && tabVisibleRef.current) {
            animate()
          }
        }, { threshold: 0.05 })
        io.observe(renderer.domElement)

        // document.visibilityState — пауза при сворачивании вкладки.
        const onVisibility = () => {
          tabVisibleRef.current = document.visibilityState !== 'hidden'
          if (tabVisibleRef.current && rafRef.current === 0 && ioVisibleRef.current) {
            animate()
          }
        }
        document.addEventListener('visibilitychange', onVisibility)

        threeRef.current = {
          scene, camera, renderer, controls, onResize, onVisibility, io,
          floorGeo, spireGeo, rafRef,
          cameraPresets: CAMERA_PRESETS,
          animRef,
          startCamAnim, startTimeAnim,
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
      // Сначала останавливаем цикл — гарантированно отменяем актуальный rafId.
      ioVisibleRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (threeRef.current) {
        const { scene, renderer, controls, onResize, onVisibility, io, floorGeo, spireGeo } = threeRef.current
        io?.disconnect()
        if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('resize', onResize)
        controls?.dispose()
        scene?.traverse(o => {
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
            else o.material.dispose()
          }
        })
        floorGeo?.dispose()
        spireGeo?.dispose()
        renderer?.dispose()
        if (renderer?.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement)
        }
        threeRef.current = null
      }
    }
  }, [buildings, webglOk, forceSvg])

  // ─── Переключение пресетов ракурса ───
  function applyCameraPreset(name) {
    const t = threeRef.current
    if (!t?.cameraPresets || !t?.startCamAnim) return
    const preset = t.cameraPresets[name]
    if (!preset) return
    setCurrentPreset(name)
    t.startCamAnim(preset.pos, preset.target, PRESET_MS)
  }

  // ─── Тумблер автоповорота ───
  function toggleAutoRotate() {
    setAutoRotate(prev => {
      const next = !prev
      const t = threeRef.current
      if (t?.animRef && t?.controls) {
        t.animRef.autoRotate = next
        if (t.controls.enabled) {
          t.controls.autoRotate = next
        }
      }
      return next
    })
  }

  // ─── Переключение времени суток ───
  function applyTimeOfDay(name) {
    setTimeOfDay(name)
    const t = threeRef.current
    if (t?.startTimeAnim) t.startTimeAnim(name)
  }

  // ─── Скачать/поделиться скриншотом текущей 3D-сцены ───
  function downloadScreenshot() {
    const t = threeRef.current
    if (!t?.renderer || !t?.scene || !t?.camera) return
    t.renderer.render(t.scene, t.camera)
    t.renderer.domElement.toBlob((blob) => {
      if (!blob) return
      const filename = `highrise-heist-city-${Date.now()}.png`
      const file = new File([blob], filename, { type: 'image/png' })
      const shareText = en
        ? `My Victory City in Highrise Heist — ${stats?.total || 0} wins!`
        : `Мой Город побед в Highrise Heist — ${stats?.total || 0} побед!`
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
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        setSnapshotMsg(en ? 'Downloaded!' : 'Скачано!')
        setTimeout(() => setSnapshotMsg(null), 2000)
      }
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

      {/* Легенда шпилей */}
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

      {/* 3D рендер или fallback на SVG */}
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
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden',
            minHeight: 320,
            position: 'relative',
          }}
        />
      )}

      {/* Photo Mode: пресеты ракурса + автоповорот + снимок */}
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
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 6,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#0a0a12' : 'var(--ink2)',
                    border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 500,
                    fontFamily: 'inherit',
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
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: autoRotate ? 'rgba(61,214,140,0.15)' : 'var(--surface2)',
              color: autoRotate ? 'var(--green)' : 'var(--ink3)',
              border: `1px solid ${autoRotate ? 'var(--green)' : 'rgba(255,255,255,0.05)'}`,
              cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            aria-pressed={autoRotate}
          >
            <span>🔄</span>
            <span>{en ? 'Rotate' : 'Авто'}</span>
          </button>

          <button
            onClick={downloadScreenshot}
            style={{
              fontSize: 11, padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--accent)',
              background: 'transparent', color: 'var(--accent)',
              cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s ease',
            }}
          >
            <span>📸</span>
            <span>{en ? 'Snapshot' : 'Снимок'}</span>
          </button>
          {snapshotMsg && (
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, animation: 'fadeIn 0.3s ease' }}>
              {snapshotMsg}
            </span>
          )}
        </div>
      )}

      {/* Day/Night: пресеты времени суток */}
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
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 6,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#0a0a12' : 'var(--ink2)',
                    border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 500,
                    fontFamily: 'inherit',
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

      {/* Модалка с информацией о выбранном здании */}
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
          : (en ? 'Drag to rotate · Pinch/scroll to zoom · Right-click drag to pan · Tap a building to focus'
                : 'Тащи — вращай · Щипок/колёсико — зум · ПКМ+тащи — пан · Тап — фокус на здании')}
      </div>
    </div>
  )
}
