# Highrise Heist (Перехват высотки)

Стратегическая настольная игра для двух игроков. AI на базе AlphaZero (MCTS + policy/value нейросеть, 859K параметров).

**Сайт:** https://highriseheist.com
**Версия:** см. `package.json` (единственный источник, текущая v5.6.0)
**Автор:** [igor1000rr](https://t.me/igor1000rr)

## Возможности

- **AI** — 5 уровней сложности (Лёгкая / Средняя / Сложная / Экстрим / Невозможный), PUCT-guided MCTS, GPU нейросеть с policy head
- **Онлайн** — WebSocket, ranked matchmaking по ELO (±200, расширение во времени), таймеры, серверная валидация каждого хода, античит с реплеем партии через движок
- **Турниры** — серии 3 / 5 партий, live Arena, spectator mode
- **Puzzle Rush** — ежедневные / еженедельные пазлы, рейтинг
- **AI Game Review** — анализ партии после завершения
- **33 ачивки** с прогрессом (бронза / серебро / золото / бриллиант)
- **Сезоны** — ежемесячные ранкед лидерборды + награды top-10
- **Клубы** 🦝 — создание, вступление, роли Owner/Officer/Member, лидерборд
- **Глобальный чат** — WS real-time, rate limit 1/3s, admin mute
- **Web Push** — уведомления "Ваш ход!" при offline оппоненте (VAPID)
- **3D Victory City** (Three.js) — каждая победа = 3D-небоскрёб, вращение, 3 пресета ракурса (Изо/Сверху/Кино), 4 пресета времени суток (Ночь/Утро/День/Закат), автоповорот, screenshot через Web Share API, grow-анимация при открытии
- **3D-превью скинов** — в магазине вращающаяся 3D-башенка активного скина
- **3D на лендинге** — автоповорачивающийся демо-город для новых посетителей, IntersectionObserver для экономии батареи
- **WebGL fallback** — на устройствах без WebGL подгружается SVG 2.5D рендер
- **Кирпичи 🧱** — внутриигровая валюта за победы, магазин скинов (17 скинов блоков и стоек, 11 тем)
- **Battle Pass** — 30 квестов на сезон
- **PWA** — Smart Service Worker с 4 стратегиями кеширования, offline режим
- **Capacitor Android** — нативный APK с 7 плагинами
- **Мультиязычность** — RU / EN, path routing `/en/`, ленивый импорт EN
- **Приватность** — GDPR экспорт данных, удаление аккаунта, Yandex.Metrika только после cookie consent

## Стек

| Часть | Технологии |
|---|---|
| Фронтенд | React 19, Vite 8, Three.js 0.170, Capacitor 8, Chart.js |
| Бэкенд | Node.js 22, Express, SQLite (better-sqlite3, WAL), ws, web-push |
| AI (браузер) | Binary float32 веса (3.2 MB), ленивая загрузка для Hard+ уровней |
| AI (обучение) | PyTorch ResNet 107→256×6 + Value + Policy heads, self-play |
| CI/CD | GitHub Actions → test → build → backup DB → scp → pm2 restart, auto-regen lockfile |
| Безопасность | JWT (7d) + refresh с grace period, bcrypt, helmet + CSP (hashed inline), rate limiting, античит |

## Структура

```
src/
  App.jsx              # роутинг, auth, модалки
  version.js           # версия через vite define из package.json
  components/
    VictoryCity.jsx    # 3D Город побед (Three.js)
    VictoryCity2D.jsx  # SVG 2.5D fallback
    LandingCity3D.jsx  # 3D-превью на лендинге (20 демо-зданий)
    Block3DPreview.jsx # вращающаяся башенка скина в магазине
    ...                # Game, Online, Profile, Board, Landing, ...
  engine/              # game engine reexport, ai.js (MCTS), neuralnet.js, api.js
  css/                 # разделён: game.css / landing.css / board / confetti грузятся лениво
  data/                # changelog, whats-new, static content
server/
  server.js            # Express entry
  db.js                # SQLite schema + versioned migrations
  middleware.js        # JWT auth, rate limit, memory leak cleanup
  chat-limits.js       # rate limit + admin mute для глобального чата
  push-helpers.js      # web-push VAPID, sendPushTo, push_subscriptions
  anticheat.js         # верификация партии через проигрывание через движок
  game-engine.js       # единственный источник правил (reexport на клиент через Vite)
  ws.js                # WebSocket: matchmaking, move validation, timers, spectate, push
  routes/              # auth, profile, games, social, missions, arena, puzzles, blog, admin, push, buildings
public/
  sw.js                # Service Worker
  demo-replays.json    # fetch по клику
  dashboard-data.json  # fetch лениво
  manifest.json        # PWA manifest
  sitemap.xml          # 20+ URL, hreflang ru/en
android/               # Capacitor Android проект (versionCode/versionName = android/app/build.gradle)
tests/                 # vitest (~3500 строк, 10 файлов)
analysis/              # Python pipeline для обучения AI
gpu_train/             # GPU training scripts (PyTorch)
```

## Установка

Зависимости разделены: корневой `package.json` — только фронт (никакого native build). `server/package.json` — серверные deps (better-sqlite3 требует python + build tools).

```bash
# Фронт — работает везде, без build tools
npm install
npm run dev              # http://localhost:5173
npm run build            # → dist/

# Бэкенд
cd server
npm install
node server.js           # http://localhost:3001

# Тесты
npm test                 # фронт + те серверные тесты, что скипаются без server deps
npm run test:full        # установит server deps и прогонит всё

# Android build (после изменения версии в android/app/build.gradle)
npm run cap:sync         # vite build + копирует dist/ в android/app/src/main/assets
npm run cap:android      # открывает Android Studio
```

## Деплой

Автодеплой через GitHub Actions при push в `main`:

1. Sync server lockfile (auto-regenerate если out-of-sync)
2. `npm install` (frontend) + `cd server && npm ci`
3. `npx vitest run`
4. `vite build` → `dist/`
5. SCP `dist/` → `/opt/stolbiki-web`
6. SCP `server/` → `/opt/stolbiki-api`
7. Автобэкап SQLite перед рестартом (хранится 7 последних)
8. `pm2 restart`

Secrets: `VPS_HOST`, `VPS_SSH_KEY`. Для web-push в проде: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` в `/opt/stolbiki-api/.env`.

## Тесты

Покрытие ~3500 строк в 10 файлах: движок (802), HTTP роуты через supertest (720), WebSocket e2e (432), validate (330), AI weights (321), stress (260), anticheat (165), helpers, error reports, ws messages.

## Ключевые решения

- **Античит** — `POST /api/games` без `moves[]` не засчитывается, с `moves[]` партия проигрывается через движок и результат сверяется с клиентом. WS-ходы тоже валидируются на сервере через `getLegalActions()` + `actionsEqual()`.
- **Единственный источник правил** — `server/game-engine.js` реэкспортируется в `src/engine/game.js`, Vite резолвит при сборке.
- **SW + cache-busting** — `CACHE_NAME` с build hash, при новом деплое старые кеши удаляются в `activate`. 4 раздельные стратегии: cache-first для hashed assets, network-first для navigate, cache-first для NN weights, stale-while-revalidate для картинок.
- **CSP без `unsafe-inline` для scripts** — vite plugin считает sha256 каждого inline `<script>` в `dist/index.html`, сервер читает хеши и подставляет в заголовок.
- **Lazy CSS** — `game.css` / `landing.css` / `confetti.css` / `board-animations.css` импортируются внутри соответствующих компонентов, Vite делает отдельные чанки. Landing загружает ~55KB CSS вместо 86KB.
- **Lazy data** — демо-реплеи (70KB) и данные админ-дашборда (30KB) в `public/`, fetch только по клику. Replay chunk ~5KB, Dashboard chunk ~14KB.
- **Three.js lazy chunk** — three (~600KB) вынесен в отдельный chunk через `manualChunks`, грузится только при открытии Victory City / SkinShop / 3D-секции лендинга. Main bundle не раздувается.
- **WS rate limits раздельно** — геймплейные сообщения (move/resign) 20/сек, chat/reaction 5/сек, globalChat 1/3s per-user. Спам эмодзи не может задропать ход.
- **Training data только авторизованные** — `POST /api/training` требует JWT + 10 партий/час на юзера. Защита от data poisoning.
- **Push fallback** — если оппонент в комнате имеет ws.readyState !== 1, при move/draw/rematch отправляется web-push с deep-link на комнату.

## Инфраструктура

- **VPS:** 178.212.12.71 (highriseheist.com)
- **PM2:** fork mode (SQLite = single writer)
- **SQLite:** WAL journal, `busy_timeout=5000`, versioned migrations
- **Nginx:** reverse proxy, Let's Encrypt, static `dist/`, API `/api/` → 3001, WS `/ws` → 3001
- **Бэкапы:** автоматически перед каждым деплоем, хранится 7 последних
- **Ежедневное обслуживание:** чистка `error_reports` (>30д), `analytics_events` (>90д), `wal_checkpoint(TRUNCATE)`
