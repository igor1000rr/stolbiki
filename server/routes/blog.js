import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

const router = Router()

// ═══ Seed Data (выполняется при старте) ═══
const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
if (blogCount === 0) {
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Snatch Highrise выходит в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\n- Игра против AI (3 уровня)\n- Онлайн мультиплеер\n- Головоломки дня/недели\n- Режим «Тренер»\n- 4 темы\n- Print & Play PDF',
    'Snatch Highrise enters open beta! Original strategy board game with AlphaZero AI.\n\n- Play vs AI (3 levels)\n- Online multiplayer\n- Daily/weekly puzzles\n- Trainer mode\n- 4 themes\n- Print & Play PDF',
    'release', 0, '2026-02-15 10:00:00')
}

const addPost = (slug, tru, ten, bru, ben, tag, date) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?,?,?,?,?,?,0,?)').run(slug, tru, ten, bru, ben, tag, date)
}

const updatePost = (slug, tru, ten, bru, ben, tag, date) => {
  if (db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('UPDATE blog_posts SET title_ru=?, title_en=?, body_ru=?, body_en=?, tag=?, created_at=?, updated_at=datetime(?) WHERE slug=?')
      .run(tru, ten, bru, ben, tag, date, date, slug)
}

// ═══ Посты (хронологически) ═══

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
  'Масштабный аудит проекта:\n\n**Тесты:** 41 → 164 (+123)\n**dist:** 14MB → 5.8MB (–59%)\n**GameContext v2:** EventEmitter — 25 CustomEvent → 0\n**Безопасность:** anti-cheat, JWT refresh, error reporting\n**Производительность:** 6 SQL индексов, Cache-Control ×7, gzip\n**CI/CD:** test → build → backup DB → deploy',
  'Massive project audit:\n\n**Tests:** 41 → 164 (+123)\n**dist:** 14MB → 5.8MB (–59%)\n**GameContext v2:** EventEmitter — 25 CustomEvents → 0\n**Security:** anti-cheat, JWT refresh, error reporting\n**Performance:** 6 SQL indexes, Cache-Control ×7, gzip\n**CI/CD:** test → build → backup DB → deploy',
  'release', '2026-04-03 14:00:00')

addPost('v471-security-audit', 'v4.7.1: Аудит безопасности, WS reconnect, AuthContext', 'v4.7.1: Security audit, WS reconnect, AuthContext',
  '**Token revocation** — смена пароля → старые JWT мгновенно невалидны.\n**WS reconnect** — партия продолжается без потери состояния.\n**SQL injection fix** в admin analytics.\n**WS maxPayload** 16KB → 4KB.\n**Раздельные rate limits:** геймплей 20/сек, чат 5/сек.\n**Новый favicon** — SH multi-size (16/32/48).',
  '**Token revocation** — password reset instantly invalidates old JWTs.\n**WS reconnect** — game continues without state loss.\n**SQL injection fix** in admin analytics.\n**WS maxPayload** 16KB → 4KB.\n**Split rate limits:** gameplay 20/sec, chat 5/sec.\n**New favicon** — SH multi-size (16/32/48).',
  'release', '2026-04-06 12:00:00')

addPost('v480-victory-city',
  'v4.8.0: Город побед — каждая победа становится зданием',
  'v4.8.0: Victory City — every win becomes a building',
  'Главная фича Sprint 1 от Александра — реализована.\n\n**Город побед** превращает победы в визуальный прогресс. После победы в профиле появляется новое здание — изометрическая высотка, форма которой отражает финальную расстановку блоков.\n\n**Как читать здание:**\n- Высота = блоки в самой высокой закрытой стойке (до 11 этажей)\n- Цвет = цвет ваших блоков\n- Золотая крыша = победа 5:5 по золотой стойке\n\n**Управление:** зум ×0.3–2.5, drag-пан, тап — детали здания.\n\n**Вкладка «Город»** появилась в профиле.\n\nТакже в этом релизе:\n**Кирпичи 🧱** — новая валюта. AI Easy=1, Medium=2, Hard+=3, PvP=5 за победу.\n**Магазин скинов** — цены в кирпичах, rarity badges (common/rare/epic/legendary).\n**Battle Pass** — 30 квестов на сезон, прогресс автоматический.',
  'Key Sprint 1 feature from Alexander — shipped.\n\n**Victory City** turns wins into visual progress. Every win adds an isometric building to your profile — shaped by the final board state.\n\n**Reading a building:**\n- Height = blocks in your highest closed stand (up to 11 floors)\n- Color = your chip color\n- Golden roof = 5:5 golden stand win\n\n**Controls:** zoom ×0.3–2.5, drag-pan, tap for building details.\n\n**"Victory City" tab** added to profile.\n\nAlso in this release:\n**Bricks 🧱** — new currency. AI Easy=1, Medium=2, Hard+=3, PvP=5 per win.\n**Skin shop** — brick prices, rarity badges (common/rare/epic/legendary).\n**Battle Pass** — 30 quests per season, auto-progress.',
  'feature', '2026-04-11 15:00:00')

addPost('v490-share-rarity',
  'v4.9.0: Share-картинки, рарность ачивок, Snappy при переносе',
  'v4.9.0: Share images, achievement rarity, Snappy transfer',
  'Три новые фичи по roadmap от Александра.\n\n**📸 Share-картинки Story 1080×1920**\nПосле партии — кнопка «Поделиться». Открывается превью, затем Web Share API на мобиле или скачивание PNG на десктопе. Карточка содержит:\n- VICTORY / DEFEAT / DRAW с glow-эффектом\n- Финальная доска — 10 стоек с блоками\n- Счёт крупными цифрами\n- Статистика (ходы, время, сложность/режим)\n- Карточка игрока с ELO дельтой\n- Бренд snatch-highrise.com\n\n**🏅 Рарность ачивок**\nВсе 33 ачивки получили тир редкости:\n- **Common** (серый) — первые шаги, базовые цели\n- **Rare** (синий) — нужна практика\n- **Epic** (фиолетовый) — серьёзное достижение\n- **Legendary** (золотой) — единицы игроков\n\nНа карточке: название тира + «XX% игроков». Легенда рарностей на странице ачивок.\n\n**🦝 Snappy при переносе (MascotRunner)**\nПри каждом переносе блоков Snappy вылетает дугой от стойки-источника к стойке-цели, держа блоки над головой. Flip по направлению движения.\n\n**👆 Жестовый перенос**\nLong-press (500ms) на стойку = жестовый перенос. Вибрация на мобиле. Кнопка «Перенос» оставлена как fallback для десктопа.',
  'Three new roadmap features from Alexander.\n\n**📸 Share images Story 1080×1920**\nAfter each game — Share button. Shows preview, then Web Share API on mobile or PNG download on desktop. Card includes:\n- VICTORY / DEFEAT / DRAW with glow effect\n- Final board — 10 stands with blocks\n- Big score numbers\n- Stats (moves, time, difficulty/mode)\n- Player card with ELO delta\n- snatch-highrise.com branding\n\n**🏅 Achievement rarity**\nAll 33 achievements now have a rarity tier:\n- **Common** (gray) — first steps, basic goals\n- **Rare** (blue) — requires practice\n- **Epic** (purple) — serious achievement\n- **Legendary** (gold) — very few players have it\n\nEach card shows tier name + "XX% of players". Rarity legend on the achievements page.\n\n**🦝 Snappy on transfer (MascotRunner)**\nEvery block transfer launches Snappy in an arc from source to target stand, holding blocks above his head. Flips based on direction.\n\n**👆 Gesture transfer**\nLong-press (500ms) a stand = gesture transfer. Haptic on mobile. Transfer button kept as desktop fallback.',
  'feature', '2026-04-12 10:00:00')

// Удаляем устаревшее
db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v3-5-gpu-neural-extreme'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v43-confetti'").run()

// Pin → v4.9.0
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v490-share-rarity'").run()


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
