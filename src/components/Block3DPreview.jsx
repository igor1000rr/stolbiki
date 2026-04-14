/**
 * Block3DPreview — вращающаяся 3D башенка из блоков активного скина.
 * Показывается в хедере вкладки "Блоки" SkinShop.
 *
 * Использует three.js напрямую: 5 кубиков (3 синих + 2 красных) в стопке,
 * авто-вращение, направленный свет + ambient, тени.
 *
 * При ошибке WebGL просто ничего не рендерит (container пустой, grid-сетка
 * с 2D-превью скинов внизу всё ещё работает).
 */
import { useEffect, useRef } from 'react'

// Палитры hex для скинов — синхронизированы с VictoryCity
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
  // legacy алиасы
  classic:        { 0: 0x6db4ff, 1: 0xff8888 },
  flat:           { 0: 0x4a9eff, 1: 0xff6066 },
  rounded:        { 0: 0x4a9eff, 1: 0xff6066 },
  glass:          { 0: 0x6ab4ff, 1: 0xff7c80 },
  metal:          { 0: 0xb8d4f0, 1: 0xf0b8b8 },
  candy:          { 0: 0x80d0ff, 1: 0xff80b0 },
  pixel:          { 0: 0x4a9eff, 1: 0xff6066 },
  neon:           { 0: 0x00e5ff, 1: 0xff3090 },
  glow:           { 0: 0x7ec8ff, 1: 0xff9090 },
}

// Характеристики материала по стилю
const SKIN_MAT = {
  blocks_classic: { roughness: 0.55, metalness: 0.15, emissive: 0 },
  blocks_flat:    { roughness: 0.8,  metalness: 0.05, emissive: 0 },
  blocks_round:   { roughness: 0.5,  metalness: 0.1,  emissive: 0 },
  blocks_glass:   { roughness: 0.1,  metalness: 0.2,  emissive: 0.08, opacity: 0.75, transparent: true },
  blocks_metal:   { roughness: 0.25, metalness: 0.85, emissive: 0 },
  blocks_candy:   { roughness: 0.35, metalness: 0.2,  emissive: 0 },
  blocks_pixel:   { roughness: 0.95, metalness: 0,    emissive: 0, flatShading: true },
  blocks_neon:    { roughness: 0.4,  metalness: 0.3,  emissive: 0.5 },
  blocks_glow:    { roughness: 0.45, metalness: 0.25, emissive: 0.3 },
}

function hasWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

// Нормализация skinId: blocks_xxx и xxx работают одинаково
function normalizeSkin(id) {
  if (!id) return 'blocks_classic'
  if (id.startsWith('blocks_')) return id
  return 'blocks_' + id
}

export default function Block3DPreview({ skinId = 'blocks_classic', height = 160 }) {
  const containerRef = useRef(null)
  const stateRef = useRef(null)

  useEffect(() => {
    if (!hasWebGL() || !containerRef.current) return
    const skin = normalizeSkin(skinId)
    const pal = SKIN_HEX[skin] || SKIN_HEX.blocks_classic
    const matProps = SKIN_MAT[skin] || SKIN_MAT.blocks_classic

    let disposed = false

    ;(async () => {
      try {
        const THREE = await import('three')
        if (disposed) return
        const container = containerRef.current
        if (!container) return

        const w = container.clientWidth
        const h = height

        const scene = new THREE.Scene()
        // Тёмный фон в тон surface
        scene.background = null // transparent

        const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 50)
        camera.position.set(4.5, 3.2, 5.5)
        camera.lookAt(0, 1.8, 0)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(w, h)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        container.appendChild(renderer.domElement)
        renderer.domElement.style.display = 'block'

        // Свет
        const ambient = new THREE.AmbientLight(0xffffff, 0.5)
        scene.add(ambient)
        const key = new THREE.DirectionalLight(0xfff0d0, 1.2)
        key.position.set(4, 6, 4)
        key.castShadow = true
        key.shadow.mapSize.set(512, 512)
        key.shadow.camera.left = -5
        key.shadow.camera.right = 5
        key.shadow.camera.top = 5
        key.shadow.camera.bottom = -5
        scene.add(key)
        const rim = new THREE.DirectionalLight(0x6080ff, 0.4)
        rim.position.set(-4, 2, -4)
        scene.add(rim)

        // "Пол" под башенкой (мягкая тень)
        const floorGeo = new THREE.CircleGeometry(3, 32)
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 })
        const floor = new THREE.Mesh(floorGeo, floorMat)
        floor.rotation.x = -Math.PI / 2
        floor.position.y = -0.01
        floor.receiveShadow = true
        scene.add(floor)

        // Башенка: 5 кубиков (3 нижних p1, 2 верхних p2)
        const tower = new THREE.Group()
        scene.add(tower)

        const blockGeo = new THREE.BoxGeometry(1.4, 0.65, 1.4)
        for (let i = 0; i < 5; i++) {
          const isP1 = i < 3
          const color = isP1 ? pal[0] : pal[1]
          const mat = new THREE.MeshStandardMaterial({
            color,
            roughness: matProps.roughness,
            metalness: matProps.metalness,
            emissive: color,
            emissiveIntensity: matProps.emissive || 0,
            flatShading: matProps.flatShading || false,
            transparent: matProps.transparent || false,
            opacity: matProps.opacity != null ? matProps.opacity : 1,
          })
          const mesh = new THREE.Mesh(blockGeo, mat)
          mesh.position.y = 0.325 + i * 0.7
          mesh.castShadow = true
          mesh.receiveShadow = true
          tower.add(mesh)
        }

        // Анимация
        let rafId = 0
        const clock = new THREE.Clock()
        const animate = () => {
          rafId = requestAnimationFrame(animate)
          const t = clock.getElapsedTime()
          tower.rotation.y = t * 0.6
          // Пульсация emissive для neon/glow
          if (matProps.emissive > 0.2) {
            tower.children.forEach((m, i) => {
              m.material.emissiveIntensity = matProps.emissive + Math.sin(t * 2 + i * 0.5) * 0.15
            })
          }
          renderer.render(scene, camera)
        }
        animate()

        // Resize
        const onResize = () => {
          if (!container) return
          const w2 = container.clientWidth
          camera.aspect = w2 / height
          camera.updateProjectionMatrix()
          renderer.setSize(w2, height)
        }
        window.addEventListener('resize', onResize)

        stateRef.current = { scene, renderer, rafId, onResize, blockGeo, floorGeo }
      } catch (e) {
        console.error('[Block3DPreview] WebGL init error:', e)
      }
    })()

    return () => {
      disposed = true
      if (stateRef.current) {
        const { scene, renderer, rafId, onResize, blockGeo, floorGeo } = stateRef.current
        cancelAnimationFrame(rafId)
        window.removeEventListener('resize', onResize)
        scene?.traverse(o => {
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
            else o.material.dispose()
          }
        })
        blockGeo?.dispose()
        floorGeo?.dispose()
        renderer?.dispose()
        if (renderer?.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement)
        }
        stateRef.current = null
      }
    }
  }, [skinId, height])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(74,158,255,0.03), rgba(155,89,182,0.03))',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    />
  )
}
