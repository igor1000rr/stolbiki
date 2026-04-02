import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

const router = Router()

// ═══ Seed Data (выполняется при старте) ═══
// Сид начальных постов (только если пусто)
const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
if (blogCount === 0) {
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Snatch Highrise выходит в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\nЧто уже работает:\n- Игра против AI (3 уровня сложности)\n- Онлайн мультиплеер по ссылке\n- Ежедневные и еженедельные головоломки\n- Режим «Тренер» с оценкой каждого хода\n- 4 цветовые темы\n- Print & Play PDF\n\nМы активно собираем обратную связь.',
    'Snatch Highrise enters open beta! An original strategy board game with an AlphaZero-based AI opponent.\n\nWhat\'s already working:\n- Play vs AI (3 difficulty levels)\n- Online multiplayer via link\n- Daily and weekly puzzles\n- Trainer mode with move evaluation\n- 4 color themes\n- Print & Play PDF\n\nWe\'re actively collecting feedback.',
    'release', 0, '2026-02-15 10:00:00')
}

// Добавление постов с датой (если ещё нет)
const addPost = (slug, tru, ten, bru, ben, tag, date) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at) VALUES (?,?,?,?,?,?,0,?)').run(slug, tru, ten, bru, ben, tag, date)
}

// ═══ Хронологический порядок (от старых к новым) ═══

addPost('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
  'Нейросеть AI прошла 3 прогона GPU-обучения:\n\n- 1146 итераций self-play\n- Loss снизился до 0.098\n- Винрейт лучшей модели: 97%\n- Баланс P1/P2: 50% / 50%\n\nAI стал заметно сильнее в эндшпиле и лучше оценивает позицию золотой стойки.',
  'The AI neural network completed 3 GPU training runs:\n\n- 1146 self-play iterations\n- Loss dropped to 0.098\n- Best model win rate: 97%\n- P1/P2 balance: 50% / 50%\n\nAI is notably stronger in endgame and better at evaluating the golden stand.',
  'ai', '2026-02-20 14:00:00')

addPost('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
  'Добавлены тактические головоломки!\n\n- Головоломка дня — обновляется каждый день\n- Задача недели — сложнее, обновляется по понедельникам\n- Банк из 50 головоломок с 3 уровнями сложности\n- Лидерборды и статистика решений\n\nЦель — закрыть нужные стойки за ограниченное число ходов.',
  'Tactical puzzles are here!\n\n- Daily puzzle — refreshes every day\n- Weekly challenge — harder, refreshes on Mondays\n- Bank of 50 puzzles with 3 difficulty levels\n- Leaderboards and solve stats\n\nGoal: close the required stands in limited moves.',
  'feature', '2026-03-01 12:00:00')

addPost('update-march-2026', 'v3.0: Масштабное обновление', 'v3.0: Major update',
  '26 ачивок, рейтинговые сезоны, 14 настроек и полная мультиязычность.\n\n**Ачивки** — 26 вместо 14. Бронза, серебро, золото, алмаз.\n**Рейтинговые сезоны** — каждый месяц новый сезон с лидербордом топ-20.\n**14 настроек** — таймер, стиль фишек, доступность.\n**Мультиязычность** — полный перевод RU/EN.',
  '26 achievements, ranked seasons, 14 settings, and full English translation.\n\n**Achievements** — 26 with bronze/silver/gold/diamond tiers.\n**Ranked Seasons** — monthly seasons with top-20 leaderboard.\n**14 Settings** — timer, chip style, accessibility.\n**Multilingual** — full RU/EN translation.',
  'release', '2026-03-15 10:00:00')

addPost('online-v2', 'Онлайн v2: resign, ничья, чат', 'Online v2: resign, draw, chat',
  'Онлайн-режим стал полноценным:\n\n**Сдача партии** — кнопка «Сдаться» через WebSocket.\n**Предложение ничьей** — баннер с «Принять» / «Отклонить».\n**Быстрый чат** — 5 кнопок (gg, gl, nice, wp, !) + свободный текст.\n**Уведомления** — мигающий заголовок когда ваш ход.',
  'Online mode is now fully featured:\n\n**Resign** — instant win for opponent via WebSocket.\n**Draw offer** — banner with Accept/Decline.\n**Quick chat** — 5 preset buttons + free text.\n**Notifications** — blinking title when it\'s your turn.',
  'feature', '2026-03-18 10:00:00')

addPost('admin-panel', 'Админ-панель и безопасность', 'Admin panel & security',
  'Полноценная админ-панель с 9 разделами: обзор с метриками, пользователи, партии, блог, комнаты.\n\nБезопасность: WebSocket аутентификация, серверная валидация, антиспам, CSP.',
  'Full admin panel with 9 sections: overview with metrics, users, games, blog, rooms.\n\nSecurity: WebSocket auth, server validation, anti-spam, CSP.',
  'update', '2026-03-20 10:00:00')

addPost('design-v3', 'Дизайн v3: лендинг и SEO', 'Design v3: landing & SEO',
  'Лендинг с 8 секциями и scroll-анимациями. Шапка с 4 пунктами + «Ещё». Авторизация в хедере.\n\nSEO: OG-теги, JSON-LD, sitemap, robots.txt, PWA-иконки.',
  'Landing with 8 sections and scroll animations. Header with 4 items + "More". Auth in header.\n\nSEO: OG tags, JSON-LD, sitemap, robots.txt, PWA icons.',
  'update', '2026-03-22 10:00:00')

addPost('v3-3-update', 'v3.3: Адаптивка и тема Wood', 'v3.3: Responsive & Wood theme',
  '8 брейкпоинтов вместо 4 — корректно от 340px до 1024px. Тема Wood с текстурой дерева. Три интерактивные схемы правил. Страница Changelog.',
  '8 breakpoints instead of 4 — correct from 340px to 1024px. Wood theme with grain texture. Three interactive rule diagrams. Changelog page.',
  'update', '2026-03-24 10:00:00')

addPost('v3-4-ux', 'v3.4: UX по результатам тестирования', 'v3.4: UX from playtesting',
  'Первое тестирование с реальными игроками:\n\n**Правила** переписаны с нуля (SVG-схемы вместо демо).\n**Стойки перевёрнуты** — фишки растут снизу вверх.\n**Счётчик фишек** — всегда виден, красный при 9+.\n**Призрачный перенос** — видно откуда/куда.\n**Онлайн-баги** исправлены.',
  'First playtest with real users:\n\n**Rules** rewritten from scratch (SVG diagrams).\n**Stands flipped** — chips grow bottom-up.\n**Chip counter** — always visible, red at 9+.\n**Ghost transfer** — visual source/destination.\n**Online bugs** fixed.',
  'release', '2026-03-27 10:00:00')

addPost('v35-gpu', 'v3.5: GPU-нейросеть в браузере', 'v3.5: GPU neural network in browser',
  'ResNet 840K параметров загружается в браузер. Сложность «Экстрим» — 1500 GPU-симуляций. Спектатор-режим. Рематч онлайн. Публичные профили. 200 головоломок. Серверная валидация ходов.',
  'ResNet 840K parameters loads in browser. Extreme difficulty — 1500 GPU simulations. Spectator mode. Online rematch. Public profiles. 200 puzzles. Server-side move validation.',
  'release', '2026-03-30 10:00:00')

addPost('v37-mobile-app', 'v3.7: Мобильное приложение!', 'v3.7: Mobile app is here!',
  'Snatch Highrise теперь на Android!\n\n**Полная адаптация UI** — доска на весь экран, tab bar.\n**Haptic feedback** — вибрация при каждом действии.\n**Offline mode** — AI без интернета.\n**Onboarding** — 4 экрана при первом запуске.\n**Новые логотипы**, Privacy Policy, Share & Rate.',
  'Snatch Highrise is now on Android!\n\n**Full UI adaptation** — board fills screen, tab bar.\n**Haptic feedback** — vibration on every action.\n**Offline mode** — AI without internet.\n**Onboarding** — 4 intro screens.\n**New logos**, Privacy Policy, Share & Rate.',
  'release', '2026-03-31 10:00:00')

addPost('roadmap-2026', 'Планы на 2026', 'Roadmap 2026',
  '✅ Android-приложение\n✅ Haptic + Offline\n✅ GPU-нейросеть 840K\n✅ 200+ головоломок\n✅ 26 ачивок\n\nДалее:\n→ Google Play\n→ Обучение AI на RTX 5090\n→ Push-уведомления\n→ iOS\n→ Турниры',
  '✅ Android app\n✅ Haptic + Offline\n✅ GPU neural net 840K\n✅ 200+ puzzles\n✅ 26 achievements\n\nNext:\n→ Google Play\n→ AI training on RTX 5090\n→ Push notifications\n→ iOS\n→ Tournaments',
  'roadmap', '2026-03-31 18:00:00')

addPost('v38-audit', 'v3.8: Аудит, безопасность, retention', 'v3.8: Audit, security, retention',
  'Полный аудит проекта + новые механики удержания:\n\n**Безопасность**: XSS chat strip, WS rate limit 15/sec, 401 auto-logout, username sanitization.\n**WebP**: все изображения -80% трафика.\n**i18n**: полный перевод Game, Online, Profile, 26 ачивок.\n**AI auto-difficulty**: после 3 поражений подряд — предложение понизить сложность.\n**First Win**: специальное celebration при первой победе.\n**ELO дельта**: +12/-8 отображается после каждой партии.\n**PvP Undo**: кнопка отмены хода.\n**Яндекс.Метрика**: вебвизор + карта кликов.',
  'Full project audit + new retention mechanics:\n\n**Security**: XSS chat strip, WS rate limit 15/sec, 401 auto-logout, username sanitization.\n**WebP**: all images -80% traffic.\n**i18n**: full translation Game, Online, Profile, 26 achievements.\n**AI auto-difficulty**: after 3 losses in a row — suggest easier level.\n**First Win**: special celebration on first victory.\n**ELO delta**: +12/-8 shown after each game.\n**PvP Undo**: undo move button.\n**Yandex Metrika**: webvisor + click map.',
  'release', '2026-03-31 22:00:00')

addPost('v39-retention', 'v3.9: Стрики, миссии, XP, уровни', 'v3.9: Streaks, missions, XP, levels',
  'Пять новых систем удержания:\n\n**Login streak** — серия ежедневных входов с календарём 30 дней. Streak freeze 1 раз в месяц. XP за каждый день (5-50).\n**Daily missions** — 3 задания в день из пула 8 (сыграй, победи, реши). XP за каждое + бонус 100 XP за все три.\n**XP / Level** — уровни 1-50. Прогресс-бар в профиле. XP за победы (20), поражения (5), миссии, стрики.\n**AI auto-difficulty** — после 3 поражений кнопка «Попробовать полегче?».\n**First Win** — celebration при первой победе в жизни.\n\nLayout расширен до 1200px для больших мониторов.',
  'Five new retention systems:\n\n**Login streak** — daily login streak with 30-day calendar. Streak freeze 1/month. XP for each day (5-50).\n**Daily missions** — 3 per day from pool of 8 (play, win, solve). XP each + 100 XP bonus for all three.\n**XP / Level** — levels 1-50. Progress bar in profile. XP for wins (20), losses (5), missions, streaks.\n**AI auto-difficulty** — after 3 losses suggests easier level.\n**First Win** — celebration on first ever victory.\n\nLayout widened to 1200px for large monitors.',
  'release', '2026-03-31 23:00:00')

addPost('v40-platform', 'v4.0: Competitive Platform', 'v4.0: Competitive Platform',
  'Пять новых режимов превращают Snatch Highrise в полноценную игровую платформу:\n\n**AI Game Review** — после каждой партии AI анализирует все ходы: отличный / хороший / ошибка / грубая ошибка. Итоговая accuracy % и replay с цветовой подсветкой.\n**Puzzle Rush** — 3 минуты, максимум головоломок. +10 сек за правильную, -15 за ошибку. Leaderboard.\n**Live Arena** — турниры Swiss system: 4 раунда, автоматический pairing по очкам, live таблица, XP для топ-3.\n**5 интерактивных уроков** — от основ до стратегии. Интерактивная доска, XP за каждый пройденный.\n**Animated board** — screen shake при закрытии, 3D perspective, золотая пульсация.',
  'Five new modes turn Snatch Highrise into a full competitive platform:\n\n**AI Game Review** — after every game, AI analyzes each move: excellent / good / mistake / blunder. Accuracy % and color-coded replay.\n**Puzzle Rush** — 3 minutes, max puzzles. +10 sec correct, -15 wrong. Leaderboard.\n**Live Arena** — Swiss system tournaments: 4 rounds, auto-pairing by score, live standings, XP for top 3.\n**5 interactive lessons** — from basics to strategy. Interactive board, XP for each completed.\n**Animated board** — screen shake on close, 3D perspective, golden pulse.',
  'release', '2026-04-01 00:00:00')

// Удаляем устаревший roadmap и дубли
db.prepare("DELETE FROM blog_posts WHERE slug='roadmap'").run()

// Закрепляем только v4.0 наверху
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v40-platform'").run()
// Удаляем дубли старых постов
db.prepare("DELETE FROM blog_posts WHERE slug='v3-5-gpu-neural-extreme'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v3-4-security-spectator'").run()
db.prepare("DELETE FROM blog_posts WHERE slug='v43-confetti'").run()

// Принудительное обновление всех постов (даты, заголовки, тексты)
const updatePost = (slug, tru, ten, bru, ben, tag, date) => {
  const existing = db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug)
  if (existing) {
    db.prepare('UPDATE blog_posts SET title_ru=?, title_en=?, body_ru=?, body_en=?, tag=?, created_at=?, updated_at=datetime(?) WHERE slug=?')
      .run(tru, ten, bru, ben, tag, date, date, slug)
  }
}
updatePost('launch', 'Запуск открытой беты', 'Open beta launch',
  'Snatch Highrise выходит в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\n- Игра против AI (3 уровня)\n- Онлайн мультиплеер\n- Головоломки дня/недели\n- Режим «Тренер»\n- 4 темы\n- Print & Play PDF',
  'Snatch Highrise enters open beta! Original strategy board game with AlphaZero AI.\n\n- Play vs AI (3 levels)\n- Online multiplayer\n- Daily/weekly puzzles\n- Trainer mode\n- 4 themes\n- Print & Play PDF',
  'release', '2026-02-15 10:00:00')
updatePost('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
  'Нейросеть прошла 3 прогона GPU-обучения:\n\n- 1146 итераций self-play\n- Loss: 0.098\n- Winrate: 97%\n- Баланс P1/P2: 50/50',
  'Neural network completed 3 GPU training runs:\n\n- 1146 self-play iterations\n- Loss: 0.098\n- Win rate: 97%\n- P1/P2 balance: 50/50',
  'ai', '2026-02-20 14:00:00')
updatePost('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
  'Тактические головоломки:\n\n- Головоломка дня\n- Задача недели\n- Банк из 50 задач\n- Лидерборды',
  'Tactical puzzles:\n\n- Daily puzzle\n- Weekly challenge\n- 50 puzzle bank\n- Leaderboards',
  'feature', '2026-03-01 12:00:00')
updatePost('v40-platform', 'v4.0: Competitive Platform', 'v4.0: Competitive Platform',
  'Snatch Highrise v4.0 — полноценная игровая платформа:\n\n**AI Game Review** — анализ каждого хода. Accuracy %, replay с подсветкой.\n**Puzzle Rush** — 3 минуты, +10/-15 сек. Leaderboard.\n**Live Arena** — Swiss турниры, 4 раунда, XP для топ-3.\n**5 уроков** — от основ до стратегии.\n**Магазин скинов** — popup с live preview, level-locked.\n**11 тем** — Dark, Ocean, Sunset, Forest, Royal, Sakura, Neon, Wood, Arctic, Retro, Light.\n**8 скинов фишек** — Classic, Flat, Round, Glass, Metal, Candy, Pixel, Glow.\n**9 скинов стоек** — Classic, Marble, Concrete, Bamboo, Obsidian, Crystal, Rust, Void, Ice.\n**Анимации** — screen shake, 3D perspective, golden pulse.',
  'Snatch Highrise v4.0 — full competitive platform:\n\n**AI Game Review** — analyze every move. Accuracy %, color-coded replay.\n**Puzzle Rush** — 3 min, +10/-15 sec. Leaderboard.\n**Live Arena** — Swiss tournaments, 4 rounds, XP for top 3.\n**5 lessons** — basics to strategy.\n**Skin Shop** — popup with live preview, level-locked.\n**11 themes** — Dark, Ocean, Sunset, Forest, Royal, Sakura, Neon, Wood, Arctic, Retro, Light.\n**8 chip skins** — Classic, Flat, Round, Glass, Metal, Candy, Pixel, Glow.\n**9 stand skins** — Classic, Marble, Concrete, Bamboo, Obsidian, Crystal, Rust, Void, Ice.\n**Animations** — screen shake, 3D perspective, golden pulse.',
  'release', '2026-04-01 00:00:00')
addPost('v41-polish', 'v4.1: UI Polish & 11 тем', 'v4.1: UI Polish & 11 themes',
  'Визуальная полировка интерфейса:\n\n**2 новые темы** — Sakura и Retro. Arctic переписана.\n**SkinShop** — мини-доска, стопки блоков, стойки с текстурой.\n**Профиль** — gradient header, level badge, XP bar.\n**Формы** — styled input/select, custom scrollbar.\n**CSS vars** — все цвета через переменные.',
  'Interface polish:\n\n**2 new themes** — Sakura and Retro. Arctic rewritten.\n**SkinShop** — mini-board, block stacks, textured stands.\n**Profile** — gradient header, level badge, XP bar.\n**Forms** — styled input/select, custom scrollbar.\n**CSS vars** — all colors through variables.',
  'release', '2026-04-01 12:00:00')
updatePost('v41-polish', 'v4.1: UI Polish & 11 тем', 'v4.1: UI Polish & 11 themes',
  'Визуальная полировка всего интерфейса:\n\n**2 новые темы** — Sakura (вишнёвая) и Retro (CRT терминал). Arctic переписана как тёмно-ледяная.\n**Визуальный SkinShop** — мини-доска для превью тем, стопки фишек и текстурированные стойки.\n**Профиль** — градиентный header, level badge, XP bar с glow, SVG checkmarks.\n**Скины** — обновлённые текстуры: Glass с border+backdrop, Metal 5-stop chrome, Candy 3D, Glow triple layer.\n**Формы** — стилизованные input/select с focus-ring, кастомный scrollbar.\n**Все цвета** → CSS vars. Все 11 тем полностью theme-aware.',
  'Visual polish of the entire interface:\n\n**2 new themes** — Sakura (cherry blossom) and Retro (CRT terminal). Arctic rewritten as dark icy.\n**Visual SkinShop** — mini-board for theme preview, chip stacks, textured stands.\n**Profile** — gradient header, level badge, XP bar with glow, SVG checkmarks.\n**Skins** — updated textures: Glass with border+backdrop, Metal 5-stop chrome, Candy 3D, Glow triple layer.\n**Forms** — styled input/select with focus-ring, custom scrollbar.\n**All colors** → CSS vars. All 11 themes fully theme-aware.',
  'release', '2026-04-01 12:00:00')

// Pin только v4.1
db.prepare("UPDATE blog_posts SET pinned=0").run()
db.prepare("UPDATE blog_posts SET pinned=1 WHERE slug='v43-seo'").run()

addPost('v43-seo', 'v4.3: Аналитика, 24 настройки, SEO, replay sharing', 'v4.3: Analytics, 24 settings, SEO, replay sharing',
  'Масштабное обновление:\n\n**24 настройки** — сложность AI по умолчанию, стартовый экран, авто-реванш, Zen mode, лог ходов, подписи стоек, приватность профиля, экспорт данных JSON и ещё 16 опций.\n**Аналитика** — новая вкладка в профиле с 15 метриками: винрейт по сложности (Easy→Extreme), тренд винрейта, W/L за 7/30 дней, активность по часам и дням, распределение счёта, golden rate, comeback rate, серия побед.\n**SEO** — path routing (/game вместо /#game), /en/ для английской версии, 16 индексируемых страниц, hreflang.\n**Replay sharing** — сохраняйте партии и делитесь ссылкой.\n**Визуал** — конфетти при победе, 6 тем с анимацией падающих блоков, 6 карточек фич с живыми SVG-анимациями.\n**Звуки** — 7 эффектов подключены (были написаны но не вызывались).\n**Error Boundary** — JS-краш → Снуппи + перезагрузка.\n**Автобэкап** — SQLite каждые 6 часов.',
  'Major update:\n\n**24 settings** — default AI difficulty, start screen, auto-rematch, Zen mode, move log, stand labels, profile privacy, JSON data export and 16 more options.\n**Analytics** — new profile tab with 15 metrics: win rate by difficulty (Easy→Extreme), win rate trend, W/L for 7/30 days, activity by hour and day, score distribution, golden rate, comeback rate, streak timeline.\n**SEO** — path routing (/game instead of /#game), /en/ for English, 16 indexable pages, hreflang.\n**Replay sharing** — save games and share links.\n**Visual** — confetti on victory, 6 themes with falling block animation, 6 feature cards with live SVG animations.\n**Sounds** — 7 effects hooked up (were written but never called).\n**Error Boundary** — JS crash → Snoopy + reload.\n**Auto backup** — SQLite every 6 hours.',
  'release', '2026-04-02 20:00:00')

addPost('v42-terminology', 'v4.2: Маскот Снуппи, терминология, симулятор', 'v4.2: Mascot Snoopy, terminology, simulator',
  'Большое обновление:\n\n**Маскот Снуппи** — енот-строитель появился на 10 страницах! 6 поз: приветствие, объяснение, победа, поражение, удивление, ура. CSS-анимации bounce и enter.\n**Терминология** — фишка → блок, закрытие → достройка. 10 стоек, 11 блоков на каждой = высотка.\n**Симулятор** — 2 новых параметра: «блоков за ход» (1-6) и «стоек за ход» (1-5).\n**Онлайн-скины** — скины передаются оппоненту через WebSocket.\n**Архитектура** — server.js разбит на 9 модулей, CORS, error handler, 41 тест.',
  'Major update:\n\n**Mascot Snoopy** — raccoon builder appears on 10 pages! 6 poses: wave, point, celebrate, sad, shock, hero. CSS bounce & enter animations.\n**Terminology** — chip → block, closing → completing. 10 stands, 11 blocks each = highrise.\n**Simulator** — 2 new parameters: "blocks per turn" (1-6) and "stands per turn" (1-5).\n**Online skins** — skins transmitted to opponent via WebSocket.\n**Architecture** — server.js split into 9 modules, CORS, error handler, 41 tests.',
  'release', '2026-04-02 12:00:00')

updatePost('roadmap-2026', 'Планы на 2026', 'Roadmap 2026',
  '✅ Android-приложение\n✅ GPU-нейросеть 840K\n✅ AI Game Review\n✅ Puzzle Rush + Live Arena\n✅ 5 уроков + 33 ачивки\n✅ 11 тем + 17 скинов\n✅ Маскот Снуппи\n✅ SEO path routing + /en/\n✅ Replay sharing\n✅ 24 настройки\n✅ 15 метрик аналитики\n✅ Конфетти + Error Boundary\n\nДалее:\n→ Google Play\n→ Ranked matchmaking\n→ Таймеры в онлайне\n→ WS reconnect\n→ AI v4\n→ iOS',
  '✅ Android app\n✅ GPU neural net 840K\n✅ AI Game Review\n✅ Puzzle Rush + Live Arena\n✅ 5 lessons + 33 achievements\n✅ 11 themes + 17 skins\n✅ Mascot Snoopy\n✅ SEO path routing + /en/\n✅ Replay sharing\n✅ 24 settings\n✅ 15 analytics metrics\n✅ Confetti + Error Boundary\n\nNext:\n→ Google Play\n→ Ranked matchmaking\n→ Online timers\n→ WS reconnect\n→ AI v4\n→ iOS',
  'roadmap', '2026-04-02 01:00:00')


// ═══ Blog Endpoints ═══
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 10
  const offset = (page - 1) * perPage
  const posts = db.prepare('SELECT id, slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at FROM blog_posts WHERE published=1 ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?').all(perPage, offset)
  const total = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE published=1').get().c
  res.json({ posts, total, page, pages: Math.ceil(total / perPage) })
})

router.get('/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug=? AND published=1').get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Пост не найден' })
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
