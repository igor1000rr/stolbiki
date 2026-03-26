# Snatch Highrise (Стойки)

Стратегическая настольная игра для двух игроков. AI на основе AlphaZero (MCTS + Self-Play). Баланс **50:50**, подтверждён на **239K+ партиях**.

**Сайт:** https://snatch-highrise.com

## Возможности

- Игра vs AI (3 сложности), PvP, AI vs AI (спектатор)
- ELO рейтинг, 14 ачивок с прогрессом, лидерборд
- Друзья (поиск, запросы, принятие)
- Симулятор баланса (до 10K партий, 6 пресетов, live графики)
- Аналитика: GPU/CPU self-play, 30 графиков
- Правила с SVG-иллюстрациями и интерактивным примером
- PWA (Add to Home Screen)

## Стек

**Фронт:** React + Vite, Chart.js, Web Audio API, CSS glass morphism, 30 анимаций

**Бэк:** Node.js + Express + SQLite (better-sqlite3), JWT auth, 16 API endpoints

**AI:** MCTS + Self-Play. CPU: numpy MLP 8K params, 1500 итер. GPU: PyTorch ResNet 840K params, 1146 итер, WR 97%

**Инфра:** VPS (nginx + PM2), GitHub Actions CI/CD (push → deploy ~40с)

## Структура

```
src/
  components/     # React: Game, Profile, Simulator, Dashboard, Replay, Rules, Board
  engine/         # Движок: game.js, ai.js, hints.js, simulator.js, sounds.js, collector.js, api.js
  data/           # Данные: dashboard.json, replays.json
  app.css         # 1200 строк, glass morphism, 30 анимаций
server/
  server.js       # Express API (auth, games, leaderboard, friends, training)
  ecosystem.config.cjs
  setup-vps.sh    # Одна команда для настройки VPS
analysis/
  report.pdf      # PDF отчёт (2.2MB, 29 графиков)
  report_gen.py   # Генератор отчёта
gpu_train/
  gpu_trainer.py  # PyTorch GPU self-play
  gpu_checkpoint/ # Модели v50-v500
```

## Деплой

```bash
# Первоначальная настройка VPS
git clone https://github.com/igor1000rr/stolbiki.git /tmp/stolbiki
cd /tmp/stolbiki && bash server/setup-vps.sh

# Далее — автодеплой через GitHub Actions при push в main
```

GitHub Secrets: `VPS_HOST`, `VPS_SSH_KEY`

## Автор

igor1000rr — https://t.me/igor1000rr
