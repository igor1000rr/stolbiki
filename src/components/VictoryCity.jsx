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
 *
 * Screenshot: кнопка "Скачать снимок" → PNG / Web Share API с файлом.
 *
 * Fallback: при отсутствии WebGL / ошибке инициализации подгружается
 * VictoryCity2D (SVG 2.5D) через lazy import.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useI18n } from '../engine/i18n'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))

// Палитры скинов → hex для three.js (верхняя грань основная, three делает освещение)
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

// Проверяем поддержку WebGL
function hasWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch { return false }
}

// easeOutCubic — красивый замедляющийся приезд
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

const COLS = 5
const SPACING = 6        // расстояние между зданиями в 3D-мире
const FLOOR_H = 1.2      // высота одного этажа
const BLOCK_W = 3        // ширина блока
const SPIRE_W = 2.5      // ширина шпиля
const INTRO_MS = 1800    // длительность intro-анимации
const FOCUS_MS = 700     // длительность zoom к зданию при клике

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

        // Scene с градиентным фоном
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0a18)
        scene.fog = new THREE.Fog(0x0a0a18, 50, 200)

        // Камера — изометрический обзор сверху-сбоку
        const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500)

        // Определяем центр города чтобы направить туда камеру
        const rows = Math.max(1, Math.ceil(buildings.length / COLS))
        const centerX = ((COLS - 1) / 2) * SPACING
        const centerZ = ((rows - 1) / 2) * SPACING
        const dist = Math.max(25, Math.max(COLS, rows) * SPACING * 1.4)

        // Финальная "цель" камеры и таргета
        const finalCamPos = new THREE.Vector3(
          centerX + dist * 0.7, dist * 0.6, centerZ + dist * 0.7,
        )
        const finalTarget = new THREE.Vector3(centerX, 3, centerZ)

        // Intro: стартуем высоко над центром города (вид "с вертолёта")
        camera.position.set(centerX, dist * 1.8, centerZ + 2)
        camera.lookAt(centerX, 0, centerZ)
        const introStartPos = camera.position.clone()
        const introStartTarget = new THREE.Vector3(centerX, 0, centerZ)

        // Renderer — preserveDrawingBuffer=true нужен для screenshot toBlob/toDataURL
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

        // Легкий фиолетовый back-light для атмосферы
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

        // Сетка-гайды
        const grid = new THREE.GridHelper(120, 40, 0x2a2a4a, 0x15152a)
        grid.position.y = 0
        scene.add(grid)

        // Звёздный купол (простые точки в небе)
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

        // Общая geometry для этажей и шпилей (экономия памяти)
        const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W)
        const spireGeo = new THREE.BoxGeometry(SPIRE_W, FLOOR_H, SPIRE_W)

        // Маппинг id здания → позиция (для focus при клике)
        const buildingPositions = new Map()

        // Для каждого здания — группа
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
          buildingPositions.set(b.id, { x: bx, z: bz, height: (chips.length + extraFloors) * FLOOR_H })

          // Обычные этажи
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

          // Шпили за сложность AI (сужаются, светятся сильнее)
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
          }

          cityGroup.add(bGroup)
        })

        // OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.minDistance = 10
        controls.maxDistance = 150
        controls.maxPolarAngle = Math.PI / 2.1  // не даём камере под землю
        controls.target.copy(introStartTarget)
        controls.enablePan = true
        controls.panSpeed = 0.6
        controls.rotateSpeed = 0.7
        controls.zoomSpeed = 0.8
        controls.enabled = false  // выключены на время intro-анимации
        controls.update()

        // Анимация: intro (при загрузке) + focus (при клике на здание)
        const introStart = performance.now()
        let focusAnim = null  // { fromPos, toPos, fromTarget, toTarget, start }

        function startFocusAnim(buildingId) {
          const p = buildingPositions.get(buildingId)
          if (!p) return
          // Позиция камеры: слегка сбоку-сверху от здания, с отступом
          const offset = Math.max(8, p.height + 6)
          focusAnim = {
            fromPos: camera.position.clone(),
            toPos: new THREE.Vector3(p.x + offset * 0.8, p.height + offset * 0.5, p.z + offset * 0.8),
            fromTarget: controls.target.clone(),
            toTarget: new THREE.Vector3(p.x, p.height / 2, p.z),
            start: performance.now(),
          }
          controls.enabled = false
        }

        // Raycaster для кликов
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
          if (dx > 5 || dy > 5) return  // это был drag, не клик
          // Не ловим клики пока идёт intro
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

        // Resize
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
        let rafId = 0
        const clock = new THREE.Clock()
        const animate = () => {
          rafId = requestAnimationFrame(animate)
          const t = clock.getElapsedTime()
          const now = performance.now()

          // Intro-анимация — плавный полёт сверху вниз к изометрии
          const introElapsed = now - introStart
          if (introElapsed < INTRO_MS) {
            const p = introElapsed / INTRO_MS
            const e = easeOutCubic(p)
            camera.position.lerpVectors(introStartPos, finalCamPos, e)
            controls.target.lerpVectors(introStartTarget, finalTarget, e)
            camera.lookAt(controls.target)
          } else if (controls.enabled === false && !focusAnim) {
            // Intro закончилась, даём управление юзеру
            controls.enabled = true
          }

          // Focus-анимация (клик на здание)
          if (focusAnim) {
            const p = Math.min(1, (now - focusAnim.start) / FOCUS_MS)
            const e = easeOutCubic(p)
            camera.position.lerpVectors(focusAnim.fromPos, focusAnim.toPos, e)
            controls.target.lerpVectors(focusAnim.fromTarget, focusAnim.toTarget, e)
            camera.lookAt(controls.target)
            if (p >= 1) {
              focusAnim = null
              controls.enabled = true
            }
          }

          // Пульсация emissive у шпилей
          cityGroup.traverse(o => {
            if (o.isMesh && o.geometry === spireGeo) {
              o.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + o.position.y) * 0.1
            }
          })

          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        threeRef.current = { scene, camera, renderer, controls, onResize, rafId, floorGeo, spireGeo }
      } catch (e) {
        console.error('[VictoryCity] WebGL init error:', e)
        if (!disposed) setForceSvg(true)
      }
    })()

    return () => {
      disposed = true
      if (threeRef.current) {
        const { scene, renderer, controls, onResize, rafId, floorGeo, spireGeo } = threeRef.current
        cancelAnimationFrame(rafId)
        window.removeEventListener('resize', onResize)
        controls?.dispose()
        // dispose materials (geo переиспользуются — диспоузим один раз)
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

  // ─── Скачать/поделиться скриншотом текущей 3D-сцены ───
  function downloadScreenshot() {
    const t = threeRef.current
    if (!t?.renderer || !t?.scene || !t?.camera) return
    // Форсируем свежий рендер-кадр перед снимком
    t.renderer.render(t.scene, t.camera)
    t.renderer.domElement.toBlob((blob) => {
      if (!blob) return
      const filename = `highrise-heist-city-${Date.now()}.png`
      const file = new File([blob], filename, { type: 'image/png' })
      const shareText = en
        ? `My Victory City in Highrise Heist — ${stats?.total || 0} wins!`
        : `Мой Город побед в Highrise Heist — ${stats?.total || 0} побед!`
      // Web Share API с файлом — мобилка
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        navigator.share({ text: shareText, files: [file] })
          .then(() => {
            setSnapshotMsg(en ? 'Shared!' : 'Отправлено!')
            setTimeout(() => setSnapshotMsg(null), 2000)
          })
          .catch(() => {
            // Пользователь отменил — не показываем ошибку
          })
      } else {
        // Desktop fallback — скачивание PNG
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

      {/* Кнопка "Скачать снимок" — только для 3D-режима */}
      {!useFallback && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, gap: 10, alignItems: 'center' }}>
          <button
            className="btn"
            onClick={downloadScreenshot}
            style={{
              fontSize: 12, padding: '8px 16px',
              borderColor: 'var(--accent)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📸 {en ? 'Download snapshot' : 'Скачать снимок'}
          </button>
          {snapshotMsg && (
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, animation: 'fadeIn 0.3s ease' }}>
              {snapshotMsg}
            </span>
          )}
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
