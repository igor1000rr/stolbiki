import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

const router = Router()

const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
if (blogCount === 0) {
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Snatch Highrise выходит в открытую бету!\n\n- Игра против AI\n- Онлайн мультиплеер\n- Головоломки\n- 4 темы\n- Print & Play PDF',
    'Snatch Highrise enters open beta!\n\n- Play vs AI\n- Online multiplayer\n- Puzzles\n- 4 themes\n- Print & Play PDF',
    'release', 0, '2026-02-15 10:00:00')
}

const addPost = (slug, tru, ten, bru, ben, tag, date) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?,?,?,?,?,?,0,?)').run(slug, tru, ten, bru, ben, tag, date)
}

// ═══ Хронологические посты ═══

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
  'Snatch Highrise теперь на Android!\n\n- Полная адаптация UI под мобильный экран\n- Haptic feedback — вибрация при каждом действии\n- Offline mode — AI без интернета\n- Onboarding — 4 экрана при первом запуске',
  'Snatch Highrise is now on Android!\n\n- Full UI adaptation for mobile\n- Haptic feedback on every action\n- Offline mode — AI without internet\n- Onboarding — 4 intro screens',
  'release', '2026-03-31 10:00:00')

addPost('v40-platform', 'v4.0: Competitive Platform', 'v4.0: Competitive Platform',
  'AI Game Review, Puzzle Rush, Live Arena, 5 уроков, 11 тем, 17 скинов.',
  'AI Game Review, Puzzle Rush, Live Arena, 5 lessons, 11 themes, 17 skins.',
  'release', '2026-04-01 00:00:00')

addPost('v44-audit', 'v4.4: Архитектурный аудит — 75 коммитов, 157 тестов', 'v4.4: Architecture audit — 75 commits, 157 tests',
  'Тесты: 41→164, dist: 14→5.8MB (–59%), GameContext EventEmitter, graceful shutdown, CI/CD.',
  'Tests: 41→164, dist: 14→5.8MB (–59%), GameContext EventEmitter, graceful shutdown, CI/CD.',
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
  '**🦝 Клубы** — создай, вступай, Owner/Officer/Member, лидерборд. До 50 участников.\n\n**🎨 Экипировка скинов** — кнопка «Экипировать» в магазине, скин синхронизируется с аккаунтом.\n\n**💬 Глобальный чат** — WS real-time в онлайн-лобби. История 50 сообщений.\n\n**Реферальные кирпичи**: +20 при регистрации, +30 при 10 партиях.',
  '**🦝 Clubs** — create, join, Owner/Officer/Member, leaderboard. Up to 50 members.\n\n**🎨 Skin equip** — "Equip" button in shop, synced to server and across devices.\n\n**💬 Global chat** — WS real-time in online lobby. 50 message history.\n\n**Referral bricks**: +20 on signup, +30 at 10 games.',
  'feature', '2026-04-12 14:00:00')

addPost('v510-modifiers',
  'v5.1.0: Геймплейные модификаторы — туман войны, двойной перенос, авто-пас',
  'v5.1.0: Gameplay modifiers — fog of war, double transfer, auto-pass',
  'Три новых игровых режима. Включаются кнопками под выбором сложности.\n\n**🌫 Туман войны** — чужие блоки скрыты, видны только ваши и счётчик (?). Играете по памяти.\n\n**↔ ×2 Перенос** — два переноса за ход вместо одного.\n\n**⚡ Авто-пас** — при истечении таймера ход пропускается вместо поражения.\n\nМодификаторы комбинируются. На мобиле — в шестерёнке.',
  'Three new game modes. Toggle buttons below difficulty selector.\n\n**🌫 Fog of War** — opponent blocks hidden, only your chips and counter visible.\n\n**↔ ×2 Transfer** — two transfers per turn instead of one.\n\n**⚡ Auto-pass** — timer runs out = auto-pass, not loss.\n\nModifiers combine. On mobile — gear icon.',
  'feature', '2026-04-12 16:00:00')

// Главный пост v5.1.0 — покрывает все фичи релиза
addPost('v510-full-release',
  'v5.1.0: Платные темы, Город скинов, TikTok-клипы',
  'v5.1.0: Paid themes, Victory City skins, TikTok clips',
  `Полный список всего нового в v5.1.0.

**🎬 TikTok/Reels-клип**
После партии (≥4 ходов) в результатах появляется кнопка «🎬 TikTok». Нажмите — генерируется короткое 9:16 видео с лучшими моментами: закрытия стоек, переносы, финал. Цвета блоков = ваш активный скин. Скачайте WebM и поделитесь в TikTok, Instagram Reels или YouTube Shorts. Требует Chrome/Edge.

**🧱 Платные темы в магазине**
Три темы остаются бесплатными навсегда: Тёмная, Лес, Светлая.
Остальные восемь — за кирпичи:
- Ocean, Дерево — 300🧱
- Закат, Арктика, Королевская — 400🧱
- Ретро, Сакура — 500🧱
- Неон — 600🧱

**🏙 Город побед с цветом скина**
Здания в Городе побед теперь отражают цвет скина блоков из той конкретной партии. Победили с Neon-скином — здание голубое. С Metal — стальное. Старые здания сохраняют классический цвет.

**🎮 Модификаторы (напоминание)**
Туман войны 🌫, ×2 перенос ↔, Авто-пас ⚡ — кнопки под выбором сложности.`,
  `Full list of everything new in v5.1.0.

**🎬 TikTok/Reels clip**
After a game (≥4 moves) a "🎬 TikTok" button appears in results. Click it — generates a short 9:16 video with highlights: stand closures, transfers, final moment. Block colors = your active skin. Download WebM and share to TikTok, Instagram Reels or YouTube Shorts. Requires Chrome/Edge.

**🧱 Paid themes in shop**
Three themes stay free forever: Dark, Forest, Light.
The other eight cost bricks:
- Ocean, Wood — 300🧱
- Sunset, Arctic, Royal — 400🧱
- Retro, Sakura — 500🧱
- Neon — 600🧱

**🏙 Victory City with skin colors**
Buildings in Victory City now reflect the block skin color used in that specific game. Won with Neon skin — building is cyan. With Metal — steel. Old buildings keep classic color.

**🎮 Modifiers (reminder)**
Fog of War 🌫, ×2 Transfer ↔, Auto-pass ⚡ — toggle buttons below difficulty.`,
  'release', '2026-04-12 18:00:00')

// Удаляем устаревшее
db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v3-5-gpu-neural-extreme'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v43-confetti'").run()

// Pin → главный v5.1.0 пост
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v510-full-release'").run()


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

router.put('/:slug', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { title_ru, title_en, body_ru, body_en, tag, pinned, published } = req.body
  db.prepare('UPDATE blog_posts SET title_ru=COALESCE(?,title_ru), title_en=COALESCE(?,title_en), body_ru=COALESCE(?,body_ru), body_en=COALESCE(?,body_en), tag=COALESCE(?,tag), pinned=COALESCE(?,pinned), published=COALESCE(?,published), updated_at=datetime(\'now\') WHERE slug=?')
    .run(title_ru, title_en, body_ru, body_en, tag, pinned, published, req.params.slug)
  res.json({ ok: true })
})

export default router
