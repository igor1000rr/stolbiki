/**
 * Embed-роуты: встраиваемые виджеты Города побед.
 *
 * GET /embed/city/:userId — самодостаточная HTML-страница с 3D визуализацией
 * города игрока. Не зависит от основного бандла. Содержит OG-теги
 * для красивых превью в соцсетях.
 *
 * Предназначено для:
 *  - <iframe src="https://highriseheist.com/embed/city/123"> в блогах/форумах
 *  - Превью при шаре линки в Telegram/Twitter/Discord
 *  - TikTok bio link, Twitter cards
 *
 * Параметры query string:
 *  - ?theme=night|day (default night)
 *  - ?nocontrols=1 (спрятать подпись и лого — для чистых скриншотов)
 */
import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// HTML escape helper: ck XSS-защита для имени
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Переиспользуем ту же логику что в buildings.js — локальный compileCity
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

  // Компактные данные для клиентского рендера — только то что нужно для визуала
  const compactTowers = city.towers.map(t => ({
    h: t.pieces.length,
    g: t.golden_top ? 1 : 0,
    s: t.pieces.map(p => [p.skin_id, p.special ? 1 : 0]),
  }))
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

  // Самодостаточная страница с лёгким three.js-рендером из CDN
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${playerName} · Highrise Heist</title>
<meta name="description" content="Город побед игрока ${playerName}: ${ogDescription}">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="🏙 Город побед · ${playerName}">
<meta property="og:description" content="${ogDescription} · Highrise Heist">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Highrise Heist">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Город побед ${playerName}">
<meta name="twitter:description" content="${ogDescription}">

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
  // Лёгкий рендер с three.js из CDN
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

  // Позволяем iframe из любых доменов, кэш на 5 мин
  res.set({
    'Cache-Control': 'public, max-age=300',
    'X-Frame-Options': 'ALLOWALL',
    // CSP для embed: разрешаем three.js из CDN
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net; frame-ancestors *;",
  })
  res.type('html').send(html)
})

export default router
