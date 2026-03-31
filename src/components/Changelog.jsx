/**
 * Changelog — история версий
 * Написано от руки, без AI-генерации
 */
import { useI18n } from '../engine/i18n'

const VERSIONS = [
  {
    version: '4.0',
    date: '2026-04-01',
    title_ru: 'AI анализ, Puzzle Rush, Arena, уроки, 9 тем, 8 скинов фишек, 9 скинов стоек',
    title_en: 'AI review, Puzzle Rush, Arena, lessons, 9 themes, 8 chip skins, 9 stand skins',
    changes_ru: [
      { type: 'new', text: 'AI Game Review — анализ каждого хода: отличный/хороший/ошибка/грубая ошибка. Accuracy %, навигация по replay' },
      { type: 'new', text: 'Puzzle Rush — реши максимум головоломок за 3 минуты. +10 сек за правильную, -15 за ошибку. Leaderboard' },
      { type: 'new', text: 'Live Arena — турнирный режим Swiss system, 4 раунда, live таблица, XP для топ-3' },
      { type: 'new', text: '5 интерактивных уроков: основы → перенос → золотая → закрытие → стратегия. XP за каждый' },
      { type: 'new', text: '5 новых тем: Ocean, Sunset, Forest, Royal, Arctic (всего 9)' },
      { type: 'new', text: '8 скинов фишек: Classic, Flat, Round, Glass, Metal, Candy, Pixel, Glow' },
      { type: 'new', text: '9 скинов стоек: Classic, Marble, Concrete, Bamboo, Obsidian, Crystal, Rust, Void, Ice' },
      { type: 'new', text: 'Магазин скинов (Skin Shop) — popup с live preview, level-locked скины' },
      { type: 'new', text: 'Animated board — screen shake при закрытии, 3D perspective, golden pulse' },
      { type: 'fix', text: 'Палитра под лого — accent coral→teal, 607 CSS var() в JSX' },
    ],
    changes_en: [
      { type: 'new', text: 'AI Game Review — analyze every move: excellent/good/inaccuracy/mistake/blunder. Accuracy %, replay navigation' },
      { type: 'new', text: 'Puzzle Rush — solve max puzzles in 3 minutes. +10 sec correct, -15 wrong. Leaderboard' },
      { type: 'new', text: 'Live Arena — Swiss tournament system, 4 rounds, live standings, XP for top 3' },
      { type: 'new', text: '5 interactive lessons: basics → transfer → golden → closing → strategy. XP for each' },
      { type: 'new', text: '5 new themes: Ocean, Sunset, Forest, Royal, Arctic (9 total)' },
      { type: 'new', text: '8 chip skins: Classic, Flat, Round, Glass, Metal, Candy, Pixel, Glow' },
      { type: 'new', text: '9 stand skins: Classic, Marble, Concrete, Bamboo, Obsidian, Crystal, Rust, Void, Ice' },
      { type: 'new', text: 'Skin Shop — popup with live preview, level-locked skins' },
      { type: 'new', text: 'Animated board — screen shake on close, 3D perspective, golden pulse' },
      { type: 'fix', text: 'Color palette aligned with logo — accent coral→teal, 607 CSS var() in JSX' },
      { type: 'fix', text: 'All 26 components fully theme-aware (607 CSS var() in JSX)' },
    ],
  },
  {
    version: '3.9',
    date: '2026-03-31',
    title_ru: 'Retention: стрики, миссии, XP, auto-difficulty',
    title_en: 'Retention: streaks, missions, XP, auto-difficulty',
    changes_ru: [
      { type: 'new', text: 'Login streak — серия входов с календарём (30 дней), streak freeze 1/мес' },
      { type: 'new', text: 'Daily missions — 3 задания в день из пула 8, XP за выполнение + бонус 100 XP за все 3' },
      { type: 'new', text: 'XP / Level system — 20 XP за победу, 5 за поражение, level * 100 XP до следующего' },
      { type: 'new', text: 'AI auto-difficulty — после 3 поражений подряд кнопка «Попробовать полегче?»' },
      { type: 'new', text: 'First Win celebration — fullscreen popup со звездой при первой победе в жизни' },
      { type: 'new', text: 'Missions auto-tracking — прогресс миссий обновляется автоматически (Game + Puzzles)' },
      { type: 'new', text: 'Streak popup — toast при входе с текущей серией и рекордом' },
      { type: 'fix', text: 'Блог — принудительное обновление дат, хронологический порядок (12 постов)' },
    ],
    changes_en: [
      { type: 'new', text: 'Login streak — daily streak with calendar (30 days), streak freeze 1/month' },
      { type: 'new', text: 'Daily missions — 3 per day from pool of 8, XP rewards + 100 XP bonus for all 3' },
      { type: 'new', text: 'XP / Level system — 20 XP per win, 5 per loss, level * 100 XP to next' },
      { type: 'new', text: 'AI auto-difficulty — after 3 losses suggests easier level' },
      { type: 'new', text: 'First Win celebration — fullscreen star popup on first ever victory' },
      { type: 'new', text: 'Missions auto-tracking — progress updates automatically (Game + Puzzles)' },
      { type: 'new', text: 'Streak popup — toast on login showing current streak and best' },
      { type: 'fix', text: 'Blog — forced date update, chronological order (12 posts)' },
    ],
  },
  {
    version: '3.8',
    date: '2026-03-31',
    title_ru: 'Аудит, безопасность, полный i18n',
    title_en: 'Audit, security, full i18n',
    changes_ru: [
      { type: 'new', text: 'Game result — fullscreen overlay на мобильных с анимацией' },
      { type: 'new', text: 'ELO дельта (+12 / -8) отображается после каждой партии' },
      { type: 'new', text: 'PvP Undo — кнопка отмены последнего хода' },
      { type: 'new', text: 'Яндекс.Метрика (вебвизор, карта кликов)' },
      { type: 'new', text: 'Firebase Push — код готов (регистрация токенов)' },
      { type: 'new', text: 'Google Play signing config (keystore.properties)' },
      { type: 'fix', text: 'XSS в чате — HTML tags stripped на сервере' },
      { type: 'fix', text: 'WS rate limiting — 15 msg/sec max' },
      { type: 'fix', text: '401 auto-logout — протухший JWT очищается автоматически' },
      { type: 'fix', text: 'SW hotfix — авто-очистка сломанного кеша для всех пользователей' },
      { type: 'fix', text: 'WebP изображения — logo, OG, icons (-80% трафика)' },
      { type: 'fix', text: 'CSS дубли убраны (site-content 3→1, stand 2→1, chip 2→1)' },
      { type: 'fix', text: 'i18n полный — Game, Online, Profile, 26 ачивок с descEn' },
      { type: 'fix', text: 'aria-labels на все icon-only кнопки' },
      { type: 'fix', text: 'Username XSS sanitization при регистрации' },
      { type: 'fix', text: 'Sitemap обновлён — удалены мёртвые ссылки' },
    ],
    changes_en: [
      { type: 'new', text: 'Game result — fullscreen overlay on mobile with animation' },
      { type: 'new', text: 'ELO delta (+12 / -8) displayed after each game' },
      { type: 'new', text: 'PvP Undo — undo last move button' },
      { type: 'new', text: 'Yandex Metrika (webvisor, click map)' },
      { type: 'new', text: 'Firebase Push — code ready (token registration)' },
      { type: 'new', text: 'Google Play signing config (keystore.properties)' },
      { type: 'fix', text: 'XSS in chat — HTML tags stripped on server' },
      { type: 'fix', text: 'WS rate limiting — 15 msg/sec max' },
      { type: 'fix', text: '401 auto-logout — expired JWT auto-cleared' },
      { type: 'fix', text: 'SW hotfix — auto-clear broken cache for all users' },
      { type: 'fix', text: 'WebP images — logo, OG, icons (-80% traffic)' },
      { type: 'fix', text: 'CSS duplicates removed (site-content 3→1, stand 2→1, chip 2→1)' },
      { type: 'fix', text: 'Full i18n — Game, Online, Profile, 26 achievements with descEn' },
      { type: 'fix', text: 'aria-labels on all icon-only buttons' },
      { type: 'fix', text: 'Username XSS sanitization on registration' },
      { type: 'fix', text: 'Sitemap updated — removed dead links' },
    ],
  },
  {
    version: '3.7',
    date: '2026-03-31',
    title_ru: 'Мобильное приложение, haptic, onboarding, новые логотипы',
    title_en: 'Mobile app, haptic feedback, onboarding, new logos',
    changes_ru: [
      { type: 'new', text: 'Мобильное приложение — полная адаптация UI для Android (Capacitor)' },
      { type: 'new', text: 'Haptic feedback — вибрация при каждом действии (размещение, перенос, закрытие, победа)' },
      { type: 'new', text: 'Onboarding — 4 экрана обучения при первом запуске (свайп, skip)' },
      { type: 'new', text: 'Новые логотипы — иконка, splash screen, header, OG-image' },
      { type: 'new', text: 'Privacy Policy — политика конфиденциальности RU/EN' },
      { type: 'new', text: 'Share app — поделиться приложением через нативный dialog' },
      { type: 'new', text: 'Rate app popup — предложение оценить после 5 побед' },
      { type: 'new', text: 'Offline detection — баннер "Нет сети" + AI работает без интернета' },
      { type: 'new', text: 'Доска растягивается на весь экран (flex layout), кнопки в зоне пальцев' },
      { type: 'new', text: 'Game result — fullscreen overlay на мобильных' },
      { type: 'new', text: 'Планшет — ограниченная ширина доски и tab bar' },
      { type: 'fix', text: 'Убрана пустота внизу экрана (.app padding 80px в native)' },
      { type: 'fix', text: 'Профиль: stats 2×2 на телефонах, табы горизонтальный скролл' },
      { type: 'fix', text: 'Puzzles grid не выходит за экран на 320px (min() fix)' },
      { type: 'fix', text: 'Фишки с border вместо тяжёлого box-shadow в native' },
      { type: 'fix', text: 'Landscape mode — компактные стойки, скрытые лейблы tab bar' },
    ],
    changes_en: [
      { type: 'new', text: 'Mobile app — full UI adaptation for Android (Capacitor)' },
      { type: 'new', text: 'Haptic feedback — vibration on every action (place, transfer, close, win)' },
      { type: 'new', text: 'Onboarding — 4 swipeable intro screens on first launch' },
      { type: 'new', text: 'New logos — app icon, splash screen, header, OG-image' },
      { type: 'new', text: 'Privacy Policy page (RU/EN)' },
      { type: 'new', text: 'Share app via native share dialog' },
      { type: 'new', text: 'Rate app popup after 5 wins' },
      { type: 'new', text: 'Offline detection — banner + AI works without internet' },
      { type: 'new', text: 'Board stretches to fill screen (flex layout), buttons in thumb zone' },
      { type: 'new', text: 'Game result — fullscreen overlay on mobile' },
      { type: 'new', text: 'Tablet — constrained board and tab bar width' },
      { type: 'fix', text: 'Removed empty space at bottom (.app padding 80px in native)' },
      { type: 'fix', text: 'Profile: 2×2 stats grid on phones, horizontal scroll tabs' },
      { type: 'fix', text: 'Puzzles grid overflow fix on 320px screens' },
      { type: 'fix', text: 'Chips with border instead of heavy box-shadow in native' },
      { type: 'fix', text: 'Landscape mode — compact stands, hidden tab labels' },
    ],
  },
  {
    version: '3.6',
    date: '2026-03-31',
    title_ru: 'Capacitor мобильное приложение',
    title_en: 'Capacitor mobile app',
    changes_ru: [
      { type: 'new', text: 'Android-приложение через Capacitor — bottom tab bar, нативный UI' },
      { type: 'new', text: 'Мобильный game bar с шестерёнкой настроек (bottom sheet)' },
      { type: 'new', text: 'More page — настройки, правила, блог, changelog, язык, аватар' },
      { type: 'new', text: 'Performance: убраны backdrop-filter, box-shadow, бесконечные анимации в native' },
      { type: 'new', text: 'Fetch interceptor: /api/ → snatch-highrise.com/api/ в native' },
      { type: 'new', text: 'Deep links: Android intent-filter для snatch-highrise.com' },
      { type: 'new', text: 'Safe area insets для notch и системной навигации' },
    ],
    changes_en: [
      { type: 'new', text: 'Android app via Capacitor — bottom tab bar, native UI' },
      { type: 'new', text: 'Mobile game bar with settings gear (bottom sheet)' },
      { type: 'new', text: 'More page — settings, rules, blog, changelog, language, avatar' },
      { type: 'new', text: 'Performance: removed backdrop-filter, box-shadow, infinite animations in native' },
      { type: 'new', text: 'Fetch interceptor: /api/ → snatch-highrise.com/api/ in native' },
      { type: 'new', text: 'Deep links: Android intent-filter for snatch-highrise.com' },
      { type: 'new', text: 'Safe area insets for notch and system navigation' },
    ],
  },
  {
    version: '3.5',
    date: '2026-03-30',
    title_ru: 'GPU-нейросеть, экстрим, рематч, спектатор, профили',
    title_en: 'GPU neural network, extreme, rematch, spectator, profiles',
    changes_ru: [
      { type: 'new', text: 'GPU-нейросеть в браузере — ResNet 840K параметров (v500, NVIDIA), значительно сильнее AI' },
      { type: 'new', text: 'Сложность «Экстрим» — 600 GPU-симуляций, самый сильный AI' },
      { type: 'new', text: 'Доучивание AI на партиях реальных игроков (retrain.py pipeline)' },
      { type: 'new', text: 'Серверная валидация ходов — движок на сервере, защита от gameOver эксплойта' },
      { type: 'new', text: 'Рематч в онлайн-режиме — кнопка после партии, сервер меняет стороны' },
      { type: 'new', text: 'Спектатор-режим — наблюдение за чужими партиями в реальном времени' },
      { type: 'new', text: 'Публичные профили — клик по нику в лидерборде открывает карточку игрока' },
      { type: 'new', text: 'Push-уведомления (Browser Notification API) — ваш ход, ничья, рематч' },
      { type: 'new', text: 'CMS: 84 хардкодных текста заменены на i18n, 65 новых ключей в админке' },
      { type: 'new', text: 'server.js разбит на модули: db.js, ws.js, server.js' },
      { type: 'new', text: 'Game.jsx декомпозиция: ReplayViewer.jsx, gameUtils.js (1424→1267 строк)' },
      { type: 'fix', text: 'Переименование лога «Стойки API» → «Snatch Highrise API»' },
      { type: 'fix', text: 'useI18n() добавлен в sub-компоненты Blog, Tutorial, Openings, Puzzles' },
      { type: 'fix', text: 'spectate-online: newGame reset, resign скрыт, back-to-lobby' },
    ],
    changes_en: [
      { type: 'new', text: 'GPU neural network in browser — ResNet 840K params (v500, NVIDIA), much stronger AI' },
      { type: 'new', text: 'Extreme difficulty — 600 GPU simulations, strongest AI level' },
      { type: 'new', text: 'AI retraining on real player games (retrain.py pipeline)' },
      { type: 'new', text: 'Server-side move validation — game engine on server, gameOver exploit fixed' },
      { type: 'new', text: 'Online rematch — button after game, server swaps sides automatically' },
      { type: 'new', text: 'Spectator mode — watch live games in real-time' },
      { type: 'new', text: 'Public profiles — click username in leaderboard to view player card' },
      { type: 'new', text: 'Push notifications (Browser Notification API) — your turn, draw, rematch' },
      { type: 'new', text: 'CMS: 84 hardcoded texts replaced with i18n, 65 new keys in admin' },
      { type: 'new', text: 'server.js split into modules: db.js, ws.js, server.js' },
      { type: 'new', text: 'Game.jsx decomposition: ReplayViewer.jsx, gameUtils.js (1424→1267 lines)' },
      { type: 'fix', text: 'Console log renamed "Стойки API" → "Snatch Highrise API"' },
      { type: 'fix', text: 'useI18n() added to Blog, Tutorial, Openings, Puzzles sub-components' },
      { type: 'fix', text: 'spectate-online: newGame reset, resign hidden, back-to-lobby' },
    ],
  },
  {
    version: '3.4',
    date: '2026-03-27',
    title_ru: 'UX по результатам тестирования',
    title_en: 'UX from playtesting',
    changes_ru: [
      { type: 'new', text: 'Правила переписаны с нуля — SVG-схемы вместо интерактивных демо' },
      { type: 'new', text: 'Стойки перевёрнуты — фишки растут снизу вверх' },
      { type: 'new', text: 'Счётчик фишек — всегда виден, красный при 9+, жёлтый при 7+' },
      { type: 'new', text: 'Призрачный перенос — видно откуда ушли и куда пришли фишки' },
      { type: 'new', text: 'Print & Play — белый фон, 70 фишек (было 55)' },
      { type: 'fix', text: 'Критический баг: Online стартовал AI вместо мультиплеера' },
      { type: 'fix', text: 'Пустые кнопки Share/Replay после resign' },
      { type: 'fix', text: 'Light тема — полная переработка (Apple-style)' },
    ],
    changes_en: [
      { type: 'new', text: 'Rules rewritten — SVG diagrams instead of interactive demos' },
      { type: 'new', text: 'Stands flipped — chips grow bottom-up' },
      { type: 'new', text: 'Chip counter — always visible, red at 9+, yellow at 7+' },
      { type: 'new', text: 'Ghost transfer — visual source/destination indicators' },
      { type: 'new', text: 'Print & Play — white bg, 70 chips (was 55)' },
      { type: 'fix', text: 'Critical bug: Online started AI instead of multiplayer' },
      { type: 'fix', text: 'Empty Share/Replay buttons after resign' },
      { type: 'fix', text: 'Light theme — full rework (Apple-style)' },
    ],
  },
  {
    version: '3.3',
    date: '2026-03-24',
    title_ru: 'Адаптивка, тема Wood, правила',
    title_en: 'Responsive, Wood theme, rules',
    changes_ru: [
      { type: 'new', text: '8 брейкпоинтов адаптивки (было 4) — от 1024px до 340px' },
      { type: 'new', text: 'Тема Wood полностью переработана: CSS текстуры дерева, inner shadow, стилизация фишек' },
      { type: 'new', text: 'Интерактивные схемы в правилах: перенос (4 шага), закрытие (3 шага), swap' },
      { type: 'new', text: 'Отдельная страница Changelog с историей всех версий' },
      { type: 'new', text: 'Обновлённый Print & Play PDF v3.2 с полными правилами' },
      { type: 'fix', text: 'Туториал центрирован по вертикали, текст переноса исправлен' },
      { type: 'fix', text: 'Футер: стили разделителей, ссылки Changelog/Правила/Print & Play' },
      { type: 'fix', text: 'Dropdown «Ещё» не пропадает при наведении' },
      { type: 'fix', text: 'Админка адаптивна: горизонтальные табы на мобилке' },
      { type: 'fix', text: 'Убран автор из лендинга' },
    ],
    changes_en: [
      { type: 'new', text: '8 responsive breakpoints (was 4) — from 1024px to 340px' },
      { type: 'new', text: 'Wood theme fully reworked: CSS wood grain textures, inner shadows, styled chips' },
      { type: 'new', text: 'Interactive rule diagrams: transfer (4 steps), closing (3 steps), swap' },
      { type: 'new', text: 'Dedicated Changelog page with full version history' },
      { type: 'new', text: 'Updated Print & Play PDF v3.2 with complete rules' },
      { type: 'fix', text: 'Tutorial vertically centered, transfer text corrected' },
      { type: 'fix', text: 'Footer: divider styles, Changelog/Rules/Print & Play links' },
      { type: 'fix', text: '"More" dropdown no longer disappears on hover' },
      { type: 'fix', text: 'Admin panel responsive: horizontal tabs on mobile' },
      { type: 'fix', text: 'Removed author from landing page' },
    ],
  },
  {
    version: '3.2',
    date: '2026-03-24',
    title_ru: 'Админ-панель и безопасность',
    title_en: 'Admin panel & security',
    changes_ru: [
      { type: 'new', text: 'Полноценная админ-панель: пользователи, партии, блог, сезоны, сервер' },
      { type: 'new', text: 'Управление блогом через админку (создание, редактирование, удаление)' },
      { type: 'new', text: 'Мониторинг комнат и очереди в реальном времени' },
      { type: 'new', text: 'Статистика ачивок и обучающих данных' },
      { type: 'fix', text: 'WebSocket аутентификация — токен передаётся при подключении' },
      { type: 'fix', text: 'Валидация результатов партий на сервере (защита от накрутки)' },
      { type: 'fix', text: 'Исправлена проверка прав администратора в блоге' },
      { type: 'fix', text: 'Helmet CSP включён, CORS ограничен' },
      { type: 'fix', text: 'Исправлен баг с двойной отправкой чат-сообщений в онлайне' },
      { type: 'perf', text: 'Game и Online загружаются только при первом посещении' },
      { type: 'perf', text: 'Service Worker обновляется автоматически при каждом деплое' },
    ],
    changes_en: [
      { type: 'new', text: 'Full admin panel: users, games, blog, seasons, server monitoring' },
      { type: 'new', text: 'Blog management through admin (create, edit, delete)' },
      { type: 'new', text: 'Live room & matchmaking queue monitoring' },
      { type: 'new', text: 'Achievement and training data stats' },
      { type: 'fix', text: 'WebSocket authentication — token sent on connection' },
      { type: 'fix', text: 'Server-side game result validation (anti-cheat)' },
      { type: 'fix', text: 'Fixed admin permission check in blog endpoints' },
      { type: 'fix', text: 'Helmet CSP enabled, CORS restricted' },
      { type: 'fix', text: 'Fixed duplicate chat messages in online mode' },
      { type: 'perf', text: 'Game and Online lazy-loaded on first visit only' },
      { type: 'perf', text: 'Service Worker auto-updates on each deploy' },
    ],
  },
  {
    version: '3.1',
    date: '2026-03-20',
    title_ru: 'Интерактивные правила и схемы',
    title_en: 'Interactive rules & diagrams',
    changes_ru: [
      { type: 'new', text: 'Интерактивная схема переноса — 4 шага с анимацией' },
      { type: 'new', text: 'Интерактивная схема закрытия стойки — 3 шага' },
      { type: 'new', text: 'Демо Swap Rule с кнопкой смены цветов' },
      { type: 'new', text: 'Расширенные правила: все нюансы из оригинального ТЗ' },
      { type: 'fix', text: 'Стили футера (разделители и расположение)' },
      { type: 'new', text: 'Ссылки в подвале: Changelog, Правила, Print & Play' },
    ],
    changes_en: [
      { type: 'new', text: 'Interactive transfer diagram — 4 animated steps' },
      { type: 'new', text: 'Interactive stand closing diagram — 3 steps' },
      { type: 'new', text: 'Swap Rule demo with color swap button' },
      { type: 'new', text: 'Expanded rules: all nuances from original spec' },
      { type: 'fix', text: 'Footer styles (dividers and layout)' },
      { type: 'new', text: 'Footer links: Changelog, Rules, Print & Play' },
    ],
  },
  {
    version: '3.0',
    date: '2026-03-15',
    title_ru: 'Масштабное обновление',
    title_en: 'Major update',
    changes_ru: [
      { type: 'new', text: '26 ачивок (было 14) с цветовыми категориями: бронза, серебро, золото, алмаз' },
      { type: 'new', text: 'Рейтинговые сезоны — каждый месяц новый, свой лидерборд' },
      { type: 'new', text: '14 настроек: таймер, стиль фишек, плотность доски, дальтоники, крупный текст' },
      { type: 'new', text: 'Полная мультиязычность RU/EN — весь интерфейс переведён' },
      { type: 'new', text: 'Resign и предложение ничьей в онлайне' },
      { type: 'new', text: 'Quick-chat: gg, gl, nice, wp, !' },
      { type: 'new', text: 'Случайный матчмейкинг — кнопка «Найти соперника»' },
      { type: 'new', text: 'Авторизация в шапке — аватар с рейтингом' },
      { type: 'new', text: 'Лендинг с scroll-анимациями (4 итерации дизайна)' },
      { type: 'perf', text: 'Error Boundary + lazy loading (11 компонентов)' },
      { type: 'perf', text: 'Hash routing: #game, #blog, #puzzles — back/forward работает' },
      { type: 'new', text: 'OG-теги, JSON-LD, robots.txt, sitemap' },
      { type: 'new', text: 'Accessibility: aria-labels, focus-visible, skip-link, keyboard nav' },
      { type: 'new', text: 'Service Worker: network-first, не кеширует API' },
    ],
    changes_en: [
      { type: 'new', text: '26 achievements (was 14) with color tiers: bronze, silver, gold, diamond' },
      { type: 'new', text: 'Ranked seasons — monthly, each with its own leaderboard' },
      { type: 'new', text: '14 settings: timer, chip style, board density, colorblind, large text' },
      { type: 'new', text: 'Full RU/EN internationalization' },
      { type: 'new', text: 'Resign and draw offer in online mode' },
      { type: 'new', text: 'Quick chat: gg, gl, nice, wp, !' },
      { type: 'new', text: 'Random matchmaking — "Find opponent" button' },
      { type: 'new', text: 'Auth in header — avatar with rating' },
      { type: 'new', text: 'Landing page with scroll animations' },
      { type: 'perf', text: 'Error Boundary + lazy loading (11 components)' },
      { type: 'perf', text: 'Hash routing with browser back/forward support' },
      { type: 'new', text: 'OG tags, JSON-LD, robots.txt, sitemap' },
      { type: 'new', text: 'Accessibility: aria-labels, focus-visible, skip-link' },
      { type: 'new', text: 'Service Worker: network-first, skips API caching' },
    ],
  },
  {
    version: '2.0',
    date: '2026-02-20',
    title_ru: 'Онлайн мультиплеер и головоломки',
    title_en: 'Online multiplayer & puzzles',
    changes_ru: [
      { type: 'new', text: 'Онлайн мультиплеер по ссылке — WebSocket, QR-код, серии 3/5' },
      { type: 'new', text: 'Ежедневные и еженедельные головоломки с лидербордами' },
      { type: 'new', text: 'Банк из 50 головоломок (3 уровня сложности)' },
      { type: 'new', text: 'Ежедневный челлендж со стартовой позицией' },
      { type: 'new', text: 'Система друзей — запросы, принятие' },
      { type: 'new', text: 'История партий (50 последних)' },
      { type: 'new', text: '4 темы: Dark, Neon, Wood, Light' },
      { type: 'new', text: '4 звуковых пака: classic, minimal, retro, off' },
      { type: 'new', text: 'Print & Play PDF: 3 страницы A4' },
    ],
    changes_en: [
      { type: 'new', text: 'Online multiplayer via link — WebSocket, QR code, best-of-3/5' },
      { type: 'new', text: 'Daily and weekly puzzles with leaderboards' },
      { type: 'new', text: '50 puzzle bank (3 difficulty levels)' },
      { type: 'new', text: 'Daily challenge with starting position' },
      { type: 'new', text: 'Friends system — requests, acceptance' },
      { type: 'new', text: 'Game history (last 50)' },
      { type: 'new', text: '4 themes: Dark, Neon, Wood, Light' },
      { type: 'new', text: '4 sound packs: classic, minimal, retro, off' },
      { type: 'new', text: 'Print & Play PDF: 3 A4 pages' },
    ],
  },
  {
    version: '1.0',
    date: '2026-01-15',
    title_ru: 'Первый релиз',
    title_en: 'First release',
    changes_ru: [
      { type: 'new', text: 'Полная реализация правил: 10 стоек, 11 фишек, золотая стойка' },
      { type: 'new', text: 'AI на AlphaZero: MCTS + нейросеть, 3 уровня сложности' },
      { type: 'new', text: 'GPU-обучение: 1146 итераций, loss 0.098, win rate 97%' },
      { type: 'new', text: 'Баланс P1/P2: 50:50 на 239K партий' },
      { type: 'new', text: 'Swap rule для компенсации преимущества первого хода' },
      { type: 'new', text: 'Режимы: vs AI, PvP локально, AI vs AI (наблюдение)' },
      { type: 'new', text: 'ELO рейтинг и профиль игрока' },
      { type: 'new', text: '12 аватаров на выбор' },
      { type: 'new', text: 'Блог с новостями разработки' },
    ],
    changes_en: [
      { type: 'new', text: 'Full game rules: 10 stands, 11 chips, golden stand' },
      { type: 'new', text: 'AlphaZero AI: MCTS + neural network, 3 difficulty levels' },
      { type: 'new', text: 'GPU training: 1146 iterations, loss 0.098, win rate 97%' },
      { type: 'new', text: 'P1/P2 balance: 50:50 across 239K games' },
      { type: 'new', text: 'Swap rule to compensate first-move advantage' },
      { type: 'new', text: 'Modes: vs AI, local PvP, AI vs AI (spectate)' },
      { type: 'new', text: 'ELO rating and player profile' },
      { type: 'new', text: '12 avatars to choose from' },
      { type: 'new', text: 'Dev blog' },
    ],
  },
]

const TYPE_STYLE = {
  new: { label: 'NEW', color: 'var(--green)', bg: 'rgba(61,214,140,0.1)' },
  fix: { label: 'FIX', color: 'var(--coral)', bg: 'rgba(240,101,74,0.1)' },
  perf: { label: 'PERF', color: 'var(--p1)', bg: 'rgba(74,158,255,0.1)' },
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  if (lang === 'en') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Changelog() {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Changelog</h2>
        <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 6 }}>
          {en ? 'What changed and when. Every update in one place.' : 'Что менялось и когда. Все обновления в одном месте.'}
        </p>
      </div>

      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Вертикальная линия */}
        <div style={{
          position: 'absolute', left: 8, top: 8, bottom: 0, width: 2,
          background: 'linear-gradient(to bottom, var(--accent), var(--surface3))',
          borderRadius: 1,
        }} />

        {VERSIONS.map((v, vi) => {
          const changes = en ? v.changes_en : v.changes_ru
          const title = en ? v.title_en : v.title_ru

          return (
            <div key={v.version} style={{ marginBottom: vi < VERSIONS.length - 1 ? 36 : 0, position: 'relative' }}>
              {/* Точка на линии */}
              <div style={{
                position: 'absolute', left: -24, top: 6, width: 14, height: 14,
                borderRadius: '50%', background: vi === 0 ? 'var(--accent)' : 'var(--surface3)',
                border: `2px solid ${vi === 0 ? 'var(--accent)' : 'var(--surface3)'}`,
              }} />

              {/* Заголовок версии */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 18, fontWeight: 700, color: 'var(--ink)',
                  fontFamily: "'DM Serif Display', serif",
                }}>v{v.version}</span>
                <span style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 500 }}>{title}</span>
                <span style={{ fontSize: 11, color: 'var(--ink3)', marginLeft: 'auto' }}>{formatDate(v.date, lang)}</span>
              </div>

              {/* Список изменений */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {changes.map((c, ci) => {
                  const t = TYPE_STYLE[c.type] || TYPE_STYLE.new
                  return (
                    <div key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                        background: t.bg, color: t.color, flexShrink: 0, marginTop: 2,
                        letterSpacing: 0.5, lineHeight: '14px',
                      }}>{t.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{c.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
