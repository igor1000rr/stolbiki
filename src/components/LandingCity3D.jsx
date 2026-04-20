/**
 * LandingCity3D — 3D-превью «Города побед» на главной странице.
 *
 * v5.9.15: дороги слиты в одну большую площадь-плиту.
 *   Раньше была сетка из 8 прямоугольных stripe-ов (rows+1 горизонтальных + cols+1
 *   вертикальных), которые создавали «плиточный» эффект. Теперь это одна большая
 *   plane-плита под всем городом (асфальт как у реальных городских площадей).
 *
 * Наследие от v5.9.14:
 *   - Реальные PointLight у фонарей (свет падает на плиту и здания)
 *   - Цветные PointLight у неонов
 *   - Огни машин на виртуальных полосах между зданиями
 */
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../engine/i18n'
import {
  makeRoadTexture, makeStarTexture, makeSoftDotTexture,
  makeFacadeTexture, makeMoonTexture,
  makeLampHaloTexture,
} from './victoryCityTextures'

const SKIN_COLORS = [
  0x4a9eff, 0xff6066, 0x00e5ff, 0xff3090, 0xffc145,
  0x3dd68c, 0x9b59b6, 0x00bcd4, 0xf48fb1, 0xffa726,
]
const GOLDEN = 0xffd86e
const CROWN_HEX = 0xffc845
const SMOKE_PER_BUILDING = 5
const ROOF_BEACON_CHANCE = 0.3
const NEON_CHANCE = 0.55
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
    hasNeon: seeded(i + 1100) < NEON_CHANCE,
    neonColorIdx: Math.floor(seeded(i + 1200) * NEON_COLORS.length),
    neonFace: Math.floor(seeded(i + 1300) * 4),
    neonHeightFrac: 0.3 + seeded(i + 1400) * 0.45,
    neonVertical: seeded(i + 1500) < 0.35,
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
        scene.background = new THREE.Color(0x04040a)
        scene.fog = new THREE.Fog(0x04040a, 28, 110)

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
        renderer.toneMappingExposure = 1.35
        container.appendChild(renderer.domElement)
        renderer.domElement.style.display = 'block'
        renderer.domElement.style.borderRadius = '14px'
        renderer.domElement.style.touchAction = 'none'

        scene.add(new THREE.AmbientLight(0x3040a0, 0.35))

        const sun = new THREE.DirectionalLight(0xaab0d8, 0.55)
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

        const rim = new THREE.DirectionalLight(0x6050b0, 0.45)
        rim.position.set(centerX - 15, 12, centerZ - 15)
        scene.add(rim)

        // Дальний фон — почти чёрная плоскость вокруг города
        const groundGeo = new THREE.PlaneGeometry(160, 160)
        const ground = new THREE.Mesh(
          groundGeo,
          new THREE.MeshStandardMaterial({ color: 0x040408, roughness: 0.9, metalness: 0.05 }),
        )
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.02
        ground.receiveShadow = true
        scene.add(ground)

        // ─── ГОРОДСКАЯ ПЛОЩАДЬ (одна большая плита вместо сетки дорог) ───
        // Плита покрывает весь город + полосу вокруг. MeshStandardMaterial — свет от
        // фонарей и неонов по-настоящему падает на неё (круглые блики).
        const plazaW = COLS * SPACING + SPACING * 1.5
        const plazaD = rows * SPACING + SPACING * 1.5
        const plazaTex = makeRoadTexture(THREE)
        plazaTex.repeat.set(plazaW / SPACING, plazaD / SPACING)
        plazaTex.needsUpdate = true
        const plazaMat = new THREE.MeshStandardMaterial({
          map: plazaTex,
          color: 0xffffff,
          roughness: 0.85,
          metalness: 0.1,
        })
        const plazaGeo = new THREE.PlaneGeometry(plazaW, plazaD)
        const plaza = new THREE.Mesh(plazaGeo, plazaMat)
        plaza.rotation.x = -Math.PI / 2
        plaza.position.set(centerX, 0, centerZ)
        plaza.receiveShadow = true
        scene.add(plaza)

        // ─── УЛИЧНЫЕ ФОНАРИ ───
        const lampHaloTex = makeLampHaloTexture(THREE)
        const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.12, 4, 8)
        const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x20202a, roughness: 0.8, metalness: 0.3 })
        const bulbGeo = new THREE.SphereGeometry(0.28, 12, 12)
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff5d0 })

        const lampPositions = [
          [-SPACING / 2, centerZ - SPACING / 2],
          [SPACING + SPACING / 2, centerZ - SPACING / 2],
          [centerX + SPACING / 2, centerZ + SPACING / 2],
          [(COLS - 1) * SPACING + SPACING / 2, centerZ + SPACING / 2],
          [centerX - SPACING / 2, -SPACING / 2],
          [centerX + SPACING / 2, (rows - 1) * SPACING + SPACING / 2],
        ]
        const lampHaloSprites = []
        const lampPointLights = []
        const lampGroup = new THREE.Group()
        for (let i = 0; i < lampPositions.length; i++) {
          const [lx, lz] = lampPositions[i]
          const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat)
          pole.position.set(lx, 2, lz)
          pole.castShadow = true
          lampGroup.add(pole)
          const bulb = new THREE.Mesh(bulbGeo, bulbMat)
          bulb.position.set(lx, 4.05, lz)
          lampGroup.add(bulb)
          const haloMat = new THREE.SpriteMaterial({
            map: lampHaloTex, color: 0xffdca0,
            transparent: true, opacity: 0.95, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
          const halo = new THREE.Sprite(haloMat)
          halo.scale.set(3.5, 3.5, 1)
          halo.position.set(lx, 4.05, lz)
          halo.userData.phase = seeded(i + 5000) * Math.PI * 2
          lampGroup.add(halo)
          lampHaloSprites.push(halo)
          const pointLight = new THREE.PointLight(0xffb060, 3.0, 14, 2)
          pointLight.position.set(lx, 4, lz)
          pointLight.userData.phase = halo.userData.phase
          lampGroup.add(pointLight)
          lampPointLights.push(pointLight)
        }
        scene.add(lampGroup)

        // ─── ЗВЁЗДЫ НА НЕБЕ ───
        const starGeo = new THREE.BufferGeometry()
        const starPos = new Float32Array(500 * 3)
        for (let i = 0; i < 500; i++) {
          const r = 120
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(Math.random() * 0.6)
          starPos[i * 3]     = centerX + r * Math.sin(phi) * Math.cos(theta)
          starPos[i * 3 + 1] = r * Math.cos(phi) + 15
          starPos[i * 3 + 2] = centerZ + r * Math.sin(phi) * Math.sin(theta)
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
        const starMat = new THREE.PointsMaterial({
          color: 0xffffff, size: 0.7, sizeAttenuation: true,
          transparent: true, opacity: 0.8,
        })
        scene.add(new THREE.Points(starGeo, starMat))

        // ─── ЛУНА ───
        const moonTex = makeMoonTexture(THREE)
        const moonMat = new THREE.SpriteMaterial({
          map: moonTex, transparent: true, opacity: 1, depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const moon = new THREE.Sprite(moonMat)
        moon.scale.set(14, 14, 1)
        moon.position.set(centerX - 38, 38, centerZ - 32)
        scene.add(moon)

        // ─── ОГНИ МАШИН (виртуальные полосы между зданиями) ───
        // Дорог больше нет — машины ездят по виртуальным линиям между рядами зданий.
        // Это сохраняет эффект «живого города» без визуальных дорожных плит.
        const carSpriteTex = makeSoftDotTexture(THREE)
        const carLightsGroup = new THREE.Group()
        const cars = []
        const CAR_COUNT = 10

        // Виртуальные полосы между рядами/колонками зданий
        const lanesH = []  // z-координаты горизонтальных полос (машина едет вдоль X)
        const lanesV = []  // x-координаты вертикальных полос (машина едет вдоль Z)
        for (let r = -1; r < rows; r++) lanesH.push(r * SPACING + SPACING / 2)
        for (let c = -1; c < COLS; c++) lanesV.push(c * SPACING + SPACING / 2)

        const laneMinX = -SPACING
        const laneMaxX = COLS * SPACING
        const laneMinZ = -SPACING
        const laneMaxZ = rows * SPACING

        for (let i = 0; i < CAR_COUNT; i++) {
          const horizontal = seeded(i + 7000) < 0.5
          const laneOffset = (seeded(i + 7100) < 0.5 ? -1 : 1) * 0.45

          const frontMat = new THREE.SpriteMaterial({
            map: carSpriteTex, color: 0xfff0c0,
            transparent: true, opacity: 1, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
          const backMat = new THREE.SpriteMaterial({
            map: carSpriteTex, color: 0xff2040,
            transparent: true, opacity: 0.9, depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
          const front = new THREE.Sprite(frontMat)
          const back = new THREE.Sprite(backMat)
          front.scale.set(0.55, 0.55, 1)
          back.scale.set(0.45, 0.45, 1)

          carLightsGroup.add(front, back)

          const car = {
            front, back, horizontal, laneOffset,
            speed: 2.2 + seeded(i + 7200) * 1.8,
            progress: seeded(i + 7300) * (laneMaxX - laneMinX),
          }
          if (horizontal) {
            car.roadZ = lanesH[Math.floor(seeded(i + 7400) * lanesH.length)]
            car.dir = seeded(i + 7500) < 0.5 ? 1 : -1
          } else {
            car.roadX = lanesV[Math.floor(seeded(i + 7400) * lanesV.length)]
            car.dir = seeded(i + 7500) < 0.5 ? 1 : -1
          }
          cars.push(car)
        }
        scene.add(carLightsGroup)

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
        const neonPointLights = []

        const cityGroup = new THREE.Group()
        scene.add(cityGroup)

        const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W)
        const spireGeo = new THREE.BoxGeometry(SPIRE_W, FLOOR_H, SPIRE_W)
        const crownGeo = new THREE.BoxGeometry(CROWN_W, FLOOR_H * 1.2, CROWN_W)
        const neonHGeo = new THREE.PlaneGeometry(2.4, 0.8)
        const neonVGeo = new THREE.PlaneGeometry(0.7, 2.5)
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

          if (b.hasNeon && !b.golden) {
            const neonColor = NEON_COLORS[b.neonColorIdx]
            const neonMat = new THREE.MeshBasicMaterial({
              color: neonColor, transparent: true, opacity: 1.0,
              blending: THREE.AdditiveBlending, depthWrite: false,
              side: THREE.DoubleSide,
            })
            const geo = b.neonVertical ? neonVGeo : neonHGeo
            const neon = new THREE.Mesh(geo, neonMat)
            const heightAt = b.height * FLOOR_H * b.neonHeightFrac
            const half = BLOCK_W / 2 + 0.05
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
            bGroup.add(neon)
            neonSigns.push(neon)

            const neonLight = new THREE.PointLight(neonColor, 1.8, 5, 2)
            const nx = f.x === 0 ? 0 : f.x * 1.3
            const nz = f.z === 0 ? 0 : f.z * 1.3
            neonLight.position.set(nx, heightAt, nz)
            neonLight.userData.phase = neon.userData.phase
            neonLight.userData.baseIntensity = 1.8
            bGroup.add(neonLight)
            neonPointLights.push(neonLight)
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
            for (let i = 0; i < lampHaloSprites.length; i++) {
              const halo = lampHaloSprites[i]
              const pLight = lampPointLights[i]
              const phase = halo.userData.phase + t * 0.7
              const breath = 0.9 + Math.sin(phase) * 0.08
              halo.material.opacity = breath
              halo.scale.setScalar(3.5 * (0.95 + Math.sin(phase) * 0.05))
              pLight.intensity = 2.8 + Math.sin(phase) * 0.4
            }
            for (let i = 0; i < neonSigns.length; i++) {
              const n = neonSigns[i]
              const nLight = neonPointLights[i]
              const phase = n.userData.phase + t * 2.5
              let opacity = 0.85 + Math.sin(phase) * 0.12
              let lightMul = 1.0
              if (Math.sin(phase * 7.3) > 0.96) {
                opacity *= 0.25
                lightMul = 0.3
              }
              n.material.opacity = opacity
              nLight.intensity = nLight.userData.baseIntensity * lightMul
            }
            for (let i = 0; i < cars.length; i++) {
              const car = cars[i]
              car.progress += dt * car.speed * car.dir
              if (car.horizontal) {
                let x = laneMinX + car.progress
                if (car.dir > 0 && x > laneMaxX + 3) {
                  car.progress = 0
                  x = laneMinX
                } else if (car.dir < 0 && x < laneMinX - 3) {
                  car.progress = laneMaxX - laneMinX
                  x = laneMaxX
                }
                const z = car.roadZ + car.laneOffset
                const frontX = x + car.dir * 0.4
                const backX = x - car.dir * 0.4
                car.front.position.set(frontX, 0.3, z)
                car.back.position.set(backX, 0.3, z)
              } else {
                let z = laneMinZ + car.progress
                if (car.dir > 0 && z > laneMaxZ + 3) {
                  car.progress = 0
                  z = laneMinZ
                } else if (car.dir < 0 && z < laneMinZ - 3) {
                  car.progress = laneMaxZ - laneMinZ
                  z = laneMaxZ
                }
                const x = car.roadX + car.laneOffset
                const frontZ = z + car.dir * 0.4
                const backZ = z - car.dir * 0.4
                car.front.position.set(x, 0.3, frontZ)
                car.back.position.set(x, 0.3, backZ)
              }
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
          neonHGeo.dispose()
          neonVGeo.dispose()
          groundGeo.dispose()
          plazaGeo.dispose()
          plazaMat.dispose()
          plazaTex.dispose()
          lampPoleGeo.dispose()
          lampPoleMat.dispose()
          bulbGeo.dispose()
          bulbMat.dispose()
          lampHaloTex.dispose()
          moonMat.dispose()
          moonTex.dispose()
          starGeo.dispose()
          starMat.dispose()
          starTex.dispose()
          dotTex.dispose()
          beaconTex.dispose()
          carSpriteTex.dispose()
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
        background: 'linear-gradient(180deg, #02020a 0%, #04040b 100%)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
        minHeight: 240,
        maxWidth: 780,
        margin: '0 auto',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 60px rgba(255,180,100,0.1)',
      }}
      aria-label={en ? '3D preview of Victory City' : '3D-превью Города побед'}
    />
  )
}
