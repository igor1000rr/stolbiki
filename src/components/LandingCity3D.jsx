/**
 * LandingCity3D — 3D-превью «Города побед» на главной странице для first-impression.
 * Рендерит демо-город из 20 сгенерированных зданий с автоповоротом камеры.
 *
 * Не использует real-user данные — работает до логина, виральный hook для новых юзеров.
 * Lazy-грузит three.js (общий chunk с VictoryCity/Block3DPreview).
 * WebGL fallback: если WebGL нет — компонент не рендерится.
 * prefers-reduced-motion: выключает авторотацию и пульсацию шпилей.
 *
 * Визуально соответствует ночному виду VictoryCity: окна светятся, дороги
 * с разметкой, у золотых зданий корона + звезда + дым. Это важно — юзер
 * видит ровно тот город, в который превратится его профиль после побед.
 */
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../engine/i18n'
import { makeRoadTexture, makeStarTexture, makeSoftDotTexture } from './victoryCityTextures'

const SKIN_COLORS = [
  0x4a9eff, 0xff6066, 0x00e5ff, 0xff3090, 0xffc145,
  0x3dd68c, 0x9b59b6, 0x00bcd4, 0xf48fb1, 0xffa726,
]
const GOLDEN = 0xffd86e
const CROWN_HEX = 0xffc845
const WINDOW_HEX = 0xfff4a8           // ярче, теплее
const WINDOW_OPACITY = 1.0            // opacity максимум, яркость даёт AdditiveBlending
const SMOKE_PER_BUILDING = 5
const ROOF_BEACON_CHANCE = 0.3        // 30% небоскребов получают мигающий маяк на крыше

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

// Детерминированный (seed-based) генератор демо-города чтобы не моргал между рендерами
function seeded(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

// 20 зданий по 5-колоночной сетке, разные высоты и цвета скинов.
// Доля metallic/emissive увеличена с 15% до 35% — больше визуального
// разнообразия. roofBeacon — мигающий маяк на крыше (для небоскребов от 5 этажей).
const DEMO_BUILDINGS = Array.from({ length: 20 }, (_, i) => {
  const height = 3 + Math.floor(seeded(i) * 6)
  return {
    height,
    colorIdx: Math.floor(seeded(i + 100) * SKIN_COLORS.length),
    golden: seeded(i + 200) < 0.18,
    spires: seeded(i + 300) < 0.25 ? 1 + Math.floor(seeded(i + 400) * 3) : 0,
    metallic: seeded(i + 500) < 0.35,
    emissive: seeded(i + 600) < 0.35,
    // Маяк на крыше только для зданий >= 5 этажей и не «золотых» (там корона)
    roofBeacon: height >= 5 && seeded(i + 700) < ROOF_BEACON_CHANCE,
    // Случайный hue-shift для вариации между этажами
    hueShift: (seeded(i + 800) - 0.5) * 0.3,
  }
})

const COLS = 5
const SPACING = 5.2
const FLOOR_H = 1.2
const BLOCK_W = 2.8
const SPIRE_W = 2.2
const CROWN_W = 2.2
const WINDOW_SIZE = 0.75              // было 0.5 — увеличено для читаемости с расстояния
const WINDOW_FACES_PER_FLOOR = 4      // было 2 — теперь 4 грани, гарантированно видны с любого ракурса

// Легкий hue shift hex-цвета (без RGB→HSL конвертации, простой множитель)
function shiftHex(hex, shift) {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  const k = 1 + shift
  const nr = Math.max(0, Math.min(255, Math.round(r * k)))
  const ng = Math.max(0, Math.min(255, Math.round(g * (1 + shift * 0.5))))
  const nb = Math.max(0, Math.min(255, Math.round(b * (1 - shift * 0.3))))
  return (nr << 16) | (ng << 8) | nb
}

export default function LandingCity3D() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [canRender, setCanRender] = useState(() => hasWebGL())
  const containerRef = useRef(null)

  useEffect(() => {
    if (!canRender || !containerRef.current) return
    let disposed = false
    let cleanup = null
    const reducedMotion = prefersReducedMotion()

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
        const h = Math.min(380, Math.max(240, w * 0.42))

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0a18)
        scene.fog = new THREE.Fog(0x0a0a18, 40, 140)

        const rows = Math.ceil(DEMO_BUILDINGS.length / COLS)
        const centerX = ((COLS - 1) / 2) * SPACING
        const centerZ = ((rows - 1) / 2) * SPACING
        const dist = Math.max(COLS, rows) * SPACING * 1.3

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 300)
        camera.position.set(centerX + dist * 0.7, dist * 0.55, centerZ + dist * 0.7)
        camera.lookAt(centerX, 2, centerZ)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(w, h)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.2
        container.appendChild(renderer.domElement)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.borderRadius = '14px'
        renderer.domElement.style.touchAction = 'none'

        // Освещение: усилен ambient + насыщенный rim сзади + 2 точечных
        // «уличных фонаря» по диагонали — даёт жилое ночное ощущение,
        // подсвечивает дороги тёплым светом снизу.
        scene.add(new THREE.AmbientLight(0x9098d8, 0.7))

        const sun = new THREE.DirectionalLight(0xfff0c8, 1.05)
        sun.position.set(centerX + 20, 35, centerZ + 12)
        sun.target.position.set(centerX, 0, centerZ)
        sun.castShadow = true
        sun.shadow.mapSize.set(1024, 1024)
        sun.shadow.camera.left = -40
        sun.shadow.camera.right = 40
        sun.shadow.camera.top = 40
        sun.shadow.camera.bottom = -40
        sun.shadow.bias = -0.0003
        scene.add(sun, sun.target)

        const rim = new THREE.DirectionalLight(0x8070d0, 0.7)
        rim.position.set(centerX - 15, 12, centerZ - 15)
        scene.add(rim)

        // Уличные фонари — два точечных источника тёплого света на уровне
        // дорог, с decay 2 (физически корректное затухание). Создают пятна
        // света на асфальте и боковую подсветку нижних этажей зданий.
        const lamp1 = new THREE.PointLight(0xffb060, 1.2, 22, 2)
        lamp1.position.set(centerX - SPACING * 1.5, 4, centerZ + SPACING * 0.5)
        scene.add(lamp1)
        const lamp2 = new THREE.PointLight(0xffa840, 1.0, 20, 2)
        lamp2.position.set(centerX + SPACING * 1.2, 4, centerZ - SPACING * 1.5)
        scene.add(lamp2)

        // Земля: чуть светлее (#16162a) + легкий emissive чтобы дороги
        // на ней не казались более темными чем сама земля.
        const groundGeo = new THREE.PlaneGeometry(160, 160)
        const ground = new THREE.Mesh(
          groundGeo,
          new THREE.MeshStandardMaterial({ color: 0x16162a, roughness: 0.85, metalness: 0.1 }),
        )
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        scene.add(ground)

        // ─── ДОРОГИ ───
        // Сетка дорог между зданиями: COLS+1 продольных + rows+1 поперечных.
        // Все дороги шарят одну геометрию, материал и текстуру.
        // Shared текстура из victoryCityTextures.js — квадратный тайл 256×256
        // с разметкой по горизонтали (U). Здесь plane ориентирован длиной по Y/V
        // (PlaneGeometry(roadW, roadLen)) — поэтому крутим текстуру на 90°
        // чтобы разметка шла ВДОЛЬ дороги, а не поперёк.
        //
        // Материал: BasicMaterial (не Standard) — чтобы теплый directional light
        // не перекрашивал асфальт в желто-золотой. Текстура рендерится как есть.
        const roadW = 2.4
        const roadLen = Math.max(rows, COLS) * SPACING + SPACING * 2
        const roadTex = makeRoadTexture(THREE)
        roadTex.center.set(0.5, 0.5)
        roadTex.rotation = Math.PI / 2
        roadTex.repeat.set(1, roadLen / SPACING)
        roadTex.needsUpdate = true
        const roadMat = new THREE.MeshBasicMaterial({ map: roadTex })
        const roadGeo = new THREE.PlaneGeometry(roadW, roadLen)
        const roadsGroup = new THREE.Group()
        for (let r = -1; r < rows; r++) {
          const z = r * SPACING + SPACING / 2
          const m = new THREE.Mesh(roadGeo, roadMat)
          m.rotation.x = -Math.PI / 2
          m.rotation.z = Math.PI / 2
          m.position.set(centerX, 0.02, z)
          m.receiveShadow = true
          roadsGroup.add(m)
        }
        for (let c = -1; c < COLS; c++) {
          const x = c * SPACING + SPACING / 2
          const m = new THREE.Mesh(roadGeo, roadMat)
          m.rotation.x = -Math.PI / 2
          m.position.set(x, 0.02, centerZ)
          m.receiveShadow = true
          roadsGroup.add(m)
        }
        scene.add(roadsGroup)

        // ─── ЗВЁЗДЫ НА НЕБЕ ───
        const starGeo = new THREE.BufferGeometry()
        const starPos = new Float32Array(300 * 3)
        for (let i = 0; i < 300; i++) {
          const r = 120
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(Math.random() * 0.6)
          starPos[i * 3]     = centerX + r * Math.sin(phi) * Math.cos(theta)
          starPos[i * 3 + 1] = r * Math.cos(phi) + 15
          starPos[i * 3 + 2] = centerZ + r * Math.sin(phi) * Math.sin(theta)
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
        const starMat = new THREE.PointsMaterial({
          color: 0xffffff, size: 0.55, sizeAttenuation: true,
          transparent: true, opacity: 0.7,
        })
        scene.add(new THREE.Points(starGeo, starMat))

        // ─── ОКНА ───
        // InstancedMesh — окна на ВСЕХ 4 гранях каждого этажа.
        // Размер 0.75 (раньше 0.5) — гарантированно читаются с расстояния.
        // AdditiveBlending — реальное «свечение» поверх стен, цвет смешивается
        // с фоном здания и даёт жёлтые яркие точки независимо от того,
        // какого цвета сама стена.
        let totalWindowSlots = 0
        for (const b of DEMO_BUILDINGS) totalWindowSlots += b.height * WINDOW_FACES_PER_FLOOR
        const windowGeo = new THREE.PlaneGeometry(WINDOW_SIZE, WINDOW_SIZE)
        const windowMat = new THREE.MeshBasicMaterial({
          color: WINDOW_HEX,
          transparent: true,
          opacity: WINDOW_OPACITY,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,   // главное изменение — реально светятся
        })
        const windowsMesh = new THREE.InstancedMesh(windowGeo, windowMat, totalWindowSlots)
        windowsMesh.frustumCulled = false
        windowsMesh.matrixAutoUpdate = false
        // renderOrder = 2 → окна рисуются ПОСЛЕ зданий и звёзд
        windowsMesh.renderOrder = 2
        scene.add(windowsMesh)

        // Текстуры для звезды над короной и дыма
        const starTex = makeStarTexture(THREE)
        const dotTex = makeSoftDotTexture(THREE)

        // Подсчёт дыма: у каждого «коронованного» здания SMOKE_PER_BUILDING частиц
        let totalSmoke = 0
        for (const b of DEMO_BUILDINGS) if (b.golden) totalSmoke += SMOKE_PER_BUILDING
        let smokeGeo = null, smokeMat = null, smoke = null, smokeData = null
        if (totalSmoke > 0) {
          smokeGeo = new THREE.BufferGeometry()
          const sp = new Float32Array(totalSmoke * 3)
          smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
          smokeMat = new THREE.PointsMaterial({
            map: dotTex, color: 0xb8b8d0, size: 0.85,
            sizeAttenuation: true, transparent: true, opacity: 0.4,
            depthWrite: false, blending: THREE.AdditiveBlending,
          })
          smoke = new THREE.Points(smokeGeo, smokeMat)
          scene.add(smoke)
          // 5 чисел на частицу: [originX, originZ, life, lifeTotal, topY]
          smokeData = new Float32Array(totalSmoke * 5)
        }

        // ─── КРЫШНЫЕ МАЯКИ (ROOF BEACONS) ───
        // Красные мигающие точки на крышах высоких небоскрёбов — как
        // авиамаяки на реальных зданиях. Sprites с AdditiveBlending,
        // мигают синусоидально с разной фазой.
        const beaconTex = makeSoftDotTexture(THREE)
        const beaconSprites = []

        const cityGroup = new THREE.Group()
        scene.add(cityGroup)

        const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W)
        const spireGeo = new THREE.BoxGeometry(SPIRE_W, FLOOR_H, SPIRE_W)
        const crownGeo = new THREE.BoxGeometry(CROWN_W, FLOOR_H * 1.2, CROWN_W)
        // Кэшируем все «золотые» меши для пульсации в animate (без traverse).
        const spireMeshes = []
        const crownMeshes = []
        const goldenSprites = []

        // Tmp-объекты для setMatrixAt окон (не выделяем в цикле)
        const tmpMat = new THREE.Matrix4()
        const tmpQuat = new THREE.Quaternion()
        const tmpEul = new THREE.Euler()
        const tmpVec = new THREE.Vector3()
        const tmpScale = new THREE.Vector3(1, 1, 1)

        let windowIdx = 0
        let smokeFillIdx = 0

        DEMO_BUILDINGS.forEach((b, idx) => {
          const col = idx % COLS
          const row = Math.floor(idx / COLS)
          const baseColor = SKIN_COLORS[b.colorIdx]
          const bx = col * SPACING
          const bz = row * SPACING

          const bGroup = new THREE.Group()
          bGroup.position.set(bx, 0, bz)

          // Корпус здания: каждый этаж — отдельный куб с легкой вариацией
          // оттенка по высоте. Низ темнее, верх светлее (имитация атмосферы)
          // плюс случайный hueShift на здание. Раньше все этажи были
          // монохромными — теперь высотки выглядят «слоями».
          for (let i = 0; i < b.height; i++) {
            const isTop = i === b.height - 1 && b.spires === 0 && !b.golden
            // Variation: -0.15 (низ темнее) до +0.15 (верх светлее) + b.hueShift
            const heightFactor = (i / Math.max(1, b.height - 1)) * 0.3 - 0.15 + b.hueShift
            const colorHex = (isTop && b.golden) ? GOLDEN : shiftHex(baseColor, heightFactor)
            const mat = new THREE.MeshStandardMaterial({
              color: colorHex,
              roughness: b.metallic ? 0.25 : 0.5,
              metalness: b.metallic ? 0.75 : 0.2,
              emissive: colorHex,
              emissiveIntensity: b.emissive ? 0.3 : 0.08,
            })
            const mesh = new THREE.Mesh(floorGeo, mat)
            mesh.position.y = FLOOR_H / 2 + i * FLOOR_H
            mesh.castShadow = true
            mesh.receiveShadow = true
            bGroup.add(mesh)

            // Окна на этом этаже — 4 грани (front/back/left/right).
            // Отступ 0.06 от грани против z-fighting + AdditiveBlending
            // → окна гарантированно видны как яркие точки на любой стене.
            const fy = FLOOR_H / 2 + i * FLOOR_H
            const half = BLOCK_W / 2 + 0.06
            const faces = [
              { x: 0,    z: half,  ry: 0 },
              { x: 0,    z: -half, ry: Math.PI },
              { x: half, z: 0,     ry: Math.PI / 2 },
              { x: -half, z: 0,    ry: -Math.PI / 2 },
            ]
            for (const f of faces) {
              tmpVec.set(bx + f.x, fy, bz + f.z)
              tmpEul.set(0, f.ry, 0)
              tmpQuat.setFromEuler(tmpEul)
              tmpMat.compose(tmpVec, tmpQuat, tmpScale)
              windowsMesh.setMatrixAt(windowIdx, tmpMat)
              windowIdx++
            }
          }

          // Шпили (золотые блоки сверху, доп. высота)
          for (let k = 0; k < b.spires; k++) {
            const mat = new THREE.MeshStandardMaterial({
              color: GOLDEN,
              roughness: 0.25, metalness: 0.8,
              emissive: GOLDEN, emissiveIntensity: 0.4,
            })
            const mesh = new THREE.Mesh(spireGeo, mat)
            mesh.position.y = FLOOR_H / 2 + (b.height + k) * FLOOR_H
            mesh.castShadow = true
            bGroup.add(mesh)
            spireMeshes.push(mesh)
          }

          // Корона + звезда + дым для «золотых» зданий
          if (b.golden) {
            const crownMat = new THREE.MeshStandardMaterial({
              color: CROWN_HEX, roughness: 0.25, metalness: 0.85,
              emissive: CROWN_HEX, emissiveIntensity: 0.4,
            })
            const crownTopY = FLOOR_H / 2 + (b.height + b.spires) * FLOOR_H
            const crownMesh = new THREE.Mesh(crownGeo, crownMat)
            crownMesh.position.y = crownTopY
            crownMesh.castShadow = true
            bGroup.add(crownMesh)
            crownMeshes.push(crownMesh)

            const sMat = new THREE.SpriteMaterial({
              map: starTex, color: 0xffffff, transparent: true,
              opacity: 0.95, depthWrite: false,
            })
            const sprite = new THREE.Sprite(sMat)
            sprite.scale.set(2.2, 2.2, 1)
            sprite.position.y = crownTopY + 1.4
            bGroup.add(sprite)
            goldenSprites.push(sprite)

            if (smoke && smokeFillIdx + SMOKE_PER_BUILDING <= totalSmoke) {
              const topY = crownTopY + 1
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

          // Маяк на крыше — мигающая красная точка для высотных
          // небоскрёбов (имитация авиамаяков). Не для золотых (там корона).
          if (b.roofBeacon) {
            const beaconMat = new THREE.SpriteMaterial({
              map: beaconTex, color: 0xff3030, transparent: true,
              opacity: 0.95, depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
            const beacon = new THREE.Sprite(beaconMat)
            beacon.scale.set(0.8, 0.8, 1)
            beacon.position.y = FLOOR_H / 2 + b.height * FLOOR_H + 0.4
            beacon.userData.phase = seeded(idx + 900) * Math.PI * 2
            bGroup.add(beacon)
            beaconSprites.push(beacon)
          }

          cityGroup.add(bGroup)
        })

        windowsMesh.instanceMatrix.needsUpdate = true
        if (smokeGeo) smokeGeo.attributes.position.needsUpdate = true

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.minDistance = 15
        controls.maxDistance = 80
        controls.maxPolarAngle = Math.PI / 2.1
        controls.target.set(centerX, 3, centerZ)
        controls.autoRotate = !reducedMotion
        controls.autoRotateSpeed = 0.6
        controls.enablePan = false
        controls.rotateSpeed = 0.5
        controls.zoomSpeed = 0.6
        controls.update()

        let resizeRaf = 0
        const onResize = () => {
          cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(() => {
            if (!container) return
            const w2 = container.clientWidth
            const h2 = Math.min(380, Math.max(240, w2 * 0.42))
            camera.aspect = w2 / h2
            camera.updateProjectionMatrix()
            renderer.setSize(w2, h2)
          })
        }
        window.addEventListener('resize', onResize)

        // Мутабельный ref для rafId — cleanup читает актуальное значение.
        const rafRef = { current: 0 }
        const visibleRef = { current: true }
        const clock = new THREE.Clock()
        let lastFrameTime = performance.now()
        const animate = () => {
          if (disposed || !visibleRef.current) { rafRef.current = 0; return }
          rafRef.current = requestAnimationFrame(animate)
          const now = performance.now()
          const dt = Math.min(0.1, (now - lastFrameTime) / 1000)
          lastFrameTime = now

          if (!reducedMotion) {
            const t = clock.getElapsedTime()
            // Пульсация шпилей и корон — по кэшу, без traverse
            for (let i = 0; i < spireMeshes.length; i++) {
              spireMeshes[i].material.emissiveIntensity =
                0.35 + Math.sin(t * 2 + spireMeshes[i].position.y) * 0.12
            }
            for (let i = 0; i < crownMeshes.length; i++) {
              crownMeshes[i].material.emissiveIntensity =
                0.35 + Math.sin(t * 2 + crownMeshes[i].position.y) * 0.12
            }
            for (let i = 0; i < goldenSprites.length; i++) {
              const s = goldenSprites[i]
              s.material.opacity = 0.85 + Math.sin(t * 1.5 + i) * 0.15
              s.scale.setScalar(2.2 + Math.sin(t * 1.5 + i) * 0.18)
            }
            // Маяки на крышах — мигают резче (square-ish), фаза разная для каждого
            for (let i = 0; i < beaconSprites.length; i++) {
              const b = beaconSprites[i]
              const phase = b.userData.phase + t * 1.8
              // Резкая пульсация: opacity скачет 0.2 → 1.0
              const blink = (Math.sin(phase) + 1) / 2  // 0..1
              b.material.opacity = 0.25 + blink * 0.75
              b.scale.setScalar(0.6 + blink * 0.5)
            }
            // Уличные фонари — лёгкое «дыхание» (не моргание, теплый свет колышется)
            lamp1.intensity = 1.1 + Math.sin(t * 0.8) * 0.15
            lamp2.intensity = 0.95 + Math.sin(t * 0.6 + 1.5) * 0.15
            // Дым: подъем + лёгкий wobble
            if (smoke) {
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
                  pos[i * 3 + 1] += dt * 1.6
                  pos[i * 3]     += dt * Math.sin(t + i) * 0.25
                  pos[i * 3 + 2] += dt * Math.cos(t + i) * 0.25
                }
              }
              smokeGeo.attributes.position.needsUpdate = true
            }
          }
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // IntersectionObserver: пауза анимации когда элемент вне viewport
        const io = new IntersectionObserver(([entry]) => {
          const visible = entry.isIntersecting
          controls.autoRotate = visible && !reducedMotion
          if (visible && !visibleRef.current) {
            visibleRef.current = true
            animate()
          } else if (!visible) {
            visibleRef.current = false
          }
        }, { threshold: 0.1 })
        io.observe(renderer.domElement)

        cleanup = () => {
          visibleRef.current = false
          if (rafRef.current) cancelAnimationFrame(rafRef.current)
          io.disconnect()
          window.removeEventListener('resize', onResize)
          controls.dispose()
          scene.traverse(o => {
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
              else o.material.dispose()
            }
          })
          floorGeo.dispose()
          spireGeo.dispose()
          crownGeo.dispose()
          windowGeo.dispose()
          windowMat.dispose()
          groundGeo.dispose()
          // Shared road resources
          roadGeo.dispose()
          roadMat.dispose()
          roadTex.dispose()
          // Stars
          starGeo.dispose()
          starMat.dispose()
          // Sprites + smoke
          starTex.dispose()
          dotTex.dispose()
          beaconTex.dispose()
          if (smokeGeo) smokeGeo.dispose()
          if (smokeMat) smokeMat.dispose()
          renderer.dispose()
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement)
          }
        }
      } catch (e) {
        console.error('[LandingCity3D] init error:', e)
        if (!disposed) setCanRender(false)
      }
    })()

    return () => {
      disposed = true
      if (cleanup) cleanup()
    }
  }, [canRender])

  if (!canRender) return null

  return (
    <div
      ref={containerRef}
      style={{
        background: 'linear-gradient(180deg, #06060f 0%, #0a0a18 100%)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
        minHeight: 240,
        maxWidth: 780,
        margin: '0 auto',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 60px rgba(74,158,255,0.08)',
      }}
      aria-label={en ? '3D preview of Victory City' : '3D-превью Города побед'}
    />
  )
}
