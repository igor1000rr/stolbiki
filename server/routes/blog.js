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
  'Каждая победа → изометрическое здание в профиле. Высота = блоки, цвет = ваши блоки, золотая крыша = 5:5.\n\nВ этом релизе:\n**Кирпичи 🧱** — валюта за победы. AI Easy=1, Medium=2, Hard+=3, PvP=5.\n**Магазин скинов** — цены в кирпичах, rarity badges.\n**Battle Pass** — 30 квестов на сезон.',
  'Every win → isometric building in profile. Height = blocks, color = your chips, golden roof = 5:5.\n\nAlso in this release:\n**Bricks 🧱** — currency per win. AI Easy=1, Medium=2, Hard+=3, PvP=5.\n**Skin shop** — brick prices, rarity badges.\n**Battle Pass** — 30 quests per season.',
  'feature', '2026-04-11 15:00:00')

addPost('v490-share-rarity',
  'v4.9.0: Share-картинки, рарность ачивок, Snappy при переносе',
  'v4.9.0: Share images, achievement rarity, Snappy transfer',
  '**📸 Share-картинки Story 1080×1920**\nПосле партии — кнопка «Поделиться». Web Share API на мобиле или PNG на десктопе.\n\n**🏅 Рарность ачивок**\n33 ачивки с тирами: Common / Rare / Epic / Legendary. Показывается % игроков с ачивкой.\n\n**🦝 Snappy при переносе (MascotRunner)**\nПри переносе блоков Snappy летит дугой от стойки к стойке.\n\n**👆 Жестовый перенос**\nLong-press (500ms) на стойку = перенос. Haptic на мобиле.',
  '**📸 Share images Story 1080×1920**\nAfter game — Share button. Web Share API on mobile or PNG on desktop.\n\n**🏅 Achievement rarity**\n33 achievements with tiers: Common / Rare / Epic / Legendary. Shows % of holders.\n\n**🦝 Snappy on transfer (MascotRunner)**\nSnappy arcs between stands on block transfers.\n\n**👆 Gesture transfer**\nLong-press (500ms) a stand = transfer. Haptic on mobile.',
  'feature', '2026-04-12 10:00:00')

addPost('v500-clubs',
  'v5.0.0: Клубы 🦝, экипировка скинов, глобальный чат',
  'v5.0.0: Clubs 🦝, skin equip, global chat',
  'Три социальных фичи одним релизом.\n\n**🦝 Клубы**\nСоздай клуб с тегом [SNCH], рекруть участников, набирай победы в общий зачёт. До 50 участников, роли Owner/Officer/Member. Kick офицером, смена владельца при уходе лидера. Лидерборд клубов по победам. Вкладка «Клубы 🦝» в профиле.\n\n**🎨 Экипировка скинов**\nТеперь покупка скина ≠ применение. Кнопка «Экипировать» в магазине — активный скин сохраняется на сервере и синхронизируется между устройствами.\n\n**💬 Глобальный чат**\nЧат в реальном времени через WebSocket в онлайн-лобби. История 50 сообщений при подключении, счётчик онлайн, фильтр плохих слов. REST fallback если WS недоступен.\n\n**Рефераьные кирпичи**\n+20 кирпичей рефереру когда реферал регается, +30 когда доходит до 10 партий.',
  'Three social features in one release.\n\n**🦝 Clubs**\nCreate a club with a tag [SNCH], recruit members, accumulate wins. Up to 50 members, Owner/Officer/Member roles. Kick by officers, owner transfers on leave. Club leaderboard by wins. "Clubs 🦝" tab in profile.\n\n**🎨 Skin equip**\nBuying a skin ≠ applying it. "Equip" button in shop — active skin saved on server and synced across devices.\n\n**💬 Global chat**\nReal-time WebSocket chat in the online lobby. 50 message history on connect, online counter, bad word filter. REST fallback if WS unavailable.\n\n**Referral bricks**\n+20 bricks to referrer when referral signs up, +30 when they reach 10 games.',
  'feature', '2026-04-12 14:00:00')

// Удаляем устаревшее
db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v3-5-gpu-neural-extreme'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v43-confetti'").run()

// Pin → v5.0.0
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v500-clubs'").run()


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
