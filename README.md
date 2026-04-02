# Snatch Highrise (Перехват высотки)

Стратегическая настольная игра для двух игроков. AI на основе AlphaZero (MCTS + нейросеть 840K параметров). Баланс **50:50**, подтверждён на **239K+ партиях**.

**Сайт:** https://snatch-highrise.com  
**Версия:** 4.4.19  
**Тесты:** 91 (vitest)  
**API routes:** 88+

## Возможности

- **AI** — 4 сложности (Easy/Medium/Hard/Extreme), GPU нейросеть, MCTS 80–1500 симуляций
- **Online** — WebSocket мультиплеер, ranked matchmaking (ELO ±200), таймеры, реконнект
- **Турниры** — серии из 3/5 партий, live Arena
- **Puzzle Rush** — ежедневные/еженедельные пазлы, рейтинг
- **AI Game Review** — анализ партии после завершения
- **33 ачивки** — бронза/серебро/золото/бриллиант, 4 уровня прогресса
- **Ranked сезоны** — ежемесячные, top-20 лидерборд
- **24 настройки** — сложность, таймер, скины, Zen mode, приватность
- **15 метрик аналитики** — винрейт, тренд, активность по часам/дням
- **8 дебютов** — openings база, swap%, тепловая карта
- **11 тем + 17 скинов** — кастомизация блоков и стоек
- **Маскот Снуппи** — 6 поз, CSS-анимации
- **PWA** — Smart Service Worker, offline support
- **Мультиязычность** — RU/EN, path routing /en/
- **Аккаунт** — смена пароля, экспорт данных (GDPR), удаление аккаунта

## Стек

**Фронт:** React 19 + Vite 6 + Capacitor (Android)  
**Бэк:** Node.js 22 + Express + SQLite (better-sqlite3) + WebSocket (ws)  
**AI:** MCTS + PyTorch GPU ResNet 840K params (GPU weights 3.2MB binary)  
**CI/CD:** GitHub Actions → test → build → backup DB → deploy (PM2 + nginx)  
**Мониторинг:** Error reporting (server DB), API stats, health endpoint

## Архитектура

```
src/
  components/     # React: Game (1489), Profile, Online, Board, GameResultPanel...
  engine/         # Движок: game.js, ai.js, neuralnet.js, api.js, multiplayer.js
                  # Hooks: GameContext, useGameTimer, useGameLog, useSessionStats, useKeyboardShortcuts
  data/           # dashboard.json, replays.json
  app.css         # 3239 строк, glass morphism, 30+ анимаций
server/
  server.js       # Express: rooms, WS, health, stats, error-report
  db.js           # SQLite: schema, migrations (versioned), 10 индексов
  middleware.js   # JWT auth, rate limiting, admin check
  routes/         # auth, profile, games, social, missions, arena, puzzles, blog, admin
  ws.js           # WebSocket: rooms, matchmaking, spectate, timers
tests/
  game-engine.test.js  # 41 тест движка
  validate.test.js     # 31 тест валидации
  helpers.test.js      # 7 тестов хелперов
  stress.test.js       # 12 тестов (500 рандомных партий, edge cases)
```

## Деплой

```bash
# Локальная разработка
npm install
npm run dev          # http://localhost:5173
cd server && npm install && node server.js  # API: http://localhost:3001

# Тесты
npm test             # vitest run (91 тест)

# Продакшн — автодеплой через GitHub Actions при push в main
# Secrets: VPS_HOST, VPS_SSH_KEY
```

## Ключевые метрики v4.4

| Метрика | Значение |
|---|---|
| Тестов | 91 |
| API routes | 88+ |
| CustomEvent (legacy) | 0 (было 25) |
| window.* globals | 0 (было 5) |
| Polling intervals | 0 (было 4) |
| SQL indexes | 10 |
| GPU weights | 3.2 MB (было 8.1 MB) |
| JWT lifetime | 7d + auto-refresh |
| Schema migrations | versioned (3) |
| Cache-Control | 7 endpoints |

## Автор

igor1000rr — https://t.me/igor1000rr
