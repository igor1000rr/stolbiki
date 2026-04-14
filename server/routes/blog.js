import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

const router = Router()

const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
if (blogCount === 0) {
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Highrise Heist выходит в открытую бету!\n\n- Игра против AI\n- Онлайн мультиплеер\n- Головоломки\n- 4 темы\n- Print & Play PDF',
    'Highrise Heist enters open beta!\n\n- Play vs AI\n- Online multiplayer\n- Puzzles\n- 4 themes\n- Print & Play PDF',
    'release', 0, '2026-02-15 10:00:00')
}

const addPost = (slug, tru, ten, bru, ben, tag, date) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?,?,?,?,?,?,0,?)').run(slug, tru, ten, bru, ben, tag, date)
}

addPost('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
  '- 1146 итераций self-play\n- Loss: 0.098\n- Winrate: 97%\n- Баланс P1/P2: 50/50',
  '- 1146 self-play iterations\n- Loss: 0.098\n- Win rate: 97%\n- P1/P2 balance: 50/50',
  'ai', '2026-02-20 14:00:00')

addPost('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
  'Тактические головоломки:\n\n- Головоломка дня\n- Задача недели\n- Банк из 50 задач\n- Лидерборды',
  'Tactical puzzles:\n\n- Daily puzzle\n- Weekly challenge\n- 50 puzzle bank\n- Leaderboards',
  'feature', '2026-03-01 12:00:00')

addPost('update-march-2026', 'v3.0: Масштабное обновление', 'v3.0: Major update',
  '26 ачивок, рейтинговые сезоны, 14 настроек и полная мультиязычность.',
  '26 achievements, ranked seasons, 14 settings, full RU/EN translation.',
  'release', '2026-03-15 10:00:00')

addPost('v35-gpu', 'v3.5: GPU-нейросеть в браузере', 'v3.5: GPU neural network in browser',
  'ResNet 840K параметров. Сложность «Экстрим». Спектатор. Рематч. Публичные профили.',
  'ResNet 840K params in browser. Extreme difficulty. Spectator. Rematch. Public profiles.',
  'release', '2026-03-30 10:00:00')

addPost('v37-mobile-app', 'v3.7: Мобильное приложение!', 'v3.7: Mobile app is here!',
  'Highrise Heist теперь на Android!\n\n- Полная адаптация UI под мобильный экран\n- Haptic feedback\n- Offline mode\n- Onboarding',
  'Highrise Heist is now on Android!\n\n- Full mobile UI\n- Haptic feedback\n- Offline mode\n- Onboarding',
  'release', '2026-03-31 10:00:00')

addPost('v40-platform', 'v4.0: Competitive Platform', 'v4.0: Competitive Platform',
  'AI Game Review, Puzzle Rush, Live Arena, 5 уроков, 11 тем, 17 скинов.',
  'AI Game Review, Puzzle Rush, Live Arena, 5 lessons, 11 themes, 17 skins.',
  'release', '2026-04-01 00:00:00')

addPost('v44-audit', 'v4.4: Архитектурный аудит — 157 тестов', 'v4.4: Architecture audit — 157 tests',
  'Тесты: 41→164, dist: 14→5.8MB (–59%), GameContext EventEmitter, CI/CD.',
  'Tests: 41→164, dist: 14→5.8MB (–59%), GameContext EventEmitter, CI/CD.',
  'release', '2026-04-03 14:00:00')

addPost('v471-security-audit', 'v4.7.1: Аудит безопасности, WS reconnect', 'v4.7.1: Security audit, WS reconnect',
  'Token revocation, SQL injection fix, WS rate limits, AuthContext, новый favicon.',
  'Token revocation, SQL injection fix, split WS rate limits, AuthContext, new favicon.',
  'release', '2026-04-06 12:00:00')

addPost('v480-victory-city',
  'v4.8.0: Город побед — каждая победа становится зданием',
  'v4.8.0: Victory City — every win becomes a building',
  'Каждая победа → изометрическое здание в профиле. Высота = блоки, цвет = ваши блоки, золотая крыша = 5:5.\n\n**Кирпичи 🧱** — валюта за победы.\n**Магазин скинов** — 9 скинов блоков, 9 стоек.\n**Battle Pass** — 30 квестов на сезон.',
  'Every win → isometric building in profile. Height = blocks, color = your chips, golden roof = 5:5.\n\n**Bricks 🧱** — currency per win.\n**Skin shop** — 9 block skins, 9 stand skins.\n**Battle Pass** — 30 quests per season.',
  'feature', '2026-04-11 15:00:00')

addPost('v490-share-rarity',
  'v4.9.0: Share-картинки, рарность ачивок, Snappy при переносе',
  'v4.9.0: Share images, achievement rarity, Snappy transfer',
  '**📸 Share Story 1080×1920** — после партии кнопка «Поделиться».\n**🏅 Рарность ачивок** — Common/Rare/Epic/Legendary + % игроков.\n**🦝 Snappy при переносе** — MascotRunner летит дугой.\n**👆 Жестовый перенос** — long-press + haptic.',
  '**📸 Share Story 1080×1920** — Share button after game.\n**🏅 Achievement rarity** — Common/Rare/Epic/Legendary + % of holders.\n**🦝 Snappy on transfer** — MascotRunner arcs between stands.\n**👆 Gesture transfer** — long-press + haptic.',
  'feature', '2026-04-12 10:00:00')

addPost('v500-clubs',
  'v5.0.0: Клубы 🦝, экипировка скинов, глобальный чат',
  'v5.0.0: Clubs 🦝, skin equip, global chat',
  '**🦝 Клубы** — создай, вступай, Owner/Officer/Member, лидерборд.\n\n**🎨 Экипировка скинов** — кнопка «Экипировать» в магазине.\n\n**💬 Глобальный чат** — WS real-time в онлайн-лобби.\n\n**Реферальные кирпичи**: +20 при регистрации, +30 при 10 партиях.',
  '**🦝 Clubs** — create, join, Owner/Officer/Member, leaderboard.\n\n**🎨 Skin equip** — "Equip" button in shop.\n\n**💬 Global chat** — WS real-time in online lobby.\n\n**Referral bricks**: +20 on signup, +30 at 10 games.',
  'feature', '2026-04-12 14:00:00')

addPost('v510-modifiers',
  'v5.1.0: Геймплейные модификаторы — туман войны, двойной перенос, авто-пас',
  'v5.1.0: Gameplay modifiers — fog of war, double transfer, auto-pass',
  '**🌫 Туман войны** — чужие блоки скрыты.\n\n**↔ ×2 Перенос** — два переноса за ход.\n\n**⚡ Авто-пас** — при истечении таймера ход пропускается.\n\nМодификаторы комбинируются.',
  '**🌫 Fog of War** — opponent blocks hidden.\n\n**↔ ×2 Transfer** — two transfers per turn.\n\n**⚡ Auto-pass** — timer runs out = auto-pass.\n\n**Modifiers combine.**',
  'feature', '2026-04-12 16:00:00')

addPost('v510-full-release',
  'v5.1.0: Платные темы, Город скинов, TikTok-клипы',
  'v5.1.0: Paid themes, Victory City skins, TikTok clips',
  `Полный список всего нового в v5.1.0.

**🎬 TikTok/Reels-клип**
После партии (≥4 ходов) кнопка «🎬 TikTok». Генерируется 9:16 видео с лучшими моментами. Цвета блоков = ваш скин. Скачайте WebM и делитесь.

**🧱 Платные темы**
Три темы бесплатно навсегда: Тёмная, Лес, Светлая.
Ocean, Дерево — 300🧱 · Закат, Арктика, Королевская — 400🧱 · Ретро, Сакура — 500🧱 · Неон — 600🧱

**🏙 Город побед с цветом скина**
Здания отражают скин блоков из той партии. Neon-скин → голубое здание, Metal → стальное.

**🎮 Модификаторы**
Туман войны 🌫, ×2 перенос ↔, Авто-пас ⚡`,
  `Full list of everything new in v5.1.0.

**🎬 TikTok/Reels clip**
After a game (≥4 moves) a "🎬 TikTok" button appears. Generates 9:16 highlight video. Block colors = your active skin.

**🧱 Paid themes**
Three free forever: Dark, Forest, Light.
Ocean, Wood — 300🧱 · Sunset, Arctic, Royal — 400🧱 · Retro, Sakura — 500🧱 · Neon — 600🧱

**🏙 Victory City with skin colors**
Buildings reflect the block skin from that game. Neon skin → cyan building, Metal → steel.

**🎮 Modifiers**
Fog of War 🌫, ×2 Transfer ↔, Auto-pass ⚡`,
  'release', '2026-04-12 18:00:00')

// ═══ v5.2.0 ═══
addPost('v520-blocks-spires-admob',
  'v5.2.0: Крупнее блоки, шпили за сложность AI, AdMob',
  'v5.2.0: Bigger blocks, AI difficulty spires, AdMob',
  `**🏗 Блоки +30% на десктопе**
На экранах 769px+ стойки и блоки стали крупнее: стойки 56→70px, блоки 40×13→52×17px. Поле теперь занимает больше места — играть приятнее.

**🏙 Золотые шпили за сложность AI**
Здания в Городе побед теперь растут в зависимости от того, кого вы победили:
- Easy — обычная высота
- Medium — +1 золотой этаж
- Hard — +2 золотых этажа
- Extreme — +3 золотых этажа
- Impossible — +4 золотых этажа

Чем сложнее противник — тем выше башня. Видно легенду прямо под городом.

**📢 AdMob реклама**
Кнопка «▶ Реклама +10 🧱» в магазине скинов. Посмотрите короткую рекламу — получите 10 кирпичей. Лимит 10 просмотров в сутки.

**🧱 Баланс кирпичей**
Теперь виден в шапке сайта прямо рядом с именем. Кнопка — открывает магазин. Баланс загружается с сервера при каждом открытии магазина.`,
  `**🏗 Blocks +30% on desktop**
On screens 769px+ stands and blocks are bigger: stands 56→70px, chips 40×13→52×17px. The board takes more space — more satisfying to play.

**🏙 Gold spires for AI difficulty**
Victory City buildings now grow based on who you beat:
- Easy — normal height
- Medium — +1 gold floor
- Hard — +2 gold floors
- Extreme — +3 gold floors
- Impossible — +4 gold floors

The harder the opponent, the taller the tower. Legend shown below the city.

**📢 AdMob ads**
"▶ Watch ad +10 🧱" button in the skin shop. Watch a short ad, get 10 bricks. Daily limit: 10 views.

**🧱 Brick balance in header**
Now visible in the site header next to your name. Click to open the shop. Balance loads from server every time you open the shop.`,
  'release', '2026-04-13 10:00:00')

// ═══ v5.5.0 ═══
addPost('v550-3d-city-skins',
  'v5.5.0: 3D Город побед + вращающиеся скины в магазине',
  'v5.5.0: 3D Victory City + rotating skins in the shop',
  `**🏙 Город побед теперь полностью 3D**
Изометрия SVG ушла в прошлое. Сейчас ваш город рендерится через Three.js с настоящими тенями, солнцем, звёздным небом и глубиной.

Тащите мышью или пальцем — камера вращается вокруг города. Щипок или колёсико — зум. ПКМ + тащите — перемещение. Клик по зданию — камера плавно перелетает к нему.

**🎥 Intro-анимация**
При первом открытии вкладки «Город» камера плавно «приземляется» с высоты на изометрический ракурс за 1.8 секунды.

**✨ Материалы скинов**
Metal-скин блестит как настоящая сталь. Neon и Glow самосвечением пульсируют. Glass полупрозрачный. Pixel — гранёный ретро-стиль.

**🔺 Пульсирующие шпили**
Золотые шпили за сложность AI теперь излучают свет с пульсацией — видно каждое победное здание издалека.

**🎪 3D-превью скинов**
Во вкладке «Блоки» магазина — вращающаяся 3D-башенка вашего активного скина. Теперь видно как скин выглядит в объёме, а не только на плоской карточке.

**💾 Fallback для старых устройств**
Если WebGL недоступен — автоматически подгружается старый SVG 2.5D рендер. Никто не потерял доступ к городу.

**⚡ Производительность**
Библиотека Three.js (~600KB) вынесена в отдельный chunk и подгружается только при открытии Города или магазина. Первоначальный bundle время не вырос.`,
  `**🏙 Victory City is fully 3D now**
SVG isometry is history. Your city renders through Three.js with real shadows, sun, starry sky and depth.

Drag with your mouse or finger — the camera rotates around the city. Pinch or scroll — zoom. Right-click drag — pan. Tap a building — the camera smoothly flies to it.

**🎥 Intro animation**
When you first open the "City" tab, the camera smoothly "lands" from above onto the isometric view in 1.8 seconds.

**✨ Skin materials**
Metal skin glistens like real steel. Neon and Glow pulse with self-emission. Glass is translucent. Pixel is faceted retro style.

**🔺 Pulsing spires**
Gold spires for AI difficulty now emit light with pulsing — every victory building visible from afar.

**🎪 3D skin preview**
In the "Blocks" tab of the shop — a rotating 3D tower of your currently equipped skin. Finally see how a skin looks in 3D, not just on a flat card.

**💾 Fallback for old devices**
If WebGL is unavailable — the old SVG 2.5D renderer auto-loads. Nobody loses access to the city.

**⚡ Performance**
Three.js library (~600KB) is split into a separate chunk and loaded only when you open the City or the shop. Initial bundle did not grow.`,
  'release', '2026-04-14 18:00:00')

// ═══ v5.6.0 ═══
addPost('v560-grow-snapshot-landing3d',
  'v5.6.0: Здания вырастают из земли, снимок города, 3D на главной',
  'v5.6.0: Buildings rise from the ground, city snapshot, 3D on landing',
  `Продолжаем полировку 3D «Города побед».

**🏗 Каскадная grow-анимация зданий**
При открытии вкладки «Город» небоскрёбы волной вырастают из земли — от ближних к дальним. Длительность одного — 500ms с easeOutCubic, задержка между соседними — 60ms. Визуально это ~2.5 секунды живого «строительства», синхронизированного с финалом intro-анимации камеры.

**📸 Скачать снимок города**
Новая кнопка «📸 Скачать снимок» под 3D-городом. На мобиле — открывает нативный share sheet с PNG-файлом и подписью «Мой Город побед в Highrise Heist — N побед!». На десктопе — скачивает highrise-heist-city-<timestamp>.png. Идеально для TikTok, сторис и Reddit.

**🏙 3D-превью на главной странице**
Новая секция на лендинге: вращающийся мини-город из 20 демо-зданий с автоповоротом камеры. Новые посетители сразу видят что их ждёт после первых побед — виральный hook, повышающий конверсию в регистрацию. Seeded-рандом гарантирует одинаковый красивый город для всех.

**⚡ Экономия батареи**
IntersectionObserver на 3D-превью лендинга: animate loop и автоповорот паузятся когда секция вне viewport. Смысла гонять GPU когда элемент не виден — нет.

**🔧 Технические улучшения**
- preserveDrawingBuffer=true в WebGLRenderer — необходим для корректного toBlob при снимке
- threeRef теперь хранит camera (не только scene/renderer) — нужно для force-рендера перед скриншотом
- Three.js chunk общий для всех 3D-компонентов (VictoryCity, Block3DPreview, LandingCity3D) — повторные открытия мгновенные из кеша браузера`,
  `Continuing the 3D "Victory City" polish.

**🏗 Cascading grow animation**
When you open the "City" tab, skyscrapers rise from the ground in a wave — from closest to farthest. Each takes 500ms with easeOutCubic, 60ms stagger between neighbors. ~2.5 seconds of live "construction" synced with the camera intro.

**📸 Download city snapshot**
New "📸 Download snapshot" button under the 3D city. On mobile — opens native share sheet with a PNG file and caption "My Victory City in Highrise Heist — N wins!". On desktop — downloads highrise-heist-city-<timestamp>.png. Perfect for TikTok, stories and Reddit.

**🏙 3D preview on the landing page**
New landing section: a rotating mini-city of 20 demo buildings with auto-rotating camera. New visitors immediately see what awaits them after first wins — a viral hook that boosts registration conversion. Seeded randomness ensures the same beautiful city for everyone.

**⚡ Battery savings**
IntersectionObserver on the landing 3D preview: animate loop and auto-rotate pause when the section is outside viewport. No point spinning GPU cycles when nothing is visible.

**🔧 Technical improvements**
- preserveDrawingBuffer=true in WebGLRenderer — required for correct toBlob during snapshot
- threeRef now holds camera (not just scene/renderer) — needed for force-render before screenshot
- Three.js chunk shared across all 3D components (VictoryCity, Block3DPreview, LandingCity3D) — repeat opens are instant from browser cache`,
  'release', '2026-04-14 22:00:00')

// ═══ v5.6.0 (часть 2) — Photo Mode + Day/Night ═══
addPost('v560-photo-mode-daynight',
  'v5.6.0: 📐 Photo Mode + 🌙 Day/Night — кинематографичные снимки',
  'v5.6.0: 📐 Photo Mode + 🌙 Day/Night — cinematic snapshots',
  `Завершаем v5.6.0 двумя визуальными фичами для скриншотов.

**📐 Photo Mode — 3 пресета ракурса**
Под 3D-городом появилась панель с тремя кнопками-ракурсами. Камера плавно переезжает к выбранному пресету за 0.9 секунды (easeOutCubic).

- **📐 Изо** — классический изометрический вид (по умолчанию)
- **🚁 Сверху** — вертолётный обзор, видна вся раскладка города
- **🎬 Кино** — низкий героический ракурс, подчёркивает высоту небоскрёбов

**🔄 Автоповорот**
Тумблер 🔄 Авто включает медленное вращение камеры вокруг города (0.5 speed). Прерывается при клике на здание или переключении пресета, потом возобновляется. Идеально для залипательного просмотра и видео-снимков.

**🌙 Day/Night — 4 пресета времени суток**
Второй ряд кнопок под Photo Mode. Плавно меняет всю атмосферу сцены за 800ms — фон, туман, солнце, ambient, прозрачность звёзд, tone-mapping.

- **🌙 Ночь** — глубокий тёмно-синий, яркие звёзды, тёплое жёлтое солнце высоко (по умолчанию)
- **🌅 Утро** — бледно-голубое небо, солнце с востока низко, тёплый ambient, последние звёзды
- **☀️ День** — яркий sky-blue, белое солнце в зените, без звёзд, повышенная экспозиция
- **🌇 Закат** — розово-фиолетовое небо, оранжевое солнце у горизонта, звёзды начинают прорезаться

**Комбо для соцсетей**
- 🌇 Закат + 🎬 Кино — кинематографичный warm gradient с героическим ракурсом
- ☀️ День + 🚁 Сверху — городская планировка в ясный полдень
- 🌙 Ночь + 🔄 Авто — залипательная ночная крутилка

Жми 📸 Снимок при любом сочетании — снимок попадает в твой нативный share sheet или скачивается PNG.

**🔧 Технически**
- animRef.timeAnim лерпит 9 параметров одновременно через Color.lerpColors / Vector3.lerpVectors
- snapshotSceneTimeState() фиксирует текущие значения как точку старта — прерывание анимации не даёт скачков
- Сцена и материалы скинов остаются неизменными — переключения времени суток не пересоздают объекты`,
  `Wrapping up v5.6.0 with two visual features for screenshots.

**📐 Photo Mode — 3 camera angle presets**
A new panel appeared under the 3D city with three angle buttons. The camera smoothly transitions to the selected preset in 0.9 seconds (easeOutCubic).

- **📐 Iso** — classic isometric view (default)
- **🚁 Top** — helicopter overview, the whole city layout visible
- **🎬 Cine** — low heroic angle, emphasizes skyscraper height

**🔄 Auto-rotate**
The 🔄 Rotate toggle enables slow camera rotation around the city (0.5 speed). Interrupted on building click or preset switch, then resumes. Perfect for mesmerizing viewing and video snapshots.

**🌙 Day/Night — 4 time-of-day presets**
A second row under Photo Mode. Smoothly changes the entire scene atmosphere in 800ms — background, fog, sun, ambient, star opacity, tone-mapping.

- **🌙 Night** — deep dark blue, bright stars, warm yellow sun high up (default)
- **🌅 Morning** — pale blue sky, sun low from the east, warm ambient, last stars fading
- **☀️ Day** — bright sky-blue, white sun at zenith, no stars, increased exposure
- **🌇 Sunset** — pink-purple sky, orange sun near the horizon, stars starting to appear

**Combos for social media**
- 🌇 Sunset + 🎬 Cine — cinematic warm gradient with heroic angle
- ☀️ Day + 🚁 Top — city layout on a clear noon
- 🌙 Night + 🔄 Rotate — mesmerizing nocturnal spinner

Hit 📸 Snapshot at any combination — the shot goes to your native share sheet or downloads as PNG.

**🔧 Technically**
- animRef.timeAnim interpolates 9 parameters simultaneously via Color.lerpColors / Vector3.lerpVectors
- snapshotSceneTimeState() captures current values as start point — interrupting animation produces no jumps
- Scene and skin materials stay unchanged — time-of-day switches don't recreate objects`,
  'release', '2026-04-14 23:30:00')

// Удаляем устаревшие слаги.
// БАГ-ФИКС: раньше здесь был DELETE 'v3-5-gpu-neural-extreme', но этот же слаг
// создаётся в db.js как часть истории релизов — получалась гонка где blog.js
// удалял пост сразу после сидинга db.js. Убрано.
db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v43-confetti'").run()

// Pin логика: источник правды по актуальному релизу — db.js (он создаёт v5.6.1/v5.7.0
// и пинит последний). Раньше здесь был UPDATE pinned=1 WHERE slug='v560-photo-mode-daynight'
// который перезаписывал пин с v5.7.0 на v5.6.0 при каждом старте сервера — критический
// баг, делавший мою работу в релизном коммите невидимой. Удалено: pin управляется из db.js.


// ═══ Blog Endpoints ═══
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 10
  const offset = (page - 1) * perPage
  const posts = db.prepare('SELECT id, slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at FROM blog_posts WHERE published=1 ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?').all(perPage, offset)
  const total = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE published=1').get().c
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ posts, total, page, pages: Math.ceil(total / perPage) })
})

router.get('/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug=? AND published=1').get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Пост не найден' })
  res.set('Cache-Control', 'public, max-age=120')
  res.json(post)
})

router.post('/', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { slug, title_ru, title_en, body_ru, body_en, tag, pinned } = req.body
  if (!slug || !title_ru || !body_ru) return res.status(400).json({ error: 'slug, title_ru, body_ru обязательны' })
  try {
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(slug, title_ru, title_en || '', body_ru, body_en || '', tag || 'update', pinned ? 1 : 0)
    res.json({ ok: true })
  } catch (e) { res.status(409).json({ error: 'Slug уже существует' }) }
})

// БАГ-ФИКС: раньше запрос был
//   UPDATE ... updated_at=datetime(\'now\') WHERE slug=?
// с экранированными кавычками, что давало SQLite невалидный синтаксис datetime(\'now\')
// с реальным слешем → SQLITE_ERROR на КАЖДОМ вызове PUT /api/blog/:slug.
// Админ не мог редактировать посты через API. Использую template literal.
router.put('/:slug', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { title_ru, title_en, body_ru, body_en, tag, pinned, published } = req.body
  db.prepare(`UPDATE blog_posts
      SET title_ru=COALESCE(?,title_ru), title_en=COALESCE(?,title_en),
          body_ru=COALESCE(?,body_ru), body_en=COALESCE(?,body_en),
          tag=COALESCE(?,tag), pinned=COALESCE(?,pinned), published=COALESCE(?,published),
          updated_at=datetime('now')
      WHERE slug=?`)
    .run(title_ru, title_en, body_ru, body_en, tag, pinned, published, req.params.slug)
  res.json({ ok: true })
})

export default router
