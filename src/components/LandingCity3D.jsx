/**
 * LandingCity3D — 3D-превью «Города побед» на главной странице.
 *
 * v5.9.13: wow-пакет 2 — уличные фонари + неоновые вывески.
 *   - Удалены зебры (доминировали на изометрии)
 *   - Дорога — упрощенный тёмный фон
 *   - 6 уличных фонарей: столб + лампочка + хало + световое пятно на асфальте
 *   - Неоновые вывески на ~35% зданий (разноцветные, мигают)
 */
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../engine/i18n'
import {
  makeRoadTexture, makeStarTexture, makeSoftDotTexture,
  makeFacadeTexture, makeMoonTexture,
  makeLampHaloTexture, makeLightPuddleTexture,
} from './victoryCityTextures'

const SKIN_COLORS = [
  0x4a9eff, 0xff6066, 0x00e5ff, 0xff3090, 0xffc145,
  0x3dd68c, 0x9b59b6, 0x00bcd4, 0xf48fb1, 0xffa726,
]
const GOLDEN = 0xffd86e
const CROWN_HEX = 0xffc845
const SMOKE_PER_BUILDING = 5
const ROOF_BEACON_CHANCE = 0.3
const NEON_CHANCE = 0.4
const NEON_COLORS = [0xff4090, 0x00d4ff, 0x3dd68c, 0xff8020, 0xc060ff, 0xffdd20]

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

function seeded(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const DEMO_BUILDINGS = Array.from({ length: 20 }, (_, i) => {
  const height = 3 + Math.floor(seeded(i) * 6)
  return {
    height,
    colorIdx: Math.floor(seeded(i + 100) * SKIN_COLORS.length),
    golden: seeded(i + 200) < 0.18,
    spires: seeded(i + 300) < 0.25 ? 1 + Math.floor(seeded(i + 400) * 3) : 0,
    metallic: seeded(i + 500) < 0.35,
    emissive: seeded(i + 600) < 0.35,
    roofBeacon: height >= 5 && seeded(i + 700) < ROOF_BEACON_CHANCE,
    hueShift: (seeded(i + 800) - 0.5) * 0.3,
    hasNeon: !seeded(i + 200) < 0.18 && seeded(i + 1100) < NEON_CHANCE,
    neonColorIdx: Math.floor(seeded(i + 1200) * NEON_COLORS.length),
    neonFace: Math.floor(seeded(i + 1300) * 4),
    neonHeightFrac: 0.35 + seeded(i + 1400) * 0.35,
  }
})

const COLS = 5
const SPACING = 5.2
const FLOOR_H = 1.2
const BLOCK_W = 2.8
const SPIRE_W = 2.2
const CROWN_W = 2.2

function shiftHex(hex, shift) {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  const nr = Math.max(0, Math.min(255, Math.round(r * (1 + shift))))
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
        scene.background = new THREE.Color(0x05050c)
        scene.fog = new THREE.Fog(0x05050c, 40, 140)

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

        scene.add(new THREE.AmbientLight(0x6070a8, 0.5))

        const sun = new THREE.DirectionalLight(0xfff0c8, 0.9)
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

        const rim = new THREE.DirectionalLight(0x8070d0, 0.6)
        rim.position.set(centerX - 15, 12, centerZ - 15)
        scene.add(rim)

        // Земля — еще темнее чем раньше (#0a0a16)
        const groundGeo = new THREE.PlaneGeometry(160, 160)
        const ground = new THREE.Mesh(
          groundGeo,
          new THREE.MeshStandardMaterial({ color: 0x0a0a16, roughness: 0.85, metalness: 0.1 }),
        )
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        scene.add(ground)

        // ─── ДОРОГИ (тёмный фон) ───
        const roadW = 2.4
        const roadLen = Math.max(rows, COLS) * SPACING + SPACING * 2
        const roadTex = makeRoadTexture(THREE)
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

        // ─── УЛИЧНЫЕ ФОНАРИ ───
        // Тонкие cylinder-столбы + sphere-лампочка + sprite-хало + plane со световым пятном на асфальте.
        const lampHaloTex = makeLampHaloTexture(THREE)
        const puddleTex = makeLightPuddleTexture(THREE)
        const lampPoleGeo = new THREE.CylinderGeometry(0.06, 0.09, 3, 8)
        const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x15151e, roughness: 0.85, metalness: 0.25 })
        const bulbGeo = new THREE.SphereGeometry(0.16, 10, 10)
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 })
        const puddleGeo = new THREE.PlaneGeometry(4, 4)

        // 6 фонарей в стратегических точках города
        const lampPositions = [
          [-SPACING / 2, centerZ - SPACING / 2],
          [SPACING + SPACING / 2, centerZ - SPACING / 2],
          [centerX + SPACING / 2, centerZ + SPACING / 2],
          [(COLS - 1) * SPACING + SPACING / 2, centerZ + SPACING / 2],
          [centerX - SPACING / 2, -SPACING / 2],
          [centerX + SPACING / 2, (rows - 1) * SPACING + SPACING / 2],
        ]
        const lampHaloSprites = []
        const lampPuddleMeshes = []
        const lampGroup = new THREE.Group()
        for (let i = 0; i < lampPositions.length; i++) {
          const [lx, lz] = lampPositions[i]
          // Столб
          const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat)
          pole.position.set(lx, 1.5, lz)
          pole.castShadow = true
          lampGroup.add(pole)
          // Лампочка
          const bulb = new THREE.Mesh(bulbGeo, bulbMat)
          bulb.position.set(lx, 3.05, lz)
          lampGroup.add(bulb)
          // Хало
          const haloMat = new THREE.SpriteMaterial({
            map: lampHaloTex, color: 0xffd9a0,
            transparent: true, opacity: 0.9, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
          const halo = new THREE.Sprite(haloMat)
          halo.scale.set(1.8, 1.8, 1)
          halo.position.set(lx, 3.05, lz)
          halo.userData.phase = seeded(i + 5000) * Math.PI * 2
          lampGroup.add(halo)
          lampHaloSprites.push(halo)
          // Световое пятно на асфальте
          const puddleMat = new THREE.MeshBasicMaterial({
            map: puddleTex, color: 0xffcc88,
            transparent: true, opacity: 0.55, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
          const puddle = new THREE.Mesh(puddleGeo, puddleMat)
          puddle.rotation.x = -Math.PI / 2
          puddle.position.set(lx, 0.05, lz)
          puddle.userData.phase = halo.userData.phase
          lampGroup.add(puddle)
          lampPuddleMeshes.push(puddle)
        }
        scene.add(lampGroup)

        // ─── ЗВЁЗДЫ НА НЕБЕ ───
        const starGeo = new THREE.BufferGeometry()
        const starPos = new Float32Array(400 * 3)
        for (let i = 0; i < 400; i++) {
          const r = 120
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(Math.random() * 0.6)
          starPos[i * 3]     = centerX + r * Math.sin(phi) * Math.cos(theta)
          starPos[i * 3 + 1] = r * Math.cos(phi) + 15
          starPos[i * 3 + 2] = centerZ + r * Math.sin(phi) * Math.sin(theta)
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
        const starMat = new THREE.PointsMaterial({
          color: 0xffffff, size: 0.6, sizeAttenuation: true,
          transparent: true, opacity: 0.75,
        })
        scene.add(new THREE.Points(starGeo, starMat))

        // ─── ЛУНА ───
        const moonTex = makeMoonTexture(THREE)
        const moonMat = new THREE.SpriteMaterial({
          map: moonTex, transparent: true, opacity: 0.95, depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const moon = new THREE.Sprite(moonMat)
        moon.scale.set(12, 12, 1)
        moon.position.set(centerX - 38, 36, centerZ - 32)
        scene.add(moon)

        // ─── ФАСАДНЫЕ ТЕКСТУРЫ ───
        const facadeCache = new Map()
        const getFacade = (baseHex, metallic) => {
          const key = `${baseHex.toString(16)}_${metallic ? 1 : 0}`
          let cached = facadeCache.get(key)
          if (!cached) {
            cached = makeFacadeTexture(THREE, { baseHex, cols: 3, rows: 3, seed: baseHex, metallic })
            facadeCache.set(key, cached)
          }
          return cached
        }

        const starTex = makeStarTexture(THREE)
        const dotTex = makeSoftDotTexture(THREE)

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
          smokeData = new Float32Array(totalSmoke * 5)
        }

        const beaconTex = makeSoftDotTexture(THREE)
        const beaconSprites = []
        const neonSigns = []

        const cityGroup = new THREE.Group()
        scene.add(cityGroup)

        const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W)
        const spireGeo = new THREE.BoxGeometry(SPIRE_W, FLOOR_H, SPIRE_W)
        const crownGeo = new THREE.BoxGeometry(CROWN_W, FLOOR_H * 1.2, CROWN_W)
        const neonGeo = new THREE.PlaneGeometry(1.7, 0.5)
        const spireMeshes = []
        const crownMeshes = []
        const goldenSprites = []

        let smokeFillIdx = 0

        DEMO_BUILDINGS.forEach((b, idx) => {
          const col = idx % COLS
          const row = Math.floor(idx / COLS)
          const baseColor = SKIN_COLORS[b.colorIdx]
          const bx = col * SPACING
          const bz = row * SPACING

          const bGroup = new THREE.Group()
          bGroup.position.set(bx, 0, bz)

          for (let i = 0; i < b.height; i++) {
            const isTop = i === b.height - 1 && b.spires === 0 && !b.golden
            const heightFactor = (i / Math.max(1, b.height - 1)) * 0.3 - 0.15 + b.hueShift
            const colorHex = (isTop && b.golden) ? GOLDEN : shiftHex(baseColor, heightFactor)

            const facade = getFacade(colorHex, b.metallic)

            const wallMat = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              map: facade.diffuse,
              emissive: 0xffffff,
              emissiveMap: facade.emissive,
              emissiveIntensity: 1.0,
              roughness: b.metallic ? 0.35 : 0.6,
              metalness: b.metallic ? 0.6 : 0.15,
            })
            const capMat = new THREE.MeshStandardMaterial({
              color: colorHex,
              roughness: b.metallic ? 0.25 : 0.5,
              metalness: b.metallic ? 0.75 : 0.2,
              emissive: colorHex,
              emissiveIntensity: b.emissive ? 0.25 : 0.06,
            })
            const matArr = [wallMat, wallMat, capMat, capMat, wallMat, wallMat]

            const mesh = new THREE.Mesh(floorGeo, matArr)
            mesh.position.y = FLOOR_H / 2 + i * FLOOR_H
            mesh.castShadow = true
            mesh.receiveShadow = true
            bGroup.add(mesh)
          }

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

          // Неоновая вывеска на фасаде (не для золотых зданий)
          if (b.hasNeon && !b.golden) {
            const neonColor = NEON_COLORS[b.neonColorIdx]
            const neonMat = new THREE.MeshBasicMaterial({
              color: neonColor, transparent: true, opacity: 0.95,
              blending: THREE.AdditiveBlending, depthWrite: false,
              side: THREE.DoubleSide,
            })
            const neon = new THREE.Mesh(neonGeo, neonMat)
            const heightAt = b.height * FLOOR_H * b.neonHeightFrac
            const half = BLOCK_W / 2 + 0.04
            const faces = [
              { x: 0,    z: half,  ry: 0 },
              { x: 0,    z: -half, ry: Math.PI },
              { x: half, z: 0,     ry: Math.PI / 2 },
              { x: -half, z: 0,    ry: -Math.PI / 2 },
            ]
            const f = faces[b.neonFace]
            neon.position.set(f.x, heightAt, f.z)
            neon.rotation.y = f.ry
            neon.userData.phase = seeded(idx + 1500) * Math.PI * 2
            neon.userData.baseColor = neonColor
            bGroup.add(neon)
            neonSigns.push(neon)
          }

          cityGroup.add(bGroup)
        })

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
            for (let i = 0; i < beaconSprites.length; i++) {
              const b = beaconSprites[i]
              const phase = b.userData.phase + t * 1.8
              const blink = (Math.sin(phase) + 1) / 2
              b.material.opacity = 0.25 + blink * 0.75
              b.scale.setScalar(0.6 + blink * 0.5)
            }
            // Уличные фонари — легкое мерцание хало + пульсация светового пятна
            for (let i = 0; i < lampHaloSprites.length; i++) {
              const halo = lampHaloSprites[i]
              const puddle = lampPuddleMeshes[i]
              const phase = halo.userData.phase + t * 0.7
              const breath = 0.88 + Math.sin(phase) * 0.09
              halo.material.opacity = breath
              halo.scale.setScalar(1.8 * (0.95 + Math.sin(phase) * 0.05))
              puddle.material.opacity = 0.5 + Math.sin(phase) * 0.08
            }
            // Неоновые вывески — мерцание с случайными glitch-моментами
            for (let i = 0; i < neonSigns.length; i++) {
              const n = neonSigns[i]
              const phase = n.userData.phase + t * 2.5
              let opacity = 0.82 + Math.sin(phase) * 0.12
              // ~2% чанс glitch-момента — детерминированно по seeded (не random)
              if (Math.sin(phase * 7.3) > 0.96) opacity *= 0.3
              n.material.opacity = opacity
            }
            lamp1_pulse: {
              // placeholder (unused label)
            }
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
          neonGeo.dispose()
          groundGeo.dispose()
          roadGeo.dispose()
          roadMat.dispose()
          roadTex.dispose()
          lampPoleGeo.dispose()
          lampPoleMat.dispose()
          bulbGeo.dispose()
          bulbMat.dispose()
          puddleGeo.dispose()
          lampHaloTex.dispose()
          puddleTex.dispose()
          moonMat.dispose()
          moonTex.dispose()
          starGeo.dispose()
          starMat.dispose()
          starTex.dispose()
          dotTex.dispose()
          beaconTex.dispose()
          facadeCache.forEach(pair => {
            pair.diffuse.dispose()
            pair.emissive.dispose()
          })
          facadeCache.clear()
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
        background: 'linear-gradient(180deg, #03030a 0%, #05050c 100%)',
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
