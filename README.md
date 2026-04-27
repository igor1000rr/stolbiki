# Highrise Heist (Перехват высотки)

Стратегическая настольная игра для двух игроков. AI на базе AlphaZero (MCTS + policy/value нейросеть).

**Сайт:** https://highriseheist.com  
**Версия:** см. `package.json` (единственный источник правды)  
**Автор:** [igor1000rr](https://t.me/igor1000rr)

## Возможности

AI 5 уровней (PUCT-MCTS + neural net), ranked онлайн с ELO и серверным античитом, турниры 3/5 партий, live Arena, spectator mode, Puzzle Rush, AI Game Review, 33 ачивки, сезонные лидерборды с наградами top-10, клубы (Owner/Officer/Member), глобальный чат с rate limit и admin mute, web-push (VAPID), 3D Victory City (Three.js + WebGL fallback на SVG 2.5D), магазин скинов (17+ скинов, 11 тем) и Battle Pass, PWA с offline-режимом, Capacitor APK с 7 нативными плагинами, RU/EN с path-routing `/en/`, GDPR экспорт и удаление аккаунта, Yandex.Metrika только после cookie consent.

## Стек

| Часть | Технологии |
|---|---|
| Фронт | React 19, Vite 8, Three.js 0.170, Capacitor 8 (Android+iOS), Chart.js, Sentry |
| Бэк | Node.js 22+, Express, SQLite (better-sqlite3, WAL), ws, web-push, helmet+CSP |
| AI обучение | PyTorch ResNet 107→256×6 + Value/Policy heads, self-play |
| AI runtime | float32 веса в браузере (~3.4MB), MCTS, ленивая загрузка для Hard+ |
| CI/CD | GitHub Actions → lint → vitest → build → Sentry sourcemaps → SCP → SQLite backup → pm2 restart |
| Безопасность | JWT (7d) + token_version revocation + 7d refresh grace, bcrypt 12 rounds, CSP с sha256 хешами inline-скриптов, rate limiting, anti-cheat через replay движка |

## Установка

Зависимости разделены: корневой `package.json` — только фронт (никакого native build). `server/package.json` — серверные deps (better-sqlite3 требует python + build tools).

```bash
npm install                # фронт
npm run dev                # http://localhost:5173
npm run build              # → dist/
npm test                   # фронт + те серверные тесты что скипаются без server deps
npm run test:full          # установит server deps и прогонит всё
npm run test:e2e           # playwright

cd server && npm install
node server.js             # http://localhost:3001

npm run cap:sync           # build + копирует dist/ в android/app/src/main/assets
npm run cap:android        # открывает Android Studio
```

## Деплой

Автодеплой при push в `main` (`.github/workflows/deploy.yml`):

1. Sync server lockfile (auto-regenerate если out-of-sync, commit обратно в репо)
2. `npm install` фронт + `npm ci` бэк
3. `npm run lint` + `npx vitest run`
4. `vite build` → Sentry release + sourcemap upload (если секреты заданы) → удаление .map из dist
5. Sync версии из root в `server/package.json`
6. **Cleanup на VPS**: удаляем `routes/`, `seeds/`, `blog-posts/` ДО upload — защита от dead-code при overwrite SCP. БД, backups, .env, .jwt-secret, .vapid, node_modules не трогаем.
7. SCP `dist/` → `/opt/stolbiki-web` (rm:true)
8. SCP `server/` → `/opt/stolbiki-api` (overwrite)
9. SQLite backup перед рестартом (хранится 7 шт)
10. `pm2 restart` + `nginx -t && systemctl reload nginx`

Secrets: `VPS_HOST`, `VPS_SSH_KEY`. Опционально для Sentry: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. На проде в `/opt/stolbiki-api/.env`: `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Структура

```
src/
  App.jsx                # роутинг, auth, модалки
  components/            # ~95 React-компонентов (Game, Online, VictoryCity, SkinShop, Profile, ...)
  engine/                # AI (ai.js, neuralnet.js), i18n, hooks, sentry, snappy, gpu_weights.bin
  css/                   # разделён по фичам, lazy-импорт в компонентах
server/
  server.js              # Express + WS bootstrap, helmet+CSP, rate limits, error handler
  game-engine.js         # ЕДИНСТВЕННЫЙ источник правил (реэкспорт в src/engine/game.js через Vite)
  ws.js                  # WebSocket: matchmaking, валидация ходов, таймеры, spectate, push
  db.js                  # SQLite schema (CREATE TABLE) + WAL + busy_timeout=5000
  migrations.js          # 15 миграций, fail-loud при ошибке (schema_version не обновляется)
  middleware.js          # JWT + token_version revocation, rate limit, LRU cleanup для memory leak
  anticheat.js           # verifyGameFromMoves через движок, walkMoves для replay/training
  routes/                # auth, profile, games, social, missions, arena, puzzles, admin, bricks, ...
public/
  sw.js                  # Service Worker, CACHE_NAME=__BUILD_HASH__ подставляется в build
android/, ios/           # Capacitor проекты
tests/                   # vitest: engine, anticheat, routes, ws-integration, stress, validate
e2e/                     # playwright
gpu_train/, analysis/    # PyTorch обучение AI
docs/                    # google-play-listing, marketing-texts, modes/
```

## Ключевые решения

- **Anti-cheat настоящий**: `POST /api/games` без `moves[]` не засчитывается; с `moves[]` партия проигрывается через `verifyGameFromMoves` — движок возвращает настоящий winner/score/turns, сравниваются с присланным. WS-ходы валидируются через `getLegalActions()` + `actionsEqual()` на каждом ходе.
- **Один источник правил**: `server/game-engine.js` реэкспортируется в `src/engine/game.js` (`export * from '../../server/game-engine.js'`). Vite резолвит путь при сборке, на VPS этот файл не меняется. Клиент и сервер физически не могут разойтись.
- **CSP без `'unsafe-inline'`**: vite-плагин (`cspHashes()`) считает sha256 каждого inline `<script>` в `dist/index.html` и пишет в `dist/csp-hashes.json` + `server/csp-hashes.json`. Сервер читает на старте и подставляет в `script-src`. Emergency fallback: `CSP_ALLOW_UNSAFE_INLINE=1`.
- **JWT + token_version revocation**: bump `users.token_version` отзывает все токены юзера. Middleware кеширует `tv` на 5 минут. Refresh принимает истёкшие токены не старше 7 дней (раньше было 30 — закрыли окно ротации при компрометации).
- **Migrations fail-loud**: `schema_version` НЕ обновляется при ошибке миграции — сервер падает на старте, проблема видна сразу. Раньше outer try/catch молча глотал ошибки, ALTER не применялись, миграция помечалась done.
- **Lazy chunks**: `three` (~600KB), `engine` (~3.5MB с весами), `charts`, `sentry` — отдельные чанки через `manualChunks`. CSS разбит по фичам — лендинг грузит ~55KB вместо 86KB.
- **WS rate limits раздельно**: gameplay (move/resign) 20/сек, chat/reaction 5/сек, globalChat 1/3s per-user. Спам эмодзи не может задропать ход.
- **Push fallback**: если оппонент в комнате имеет `ws.readyState !== 1`, при move/draw/rematch отправляется web-push с deep-link.
- **PM2 fork mode**: SQLite single writer.
- **DB maintenance**: каждые 24ч `DELETE FROM error_reports >30д`, `DELETE FROM analytics_events >90д`, `wal_checkpoint(TRUNCATE)`.

## Инфраструктура

VPS 178.212.12.71, nginx reverse proxy + Let's Encrypt, PM2 fork mode, SQLite WAL journal, Sentry для фронт-ошибок + sourcemaps, бэкапы перед каждым деплоем (7 последних).
