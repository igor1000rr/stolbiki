/**
 * VictoryCity — Three.js 3D «Город побед»
 *
 * Модули:
 *   victoryCityUtils.js — константы, helpers
 *   victoryCityTextures.js — текстурные фабрики
 *   VictoryCityStats.jsx — стат-бар + прогресс + легенда
 *   VictoryCityTowerDetail.jsx — панель деталей башни
 *   VictoryCityControls.jsx — Photo Mode, Saved Views, Time Presets
 *
 * Fallback: WebGL error → VictoryCity2D.
 *
 * 26.04.2026 — апр ревизия по обратной связи Александра:
 * - "Землю у города сделать днём зелёной, ночью темно-зелёной":
 *   getGroundColor(timeOfDay) возвращает оттенок зелёного, useEffect
 *   обновляет цвет ground.material при смене пресета.
 * - "Snappy вылетает прям на уровне города": локальный <Snappy
 *   variant='anchored'> внутри 3D-контейнера вместо global fixed overlay.
 *
 * 27.04.2026 — переименование EN: "Victory City" → "City of Victories"
 * (точный обратный перевод "Город побед"). RU не задет.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useI18n } from '../engine/i18n'
import {
  GOLDEN_HEX, CROWN_HEX, TOWER_HEIGHT, VIDEO_DURATION_MS, VIDEO_FPS, VIDEO_BITRATE,
  COLS, SPACING, FLOOR_H, BLOCK_W, CROWN_W,
  INTRO_MS, FOCUS_MS, GROW_MS, GROW_STAGGER, GROW_START_AT, TIME_MS,
  TIMELAPSE_STAGGER, TIMELAPSE_GROW_MS, SMOKE_PER_BUILDING,
  WEATHER_COUNT_HIGH, WEATHER_COUNT_LOW, TIME_PRESETS, WEATHER_PARAMS,
  pieceColor, pieceEmissive, getDiffLabel, hasWebGL, prefersReducedMotion,
  hasLowPower, getSeason, easeOutCubic, lerp, pickVideoMimeType,
  towerMatchesFilter, snapshotSceneTimeState,
  loadSavedViews,
} from './victoryCityUtils'
import { makeStarTexture, makeRoadTexture, makeSoftDotTexture } from './victoryCityTextures'
import VictoryCityStats from './VictoryCityStats'
import VictoryCityTowerDetail from './VictoryCityTowerDetail'
import VictoryCityControls from './VictoryCityControls'
import Snappy from './Snappy'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))
const HallOfFame = lazy(() => import('./HallOfFame'))

/**
 * Цвет земли в зависимости от времени суток.
 * По обратной связи Александра: "Землю у города сделать днём зелёной,
 * ночью темно-зелёной" + ревизия 28.04.2026: «Давай по все времена дня
 * сделаем зелёную землю, ну с чёрной вообще не позитивно, как пустота».
 *
 * Раньше был хардкод 0x0d0d22 (тёмно-фиолетовый) — выглядел как асфальт
 * 24/7, не передавал смену времени суток.
 *
 * 28.04.2026 — поднял luminance ночных оттенков (night, night_neon, dusk),
 * чтобы зелень читалась во всех пресетах и не сливалась с тёмным фоном
 * (был эффект «чёрной пустоты»). День/dawn остаются прежними.
 */
function getGroundColor(timeOfDay) {
  switch (timeOfDay) {
    case 'day':       return 0x4a7a32  // ярко-зелёный газон, солнечный день
    case 'dawn':      return 0x3a6228  // утренний, чуть приглушённее
    case 'dusk':      return 0x3d5a28  // закат — было 0x2e4a1e, поднял яркость
    case 'night_neon':return 0x2a4a22  // киберпанк-ночь — было 0x152a14, поднял
    case 'night':
    default:          return 0x2a4a24  // ночь — было 0x1a3a18, поднял luminance
  }
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
  const [isRecording, setIsRecording] = useState(false)
  const [recordProgress, setRecordProgress] = useState(0)
  const [showHallOfFame, setShowHallOfFame] = useState(false)

  const containerRef = useRef(null)
  const threeRef = useRef(null)
  const recorderRef = useRef(null)
  const progressTimerRef = useRef(null)

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

  // При смене времени суток меняем цвет земли через сохранённую ссылку
  // в threeRef.ground. setHex даёт мгновенный переход — гармонирует
  // с резкой сменой пресета через UI.
  useEffect(() => {
    const t = threeRef.current
    if (!t?.ground?.material) return
    t.ground.material.color.setHex(getGroundColor(timeOfDay))
    t.ground.material.needsUpdate = true
  }, [timeOfDay])

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

        // Цвет земли зависит от timeOfDay (день — зелёный, ночь — тёмно-зелёный).
        // Ссылку сохраняем в threeRef ниже чтобы useEffect мог менять цвет
        // при переключении пресета без полного перерендера сцены.
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({
            color: getGroundColor(timeOfDay),
            roughness: 0.85,
            metalness: 0.1,
          }),
        )
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        scene.add(ground)

        const roadW = 2.6
        const roadLen = Math.max(rows, COLS) * SPACING + SPACING * 2
        const roadTex = makeRoadTexture(THREE)
        roadTex.repeat.set(roadLen / SPACING, 1)
        roadTex.needsUpdate = true
        const roadMat = new THREE.MeshBasicMaterial({ map: roadTex })
        const roadGeo = new THREE.PlaneGeometry(roadLen, roadW)
        const roadsGroup = new THREE.Group()
        for (let r = -1; r < rows; r++) {
          const z = r * SPACING + SPACING / 2
          const m = new THREE.Mesh(roadGeo, roadMat)
          m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2
          m.position.set(centerX, 0.005, z); m.receiveShadow = true
          roadsGroup.add(m)
        }
        for (let c = -1; c < COLS; c++) {
          const x = c * SPACING + SPACING / 2
          const m = new THREE.Mesh(roadGeo, roadMat)
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
          windowsMesh.visible = false
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
          timelapse: null,
          weatherEnabled: weatherEnabled,
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
          if (windowsMesh) windowsMesh.visible = false
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
          if (windowsMesh) windowsMesh.visible = true
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

        function startRecordOrbit(durationMs) {
          animRef.focusAnim = null
          animRef.recordOrbit = {
            start: performance.now(),
            durationMs,
            centerX, centerZ,
            radius: dist * 0.85,
            height: dist * 0.25,
            lookHeight: 4,
            prevAutoRotate: animRef.autoRotate,
          }
          controls.enabled = false
          controls.autoRotate = false
        }
        function stopRecordOrbit() {
          const wasAutoRotate = animRef.recordOrbit?.prevAutoRotate
          animRef.recordOrbit = null
          controls.enabled = true
          if (wasAutoRotate && !reducedMotion) controls.autoRotate = true
        }

        const introStart = performance.now()

        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()
        let clickStart = null
        const onPointerDown = (e) => {
          clickStart = { x: e.clientX, y: e.clientY }
        }
        const onPointerUp = (e) => {
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
        }
        renderer.domElement.addEventListener('pointerdown', onPointerDown)
        renderer.domElement.addEventListener('pointerup', onPointerUp)

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
          if (disposed) { rafRef.current = 0; return }
          if (!ioVisibleRef.current || !tabVisibleRef.current) { rafRef.current = 0; return }
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

          if (animRef.recordOrbit) {
            const ro = animRef.recordOrbit
            const elapsed = now - ro.start
            const p = Math.min(1, elapsed / ro.durationMs)
            const angle = p * Math.PI * 2 + Math.PI / 4
            const px = ro.centerX + Math.cos(angle) * ro.radius
            const pz = ro.centerZ + Math.sin(angle) * ro.radius
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
              if (allDone) {
                growComplete = true
                if (windowsMesh) windowsMesh.visible = true
              }
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
                if (windowsMesh) windowsMesh.visible = true
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

          if (controls.enabled && !animRef.recordOrbit) controls.update()
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
          ground,                                /* для useEffect [timeOfDay] */
          floorGeo, crownGeo, windowGeo, windowMat, windowsMesh,
          starTex, roadTex, dotTex, smoke, smokeGeo, smokeMat,
          weather, weatherGeo, weatherMat, rafRef,
          roadGeo, roadMat,
          cameraPresets: CAMERA_PRESETS, animRef,
          startCamAnim, startTimeAnim, startTimelapse, stopTimelapse, startFocusAnim,
          startRecordOrbit, stopRecordOrbit,
          applyFilter, setWeatherEnabled,
          minimapBounds, towerPositions,
          onPointerMove, onPointerLeave, onPointerDown, onPointerUp,
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
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
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
          if (t.onPointerDown) t.renderer.domElement.removeEventListener('pointerdown', t.onPointerDown)
          if (t.onPointerUp) t.renderer.domElement.removeEventListener('pointerup', t.onPointerUp)
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
        t.roadGeo?.dispose(); t.roadMat?.dispose()
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
        ? `My City of Victories in Highrise Heist — ${winsCount} wins!`
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
    try { stream = t.renderer.domElement.captureStream(VIDEO_FPS) }
    catch { setSnapshotMsg(en ? 'Could not capture canvas' : 'Не удалось захватить canvas'); setTimeout(() => setSnapshotMsg(null), 3000); return }
    let recorder
    try { recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE }) }
    catch (e) { console.error('[VictoryCity] MediaRecorder failed:', e); setSnapshotMsg(en ? 'Recorder error' : 'Ошибка записи'); setTimeout(() => setSnapshotMsg(null), 3000); return }

    recorderRef.current = recorder
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      try {
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunks, { type: mime })
        const filename = `highrise-heist-flythrough-${Date.now()}.${ext}`
        const file = new File([blob], filename, { type: mime })
        const shareText = en ? 'Flythrough of my City of Victories in Highrise Heist!' : 'Облёт моего Города побед в Highrise Heist!'
        if (navigator.canShare?.({ files: [file] }) && navigator.share) {
          navigator.share({ text: shareText, files: [file] })
            .then(() => { setSnapshotMsg(en ? 'Shared!' : 'Отправлено!'); setTimeout(() => setSnapshotMsg(null), 2000) })
            .catch(() => {})
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
          URL.revokeObjectURL(url)
          setSnapshotMsg(en ? `Downloaded! (${ext.toUpperCase()})` : `Скачано! (${ext.toUpperCase()})`)
          setTimeout(() => setSnapshotMsg(null), 3000)
        }
      } catch (e) { console.error('[VictoryCity] video save error:', e) }
      finally {
        recorderRef.current = null
        try { stream.getTracks().forEach(tr => tr.stop()) } catch {}
        const tt = threeRef.current
        if (tt?.stopRecordOrbit) tt.stopRecordOrbit()
        setIsRecording(false); setRecordProgress(0)
      }
    }
    setIsRecording(true); setRecordProgress(0); setShowShotMenu(false); setHoverInfo(null)
    t.startRecordOrbit(VIDEO_DURATION_MS); recorder.start()
    const progressStart = performance.now()
    progressTimerRef.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - progressStart) / VIDEO_DURATION_MS)
      setRecordProgress(p)
      if (p >= 1) { clearInterval(progressTimerRef.current); progressTimerRef.current = null }
    }, 100)
    setTimeout(() => {
      if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null }
      if (recorderRef.current?.state === 'recording') { try { recorderRef.current.stop() } catch (e) { console.error(e) } }
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
      <VictoryCityStats cityData={cityData} towers={towers} en={en} />

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

          {/* Локальный Snappy — "вылетает прям на уровне города" по запросу
              Александра. variant='anchored' = position: absolute внутри
              контейнера 3D-сцены, не глобальный fixed overlay. cooldown=false
              чтобы гарантированно показать при заходе в город. Скрываем
              во время записи/таймлапса чтобы не мешать UI. */}
          {!isTimelapsing && !isRecording && (
            <Snappy
              event="victory_city"
              lang={lang}
              variant="anchored"
              cooldown={false}
              duration={4000}
            />
          )}
        </div>
      )}

      {!useFallback && (
        <VictoryCityControls
          en={en} threeRef={threeRef}
          currentPreset={currentPreset} setCurrentPreset={setCurrentPreset}
          autoRotate={autoRotate} setAutoRotate={setAutoRotate}
          isTimelapsing={isTimelapsing} isRecording={isRecording} isFullscreen={isFullscreen}
          weatherEnabled={weatherEnabled} setWeatherEnabled={setWeatherEnabled}
          season={season}
          buildingFilter={buildingFilter} setBuildingFilter={setBuildingFilter}
          showFilterMenu={showFilterMenu} setShowFilterMenu={setShowFilterMenu}
          showShotMenu={showShotMenu} setShowShotMenu={setShowShotMenu}
          shotFilter={shotFilter} setShotFilter={setShotFilter}
          snapshotMsg={snapshotMsg}
          savedViews={savedViews} setSavedViews={setSavedViews}
          timeOfDay={timeOfDay} setTimeOfDay={setTimeOfDay}
          containerRef={containerRef}
          onTimelapse={handleTimelapse} onFullscreen={handleFullscreen}
          onDownloadScreenshot={downloadScreenshot} onRecordVideo={recordVideo}
          setShowHallOfFame={setShowHallOfFame} setSnapshotMsg={setSnapshotMsg}
        />
      )}

      <VictoryCityTowerDetail selTower={selTower} selTowerIdx={selTowerIdx} setSelTowerIdx={setSelTowerIdx} en={en} />

      <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', marginTop: 8, opacity: 0.6 }}>
        {useFallback
          ? (en ? 'Scroll to zoom · Drag to pan · Tap a building for details' : 'Колёсико — зум · Тащи — пан · Тап — детали')
          : (en ? 'Drag to rotate · Pinch/scroll to zoom · Hover for info · Tap a tower for wins list'
                : 'Тащи — вращай · Щипок/колёсико — зум · Наведи — инфо · Тап — список побед')}
      </div>

      {showHallOfFame && (
        <Suspense fallback={null}>
          <HallOfFame onClose={() => setShowHallOfFame(false)} en={en} currentUserId={userId} />
        </Suspense>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
