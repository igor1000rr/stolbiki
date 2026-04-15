/**
 * Embed-роуты: встраиваемые виджеты Города побед.
 *
 * GET /embed/city/:userId          — самодостаточная HTML с 3D визуализацией.
 * GET /embed/og/city/:userId.png   — PNG 1200×630 для og:image (Telegram, Twitter, Discord).
 *
 * PNG генерируется через @resvg/resvg-js (нативный Rust binding) —
 * лёгкий, без headless chrome. Рендер ~50ms, кэш в памяти 1 час,
 * LRU max 500 записей.
 *
 * Для работы нужны системные шрифты. На Ubuntu/Debian:
 *   apt install -y fontconfig fonts-dejavu-core
 */
import { Router } from 'express'
import { Resvg } from '@resvg/resvg-js'
import { db } from '../db.js'

const router = Router()

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const TOWER_HEIGHT = 11
function brickValue(b) {
  let v = 1
  if (b.is_ai && b.ai_difficulty) {
    const d = parseInt(b.ai_difficulty, 10) || 0
    if (d >= 1500) v += 3
    else if (d >= 800) v += 2
    else if (d >= 400) v += 1
  }
  if (!b.is_ai) v += 1
  if (b.result === 'draw_won') v += 1
  return v
}
function isSpecialWin(b) {
  if (b.result === 'draw_won') return true
  if (b.is_ai && b.ai_difficulty) {
    const d = parseInt(b.ai_difficulty, 10) || 0
    if (d >= 1500) return true
  }
  return false
}
function compileCity(userId) {
  const rows = db.prepare(`
    SELECT id, opponent_name, is_ai, ai_difficulty, player_skin_id, result, created_at
    FROM victory_buildings WHERE user_id = ? ORDER BY created_at ASC
  `).all(userId)
  const pieces = []
  for (const b of rows) {
    const v = brickValue(b)
    const special = isSpecialWin(b)
    for (let i = 0; i < v; i++) {
      pieces.push({
        skin_id: b.player_skin_id || 'blocks_classic',
        special: i === v - 1 && special,
      })
    }
  }
  const towers = []
  for (let i = 0; i < pieces.length; i += TOWER_HEIGHT) {
    const towerPieces = pieces.slice(i, i + TOWER_HEIGHT)
    const isClosed = towerPieces.length === TOWER_HEIGHT
    const top = towerPieces[towerPieces.length - 1]
    towers.push({
      pieces: towerPieces,
      is_closed: isClosed,
      golden_top: isClosed && top.special,
    })
  }
  return {
    towers,
    total_bricks: pieces.length,
    total_wins: rows.length,
  }
}

function toCompact(city) {
  return city.towers.map(t => ({
    h: t.pieces.length,
    g: t.golden_top ? 1 : 0,
    s: t.pieces.map(p => [p.skin_id, p.special ? 1 : 0]),
  }))
}

// ═══ OG картинка ═══

const SKIN_HEX_OG = {
  blocks_classic: '#6db4ff', blocks_flat: '#4a9eff', blocks_round: '#4a9eff',
  blocks_glass: '#6ab4ff', blocks_metal: '#b8d4f0', blocks_candy: '#80d0ff',
  blocks_pixel: '#4a9eff', blocks_neon: '#00e5ff', blocks_glow: '#7ec8ff',
}
const OG_GOLDEN = '#ffd86e'
const OG_CROWN = '#ffc845'

function buildOgSvg({ name, wins, bricks, closed, crowned, towers }) {
  const W = 1200, H = 630
  const safeName = esc(name).slice(0, 24)

  // Район города: снизу всей картинки
  const cityTop = 380, cityBottom = 580, cityH = cityBottom - cityTop
  const blockH = 12  // высота одного этажа-кирпича
  const maxFloors = 11

  const displayed = towers.slice(0, 28)
  const remaining = towers.length - displayed.length

  const innerW = W - 80
  const slotW = innerW / Math.max(displayed.length, 1)
  const blockW = Math.min(32, slotW * 0.78)

  let cityElems = ''
  displayed.forEach((tower, i) => {
    const x = 40 + i * slotW + (slotW - blockW) / 2
    // Строим снизу вверх
    tower.s.forEach(([skin, special], j) => {
      const color = special ? OG_GOLDEN : (SKIN_HEX_OG[skin] || SKIN_HEX_OG.blocks_classic)
      const y = cityBottom - blockH - j * blockH
      cityElems += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${blockW.toFixed(1)}" height="${blockH - 1}" fill="${color}" rx="1.5"/>`
    })
    // Корона и звезда над закрытыми high towers с golden_top
    if (tower.g) {
      const yCrown = cityBottom - blockH * (tower.h + 1)
      const cw = blockW * 0.72
      const cx = x + (blockW - cw) / 2
      cityElems += `<rect x="${cx.toFixed(1)}" y="${yCrown.toFixed(1)}" width="${cw.toFixed(1)}" height="${blockH - 1}" fill="${OG_CROWN}" rx="1.5"/>`
      // 5-конечная звезда
      const sy = yCrown - 12
      const sx = x + blockW / 2
      const r1 = 8, r2 = 3.5
      let pts = ''
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? r1 : r2
        const a = (Math.PI * 2 / 10) * k - Math.PI / 2
        pts += `${(sx + Math.cos(a) * r).toFixed(1)},${(sy + Math.sin(a) * r).toFixed(1)} `
      }
      cityElems += `<polygon points="${pts.trim()}" fill="${OG_GOLDEN}"/>`
    }
  })

  if (remaining > 0) {
    cityElems += `<text x="${W - 40}" y="${cityBottom + 30}" font-family="sans-serif" font-size="22" font-weight="600" fill="#888" text-anchor="end">+${remaining} башен</text>`
  }

  // Empty state
  if (!towers.length) {
    cityElems = `<text x="${W / 2}" y="${cityTop + cityH / 2}" font-family="sans-serif" font-size="36" fill="#444" text-anchor="middle">Город ещё пуст</text>`
  }

  // Статы: 4 крупных числа с подписями
  const stats = [
    { v: wins,    l: 'Побед',     c: '#3dd68c' },
    { v: bricks,  l: 'Кирпичей',  c: '#4a9eff' },
    { v: closed,  l: 'Высоток',    c: '#ffffff' },
    { v: crowned, l: 'С короной',  c: '#ffd86e' },
  ]
  const statW = 270
  const statY = 240
  let statElems = ''
  stats.forEach((s, i) => {
    const x = 40 + i * statW
    statElems += `<text x="${x}" y="${statY}" font-family="sans-serif" font-size="72" font-weight="800" fill="${s.c}">${s.v}</text>`
    statElems += `<text x="${x}" y="${statY + 32}" font-family="sans-serif" font-size="20" fill="#888">${s.l}</text>`
  })

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d0d22"/>
      <stop offset="100%" stop-color="#06060f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="75%" r="75%">
      <stop offset="0%" stop-color="#4a9eff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Лого -->
  <text x="40" y="58" font-family="sans-serif" font-size="22" font-weight="800" fill="#ffd86e" letter-spacing="4">HIGHRISE HEIST</text>
  <line x1="40" y1="75" x2="260" y2="75" stroke="#ffd86e" stroke-width="2" opacity="0.4"/>

  <!-- Имя игрока -->
  <text x="40" y="150" font-family="sans-serif" font-size="60" font-weight="800" fill="#ffffff">${safeName}</text>
  <text x="40" y="185" font-family="sans-serif" font-size="22" fill="#888">Город побед</text>

  <!-- Статы -->
  ${statElems}

  <!-- Город внизу -->
  ${cityElems}

  <!-- Footer разделитель -->
  <line x1="40" y1="595" x2="${W - 40}" y2="595" stroke="#222" stroke-width="1"/>

  <!-- Footer -->
  <text x="40" y="618" font-family="sans-serif" font-size="16" fill="#666">Стратегическая настолка · Побеждай, строй, выигрывай</text>
  <text x="${W - 40}" y="618" font-family="sans-serif" font-size="16" font-weight="700" fill="#ffd86e" text-anchor="end">highriseheist.com</text>
</svg>`
}

// LRU кэш PNG
const ogCache = new Map()
const OG_CACHE_TTL = 60 * 60 * 1000     // 1 час
const OG_CACHE_MAX = 500

function cacheGet(key) {
  const e = ogCache.get(key)
  if (!e) return null
  if (Date.now() - e.at > OG_CACHE_TTL) { ogCache.delete(key); return null }
  // refresh LRU position
  ogCache.delete(key); ogCache.set(key, e)
  return e.png
}
function cacheSet(key, png) {
  if (ogCache.size >= OG_CACHE_MAX) {
    const firstKey = ogCache.keys().next().value
    ogCache.delete(firstKey)
  }
  ogCache.set(key, { png, at: Date.now() })
}

router.get('/og/city/:userId.png', (req, res) => {
  const userId = parseInt(req.params.userId, 10)
  if (!userId) return res.status(400).send('invalid userId')

  // Кэш-ключ учитывает версию — при изменениях SVG-дизайна бампай версию
  const cacheKey = `v1:${userId}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    res.set('Cache-Control', 'public, max-age=1800').type('image/png').send(cached)
    return
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).send('user not found')

  let city
  try {
    city = compileCity(userId)
  } catch (e) {
    console.error('og compileCity error:', e)
    return res.status(500).send('compile error')
  }

  const closed = city.towers.filter(t => t.is_closed).length
  const crowned = city.towers.filter(t => t.golden_top).length
  const compactTowers = toCompact(city)

  try {
    const svg = buildOgSvg({
      name: user.name || `Player #${userId}`,
      wins: city.total_wins,
      bricks: city.total_bricks,
      closed, crowned,
      towers: compactTowers,
    })
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
      font: {
        loadSystemFonts: true,
        defaultFontFamily: 'DejaVu Sans',
      },
      background: '#06060f',
    })
    const png = resvg.render().asPng()
    cacheSet(cacheKey, png)
    res.set('Cache-Control', 'public, max-age=1800').type('image/png').send(png)
  } catch (e) {
    console.error('OG render error:', e)
    res.status(500).send('render error')
  }
})

// Инвалидация кэша при новой победе игрока.
// Экспортируется чтобы buildings.js мог вызывать после INSERT.
export function invalidateOgCache(userId) {
  ogCache.delete(`v1:${userId}`)
}

// ═══ HTML embed-страница ═══

router.get('/city/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10)
  if (!userId) {
    return res.status(400).type('html').send('<h1>Invalid user id</h1>')
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId)
  if (!user) {
    return res.status(404).type('html').send('<h1>Player not found</h1>')
  }

  let city
  try {
    city = compileCity(userId)
  } catch (e) {
    console.error('embed compileCity error:', e)
    return res.status(500).type('html').send('<h1>Server error</h1>')
  }

  const closed = city.towers.filter(t => t.is_closed).length
  const crowned = city.towers.filter(t => t.golden_top).length
  const playerName = esc(user.name || `Player #${user.id}`)
  const theme = req.query.theme === 'day' ? 'day' : 'night'
  const noControls = req.query.nocontrols === '1'

  const compactTowers = toCompact(city)
  const dataJson = JSON.stringify({
    towers: compactTowers,
    bricks: city.total_bricks,
    wins: city.total_wins,
    closed,
    crowned,
  })

  const ogDescription = `${city.total_wins} побед · ${city.total_bricks} кирпичей · ${closed} высоток` +
    (crowned > 0 ? ` · ★ ${crowned}` : '')
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const pageUrl = `${baseUrl}/embed/city/${userId}`
  const profileUrl = `${baseUrl}/?profile=${userId}`
  const ogImage = `${baseUrl}/embed/og/city/${userId}.png`

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${playerName} · Highrise Heist</title>
<meta name="description" content="Город побед игрока ${playerName}: ${ogDescription}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Город побед · ${playerName}">
<meta property="og:description" content="${ogDescription} · Highrise Heist">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Highrise Heist">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Город побед ${playerName}">
<meta name="twitter:description" content="${ogDescription}">
<meta name="twitter:image" content="${ogImage}">

<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: ${theme === 'day' ? '#5ba7d9' : '#06060f'}; font-family: system-ui, -apple-system, sans-serif; color: #e8e6f2; }
  #app { position: relative; width: 100%; height: 100vh; }
  #cv { width: 100%; height: 100%; display: block; }
  .overlay {
    position: absolute; left: 0; right: 0; top: 0;
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);
    pointer-events: none;
    display: flex; justify-content: space-between; align-items: flex-start;
    z-index: 5;
  }
  .name { font-size: 16px; font-weight: 700; color: ${theme === 'day' ? '#fff' : '#ffc145'}; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
  .stats { font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
  .stats strong { color: #ffd86e; }
  .stats .crown { color: #ffd86e; margin-left: 4px; }
  .footer {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 8px 16px;
    background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%);
    pointer-events: auto; z-index: 5;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: rgba(255,255,255,0.7);
  }
  .footer a { color: #ffc145; text-decoration: none; font-weight: 600; pointer-events: auto; }
  .footer a:hover { text-decoration: underline; }
  .empty {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center; flex-direction: column;
    color: rgba(255,255,255,0.5); text-align: center; padding: 20px;
  }
  .empty .em-emoji { font-size: 48px; margin-bottom: 12px; }
  .empty .em-text { font-size: 14px; max-width: 240px; line-height: 1.5; }
  .loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5); font-size: 12px; }
</style>
</head>
<body>
<div id="app">
  ${noControls ? '' : `<div class="overlay">
    <div>
      <div class="name">🏙 ${playerName}</div>
      <div class="stats"><strong>${city.total_wins}</strong> побед · <strong>${city.total_bricks}</strong> кирп. · <strong>${closed}</strong> высоток${crowned > 0 ? ` <span class="crown">★${crowned}</span>` : ''}</div>
    </div>
  </div>`}
  <canvas id="cv"></canvas>
  ${city.towers.length === 0 ? `<div class="empty">
    <div class="em-emoji">🧱</div>
    <div class="em-text">Игрок ещё не построил свой город побед</div>
  </div>` : '<div class="loading" id="loading">Загружаю 3D...</div>'}
  ${noControls ? '' : `<div class="footer">
    <span>Highrise Heist · Ставь свой город</span>
    <a href="${profileUrl}" target="_blank" rel="noopener">Открыть →</a>
  </div>`}
</div>

<script type="module">
const CITY = ${dataJson};
const THEME = ${JSON.stringify(theme)};

if (CITY.towers.length === 0) {
  // Пусто — ничего не рисуем
} else {
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.169/build/three.module.js');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.169/examples/jsm/controls/OrbitControls.js');

    document.getElementById('loading')?.remove();

    const SKIN_HEX = {
      blocks_classic: 0x6db4ff, blocks_flat: 0x4a9eff, blocks_round: 0x4a9eff,
      blocks_glass: 0x6ab4ff, blocks_metal: 0xb8d4f0, blocks_candy: 0x80d0ff,
      blocks_pixel: 0x4a9eff, blocks_neon: 0x00e5ff, blocks_glow: 0x7ec8ff,
    };
    const GOLDEN = 0xffd86e, CROWN = 0xffc845;
    const COLS = 5, SPACING = 6, FLOOR_H = 1.2, BLOCK_W = 3, CROWN_W = 2.5;

    const cv = document.getElementById('cv');
    const w = cv.clientWidth, h = cv.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(THEME === 'day' ? 0x5ba7d9 : 0x0a0a18);
    scene.fog = new THREE.Fog(THEME === 'day' ? 0x8ec6ea : 0x0a0a18, 50, 220);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
    const rows = Math.max(1, Math.ceil(CITY.towers.length / COLS));
    const cx = ((COLS - 1) / 2) * SPACING, cz = ((rows - 1) / 2) * SPACING;
    const dist = Math.max(25, Math.max(COLS, rows) * SPACING * 1.4);
    camera.position.set(cx + dist * 0.7, dist * 0.6, cz + dist * 0.7);
    camera.lookAt(cx, 3, cz);

    scene.add(new THREE.AmbientLight(THEME === 'day' ? 0xc0d8e8 : 0x8080c0, THEME === 'day' ? 0.65 : 0.45));
    const sun = new THREE.DirectionalLight(THEME === 'day' ? 0xffffff : 0xfff0c8, THEME === 'day' ? 1.4 : 1.1);
    sun.position.set(cx + 25, 40, cz + 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: THEME === 'day' ? 0x8a9ba8 : 0x0d0d22, roughness: 0.85 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const floorGeo = new THREE.BoxGeometry(BLOCK_W, FLOOR_H, BLOCK_W);
    const crownGeo = new THREE.BoxGeometry(CROWN_W, FLOOR_H, CROWN_W);

    CITY.towers.forEach((tower, idx) => {
      const col = idx % COLS, row = Math.floor(idx / COLS);
      const bx = col * SPACING, bz = row * SPACING;
      const group = new THREE.Group();
      group.position.set(bx, 0, bz);
      tower.s.forEach(([skin, special], i) => {
        const color = special ? GOLDEN : (SKIN_HEX[skin] || SKIN_HEX.blocks_classic);
        const mat = new THREE.MeshStandardMaterial({
          color, roughness: 0.55, metalness: 0.15,
          emissive: color, emissiveIntensity: special ? 0.4 : 0,
        });
        const m = new THREE.Mesh(floorGeo, mat);
        m.position.y = FLOOR_H / 2 + i * FLOOR_H;
        m.castShadow = true; m.receiveShadow = true;
        group.add(m);
      });
      if (tower.g) {
        const cmat = new THREE.MeshStandardMaterial({
          color: CROWN, roughness: 0.25, metalness: 0.85,
          emissive: CROWN, emissiveIntensity: 0.4,
        });
        const cm = new THREE.Mesh(crownGeo, cmat);
        cm.position.y = FLOOR_H / 2 + tower.h * FLOOR_H;
        cm.castShadow = true;
        group.add(cm);
      }
      scene.add(group);
    });

    const controls = new OrbitControls(camera, cv);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(cx, 3, cz);
    controls.minDistance = 10;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        const w2 = cv.clientWidth, h2 = cv.clientHeight;
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
      else if (!document.hidden && !raf) animate();
    });
  } catch (e) {
    console.error('Embed render error:', e);
    const loading = document.getElementById('loading');
    if (loading) loading.textContent = 'WebGL не поддерживается';
  }
}
</script>
</body>
</html>`

  res.set({
    'Cache-Control': 'public, max-age=300',
    'X-Frame-Options': 'ALLOWALL',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net; frame-ancestors *;",
  })
  res.type('html').send(html)
})

export default router
