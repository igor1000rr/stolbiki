/**
 * Сидинг блог-постов.
 *
 * Новый релиз = одна запись в конец BLOG_POSTS + обновить PINNED_SLUG.
 * При старте сервера:
 *   1. Новые посты добавляются по slug (идемпотентно).
 *   2. Пин жёстко перестанавливается на PINNED_SLUG — админ-пины
 *      через PUT /api/admin/blog не переживут рестарт — это сознательный trade-off
 *      ради того чтобы пин всегда совпадал с текущим релизом.
 *
 * Тексты пишем нейтрально без эмодзи — это публичный блог.
 */

export const PINNED_SLUG = 'v572-arena-races'

export const BLOG_POSTS = [
  {
    slug: 'v3-4-security-spectator',
    title_ru: 'v3.4 — Безопасность, спектатор, рематч и публичные профили',
    title_en: 'v3.4 — Security, spectator mode, rematch and public profiles',
    body_ru: 'Большое обновление серверной части и онлайн-функционала.\n\nБезопасность: сервер валидирует каждый ход через игровой движок.\n\nРематч: после онлайн-партии можно предложить переиграть.\n\nСпектатор-режим: в лобби появился раздел живых партий.\n\nПубличные профили: клик по нику в лидерборде открывает карточку игрока.\n\nPush-уведомления: когда вкладка в фоне — браузер покажет уведомление о ходе.\n\nПод капотом: server.js разбит на 3 модуля, Game.jsx декомпозирован, 84 хардкодных текста заменены на CMS-ключи.',
    body_en: 'Major server-side and online functionality update.\n\nSecurity: server now validates every move through the game engine.\n\nRematch: after an online game you can offer a rematch.\n\nSpectator mode: the lobby now has a live games section.\n\nPublic profiles: click a username in the leaderboard to view their player card.\n\nPush notifications: when the tab is in background, the browser shows your-turn notifications.\n\nUnder the hood: server.js split into 3 modules, Game.jsx decomposed, 84 hardcoded texts replaced with CMS keys.',
    tag: 'release',
    created_at: '2026-03-30 10:00:00',
  },
  {
    slug: 'v3-5-gpu-neural-extreme',
    title_ru: 'v3.5 — GPU-нейросеть, экстрим, рематч, спектатор',
    title_en: 'v3.5 — GPU neural network, extreme, rematch, spectator',
    body_ru: 'GPU-нейросеть в браузере: ResNet с 840K параметрами (93× больше предыдущей).\n\nЭкстрим-сложность: новый уровень с 600 GPU-симуляциями.\n\nСерверная валидация каждого хода. Рематч, спектатор, публичные профили, push-уведомления.',
    body_en: 'GPU neural network in browser: ResNet with 840K parameters (93x larger than before).\n\nExtreme difficulty: new level with 600 GPU simulations.\n\nServer-side validation of every move. Rematch, spectator, public profiles, push notifications.',
    tag: 'release',
    created_at: '2026-03-30 12:00:00',
  },
  {
    slug: 'v4-5-0-code-audit',
    title_ru: 'v4.5.0 — Аудит кода, очистка, Node 22',
    title_en: 'v4.5.0 — Code audit, cleanup, Node 22',
    body_ru: 'Технический аудит всей кодовой базы.\n\nNode.js 22: VPS обновлён с Node 20 на 22.22.2.\n\n8.1 MB вырезано из репо: удалён мёртвый gpu_weights.json.\n\nМёртвый код удалён. PM2 fork mode. Vite chunks. ELO-график с тирами.',
    body_en: 'Full code audit.\n\nNode.js 22: VPS upgraded from Node 20 to 22.22.2.\n\n8.1 MB removed from repo: dead gpu_weights.json gone.\n\nDead code removed. PM2 fork mode. Vite chunks. ELO chart with tiers.',
    tag: 'release',
    created_at: '2026-04-03 14:00:00',
  },
  {
    slug: 'v4-5-1-virality',
    title_ru: 'v4.5.1 — Share-карточки и реферальная система',
    title_en: 'v4.5.1 — Share cards and referral system',
    body_ru: 'Виральные фичи.\n\nShare-карточка: Canvas в PNG через Web Share API.\n\nРеферальная система: уникальный код и ссылка, +100 XP за приглашённого друга.',
    body_en: 'Viral features.\n\nShare card: Canvas to PNG via Web Share API.\n\nReferral system: unique code and link, +100 XP per invited friend.',
    tag: 'release',
    created_at: '2026-04-04 12:00:00',
  },
  {
    slug: 'v4-6-0-challenge-css',
    title_ru: 'v4.6.0 — Вызов друзьям, CSS –81%, рефералы',
    title_en: 'v4.6.0 — Friend Challenge, CSS –81%, referrals',
    body_ru: 'Вызов друзьям: кнопка создаёт комнату с таймером 5 минут.\n\nCSS рефакторинг: app.css с 3093 до 595 строк (–81%).\n\nNode.js 22, HTTPS, UFW, SQLite бэкапы каждые 6 часов.',
    body_en: 'Friend Challenge: button creates a room with 5-minute timer.\n\nCSS Refactor: app.css from 3093 to 595 lines (-81%).\n\nNode.js 22, HTTPS, UFW, SQLite backups every 6h.',
    tag: 'release',
    created_at: '2026-04-05 10:00:00',
  },
  {
    slug: 'v4-6-1-10m-spectator',
    title_ru: 'v4.6.1 — 10M партий, spectator chat, сезонные награды',
    title_en: 'v4.6.1 — 10M games, spectator chat, season rewards',
    body_ru: '10M self-play партий: P0 36.35% vs P1 36.33% — идеальный баланс.\n\nAI v5: checkpoint v1493, 840K параметров.\n\nSpectator chat, сезонные награды top-10, 4 сложные головоломки.',
    body_en: '10M self-play games: P0 36.35% vs P1 36.33% — perfect balance.\n\nAI v5: checkpoint v1493, 840K params.\n\nSpectator chat, season rewards top-10, 4 hard puzzles.',
    tag: 'release',
    created_at: '2026-04-05 14:00:00',
  },
  {
    slug: 'v4-6-2-analytics-gdpr',
    title_ru: 'v4.6.2 — AI Impossible, Profile/Settings redesign, Legal',
    title_en: 'v4.6.2 — AI Impossible, Profile/Settings redesign, Legal',
    body_ru: 'AI Impossible: 5000 MCTS симуляций (~6 сек). 99%+ побед против людей. 5 уровней сложности.\n\nProfile/Settings redesign. Сбор training data. Privacy Policy, Terms of Service. Cookie consent. Landing redesign. 9 аналитических событий.',
    body_en: 'AI Impossible: 5000 MCTS simulations (~6 sec). 99%+ win rate vs humans. 5 difficulty levels.\n\nProfile/Settings redesign. Training data collection. Privacy Policy, Terms of Service. Cookie consent. Landing redesign. 9 analytics events.',
    tag: 'release',
    created_at: '2026-04-05 18:00:00',
  },
  {
    slug: 'v4-7-0-alphazero-android',
    title_ru: 'v4.7.0 — AlphaZero AI v7, Android, полный редизайн UX',
    title_en: 'v4.7.0 — AlphaZero AI v7, Android, full UX redesign',
    body_ru: 'AlphaZero AI v7: policy+value архитектура (859K параметров). PUCT формула вместо UCB1.\n\n5 уровней сложности: Easy (50), Medium (150), Hard (400), Extreme (800), Impossible (1500).\n\nAndroid-приложение: Capacitor 8, 6 плагинов. Редизайн игры и лендинга.',
    body_en: 'AlphaZero AI v7: policy+value architecture (859K params). PUCT formula instead of UCB1.\n\n5 difficulty levels: Easy (50), Medium (150), Hard (400), Extreme (800), Impossible (1500).\n\nAndroid app: Capacitor 8, 6 plugins. Game and landing redesign.',
    tag: 'release',
    created_at: '2026-04-05 20:00:00',
  },
  {
    slug: 'v530-bugfixes',
    title_ru: 'v5.3.0 — Багфиксы CI/CD, /api/training, rewarded field',
    title_en: 'v5.3.0 — Bug fixes CI/CD, /api/training, rewarded field',
    body_ru: 'CI/CD: deploy.yml использовал actions/checkout@v5 и setup-node@v5 — этих версий не существует. Исправлено на @v4.\n\n/api/training: переменная safeDifficulty была undefined — все записи сохранялись с difficulty=0.\n\n/api/bricks/award-rewarded: ответ теперь содержит поле rewarded.\n\nDB migration 8+9: колонки bricks, active_skin, rush_best — через versioned migration вместо try/catch в routes.',
    body_en: 'CI/CD: deploy.yml used actions/checkout@v5 and setup-node@v5 — these versions do not exist. Fixed to @v4.\n\n/api/training: safeDifficulty was undefined — all training records saved with difficulty=0.\n\n/api/bricks/award-rewarded: response now includes the rewarded field.\n\nDB migration 8+9: bricks, active_skin, rush_best columns via versioned migration instead of try/catch in routes.',
    tag: 'release',
    created_at: '2026-04-14 12:00:00',
  },
  {
    slug: 'v561-audit-fixes',
    title_ru: 'v5.6.1 — Багфиксы по архитектурному аудиту',
    title_en: 'v5.6.1 — Audit bug fixes',
    body_ru: 'Провели полный аудит кодовой базы: фронт, бэк, WS, PWA, 3D. Нашли и закрыли 7 багов.\n\n## Push-уведомления вели на старый домен\nПосле ребрендинга в server/ws.js оставался hardcoded URL snatch-highrise.com. Теперь highriseheist.com.\n\n## /api/auth/refresh принимал JWT без exp\nСамодельный токен без exp давал NaN > N = false и проходил. Добавили typeof exp === number.\n\n## sendPushTo молча глушил ошибки\nОшибки VAPID, 429, сетевые терялись. Теперь логируются в error_reports.\n\n## Victory City 3D: TDZ при раннем клике\nintroStart объявлялся внутри animate(), pointerup-handler получал ReferenceError до первого RAF.\n\n## Matchmaking: зависшие комнаты\nКомнаты из findMatch не имели room.created, GC их не чистил. Копились при разрыве двух WS.\n\n## middleware.lastSeenCache рос без лимита\nЧистилась только rateLimits-мапа. Добавили LRU 20k записей.\n\n## Service Worker: упрощён activate\nУсловие k !== CACHE_NAME || k.startsWith(OLD) было всегда true. Упростили.\n\n## bricks.js: дубль ALTER TABLE\nТри try ALTER дублировали миграцию 8 из db.js. Убраны.',
    body_en: 'Full audit of the codebase: frontend, backend, WS, PWA, 3D. Found and fixed 7 bugs.\n\n## Push notifications pointed to old domain\nAfter the rebrand server/ws.js still had hardcoded URL snatch-highrise.com. Now highriseheist.com.\n\n## /api/auth/refresh accepted JWTs without exp\nA handcrafted token without exp made NaN > N = false and slipped through. Added typeof exp === number check.\n\n## sendPushTo silenced errors\nVAPID, 429, network errors were lost. Now logged to error_reports.\n\n## Victory City 3D: TDZ on early click\nintroStart was declared inside animate(), pointerup-handler got ReferenceError before the first RAF.\n\n## Matchmaking: stale rooms\nfindMatch rooms had no room.created, GC could not reap them. Accumulated on double-WS disconnect.\n\n## middleware.lastSeenCache grew without bound\nOnly rateLimits had LRU. Added LRU 20k entries.\n\n## Service Worker: simplified activate\nThe condition k !== CACHE_NAME || k.startsWith(OLD) was always true. Simplified.\n\n## bricks.js: duplicate ALTER TABLE\nThree try ALTER duplicated migration 8 from db.js. Removed.',
    tag: 'release',
    created_at: '2026-04-14 18:00:00',
  },
  {
    slug: 'v570-achievement-rarity',
    title_ru: 'v5.7.0 — Achievement Rarity, живой процент держателей',
    title_en: 'v5.7.0 — Achievement Rarity, live percentage of holders',
    body_ru: 'Закрыли Issue #6 — полноценная реализация рарности ачивок.\n\n## Как работает\nКаждая ачивка показывает реальный процент игроков, которые её получили, и tier по порогам:\n- legendary: менее 1% держателей\n- epic: менее 5%\n- rare: менее 20%\n- common: 20% и выше\n\nБаза для расчёта — только активные игроки с games_played ≥ 1.\n\n## Endpoints\n- GET /api/achievements/rarity — публичный, возвращает { total, rarity, computedAt }\n- GET /api/achievements/me (auth) — ачивки юзера с rarity merged\n\nОдин SQL с GROUP BY и JOIN через индекс idx_achievements_user. Кэш 5 минут in-memory + Cache-Control на клиенте.\n\n## Фронт\nHook useAchievementRarity — sessionStorage кэш 5 минут + дедупликация parallel-фетчей (10 бейджей = 1 запрос).\n\nКарточки в ProfileAchievements обогащаются живым holders перед рендером.\n\n## Вторая волна аудита\n- chat-limits: LRU для lastSent Map (защита от memory leak)\n- Notification API: title под брендом Highrise Heist (было 4 места)\n- Notification tag префикс snatch- заменён на highrise-',
    body_en: 'Closed Issue #6 — full implementation of achievement rarity.\n\n## How it works\nEach achievement shows the real percentage of players who unlocked it, and a tier by thresholds:\n- legendary: less than 1% holders\n- epic: less than 5%\n- rare: less than 20%\n- common: 20% or more\n\nCalculation base — only active players with games_played >= 1.\n\n## Endpoints\n- GET /api/achievements/rarity — public, returns { total, rarity, computedAt }\n- GET /api/achievements/me (auth) — user achievements with rarity merged\n\nOne SQL with GROUP BY and JOIN via idx_achievements_user. 5-minute in-memory cache + Cache-Control on client.\n\n## Frontend\nHook useAchievementRarity — sessionStorage cache 5 minutes + parallel-fetch deduplication (10 badges = 1 request).\n\nProfileAchievements cards are enriched with live holders before rendering.\n\n## Second audit wave\n- chat-limits: LRU for lastSent Map (memory leak protection)\n- Notification API: title under Highrise Heist brand (was 4 places)\n- Notification tag prefix snatch- replaced with highrise-',
    tag: 'release',
    created_at: '2026-04-14 22:00:00',
  },
  {
    slug: 'v572-arena-races',
    title_ru: 'v5.7.2 — Hotfix: 4 race condition в турнирной логике Арены',
    title_en: 'v5.7.2 — Hotfix: 4 race conditions in Arena tournament logic',
    body_ru: 'Критический hotfix. Нашли и исправили четыре race condition’а в server/routes/arena.js, которые портили рейтинг и XP при одновременных запросах от обоих игроков матча.\n\n## 1. Dual-report — двойной подсчёт рейтинга\n\nВ POST /api/arena/result был check-then-act. Если оба игрока жали «я выиграл» одновременно (типичный сценарий — оба доиграли партию и сразу репортят), оба SELECT’а возвращали winner_id = null, оба проходили проверку, оба делали UPDATE. Итог: arena_matches перезаписывался два раза, а score, wins, losses в arena_participants инкрементировались дважды. Сетка турнира ехала, рейтинг фейкался.\n\nФикс: атомарный UPDATE с guard’ом — UPDATE arena_matches SET winner_id=?, result=? WHERE id=? AND winner_id IS NULL. Проверяем .changes — только один запрос фактически применяется, второй получает 409 без побочных эффектов на participants. Классический SQL optimistic concurrency control.\n\n## 2. Double round advance — дублирующие матчи\n\nАналогичная проблема на следующем уровне. Когда параллельные /result закрывали разные последние матчи раунда, оба видели allDone === true и оба начинали генерировать следующий раунд.\n\nФикс: guard на arena_tournaments.current_round — UPDATE … SET current_round=? WHERE id=? AND current_round=?. Только тот запрос, который реально продвинул раунд, генерирует матчи.\n\n## 3. Double XP для top-3\n\nТо же самое в финальном раунде — XP +200/+100/+50 для top-3 мог начислиться дважды. Guard через status=\'playing\' в finish UPDATE.\n\n## 4. Смещённый shuffle первого раунда\n\nПервоначальная разбивка на пары была через parts.sort(() => Math.random() - 0.5) — анти-паттерн JavaScript’а. Array.sort ожидает consistent comparator. Рандомный comparator в V8 даёт смещённое распределение.\n\nФикс: классический Fisher-Yates shuffle. Равномерное распределение, O(n).\n\n## Итог\n\nОдин коммит c073bd0 — 4 точечных фикса. API не изменилось, все клиенты совместимы. Существующие arena_tournaments не ломаются.\n\nAndroid: versionCode=59, versionName=5.7.2.',
    body_en: 'Critical hotfix. Found and fixed four race conditions in server/routes/arena.js that were corrupting ratings and XP on simultaneous requests from both match players.\n\n## 1. Dual-report — double rating credit\n\nPOST /api/arena/result had check-then-act. If both players pressed “I won” simultaneously (typical scenario — both finish the game and report immediately), both SELECTs returned winner_id = null, both passed the check, both performed UPDATE. Result: arena_matches was overwritten twice, and score, wins, losses in arena_participants were incremented twice. Tournament bracket got skewed, ratings faked.\n\nFix: atomic UPDATE with guard — UPDATE arena_matches SET winner_id=?, result=? WHERE id=? AND winner_id IS NULL. Check .changes — only one request actually applies, the second gets 409 with no side effects on participants. Classic SQL optimistic concurrency control.\n\n## 2. Double round advance — duplicate matches\n\nSame problem at the next level. When parallel /result closed different last matches of the round, both saw allDone === true and both started generating the next round.\n\nFix: guard on arena_tournaments.current_round — UPDATE … SET current_round=? WHERE id=? AND current_round=?. Only the request that actually advanced the round generates matches.\n\n## 3. Double XP for top-3\n\nSame thing in the final round — top-3 XP +200/+100/+50 could be credited twice. Guard via status=\'playing\' in finish UPDATE.\n\n## 4. Biased first-round shuffle\n\nInitial pairing was via parts.sort(() => Math.random() - 0.5) — a JavaScript anti-pattern. Array.sort expects a consistent comparator. Random comparator gives biased distribution in V8.\n\nFix: classic Fisher-Yates shuffle. Uniform distribution, O(n).\n\n## Summary\n\nSingle commit c073bd0 — 4 targeted fixes. API unchanged, all clients compatible. Existing arena_tournaments do not break.\n\nAndroid: versionCode=59, versionName=5.7.2.',
    tag: 'release',
    created_at: '2026-04-15 10:00:00',
  },
]

export function seedBlogPosts(db) {
  const exists = db.prepare('SELECT 1 FROM blog_posts WHERE slug = ?')
  const insert = db.prepare(
    'INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)'
  )
  let added = 0
  for (const p of BLOG_POSTS) {
    if (exists.get(p.slug)) continue
    insert.run(
      p.slug, p.title_ru, p.title_en || '',
      p.body_ru, p.body_en || '',
      p.tag || 'release',
      p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
    )
    added++
  }
  // Жёстко перестанавливаем пин на текущий релиз.
  // Админ-пины через PUT /api/admin/blog не переживут рестарт — сознательный trade-off.
  db.prepare('UPDATE blog_posts SET pinned = CASE WHEN slug = ? THEN 1 ELSE 0 END').run(PINNED_SLUG)
  if (added > 0) console.log('Блог: добавлено ' + added + ' новых постов, запинен ' + PINNED_SLUG)
}
