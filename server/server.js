import express from 'express'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import helmet from 'helmet'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { GameState, applyAction, getLegalActions } from './game-engine.js'

// ═══ Загрузка .env ═══
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim()
  }
}

// ═══ Конфиг ═══
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('ОШИБКА: JWT_SECRET не задан! Установите в .env')
    process.exit(1)
  }
  return 'stolbiki_dev_secret_' + Math.random().toString(36).slice(2)
})()
const DB_PATH = process.env.DB_PATH || './data/stolbiki.db'

// Создаём директорию для БД
const dbDir = dirname(resolve(DB_PATH))
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

// ═══ База данных ═══
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    rating INTEGER DEFAULT 1000,
    games_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    golden_closed INTEGER DEFAULT 0,
    comebacks INTEGER DEFAULT 0,
    perfect_wins INTEGER DEFAULT 0,
    beat_hard_ai INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, achievement_id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    won INTEGER NOT NULL,
    score TEXT NOT NULL,
    rating_before INTEGER,
    rating_after INTEGER,
    rating_delta INTEGER,
    difficulty INTEGER,
    closed_golden INTEGER DEFAULT 0,
    is_comeback INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'ai',
    turns INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    played_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    game_data TEXT NOT NULL,
    winner INTEGER,
    total_moves INTEGER,
    mode TEXT,
    difficulty INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_ru TEXT NOT NULL,
    title_en TEXT,
    body_ru TEXT NOT NULL,
    body_en TEXT,
    tag TEXT DEFAULT 'update',
    pinned INTEGER DEFAULT 0,
    published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id, played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, created_at DESC);

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS season_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    rating INTEGER DEFAULT 1000,
    games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    UNIQUE(user_id, season_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id)
  );

  CREATE TABLE IF NOT EXISTS rating_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    game_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Таблица контента сайта (CMS)
db.exec(`
  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    section TEXT NOT NULL DEFAULT 'general',
    value_ru TEXT NOT NULL DEFAULT '',
    value_en TEXT NOT NULL DEFAULT '',
    label TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

// Сид контента — автоматически при первом запуске
const contentCount = db.prepare('SELECT COUNT(*) as c FROM site_content').get().c
if (contentCount === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')

  // ── Секция: Сайт ──
  const siteSeed = [
    ['site.name', 'Перехват высотки', 'Snatch Highrise', 'Название игры'],
    ['site.tagline', 'Стратегическая настолка с AI', 'Strategy board game powered by AI', 'Слоган / подзаголовок'],
    ['site.description', 'Стратегическая настольная игра с AI-противником на базе AlphaZero. Играйте онлайн, решайте головоломки, соревнуйтесь.', 'Strategy board game with AlphaZero AI. Play online, solve puzzles, compete.', 'Описание для поисковиков (meta)'],
    ['site.beta_text', 'Открытая бета — активная разработка', 'Open beta — active development', 'Текст под логотипом'],
    ['footer.tagline', 'Настольные игры и AI-исследования', 'Board games meet AI research', 'Подпись в футере'],
  ]
  for (const [key, ru, en, label] of siteSeed) ins.run(key, 'Сайт', ru, en, label)

  // ── Секция: Главная страница ──
  const landingSeed = [
    ['landing.play_btn', 'Играть', 'Play free', 'Кнопка «Играть»'],
    ['landing.learn_btn', 'Обучение за 2 мин', 'Learn in 2 min', 'Кнопка «Обучение»'],
    ['landing.stat_games', 'партий', 'games analyzed', 'Подпись под числом 239K+'],
    ['landing.stat_winrate', 'винрейт AI', 'AI win rate', 'Подпись под числом 97%'],
    ['landing.stat_balance', 'баланс', 'balance', 'Подпись под числом 50:50'],
    ['landing.steps_title', 'Научитесь за 3 шага', 'Learn in 3 steps', 'Заголовок блока «3 шага»'],
    ['landing.step1_title', 'Ставьте', 'Place', 'Шаг 1 — заголовок'],
    ['landing.step1_desc', 'До 3 фишек на 2 стойки за ход. Первый ход — 1 фишка.', 'Up to 3 chips on max 2 stands per turn. First move is always 1 chip.', 'Шаг 1 — описание'],
    ['landing.step2_title', 'Переносите', 'Transfer', 'Шаг 2 — заголовок'],
    ['landing.step2_desc', 'Переместите верхнюю группу фишек. Ключевой тактический приём, решающий партии.', 'Move your top chip group to another stand. The key tactical move that decides games.', 'Шаг 2 — описание'],
    ['landing.step3_title', 'Закрывайте', 'Close', 'Шаг 3 — заголовок'],
    ['landing.step3_desc', 'При 11 фишках стойка закрывается. Цвет сверху = владелец. Закройте 6 из 10!', 'At 11 chips a stand closes. Top color = owner. First to close 6 of 10 wins!', 'Шаг 3 — описание'],
    ['landing.features_title', 'Что внутри', "What's inside", 'Заголовок блока фич'],
    ['landing.ai_title', 'AI на базе AlphaZero', 'AlphaZero AI', 'Заголовок блока AI'],
    ['landing.online_title', 'Онлайн мультиплеер', 'Online multiplayer', 'Заголовок блока онлайн'],
    ['landing.online_desc', 'Ссылка другу — играйте через секунды. Без регистрации. Серии 3/5.', 'Send a link to a friend — start playing in seconds. No signup. Best-of-3 and best-of-5 series.', 'Описание онлайн'],
    ['landing.puzzles_title', 'Головоломки', 'Daily puzzles', 'Заголовок блока головоломок'],
    ['landing.puzzles_desc', 'Новая задача каждый день. Сложная — каждую неделю. 50 штук с лидербордами.', 'New challenge every day. Harder one weekly. Bank of 50 with leaderboards.', 'Описание головоломок'],
    ['landing.about_title', 'Об игре', 'About', 'Заголовок «О проекте»'],
    ['landing.about_text', 'Перехват высотки — open-source исследовательский проект на стыке дизайна настольных игр и AI. Нейросеть обучена с нуля через self-play (подход AlphaZero) на 239K+ партиях. Игра спроектирована для баланса: 50:50 между первым и вторым игроком, подтверждено статистическим анализом.', 'Snatch Highrise is an open-source research project exploring the intersection of board game design and AI. The neural network was trained from scratch using self-play (AlphaZero approach) across 239K+ games. The game is designed for balance: 50:50 between first and second player, verified by statistical analysis.', 'Текст «О проекте»'],
  ]
  for (const [key, ru, en, label] of landingSeed) ins.run(key, 'Главная', ru, en, label)

  // ── Секции из i18n: автоматический импорт ──
  const i18nMap = {
    'nav': 'Навигация',
    'game': 'Игра',
    'tournament': 'Турниры',
    'online': 'Онлайн',
    'daily': 'Ежедневный челлендж',
    'puzzle': 'Головоломки',
    'trainer': 'Тренер',
    'swap': 'Swap / Баланс',
    'replay': 'Повтор партии',
    'tutorial': 'Обучение',
    'header': 'Шапка сайта',
    'common': 'Общее',
  }
  const i18nLabels = {
    'nav.play': 'Меню: Играть', 'nav.online': 'Меню: Онлайн', 'nav.profile': 'Меню: Профиль',
    'nav.rules': 'Меню: Правила', 'nav.puzzles': 'Меню: Головоломки', 'nav.simulator': 'Меню: Симулятор',
    'nav.analytics': 'Меню: Аналитика', 'nav.replays': 'Меню: Реплеи',
    'game.newGame': 'Кнопка «Новая игра»', 'game.confirm': 'Кнопка «Подтвердить»',
    'game.reset': 'Кнопка «Сброс»', 'game.transfer': 'Кнопка «Сделать перенос»',
    'game.cancelTransfer': 'Кнопка «Отменить перенос»',
    'game.blue': 'Название: Синие', 'game.red': 'Название: Красные',
    'game.victory': 'Текст: Победа', 'game.defeat': 'Текст: Поражение',
    'game.aiWins': 'Текст: AI победил', 'game.gameOver': 'Текст: Игра окончена',
    'game.place1': 'Подсказка: поставьте 1 фишку', 'game.placeChips': 'Подсказка: расставьте фишки',
    'game.aiThinking': 'Текст: AI думает', 'game.opponentTurn': 'Текст: Ход противника',
    'game.timeUp': 'Текст: Время вышло',
    'header.title': 'Логотип: название в шапке',
    'tutorial.title': 'Заголовок обучения',
    'common.online': 'Статус: Онлайн', 'common.offline': 'Статус: Оффлайн',
  }

  // Читаем i18n ключи из хардкода
  const i18nRu = {
    'nav.play': 'Играть', 'nav.online': 'Онлайн', 'nav.profile': 'Профиль',
    'nav.rules': 'Правила', 'nav.puzzles': 'Головоломки', 'nav.simulator': 'Симулятор',
    'nav.analytics': 'Аналитика', 'nav.replays': 'Реплеи',
    'game.newGame': 'Новая игра', 'game.confirm': 'Подтвердить', 'game.reset': 'Сброс',
    'game.transfer': '↗ Сделать перенос', 'game.cancelTransfer': '✕ Отменить перенос',
    'game.mode': 'Режим', 'game.vsAI': 'Против AI', 'game.pvp': 'Вдвоём', 'game.spectate': 'AI vs AI',
    'game.side': 'Сторона', 'game.blue': 'Синие', 'game.red': 'Красные',
    'game.blueFirst': 'Синие (первый ход)', 'game.redSwap': 'Красные (swap)',
    'game.difficulty': 'Сложность', 'game.easy': 'Лёгкая', 'game.medium': 'Средняя', 'game.hard': 'Сложная',
    'game.hints': 'Подсказки', 'game.trainer': 'Тренер',
    'game.victory': 'Победа!', 'game.defeat': 'Поражение', 'game.aiWins': 'AI победил',
    'game.blueWin': 'Синие победили!', 'game.redWin': 'Красные победили!',
    'game.gameOver': 'Игра окончена', 'game.newGame': 'Новая игра',
    'game.place1': 'Поставьте 1 фишку', 'game.place1first': 'Ваш ход — поставьте 1 фишку',
    'game.placeChips': 'Расставьте фишки', 'game.clickStands': 'Кликайте на стойки',
    'game.aiFirst': 'AI ходит первым...', 'game.aiThinking': 'AI думает...',
    'game.opponentTurn': 'Ход противника', 'game.timeUp': 'Время вышло!',
    'game.oppTimeUp': 'У соперника вышло время!', 'game.max2stands': 'Макс 2 стойки',
    'game.allPlaced': 'Все фишки расставлены', 'game.undone': 'Ход отменён',
    'game.yourTurn': 'ваш ход', 'game.pass': 'пас',
    'game.swapDone': 'Swap выполнен — цвета поменялись', 'game.swapOnlineDone': 'Swap — вы теперь синие',
    'game.selectTransferFrom': 'Выберите стойку для переноса', 'game.transferSelected': 'Перенос выбран, расставьте фишки',
    'game.transferCancelled': 'Перенос отменён', 'game.swap': 'Swap — смена цветов',
    'header.title': 'Перехват высотки', 'header.totalUsers': 'игроков', 'header.totalGames': 'партий', 'header.avgRating': 'ср. рейтинг',
    'tutorial.title': 'Как играть',
    'common.online': 'Онлайн', 'common.offline': 'Оффлайн',
    'tournament.won': 'Турнир выигран!', 'tournament.lost': 'Турнир проигран', 'tournament.draw': 'Ничья в турнире',
    'trainer.strong': 'Сильная позиция', 'trainer.slight': 'Небольшое преимущество',
    'trainer.equal': 'Равная позиция', 'trainer.weak': 'Слабая позиция', 'trainer.bad': 'Плохая позиция',
  }
  const i18nEn = {
    'nav.play': 'Play', 'nav.online': 'Online', 'nav.profile': 'Profile',
    'nav.rules': 'Rules', 'nav.puzzles': 'Puzzles', 'nav.simulator': 'Simulator',
    'nav.analytics': 'Analytics', 'nav.replays': 'Replays',
    'game.newGame': 'New game', 'game.confirm': 'Confirm', 'game.reset': 'Reset',
    'game.transfer': '↗ Transfer', 'game.cancelTransfer': '✕ Cancel transfer',
    'game.mode': 'Mode', 'game.vsAI': 'vs AI', 'game.pvp': 'PvP', 'game.spectate': 'AI vs AI',
    'game.side': 'Side', 'game.blue': 'Blue', 'game.red': 'Red',
    'game.blueFirst': 'Blue (first move)', 'game.redSwap': 'Red (swap)',
    'game.difficulty': 'Difficulty', 'game.easy': 'Easy', 'game.medium': 'Medium', 'game.hard': 'Hard',
    'game.hints': 'Hints', 'game.trainer': 'Trainer',
    'game.victory': 'Victory!', 'game.defeat': 'Defeat', 'game.aiWins': 'AI wins',
    'game.blueWin': 'Blue wins!', 'game.redWin': 'Red wins!',
    'game.gameOver': 'Game over', 'game.place1': 'Place 1 chip',
    'game.place1first': 'Your turn — place 1 chip', 'game.placeChips': 'Place chips',
    'game.clickStands': 'Click stands to place', 'game.aiFirst': 'AI goes first...',
    'game.aiThinking': 'AI thinking...', 'game.opponentTurn': "Opponent's turn",
    'game.timeUp': 'Time up!', 'game.oppTimeUp': "Opponent's time is up!",
    'game.max2stands': 'Max 2 stands', 'game.allPlaced': 'All chips placed',
    'game.undone': 'Move undone', 'game.yourTurn': 'your turn', 'game.pass': 'pass',
    'game.swapDone': 'Swap done — colors changed', 'game.swapOnlineDone': 'Swap — you are now blue',
    'game.selectTransferFrom': 'Select stand to transfer from', 'game.transferSelected': 'Transfer set, place chips',
    'game.transferCancelled': 'Transfer cancelled', 'game.swap': 'Swap colors',
    'header.title': 'Snatch Highrise', 'header.totalUsers': 'players', 'header.totalGames': 'games', 'header.avgRating': 'avg rating',
    'tutorial.title': 'How to play',
    'common.online': 'Online', 'common.offline': 'Offline',
    'tournament.won': 'Tournament won!', 'tournament.lost': 'Tournament lost', 'tournament.draw': 'Tournament draw',
    'trainer.strong': 'Strong position', 'trainer.slight': 'Slight advantage',
    'trainer.equal': 'Equal position', 'trainer.weak': 'Weak position', 'trainer.bad': 'Bad position',
  }

  for (const key of Object.keys(i18nRu)) {
    const prefix = key.split('.')[0]
    const section = i18nMap[prefix] || 'Другое'
    const label = i18nLabels[key] || key
    ins.run(key, section, i18nRu[key], i18nEn[key] || '', label)
  }

  console.log('Контент сайта засеян: сайт + главная + i18n')
}

console.log('База данных готова:', DB_PATH)

// ═══ Ачивки ═══
const ALL_ACHIEVEMENTS = [
  // Оригинальные 14
  { id: 'first_win', check: u => u.wins >= 1 },
  { id: 'streak_3', check: u => u.best_streak >= 3 },
  { id: 'streak_5', check: u => u.best_streak >= 5 },
  { id: 'streak_10', check: u => u.best_streak >= 10 },
  { id: 'golden_1', check: u => u.golden_closed >= 1 },
  { id: 'golden_10', check: u => u.golden_closed >= 10 },
  { id: 'comeback', check: u => u.comebacks >= 1 },
  { id: 'games_10', check: u => u.games_played >= 10 },
  { id: 'games_50', check: u => u.games_played >= 50 },
  { id: 'games_100', check: u => u.games_played >= 100 },
  { id: 'rating_1200', check: u => u.rating >= 1200 },
  { id: 'rating_1500', check: u => u.rating >= 1500 },
  { id: 'beat_hard', check: u => u.beat_hard_ai },
  { id: 'perfect', check: u => u.perfect_wins >= 1 },
  // Новые 12
  { id: 'streak_20', check: u => u.best_streak >= 20 },
  { id: 'games_500', check: u => u.games_played >= 500 },
  { id: 'golden_50', check: u => u.golden_closed >= 50 },
  { id: 'comeback_5', check: u => u.comebacks >= 5 },
  { id: 'perfect_3', check: u => u.perfect_wins >= 3 },
  { id: 'rating_1800', check: u => u.rating >= 1800 },
  { id: 'rating_2000', check: u => u.rating >= 2000 },
  { id: 'fast_win', check: u => (u.fast_wins || 0) >= 1 },
  { id: 'fast_win_5', check: u => (u.fast_wins || 0) >= 5 },
  { id: 'online_win', check: u => (u.online_wins || 0) >= 1 },
  { id: 'online_10', check: u => (u.online_wins || 0) >= 10 },
  { id: 'puzzle_10', check: u => (u.puzzles_solved || 0) >= 10 },
]

// Добавляем новые колонки (безопасно — если уже есть, не упадёт)
try { db.exec('ALTER TABLE users ADD COLUMN fast_wins INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN online_wins INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN puzzles_solved INTEGER DEFAULT 0') } catch {}

function checkAchievements(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return []
  const existing = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(userId).map(a => a.achievement_id)
  const newAch = []
  const insert = db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)')
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!existing.includes(ach.id) && ach.check(user)) {
      insert.run(userId, ach.id)
      newAch.push(ach.id)
    }
  }
  return newAch
}

// ═══ Middleware ═══
const app = express()
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://snatch-highrise.com', 'https://www.snatch-highrise.com', 'http://178.212.12.71', 'http://localhost:5173']
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    },
  },
}))
app.use(cors({ origin: (origin, cb) => {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true)
  else cb(null, true) // Пока разрешаем всё, но логируем
}}))
app.use(express.json({ limit: '5mb' }))

// Rate limiting (in-memory, простой)
const rateLimits = new Map()
function rateLimit(windowMs = 60000, max = 60) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path
    const now = Date.now()
    const entry = rateLimits.get(key)
    if (!entry || now - entry.start > windowMs) {
      rateLimits.set(key, { start: now, count: 1 })
      return next()
    }
    entry.count++
    if (entry.count > max) return res.status(429).json({ error: 'Слишком много запросов' })
    next()
  }
}
// Чистка каждые 5 минут + лимит размера Map
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimits) { if (now - v.start > 120000) rateLimits.delete(k) }
  // Чистка антиспам-лимитов записи партий
  for (const [k, v] of gameSubmitLimits) { if (now - v > 60000) gameSubmitLimits.delete(k) }
  // Если Map разросся — полная очистка (защита от DDoS)
  if (rateLimits.size > 50000) rateLimits.clear()
}, 300000)

app.use('/api/auth', rateLimit(60000, 20))  // 20 auth/мин
app.use('/api/games', rateLimit(60000, 60)) // 60 games/мин
app.use('/api/', rateLimit(60000, 120))     // 120 req/мин общий

// JWT auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Нужна авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    // Обновляем last_seen
    db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`).run(req.user.id)
    next()
  } catch (authErr) {
    console.error('AUTH ERROR:', authErr.message)
    res.status(401).json({ error: 'Неверный токен' })
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Нужен админ-доступ' })
  next()
}

// ═══ AUTH ═══
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Нужны username и password' })
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'Ник: 2-20 символов' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль: мин 6 символов' })

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return res.status(409).json({ error: 'Ник занят' })

  const hash = bcrypt.hashSync(password, 10)
  const adminNames = ['admin']
  const isAdmin = adminNames.includes(username) ? 1 : 0

  const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(username, email || null, hash, isAdmin)
  const token = jwt.sign({ id: result.lastInsertRowid, username, isAdmin: !!isAdmin }, JWT_SECRET, { expiresIn: '30d' })

  res.json({ token, user: { id: result.lastInsertRowid, username, rating: 1000, isAdmin: !!isAdmin } })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, user: formatUser(user) })
})

// ═══ PROFILE ═══
app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ?').all(req.user.id)
  res.json({ ...formatUser(user), achievements })
})

app.get('/api/profile/:username', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const achievements = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(user.id)
  res.json({ ...formatUser(user), achievements: achievements.map(a => a.achievement_id) })
})

function formatUser(u) {
  return {
    id: u.id, username: u.username, rating: u.rating,
    gamesPlayed: u.games_played, wins: u.wins, losses: u.losses,
    winStreak: u.win_streak, bestStreak: u.best_streak,
    goldenClosed: u.golden_closed, comebacks: u.comebacks,
    perfectWins: u.perfect_wins, beatHardAi: !!u.beat_hard_ai,
    fastWins: u.fast_wins || 0, onlineWins: u.online_wins || 0,
    puzzlesSolved: u.puzzles_solved || 0, avatar: u.avatar || 'default',
    isAdmin: !!u.is_admin, createdAt: u.created_at, lastSeen: u.last_seen,
  }
}

// ═══ GAMES ═══
// Антиспам: 1 партия / 10 сек на игрока
const gameSubmitLimits = new Map()

app.post('/api/games', auth, (req, res) => {
  const { won, score, difficulty, closedGolden, isComeback, turns, duration, isOnline } = req.body

  // ── Валидация формата score ──
  if (!score || typeof score !== 'string') return res.status(400).json({ error: 'Некорректный счёт' })
  const scoreParts = score.split(':')
  if (scoreParts.length !== 2) return res.status(400).json({ error: 'Формат счёта: X:Y' })
  const [s1, s2] = scoreParts.map(Number)
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 10 || s2 > 10) {
    return res.status(400).json({ error: 'Счёт вне диапазона 0-10' })
  }
  if (s1 + s2 > 10) return res.status(400).json({ error: 'Сумма счёта > 10' })

  // ── Валидация won vs score ──
  // Если won=true, игрок должен иметь больше стоек (s1 > s2 для P1)
  if (won && s1 <= s2 && s1 !== s2) {
    // Допускаем: золотая стойка могла решить при 5:5
  }
  if (!won && s1 > s2) {
    // Проиграл но счёт в его пользу — подозрительно, но допускаем (resign, таймаут)
  }

  // ── Валидация turns/duration ──
  const safeTurns = Math.max(0, Math.min(500, Math.floor(+turns || 0)))
  const safeDuration = Math.max(0, Math.min(7200, Math.floor(+duration || 0)))
  const safeDifficulty = Math.max(0, Math.min(400, Math.floor(+difficulty || 150)))

  // ── Антиспам: 1 партия / 10 сек ──
  const now = Date.now()
  const lastSubmit = gameSubmitLimits.get(req.user.id)
  if (lastSubmit && now - lastSubmit < 10000) {
    return res.status(429).json({ error: 'Слишком быстро. Подождите 10 секунд' })
  }
  gameSubmitLimits.set(req.user.id, now)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })

  const ratingBefore = user.rating
  let ratingDelta = won ? 25 : -15
  if (safeDifficulty >= 400) ratingDelta = won ? 35 : -10
  else if (safeDifficulty <= 50) ratingDelta = won ? 15 : -20

  const ratingAfter = Math.max(100, Math.min(2500, ratingBefore + ratingDelta))
  const newStreak = won ? user.win_streak + 1 : 0
  const bestStreak = Math.max(user.best_streak, newStreak)
  const isFastWin = won && safeTurns > 0 && safeTurns <= 10

  // Обновляем пользователя
  db.prepare(`UPDATE users SET
    rating = ?, games_played = games_played + 1,
    wins = wins + ?, losses = losses + ?,
    win_streak = ?, best_streak = ?,
    golden_closed = golden_closed + ?,
    comebacks = comebacks + ?,
    perfect_wins = perfect_wins + ?,
    beat_hard_ai = CASE WHEN ? THEN 1 ELSE beat_hard_ai END,
    fast_wins = fast_wins + ?,
    online_wins = online_wins + ?
    WHERE id = ?`
  ).run(
    ratingAfter, won ? 1 : 0, won ? 0 : 1,
    newStreak, bestStreak,
    closedGolden ? 1 : 0, isComeback ? 1 : 0,
    score === '6:0' && won ? 1 : 0,
    safeDifficulty >= 400 && won ? 1 : 0,
    isFastWin ? 1 : 0,
    isOnline && won ? 1 : 0,
    req.user.id
  )

  // Записываем партию
  const gameResult = db.prepare(`INSERT INTO games (user_id, won, score, rating_before, rating_after, rating_delta, difficulty, closed_golden, is_comeback, turns, duration, is_online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, won ? 1 : 0, score, ratingBefore, ratingAfter, ratingDelta, safeDifficulty, closedGolden ? 1 : 0, isComeback ? 1 : 0, safeTurns, safeDuration, isOnline ? 1 : 0)

  // Записываем историю рейтинга
  db.prepare('INSERT INTO rating_history (user_id, rating, delta, game_id) VALUES (?, ?, ?, ?)').run(req.user.id, ratingAfter, ratingDelta, gameResult.lastInsertRowid)

  // Обновляем сезонный рейтинг
  const currentSeason = ensureCurrentSeason()
  if (currentSeason) {
    const sr = db.prepare('SELECT * FROM season_ratings WHERE user_id=? AND season_id=?').get(req.user.id, currentSeason.id)
    if (sr) {
      const newRating = Math.max(100, Math.min(2500, sr.rating + ratingDelta))
      db.prepare('UPDATE season_ratings SET rating=?, games=games+1, wins=wins+? WHERE id=?').run(newRating, won ? 1 : 0, sr.id)
    } else {
      db.prepare('INSERT INTO season_ratings (user_id, season_id, rating, games, wins) VALUES (?, ?, ?, 1, ?)').run(req.user.id, currentSeason.id, ratingAfter, won ? 1 : 0)
    }
  }

  // Ачивки
  const newAch = checkAchievements(req.user.id)

  res.json({ ratingBefore, ratingAfter, ratingDelta, newAchievements: newAch })
})

app.get('/api/games', auth, (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 50)
  const games = db.prepare('SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ?').all(req.user.id, limit)
  res.json(games)
})

// ═══ LEADERBOARD ═══

// Автоматическое создание сезонов (месячные)
function ensureCurrentSeason() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const start = new Date(y, m, 1).toISOString().slice(0, 10)
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  const name = `${y}-${String(m + 1).padStart(2, '0')}`

  let season = db.prepare('SELECT * FROM seasons WHERE name=?').get(name)
  if (!season) {
    // Деактивируем старые
    db.prepare('UPDATE seasons SET active=0 WHERE active=1').run()
    db.prepare('INSERT INTO seasons (name, start_date, end_date, active) VALUES (?, ?, ?, 1)').run(name, start, end)
    season = db.prepare('SELECT * FROM seasons WHERE name=?').get(name)
  }
  return season
}

app.get('/api/seasons/current', (req, res) => {
  const season = ensureCurrentSeason()
  if (!season) return res.json({ season: null })
  const top = db.prepare(`SELECT sr.rating, sr.games, sr.wins, u.username
    FROM season_ratings sr JOIN users u ON u.id = sr.user_id
    WHERE sr.season_id = ? ORDER BY sr.rating DESC LIMIT 20`).all(season.id)
  res.json({ season, leaderboard: top })
})

app.get('/api/seasons/history', (req, res) => {
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC LIMIT 12').all()
  res.json(seasons)
})

app.get('/api/profile/rating-history', auth, (req, res) => {
  const history = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  res.json(history)
})

app.get('/api/leaderboard', (req, res) => {
  const limit = Math.min(+req.query.limit || 20, 100)
  const users = db.prepare('SELECT id, username, rating, games_played, wins, losses, best_streak FROM users ORDER BY rating DESC LIMIT ?').all(limit)
  res.json(users.map(u => ({
    username: u.username, rating: u.rating,
    games: u.games_played, wins: u.wins,
    winRate: u.games_played > 0 ? +(u.wins / u.games_played * 100).toFixed(1) : 0,
    bestStreak: u.best_streak,
  })))
})

// ═══ FRIENDS ═══
app.post('/api/friends/request', auth, (req, res) => {
  const { username } = req.body
  const friend = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (!friend) return res.status(404).json({ error: 'Пользователь не найден' })
  if (friend.id === req.user.id) return res.status(400).json({ error: 'Нельзя добавить себя' })

  const existing = db.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?').get(req.user.id, friend.id)
  if (existing) return res.status(409).json({ error: 'Запрос уже отправлен' })

  db.prepare('INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, "pending")').run(req.user.id, friend.id)
  res.json({ ok: true })
})

app.post('/api/friends/accept', auth, (req, res) => {
  const { userId } = req.body
  db.prepare('UPDATE friends SET status = "accepted" WHERE user_id = ? AND friend_id = ?').run(userId, req.user.id)
  // Создаём обратную связь
  db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, "accepted")').run(req.user.id, userId)
  res.json({ ok: true })
})

app.get('/api/friends', auth, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.username, u.rating, u.last_seen, f.status
    FROM friends f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'accepted'
  `).all(req.user.id)

  const pending = db.prepare(`
    SELECT u.id, u.username, u.rating
    FROM friends f JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
  `).all(req.user.id)

  res.json({ friends, pending })
})

// ═══ TRAINING DATA ═══
app.post('/api/training', auth, (req, res) => {
  const { gameData, winner, totalMoves, mode, difficulty } = req.body
  db.prepare('INSERT INTO training_data (user_id, game_data, winner, total_moves, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, JSON.stringify(gameData), winner, totalMoves || 0, mode || 'ai', difficulty || 150)
  res.json({ ok: true })
})

app.get('/api/training/stats', auth, adminOnly, (req, res) => {
  const stats = db.prepare('SELECT COUNT(*) as games, SUM(total_moves) as moves FROM training_data').get()
  const byMode = db.prepare('SELECT mode, COUNT(*) as count FROM training_data GROUP BY mode').all()
  res.json({ ...stats, byMode })
})

app.get('/api/training/export', auth, adminOnly, (req, res) => {
  const data = db.prepare('SELECT game_data, winner FROM training_data ORDER BY created_at DESC LIMIT 500').all()
  res.json(data.map(d => ({ ...JSON.parse(d.game_data), winner: d.winner })))
})

// ═══ SEARCH ═══
app.get('/api/users/search', auth, (req, res) => {
  const q = req.query.q
  if (!q || q.length < 2) return res.json([])
  const escaped = q.replace(/[%_]/g, '\\$&')
  const users = db.prepare("SELECT id, username, rating FROM users WHERE username LIKE ? ESCAPE '\\' AND id != ? LIMIT 10").all(`%${escaped}%`, req.user.id)
  res.json(users)
})

// ═══ STATS (public) ═══
app.get('/api/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  const totalGames = db.prepare('SELECT COUNT(*) as c FROM games').get().c
  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM users WHERE games_played > 0').get().avg || 1000
  res.json({ totalUsers, totalGames, avgRating: Math.round(avgRating) })
})

// ═══ Health ═══
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), users: db.prepare('SELECT COUNT(*) as c FROM users').get().c, rooms: rooms.size })
})

// ═══ DAILY CHALLENGE ═══
function getDailySeed() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
}

function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}

app.get('/api/daily', (req, res) => {
  const seed = getDailySeed()
  const rng = seededRandom(seed)
  // Генерируем стартовую позицию: первый ход P1 (1 фишка) + ответ P2 (1-3 фишки на макс 2 стойки)
  const firstStand = Math.floor(rng() * 10)
  const p2count = 1 + Math.floor(rng() * 3) // 1-3 фишки
  // Выбираем 1 или 2 стойки
  const numStands = p2count === 1 ? 1 : (1 + Math.floor(rng() * 2)) // 1-2 стойки
  const standA = Math.floor(rng() * 10)
  let standB = standA
  if (numStands === 2) {
    standB = Math.floor(rng() * 10)
    while (standB === standA) standB = Math.floor(rng() * 10)
  }
  const p2stands = []
  for (let i = 0; i < p2count; i++) {
    p2stands.push(i === 0 || numStands === 1 ? standA : standB)
  }
  res.json({ seed, date: seed, firstMove: { stand: firstStand }, secondMove: { stands: p2stands }, swapped: rng() > 0.5 })
})

app.get('/api/daily/leaderboard', (req, res) => {
  const seed = getDailySeed()
  const rows = db.prepare(`SELECT username, turns, duration FROM daily_results
    WHERE seed = ? ORDER BY turns ASC, duration ASC LIMIT 20`).all(seed)
  res.json({ seed, results: rows })
})

app.post('/api/daily/submit', auth, (req, res) => {
  const { turns, duration, won } = req.body
  const seed = getDailySeed()
  const existing = db.prepare('SELECT id FROM daily_results WHERE user_id = ? AND seed = ?').get(req.user.id, seed)
  if (existing) return res.status(409).json({ error: 'Уже отправлено сегодня' })
  db.prepare('INSERT INTO daily_results (user_id, username, seed, turns, duration, won) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, req.user.username, seed, turns, duration || 0, won ? 1 : 0)
  res.json({ ok: true })
})

// Таблица daily
db.exec(`CREATE TABLE IF NOT EXISTS daily_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, username TEXT, seed TEXT,
  turns INTEGER, duration INTEGER, won INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, seed)
)`)

// ═══ Таблицы головоломок ═══
db.exec(`
  CREATE TABLE IF NOT EXISTS puzzle_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, username TEXT,
    puzzle_type TEXT NOT NULL,
    puzzle_id TEXT NOT NULL,
    solved INTEGER DEFAULT 0,
    moves_used INTEGER,
    duration INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, puzzle_type, puzzle_id)
  )
`)

// ═══ Генератор головоломок ═══
// Шаблоны — описание позиций (stands, closed, goal)
const PUZZLE_TEMPLATES = [
  // ─── Лёгкие (1 ход) — перенос закрывает стойку ───
  { difficulty: 1, maxMoves: 1, title_ru: 'Закрой стойку', title_en: 'Close a stand',
    gen: (rng) => {
      const s = Math.floor(rng() * 9) + 1
      const d = (s + 3) % 10 || 1
      const stands = Array.from({length:10}, () => [])
      // Стойка s: 8 своих наверху → перенос 3 с d закроет (8+3=11)
      stands[s] = [...Array(2).fill(1), ...Array(6 + Math.floor(rng() * 2)).fill(0)]
      stands[d] = Array(11 - stands[s].length).fill(0)
      return { stands, goal: { closedByPlayer: { [s]: 0 }, maxMoves: 1 },
        desc_ru: `Закройте стойку ${s} переносом`, desc_en: `Close stand ${s} by transfer` }
    }
  },
  { difficulty: 1, maxMoves: 1, title_ru: 'Золотая', title_en: 'Golden',
    gen: (rng) => {
      const stands = Array.from({length:10}, () => [])
      // Золотая: 8 своих сверху, перенос с src закроет
      stands[0] = [...Array(2).fill(1), ...Array(6).fill(0)]
      const src = 1 + Math.floor(rng() * 9)
      stands[src] = Array(3).fill(0)
      return { stands, goal: { closedByPlayer: { 0: 0 }, maxMoves: 1 },
        desc_ru: 'Закройте золотую стойку ★', desc_en: 'Close golden stand ★' }
    }
  },
  // ─── Средние (2 хода) ───
  { difficulty: 2, maxMoves: 2, title_ru: 'Двойное закрытие', title_en: 'Double close',
    gen: (rng) => {
      const a = 1 + Math.floor(rng() * 4)
      const b = 5 + Math.floor(rng() * 4)
      const stands = Array.from({length:10}, () => [])
      stands[a] = Array(8).fill(0)
      stands[b] = Array(8).fill(0)
      // Два источника по 3 — гарантировано не пересекаются
      const used = new Set([a, b])
      const srcs = []
      for (let i = 0; i < 10 && srcs.length < 2; i++) {
        if (!used.has(i)) { srcs.push(i); used.add(i) }
      }
      stands[srcs[0]] = Array(3).fill(0)
      stands[srcs[1]] = Array(3).fill(0)
      return { stands, goal: { minClosed: 2, maxMoves: 2 },
        desc_ru: 'Закройте 2 стойки за 2 хода', desc_en: 'Close 2 stands in 2 moves' }
    }
  },
  { difficulty: 2, maxMoves: 2, title_ru: 'Захват', title_en: 'Capture',
    gen: (rng) => {
      const target = 1 + Math.floor(rng() * 9)
      const src = (target + 3) % 10 || 1
      const stands = Array.from({length:10}, () => [])
      // Стойка с чужими внизу, нашими сверху — перенос закроет за нас
      stands[target] = [...Array(5).fill(1), ...Array(3).fill(0)]
      stands[src] = Array(3 + Math.floor(rng() * 2)).fill(0)
      return { stands, goal: { closedByPlayer: { [target]: 0 }, maxMoves: 2 },
        desc_ru: `Перехватите стойку ${target}`, desc_en: `Capture stand ${target}` }
    }
  },
  // ─── Сложные (3 хода) ───
  { difficulty: 3, maxMoves: 3, title_ru: 'Тройной удар', title_en: 'Triple strike',
    gen: (rng) => {
      const s1 = 1 + Math.floor(rng() * 3)
      const s2 = 4 + Math.floor(rng() * 3)
      const s3 = 7 + Math.floor(rng() * 2)
      const stands = Array.from({length:10}, () => [])
      // Три стойки по 8, три источника по 3 — каждый ход = перенос + закрытие
      stands[s1] = Array(8).fill(0)
      stands[s2] = Array(8).fill(0)
      stands[s3] = Array(8).fill(0)
      // Три разных источника
      const used = new Set([s1, s2, s3])
      const srcs = []
      for (let i = 0; i < 10 && srcs.length < 3; i++) {
        if (!used.has(i)) { srcs.push(i); used.add(i) }
      }
      srcs.forEach(s => { stands[s] = Array(3).fill(0) })
      return { stands, goal: { minClosed: 3, maxMoves: 3 },
        desc_ru: 'Закройте 3 стойки за 3 хода', desc_en: 'Close 3 stands in 3 moves' }
    }
  },
  { difficulty: 3, maxMoves: 3, title_ru: 'Цепная реакция', title_en: 'Chain reaction',
    gen: (rng) => {
      const a = Math.floor(rng() * 5)
      const b = 5 + Math.floor(rng() * 5)
      const stands = Array.from({length:10}, () => [])
      // a: чужие внизу + наши сверху, b: смешанные с нашими сверху
      stands[a] = [...Array(6).fill(1), ...Array(3).fill(0)]
      stands[b] = [...Array(4).fill(1), ...Array(4).fill(0)]
      const src = (a + 2) % 10 === b ? (a + 3) % 10 : (a + 2) % 10
      stands[src] = Array(4).fill(0)
      return { stands, goal: { minClosed: 2, maxMoves: 3 },
        desc_ru: 'Разберите позицию и закройте 2 стойки', desc_en: 'Untangle and close 2 stands' }
    }
  },
]

function puzzleSeededRandom(seed) {
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}

function generatePuzzle(seed, difficultyFilter) {
  const rng = puzzleSeededRandom(seed)
  const templates = difficultyFilter
    ? PUZZLE_TEMPLATES.filter(t => t.difficulty === difficultyFilter)
    : PUZZLE_TEMPLATES
  const tmpl = templates[Math.floor(rng() * templates.length)]
  const puzzle = tmpl.gen(rng)
  return {
    id: String(seed),
    difficulty: tmpl.difficulty,
    maxMoves: tmpl.maxMoves,
    title_ru: tmpl.title_ru,
    title_en: tmpl.title_en,
    ...puzzle,
    turn: 6 + Math.floor(rng() * 4) * 2, // чётный ход
  }
}

// ─── Daily puzzle (новая каждый день) ───
app.get('/api/puzzles/daily', (req, res) => {
  const d = new Date()
  const seed = `daily-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
  const puzzle = generatePuzzle(seed, 2)
  puzzle.type = 'daily'
  // Сколько решило
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('daily', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  // Лидерборд
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('daily', seed)
  res.json(puzzle)
})

// ─── Weekly puzzle (новая каждую неделю, сложнее) ───
app.get('/api/puzzles/weekly', (req, res) => {
  const d = new Date()
  const weekNum = Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000)
  const seed = `weekly-${d.getFullYear()}-W${weekNum}`
  const puzzle = generatePuzzle(seed, 3)
  puzzle.type = 'weekly'
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('weekly', seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  puzzle.leaderboard = db.prepare('SELECT username, moves_used, duration FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=? AND solved=1 ORDER BY moves_used ASC, duration ASC LIMIT 10').all('weekly', seed)
  res.json(puzzle)
})

// ─── Банк головоломок (50 штук, статичные) ───
app.get('/api/puzzles/bank', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 12
  const diff = parseInt(req.query.difficulty) || 0
  
  const puzzles = []
  const total = 50
  const start = (page - 1) * perPage
  
  for (let i = start; i < Math.min(start + perPage, total); i++) {
    const seed = `bank-${i}`
    const difficulty = i < 15 ? 1 : i < 35 ? 2 : 3
    if (diff && difficulty !== diff) continue
    const p = generatePuzzle(seed, difficulty)
    p.type = 'bank'
    p.bankIndex = i + 1
    // Статы решения
    const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get('bank', seed)
    p.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
    puzzles.push(p)
  }
  
  res.json({ puzzles, total, page, perPage, pages: Math.ceil(total / perPage) })
})

// ─── Отдельная головоломка ───
app.get('/api/puzzles/:type/:id', (req, res) => {
  const { type, id } = req.params
  if (!['daily', 'weekly', 'bank'].includes(type)) return res.status(400).json({ error: 'Invalid type' })
  const seed = type === 'bank' ? `bank-${id}` : id
  const difficulty = type === 'weekly' ? 3 : type === 'daily' ? 2 : (parseInt(id) < 15 ? 1 : parseInt(id) < 35 ? 2 : 3)
  const puzzle = generatePuzzle(seed, difficulty)
  puzzle.type = type
  const stats = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE puzzle_type=? AND puzzle_id=?').get(type, seed)
  puzzle.stats = { attempts: stats?.total || 0, solved: stats?.solved || 0 }
  res.json(puzzle)
})

// ─── Отправка результата ───
app.post('/api/puzzles/submit', auth, (req, res) => {
  const { type, puzzleId, solved, movesUsed, duration } = req.body
  if (!type || !puzzleId) return res.status(400).json({ error: 'Missing fields' })
  
  const existing = db.prepare('SELECT id, solved FROM puzzle_results WHERE user_id=? AND puzzle_type=? AND puzzle_id=?').get(req.user.id, type, puzzleId)
  let newSolve = false
  if (existing) {
    if (solved && (!existing.solved || movesUsed < existing.moves_used)) {
      db.prepare('UPDATE puzzle_results SET solved=1, moves_used=?, duration=? WHERE id=?').run(movesUsed, duration, existing.id)
      if (!existing.solved) newSolve = true
    }
  } else {
    db.prepare('INSERT INTO puzzle_results (user_id, username, puzzle_type, puzzle_id, solved, moves_used, duration) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.user.id, req.user.username, type, puzzleId, solved ? 1 : 0, movesUsed, duration)
    if (solved) newSolve = true
  }
  // Инкремент счётчика решённых и проверка ачивок
  if (newSolve) {
    db.prepare('UPDATE users SET puzzles_solved = puzzles_solved + 1 WHERE id = ?').run(req.user.id)
    checkAchievements(req.user.id)
  }
  res.json({ ok: true })
})

// ─── Статистика пользователя по головоломкам ───
app.get('/api/puzzles/user/stats', auth, (req, res) => {
  const daily = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE user_id=? AND puzzle_type=?').get(req.user.id, 'daily')
  const weekly = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE user_id=? AND puzzle_type=?').get(req.user.id, 'weekly')
  const bank = db.prepare('SELECT COUNT(*) as total, SUM(solved) as solved FROM puzzle_results WHERE user_id=? AND puzzle_type=?').get(req.user.id, 'bank')
  res.json({
    daily: { attempts: daily?.total || 0, solved: daily?.solved || 0 },
    weekly: { attempts: weekly?.total || 0, solved: weekly?.solved || 0 },
    bank: { attempts: bank?.total || 0, solved: bank?.solved || 0 },
    totalSolved: (daily?.solved || 0) + (weekly?.solved || 0) + (bank?.solved || 0),
  })
})

// ═══ БЛОГ / НОВОСТИ ═══

// Сид начальных постов (только если пусто)
const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
if (blogCount === 0) {
  const seed = db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)')
  seed.run('launch', 'Запуск открытой беты', 'Open beta launch',
    'Snatch Highrise выходит в открытую бету! Оригинальная стратегическая настольная игра с AI-противником на базе AlphaZero.\n\nЧто уже работает:\n- Игра против AI (3 уровня сложности)\n- Онлайн мультиплеер по ссылке\n- Ежедневные и еженедельные головоломки\n- Режим «Тренер» с оценкой каждого хода\n- 4 цветовые темы\n- Print & Play PDF\n\nМы активно собираем обратную связь. Нашли баг или есть идея? Пишите в профиле.',
    'Snatch Highrise enters open beta! An original strategy board game with an AlphaZero-based AI opponent.\n\nWhat\'s already working:\n- Play vs AI (3 difficulty levels)\n- Online multiplayer via link\n- Daily and weekly puzzles\n- Trainer mode with move evaluation\n- 4 color themes\n- Print & Play PDF\n\nWe\'re actively collecting feedback. Found a bug or have an idea? Let us know via your profile.',
    'release', 1)
  seed.run('ai-v2', 'AI v2: GPU-обучение завершено', 'AI v2: GPU training complete',
    'Нейросеть AI прошла 3 прогона GPU-обучения. Результаты:\n\n- 1146 итераций self-play\n- Loss снизился до 0.098\n- Винрейт лучшей модели: 97%\n- Баланс P1/P2: 50% / 50%\n\nAI стал заметно сильнее в эндшпиле и лучше оценивает позицию золотой стойки.',
    'The AI neural network completed 3 GPU training runs:\n\n- 1146 self-play iterations\n- Loss dropped to 0.098\n- Best model win rate: 97%\n- P1/P2 balance: 50% / 50%\n\nAI is notably stronger in endgame and better at evaluating the golden stand.',
    'ai', 0)
  seed.run('puzzles-launch', 'Запуск головоломок', 'Puzzles launch',
    'Добавлены тактические головоломки!\n\n- Головоломка дня — обновляется каждый день\n- Задача недели — сложнее, обновляется по понедельникам\n- Банк из 50 головоломок с 3 уровнями сложности\n- Лидерборды и статистика решений\n\nЦель — закрыть нужные стойки за ограниченное число ходов. Тренирует тактическое мышление.',
    'Tactical puzzles are here!\n\n- Daily puzzle — refreshes every day\n- Weekly challenge — harder, refreshes on Mondays\n- Bank of 50 puzzles with 3 difficulty levels\n- Leaderboards and solve stats\n\nGoal: close the required stands in limited moves. Trains tactical thinking.',
    'feature', 0)
  seed.run('roadmap', 'Что дальше: планы развития', 'What\'s next: roadmap',
    'Snatch Highrise — исследовательский проект на стыке настольных игр и AI. Вот что в планах:\n\nБлижайшее:\n- Рейтинговые сезоны\n- Push-уведомления\n- Расширенная книга дебютов\n\nБудущее:\n- Мобильное приложение (iOS/Android)\n- Турниры с призами\n- Физическое издание игры\n- Открытый API для разработчиков\n\nСледите за обновлениями в этом блоге.',
    'Snatch Highrise is a research project at the intersection of board games and AI. Here\'s what\'s planned:\n\nComing soon:\n- Ranked seasons\n- Push notifications\n- Extended opening book\n\nFuture:\n- Mobile app (iOS/Android)\n- Tournaments with prizes\n- Physical game edition\n- Open API for developers\n\nStay tuned via this blog.',
    'roadmap', 0)
}

// Новые посты (добавляются если ещё нет)
const addPost = (slug, tru, ten, bru, ben, tag) => {
  if (!db.prepare('SELECT id FROM blog_posts WHERE slug=?').get(slug))
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?,?,?,?,?,?,0)').run(slug, tru, ten, bru, ben, tag)
}

addPost('update-march-2026', 'Март 2026: масштабное обновление', 'March 2026: Major update',
  '26 ачивок, рейтинговые сезоны, 14 настроек и полная мультиязычность — вот главные изменения за март.\n\n' +
  'Ачивки\nТеперь их 26 вместо 14. Новые: Бессмертный (20 побед подряд), Гроссмейстер (рейтинг 1800), Молния (5 быстрых побед), Решатель (10 головоломок) и другие. Каждая ачивка теперь с цветовой категорией: бронза, серебро, золото, алмаз.\n\n' +
  'Рейтинговые сезоны\nКаждый месяц — новый сезон. Отдельный рейтинг, лидерборд топ-20, график истории ELO прямо в профиле.\n\n' +
  'Настройки\n14 параметров: таймер (блиц/рапид/30м), стиль фишек, плотность доски, скорость анимаций, режим для дальтоников, крупный текст, высокий контраст. Всё сохраняется и применяется мгновенно.\n\n' +
  'Мультиязычность\nВесь интерфейс полностью переведён на английский. Переключатель RU/EN в шапке.',
  '26 achievements, ranked seasons, 14 settings, and full English translation — here are the main changes for March.\n\n' +
  'Achievements\nNow 26 instead of 14. New ones: Immortal (20 wins in a row), Grandmaster (1800 rating), Lightning (5 fast wins), Solver (10 puzzles), and more. Each achievement now has a color tier: bronze, silver, gold, diamond.\n\n' +
  'Ranked Seasons\nEvery month is a new season with separate rating, top-20 leaderboard, and ELO history chart right in your profile.\n\n' +
  'Settings\n14 parameters: timer (blitz/rapid/30m), chip style, board density, animation speed, colorblind mode, large text, high contrast. Everything saves and applies instantly.\n\n' +
  'Multilingual\nThe entire interface is now fully translated to English. RU/EN switch in the header.',
  'release')

addPost('online-v2', 'Онлайн v2: resign, ничья, чат', 'Online v2: resign, draw, chat',
  'Онлайн-режим стал полноценным. Что нового:\n\n' +
  'Сдача партии\nКнопка «Сдаться» — противник мгновенно получает победу. Работает через WebSocket.\n\n' +
  'Предложение ничьей\nКнопка «Ничья» отправляет предложение противнику. Он видит баннер с кнопками «Принять» и «Отклонить».\n\n' +
  'Быстрый чат\nПять кнопок быстрых сообщений: gg, gl, nice, wp, ! — плюс ввод произвольного текста.\n\n' +
  'Уведомления\nКогда противник сделал ход и вкладка в фоне — заголовок мигает красной точкой. Вы не пропустите свой ход.',
  'Online mode is now fully featured. What\'s new:\n\n' +
  'Resign\nA "Resign" button — your opponent instantly gets the win. Works via WebSocket.\n\n' +
  'Draw offer\nA "Draw" button sends an offer. Opponent sees a banner with "Accept" and "Decline".\n\n' +
  'Quick chat\nFive quick message buttons: gg, gl, nice, wp, ! — plus free text input.\n\n' +
  'Notifications\nWhen opponent moves and your tab is in the background, the title blinks with a red dot. You won\'t miss your turn.',
  'feature')

addPost('design-v3', 'Дизайн v3: лендинг, шапка, авторизация', 'Design v3: landing, header, auth',
  'Полная переработка визуала:\n\n' +
  'Лендинг\n8 секций, каждая с уникальной архитектурой. Scroll-анимации (IntersectionObserver), animated counters, AI-баннер с метриками, gradient Print&Play баннер, нумерованный FAQ.\n\n' +
  'Шапка\n4 основных пункта + выпадающее «Ещё». Авторизация вынесена в хедер — аватар с рейтингом или кнопка «Войти» с dropdown формой.\n\n' +
  'SEO\nOG-теги, twitter:card, JSON-LD structured data, robots.txt, sitemap.xml, PWA-иконки 192+512.\n\n' +
  'Код\n11 lazy-loaded компонентов (React.lazy + Suspense). Hash-роутинг: #game, #blog, #puzzles — back/forward работает. Error Boundary для безопасности.',
  'Complete visual overhaul:\n\n' +
  'Landing\n8 sections, each with unique architecture. Scroll animations (IntersectionObserver), animated counters, AI banner with metrics, gradient Print&Play banner, numbered FAQ.\n\n' +
  'Header\n4 main items + "More" dropdown. Auth moved to header — avatar with rating or "Login" button with dropdown form.\n\n' +
  'SEO\nOG tags, twitter:card, JSON-LD structured data, robots.txt, sitemap.xml, PWA icons 192+512.\n\n' +
  'Code\n11 lazy-loaded components (React.lazy + Suspense). Hash routing: #game, #blog, #puzzles — back/forward works. Error Boundary for safety.',
  'update')

// Получить посты
app.get('/api/blog', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const perPage = 10
  const offset = (page - 1) * perPage
  const posts = db.prepare('SELECT id, slug, title_ru, title_en, body_ru, body_en, tag, pinned, created_at FROM blog_posts WHERE published=1 ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?').all(perPage, offset)
  const total = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE published=1').get().c
  res.json({ posts, total, page, pages: Math.ceil(total / perPage) })
})

// Отдельный пост
app.get('/api/blog/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug=? AND published=1').get(req.params.slug)
  if (!post) return res.status(404).json({ error: 'Пост не найден' })
  res.json(post)
})

// Создание поста (только админ)
app.post('/api/blog', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { slug, title_ru, title_en, body_ru, body_en, tag, pinned } = req.body
  if (!slug || !title_ru || !body_ru) return res.status(400).json({ error: 'slug, title_ru, body_ru обязательны' })
  try {
    db.prepare('INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)').run(slug, title_ru, title_en || '', body_ru, body_en || '', tag || 'update', pinned ? 1 : 0)
    res.json({ ok: true })
  } catch (e) { res.status(409).json({ error: 'Slug уже существует' }) }
})

// Обновление поста (только админ)
app.put('/api/blog/:slug', auth, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Только администратор' })
  const { title_ru, title_en, body_ru, body_en, tag, pinned, published } = req.body
  db.prepare('UPDATE blog_posts SET title_ru=COALESCE(?,title_ru), title_en=COALESCE(?,title_en), body_ru=COALESCE(?,body_ru), body_en=COALESCE(?,body_en), tag=COALESCE(?,tag), pinned=COALESCE(?,pinned), published=COALESCE(?,published), updated_at=datetime(\'now\') WHERE slug=?')
    .run(title_ru, title_en, body_ru, body_en, tag, pinned, published, req.params.slug)
  res.json({ ok: true })
})

// ═══ ROOMS (REST API для создания) ═══
const rooms = new Map()
const matchQueue = [] // [{ ws, name }]

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

app.post('/api/rooms', (req, res) => {
  const { name, mode } = req.body // mode: 'single' | 'tournament3' | 'tournament5'
  let id = generateRoomId()
  while (rooms.has(id)) id = generateRoomId()
  rooms.set(id, {
    id, created: Date.now(), mode: mode || 'single',
    totalGames: mode === 'tournament5' ? 5 : mode === 'tournament3' ? 3 : 1,
    currentGame: 0, scores: [0, 0],
    players: [], state: 'waiting', game: null,
  })
  // Автоудаление через 30 мин
  setTimeout(() => rooms.delete(id), 30 * 60 * 1000)
  res.json({ roomId: id })
})

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Комната не найдена' })
  res.json({ id: room.id, mode: room.mode, players: room.players.map(p => p.name), state: room.state, scores: room.scores, totalGames: room.totalGames, currentGame: room.currentGame })
})

// ═══ WebSocket ═══
import { WebSocketServer } from 'ws'
import { createServer } from 'http'

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Верификация WS-клиента по токену
function wsAuth(token) {
  if (!token) return null
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

// ─── Хелперы серверной валидации ходов ───

/** Сравнение двух action объектов (transfer, placement, swap) */
function actionsEqual(a, b) {
  // swap
  if (a.swap || b.swap) return !!a.swap === !!b.swap
  // transfer
  const at = a.transfer, bt = b.transfer
  if (!at && !bt) { /* ok */ }
  else if (!at || !bt) return false
  else if (at[0] !== bt[0] || at[1] !== bt[1]) return false
  // placement
  const ap = a.placement || {}, bp = b.placement || {}
  const ak = Object.keys(ap).sort(), bk = Object.keys(bp).sort()
  if (ak.length !== bk.length) return false
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i] || ap[ak[i]] !== bp[bk[i]]) return false
  }
  return true
}

/** Конвертация game player index → room player index */
function gameToRoomPlayer(room, gamePlayer) {
  const firstP = room.firstPlayer ?? 0
  return gamePlayer === 0 ? firstP : 1 - firstP
}

/** Обработка gameOver сервером: обновление счёта + турнирная логика */
function handleServerGameOver(room) {
  const gs = room.gameState
  if (!gs) return
  const winner = gs.winner // 0, 1 (game player) или -1 (ничья)
  if (winner >= 0) {
    const roomWinner = gameToRoomPlayer(room, winner)
    room.scores[roomWinner]++
  }
  // Рассылаем серверный gameOver с авторитетным победителем
  const gameOverMsg = JSON.stringify({
    type: 'serverGameOver',
    winner: winner >= 0 ? gameToRoomPlayer(room, winner) : -1,
    scores: room.scores,
  })
  room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(gameOverMsg))
  handleTournamentNext(room)
}

/** Турнирная логика: следующая партия или финал */
function handleTournamentNext(room) {
  if (room.currentGame < room.totalGames) {
    room.currentGame++
    room.firstPlayer = room.currentGame % 2 === 1 ? 0 : 1
    room.gameState = new GameState()
    const nextMsg = JSON.stringify({
      type: 'nextGame',
      currentGame: room.currentGame, totalGames: room.totalGames,
      scores: room.scores,
      firstPlayer: room.firstPlayer,
    })
    room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(nextMsg))
  } else {
    const finalMsg = JSON.stringify({
      type: 'tournamentOver',
      scores: room.scores,
      winner: room.scores[0] > room.scores[1] ? 0 : room.scores[1] > room.scores[0] ? 1 : -1,
    })
    room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(finalMsg))
  }
}

wss.on('connection', (ws, req) => {
  let playerRoom = null
  let playerIdx = -1
  let wsUser = null // { id, username, isAdmin } — null = гость

  // Аутентификация через первое сообщение или query param
  const url = new URL(req.url, 'http://localhost')
  const tokenFromUrl = url.searchParams.get('token')
  if (tokenFromUrl) wsUser = wsAuth(tokenFromUrl)

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    // Аутентификация через сообщение (альтернатива query param)
    if (msg.type === 'auth') {
      wsUser = wsAuth(msg.token)
      ws.send(JSON.stringify({ type: 'authResult', ok: !!wsUser, username: wsUser?.username }))
      return
    }

    // ─── JOIN ───
    // ─── MATCHMAKING ───
    if (msg.type === 'findMatch') {
      const name = wsUser?.username || msg.name || 'Player'
      // Remove stale entries
      for (let i = matchQueue.length - 1; i >= 0; i--) {
        if (matchQueue[i].ws.readyState !== 1) matchQueue.splice(i, 1)
      }
      // Check if already in queue
      if (matchQueue.some(q => q.ws === ws)) return
      matchQueue.push({ ws, name, userId: wsUser?.id || null })

      if (matchQueue.length >= 2) {
        const p1 = matchQueue.shift()
        const p2 = matchQueue.shift()
        // Create room
        const roomId = Math.random().toString(36).slice(2, 8).toUpperCase()
        const room = { id: roomId, players: [{ ws: p1.ws, name: p1.name, userId: p1.userId }, { ws: p2.ws, name: p2.name, userId: p2.userId }],
          mode: 'single', totalGames: 1, currentGame: 1, scores: [0, 0], gameState: new GameState(), firstPlayer: 0 }
        rooms.set(roomId, room)
        // Notify both
        p1.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 0 }))
        p2.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 1 }))
        // Start game
        const startMsg = JSON.stringify({ type: 'start', players: [p1.name, p2.name], firstPlayer: 0, scores: [0, 0], currentGame: 1 })
        p1.ws.send(startMsg); p2.ws.send(startMsg)
      } else {
        ws.send(JSON.stringify({ type: 'queued', position: matchQueue.length }))
      }
      return
    }

    if (msg.type === 'cancelMatch') {
      const idx = matchQueue.findIndex(q => q.ws === ws)
      if (idx !== -1) matchQueue.splice(idx, 1)
      ws.send(JSON.stringify({ type: 'matchCancelled' }))
      return
    }

    if (msg.type === 'join') {
      const roomId = (msg.roomId || '').toUpperCase()
      const room = rooms.get(roomId)
      if (!room) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната не найдена' }))
      if (room.players.length >= 2) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната полна' }))

      playerIdx = room.players.length
      room.players.push({ ws, name: wsUser?.username || msg.name || `Игрок ${playerIdx + 1}`, userId: wsUser?.id || null })
      playerRoom = room

      ws.send(JSON.stringify({ type: 'joined', roomId, playerIdx, mode: room.mode, totalGames: room.totalGames }))

      // Второй игрок — стартуем
      if (room.players.length === 2) {
        room.state = 'playing'
        room.currentGame = 1
        room.gameState = new GameState()
        room.firstPlayer = 0
        const startMsg = JSON.stringify({
          type: 'start',
          players: room.players.map(p => p.name),
          currentGame: 1, totalGames: room.totalGames, scores: [0, 0],
          // Первая партия: P1 = игрок 0
          firstPlayer: 0,
        })
        room.players.forEach(p => p.ws.send(startMsg))
      } else {
        ws.send(JSON.stringify({ type: 'waiting', players: room.players.map(p => p.name) }))
      }
    }

    // ─── MOVE (серверная валидация) ───
    if (msg.type === 'move' && playerRoom) {
      const room = playerRoom
      const gs = room.gameState
      if (!gs || gs.gameOver) {
        ws.send(JSON.stringify({ type: 'error', msg: 'Игра не активна' }))
      } else {
        // Маппинг: room.firstPlayer — кто из комнаты играет за game player 0
        const firstP = room.firstPlayer ?? 0
        const gamePlayer = playerIdx === firstP ? 0 : 1
        if (gs.currentPlayer !== gamePlayer) {
          ws.send(JSON.stringify({ type: 'error', msg: 'Не ваш ход' }))
        } else {
          // Валидируем action через движок
          const action = msg.action || {}
          const legal = getLegalActions(gs)
          const isLegal = legal.some(a => actionsEqual(a, action))
          if (!isLegal) {
            ws.send(JSON.stringify({ type: 'error', msg: 'Недопустимый ход' }))
          } else {
            // Применяем ход
            room.gameState = applyAction(gs, action)
            // Рассылаем ход оппоненту (отправитель уже применил локально)
            const opponent = room.players[1 - playerIdx]
            if (opponent?.ws?.readyState === 1) {
              opponent.ws.send(JSON.stringify({ type: 'move', action, from: playerIdx }))
            }
            // Проверяем gameOver — сервер определяет победителя
            if (room.gameState.gameOver) {
              handleServerGameOver(room)
            }
          }
        }
      }
    }

    // ─── RESIGN ───
    if (msg.type === 'resign' && playerRoom) {
      const room = playerRoom
      // Определяем победителя — оппонент
      const firstP = room.firstPlayer ?? 0
      const resignedGamePlayer = playerIdx === firstP ? 0 : 1
      const winnerGamePlayer = 1 - resignedGamePlayer
      // Помечаем gameOver на сервере
      if (room.gameState) {
        room.gameState.gameOver = true
        room.gameState.winner = winnerGamePlayer
      }
      // Рассылаем resign
      room.players.forEach((p, i) => {
        if (i !== playerIdx && p.ws?.readyState === 1) {
          p.ws.send(JSON.stringify({ type: 'resign', from: playerIdx }))
        }
      })
      // Обрабатываем счёт/турнир
      handleServerGameOver(room)
    }

    // ─── CHAT (quick messages) ───
    if (msg.type === 'chat' && playerRoom && msg.text) {
      const text = String(msg.text).slice(0, 50)
      playerRoom.players.forEach((p, i) => {
        if (i !== playerIdx && p.ws?.readyState === 1) {
          p.ws.send(JSON.stringify({ type: 'chat', text, from: playerIdx }))
        }
      })
    }

    // ─── DRAW OFFER ───
    if (msg.type === 'drawOffer' && playerRoom) {
      const opponent = playerRoom.players[1 - playerIdx]
      if (opponent?.ws?.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'drawOffer', from: playerIdx }))
      }
    }

    if (msg.type === 'drawResponse' && playerRoom) {
      const opponent = playerRoom.players[1 - playerIdx]
      if (opponent?.ws?.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'drawResponse', accepted: msg.accepted, from: playerIdx }))
      }
      // Ничья принята — обрабатываем как gameOver с winner=-1
      if (msg.accepted) {
        const room = playerRoom
        if (room.gameState) {
          room.gameState.gameOver = true
          room.gameState.winner = -1
        }
        handleServerGameOver(room)
      }
    }

    // Клиентский gameOver игнорируется — сервер сам определяет через движок
    if (msg.type === 'gameOver' && playerRoom) {
      // Backward compatibility: если gameState не инициализирован (старые сессии),
      // принимаем от клиента как раньше
      if (!playerRoom.gameState) {
        const room = playerRoom
        if (msg.winner === 0) room.scores[0]++
        else if (msg.winner === 1) room.scores[1]++
        handleTournamentNext(room)
      }
      // Иначе — игнорируем, gameOver обрабатывается через валидацию ходов
    }

    // (дубликат chat удалён — обрабатывается выше на строке ~1056)
  })

  ws.on('close', () => {
    if (playerRoom) {
      const room = playerRoom
      const dcMsg = JSON.stringify({ type: 'disconnected', playerIdx })
      room.players.forEach((p, i) => {
        if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(dcMsg)
      })
      // Удаляем комнату через 60 сек если не переподключился
      setTimeout(() => {
        if (room.players.some(p => p.ws?.readyState !== 1)) rooms.delete(room.id)
      }, 60000)
    }
  })
})

// ═══ AVATARS ═══
try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT "default"') } catch {}
try { db.exec('ALTER TABLE games ADD COLUMN is_online INTEGER DEFAULT 0') } catch {}

app.put('/api/profile/avatar', auth, (req, res) => {
  const { avatar } = req.body
  const valid = ['default','cat','dog','fox','bear','owl','robot','crown','fire','star','diamond','ghost']
  if (!valid.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' })
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, req.user.id)
  res.json({ avatar })
})

// ═══ OPENING STATS (какой первый ход чаще побеждает) ═══
app.get('/api/profile/opening-stats', auth, (req, res) => {
  const games = db.prepare('SELECT game_data FROM training_data WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  // Простая статистика: сколько раз каждая стойка использовалась первым ходом
  const standCounts = {}
  const standWins = {}
  for (const g of games) {
    try {
      const data = JSON.parse(g.game_data)
      if (data.moves && data.moves[0]) {
        const firstStand = data.moves[0].stand ?? data.moves[0].placement?.[0]
        if (firstStand !== undefined) {
          standCounts[firstStand] = (standCounts[firstStand] || 0) + 1
          if (data.winner === 0) standWins[firstStand] = (standWins[firstStand] || 0) + 1
        }
      }
    } catch {}
  }
  res.json({ total: games.length, standCounts, standWins })
})

// ═══ ADMIN API ═══

// Обзор — живые данные из БД
app.get('/api/admin/overview', auth, adminOnly, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE last_seen > datetime('now', '-7 days')").get().c
  const todayUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE last_seen > datetime('now', '-1 day')").get().c
  const totalGames = db.prepare('SELECT COUNT(*) as c FROM games').get().c
  const todayGames = db.prepare("SELECT COUNT(*) as c FROM games WHERE played_at > datetime('now', '-1 day')").get().c
  const weekGames = db.prepare("SELECT COUNT(*) as c FROM games WHERE played_at > datetime('now', '-7 days')").get().c
  const onlineGames = db.prepare('SELECT COUNT(*) as c FROM games WHERE is_online=1').get().c
  const avgRating = Math.round(db.prepare('SELECT AVG(rating) as a FROM users WHERE games_played > 0').get().a || 1000)
  const maxRating = db.prepare('SELECT MAX(rating) as m FROM users').get().m || 1000
  const totalTraining = db.prepare('SELECT COUNT(*) as c FROM training_data').get().c
  const totalPuzzles = db.prepare('SELECT COUNT(*) as c FROM puzzle_results').get().c
  const solvedPuzzles = db.prepare('SELECT COUNT(*) as c FROM puzzle_results WHERE solved=1').get().c
  const blogPosts = db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c
  const totalAchievements = db.prepare('SELECT COUNT(*) as c FROM achievements').get().c

  // Регистрации по дням (30 дней)
  const regByDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count 
    FROM users WHERE created_at > datetime('now', '-30 days') 
    GROUP BY day ORDER BY day
  `).all()

  // Партии по дням (30 дней)
  const gamesByDay = db.prepare(`
    SELECT date(played_at) as day, COUNT(*) as count 
    FROM games WHERE played_at > datetime('now', '-30 days') 
    GROUP BY day ORDER BY day
  `).all()

  // Топ-5 рейтинг
  const topPlayers = db.prepare('SELECT username, rating, games_played, wins FROM users ORDER BY rating DESC LIMIT 5').all()

  res.json({
    users: { total: totalUsers, active7d: activeUsers, today: todayUsers },
    games: { total: totalGames, today: todayGames, week: weekGames, online: onlineGames },
    rating: { avg: avgRating, max: maxRating },
    training: totalTraining,
    puzzles: { total: totalPuzzles, solved: solvedPuzzles },
    blog: blogPosts,
    achievements: totalAchievements,
    rooms: rooms.size,
    matchQueue: matchQueue.length,
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    charts: { regByDay, gamesByDay },
    topPlayers,
  })
})

// Пользователи — список с пагинацией и поиском
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const page = Math.max(1, +req.query.page || 1)
  const limit = Math.min(+req.query.limit || 30, 100)
  const offset = (page - 1) * limit
  const search = req.query.q || ''
  const sort = ['rating', 'games_played', 'created_at', 'last_seen', 'username'].includes(req.query.sort) ? req.query.sort : 'created_at'
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC'

  let where = '1=1'
  const params = []
  if (search) {
    where = "username LIKE ? ESCAPE '\\'"
    params.push(`%${search.replace(/[%_]/g, '\\$&')}%`)
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c
  const users = db.prepare(`SELECT id, username, email, rating, games_played, wins, losses, 
    win_streak, best_streak, golden_closed, comebacks, perfect_wins, beat_hard_ai,
    fast_wins, online_wins, puzzles_solved, avatar, is_admin, created_at, last_seen
    FROM users WHERE ${where} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`).all(...params, limit, offset)

  res.json({ users, total, page, pages: Math.ceil(total / limit) })
})

// Пользователь — детали
app.get('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Не найден' })
  const achievements = db.prepare('SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=?').all(user.id)
  const recentGames = db.prepare('SELECT * FROM games WHERE user_id=? ORDER BY played_at DESC LIMIT 20').all(user.id)
  const ratingHistory = db.prepare('SELECT rating, delta, created_at FROM rating_history WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(user.id)
  res.json({ user: formatUser(user), achievements, recentGames, ratingHistory })
})

// Пользователь — редактирование
app.put('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const { rating, is_admin, username, reset_password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Не найден' })

  if (rating !== undefined) db.prepare('UPDATE users SET rating=? WHERE id=?').run(Math.max(100, Math.min(2500, +rating)), user.id)
  if (is_admin !== undefined) db.prepare('UPDATE users SET is_admin=? WHERE id=?').run(is_admin ? 1 : 0, user.id)
  if (username) db.prepare('UPDATE users SET username=? WHERE id=?').run(username, user.id)
  if (reset_password) {
    const hash = bcrypt.hashSync(reset_password, 10)
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id)
  }

  res.json({ ok: true })
})

// Пользователь — удаление
app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const id = +req.params.id
  if (id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' })
  db.prepare('DELETE FROM achievements WHERE user_id=?').run(id)
  db.prepare('DELETE FROM games WHERE user_id=?').run(id)
  db.prepare('DELETE FROM friends WHERE user_id=? OR friend_id=?').run(id, id)
  db.prepare('DELETE FROM training_data WHERE user_id=?').run(id)
  db.prepare('DELETE FROM rating_history WHERE user_id=?').run(id)
  db.prepare('DELETE FROM season_ratings WHERE user_id=?').run(id)
  db.prepare('DELETE FROM daily_results WHERE user_id=?').run(id)
  db.prepare('DELETE FROM puzzle_results WHERE user_id=?').run(id)
  db.prepare('DELETE FROM users WHERE id=?').run(id)
  res.json({ ok: true })
})

// Партии — список
app.get('/api/admin/games', auth, adminOnly, (req, res) => {
  const page = Math.max(1, +req.query.page || 1)
  const limit = Math.min(+req.query.limit || 30, 100)
  const offset = (page - 1) * limit
  const mode = req.query.mode || ''

  let where = '1=1'
  const params = []
  if (mode) { where += ' AND g.mode=?'; params.push(mode) }

  const total = db.prepare(`SELECT COUNT(*) as c FROM games g WHERE ${where}`).get(...params).c
  const games = db.prepare(`SELECT g.*, u.username FROM games g JOIN users u ON u.id=g.user_id 
    WHERE ${where} ORDER BY g.played_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)

  res.json({ games, total, page, pages: Math.ceil(total / limit) })
})

// Блог — полный список (включая неопубликованные)
app.get('/api/admin/blog', auth, adminOnly, (req, res) => {
  const posts = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all()
  res.json(posts)
})

// Блог — удаление
app.delete('/api/admin/blog/:slug', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE slug=?').run(req.params.slug)
  res.json({ ok: true })
})

// Сезоны — управление
app.get('/api/admin/seasons', auth, adminOnly, (req, res) => {
  const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all()
  res.json(seasons)
})

app.put('/api/admin/seasons/:id', auth, adminOnly, (req, res) => {
  const { active, name } = req.body
  if (active !== undefined) db.prepare('UPDATE seasons SET active=? WHERE id=?').run(active ? 1 : 0, req.params.id)
  if (name) db.prepare('UPDATE seasons SET name=? WHERE id=?').run(name, req.params.id)
  res.json({ ok: true })
})

// Ачивки — статистика
app.get('/api/admin/achievements', auth, adminOnly, (req, res) => {
  const stats = db.prepare(`
    SELECT achievement_id, COUNT(*) as count,
    MIN(unlocked_at) as first_unlock, MAX(unlocked_at) as last_unlock
    FROM achievements GROUP BY achievement_id ORDER BY count DESC
  `).all()
  res.json(stats)
})

// Обучающие данные — статистика и управление
app.get('/api/admin/training', auth, adminOnly, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM training_data').get().c
  const byMode = db.prepare('SELECT mode, COUNT(*) as count, AVG(total_moves) as avgMoves FROM training_data GROUP BY mode').all()
  const byDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM training_data WHERE created_at > datetime('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all()
  const sizeMB = db.prepare("SELECT SUM(LENGTH(game_data)) as s FROM training_data").get().s
  res.json({ total, byMode, byDay, sizeMB: Math.round((sizeMB || 0) / 1024 / 1024 * 100) / 100 })
})

// Обучающие данные — очистка старых
app.delete('/api/admin/training', auth, adminOnly, (req, res) => {
  const days = Math.max(1, Math.min(365, Math.floor(+req.query.olderThan || 90)))
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const result = db.prepare('DELETE FROM training_data WHERE created_at < ?').run(cutoff)
  res.json({ deleted: result.changes })
})

// Активные комнаты и очередь
app.get('/api/admin/rooms', auth, adminOnly, (req, res) => {
  const active = []
  for (const [id, room] of rooms) {
    active.push({
      id, mode: room.mode, state: room.state,
      players: room.players.map(p => p.name),
      scores: room.scores, currentGame: room.currentGame,
      totalGames: room.totalGames,
      ageMin: Math.round((Date.now() - room.created) / 60000),
    })
  }
  res.json({ rooms: active, queueLength: matchQueue.length })
})

// Серверные логи/инфо
app.get('/api/admin/server', auth, adminOnly, (req, res) => {
  const mem = process.memoryUsage()
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get()
  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    db: {
      sizeMB: Math.round((dbSize?.size || 0) / 1024 / 1024 * 100) / 100,
      walMode: db.pragma('journal_mode')[0]?.journal_mode,
    },
    rooms: rooms.size,
    matchQueue: matchQueue.length,
    rateLimitEntries: rateLimits.size,
    pid: process.pid,
  })
})

// Changelog blog post
addPost('changelog-march', 'Changelog: март 2026', 'Changelog: March 2026',
  'Версия 3.0 — полный список изменений:\n\n' +
  '• 26 ачивок (было 14) с цветовыми категориями\n• Рейтинговые сезоны (месячные) + график ELO\n• 14 настроек (таймер, фишки, доступность)\n• Полная мультиязычность RU/EN\n' +
  '• Resign + предложение ничьей в онлайне\n• Quick-chat (gg, gl, nice, wp)\n• Случайный матчмейкинг\n• Авторизация в хедере\n• 3 новых блог-поста\n' +
  '• Лендинг с scroll-анимациями (4 итерации дизайна)\n• Error Boundary + lazy loading (11 компонентов)\n• Hash routing (#game, #blog, #puzzles)\n• OG-теги, JSON-LD, robots.txt, sitemap\n• Accessibility (aria, landmarks, keyboard)\n• Service Worker: network-first',
  'Version 3.0 — full changelog:\n\n' +
  '• 26 achievements (was 14) with color tiers\n• Ranked seasons (monthly) + ELO graph\n• 14 settings (timer, chips, accessibility)\n• Full EN/RU internationalization\n' +
  '• Resign + draw offer in online\n• Quick chat (gg, gl, nice, wp)\n• Random matchmaking\n• Auth in header\n• 3 new blog posts\n' +
  '• Landing with scroll animations (4 design iterations)\n• Error Boundary + lazy loading (11 components)\n• Hash routing (#game, #blog, #puzzles)\n• OG tags, JSON-LD, robots.txt, sitemap\n• Accessibility (aria, landmarks, keyboard)\n• Service Worker: network-first',
  'release')

addPost('admin-panel', 'Админ-панель и безопасность', 'Admin panel & security',
  'Добавлена полноценная админ-панель с 9 разделами.\n\n' +
  'Что внутри\n' +
  'Обзор — живые метрики: пользователи, партии, рейтинг, память сервера. Графики регистраций и партий за 30 дней.\n\n' +
  'Пользователи — поиск, сортировка, редактирование рейтинга, сброс пароля, удаление.\n\n' +
  'Партии — фильтрация по режиму (AI, PvP, онлайн), история с дельтой рейтинга.\n\n' +
  'Блог — создание и редактирование постов прямо из админки. Черновики, теги, закрепление.\n\n' +
  'Комнаты — мониторинг активных онлайн-комнат и очереди матчмейкинга в реальном времени.\n\n' +
  'Безопасность\n' +
  'WebSocket аутентификация, валидация результатов партий на сервере, антиспам при записи партий, CSP заголовки.',
  'Full admin panel with 9 sections added.\n\n' +
  'Overview — live metrics: users, games, rating, server memory. Registration and game charts for 30 days.\n\n' +
  'Users — search, sort, edit rating, reset password, delete.\n\n' +
  'Games — filter by mode (AI, PvP, online), history with rating delta.\n\n' +
  'Blog — create and edit posts from admin. Drafts, tags, pinning.\n\n' +
  'Rooms — live monitoring of online rooms and matchmaking queue.\n\n' +
  'Security\n' +
  'WebSocket authentication, server-side game result validation, anti-spam, CSP headers.',
  'release')

addPost('v3-3-update', 'Адаптивка, тема Wood и интерактивные правила', 'Responsive, Wood theme & interactive rules',
  'Большое обновление интерфейса.\n\n' +
  'Адаптивка\n' +
  'Теперь 8 брейкпоинтов вместо 4. Сайт корректно отображается на экранах от 340px до 1024px. Админка на мобилке показывает горизонтальные табы вместо сайдбара.\n\n' +
  'Тема Wood\n' +
  'Полностью переработана. Доска и стойки с текстурой дерева через CSS-паттерны. Фишки стилизованы: светлые как кость, тёмные как эбен. Inner shadow для глубины.\n\n' +
  'Правила\n' +
  'Три интерактивные схемы с пошаговой анимацией: перенос фишек (4 шага), закрытие стойки (3 шага), swap rule с кнопкой смены цветов. Обновлён Print & Play PDF.\n\n' +
  'Также добавлена отдельная страница Changelog с историей всех версий.',
  'Big interface update.\n\n' +
  'Responsive\n' +
  'Now 8 breakpoints instead of 4. Site displays correctly from 340px to 1024px. Admin on mobile shows horizontal tabs instead of sidebar.\n\n' +
  'Wood theme\n' +
  'Fully reworked. Board and stands with wood grain texture via CSS patterns. Chips styled: light as ivory, dark as ebony. Inner shadows for depth.\n\n' +
  'Rules\n' +
  'Three interactive diagrams with step-by-step animation: chip transfer (4 steps), stand closing (3 steps), swap rule with color swap button. Updated Print & Play PDF.\n\n' +
  'Also added a dedicated Changelog page with full version history.',
  'update')

addPost('v3-4-ux', 'UX-обновление по тестированию', 'UX update from playtesting',
  'Провели первое тестирование с реальными игроками. Вот что изменилось:\n\n' +
  'Правила полностью переписаны\n' +
  'Раздел «Правила» переработан с нуля. Убраны интерактивные демо (раздражали необходимостью кликать). ' +
  'Вместо них — статичные SVG-схемы переноса и закрытия. Формулировки уточнены: «Стойка принадлежит игроку, если фишка его цвета на вершине». ' +
  'Swap Rule переименован в «Баланс первого хода» — сразу понятно зачем это нужно.\n\n' +
  'Стойки перевёрнуты\n' +
  'Фишки теперь растут снизу вверх. Раньше верх стоек обрезался и хотелось прокрутить — теперь основание внизу, верх скруглён, визуально завершённая форма.\n\n' +
  'Счётчик фишек\n' +
  'Под каждой стойкой всегда виден счётчик: сколько фишек стоит. Красный при 9+, жёлтый при 7+. ' +
  'Больше не нужно считать вручную — главный pain point по отзывам.\n\n' +
  'Призрачный перенос\n' +
  'После переноса во время расстановки видно: откуда ушли фишки (полосатые, dashed border) и куда пришли (пульсирующие, зелёный glow). Помогает ориентироваться.\n\n' +
  'Онлайн-баги\n' +
  'Исправлен критический баг: если игрок шёл прямо в «Онлайн» не заходя в «Играть», партия стартовала с AI вместо противника. ' +
  'Исправлены пустые кнопки после сдачи партии. «Ещё партию» заменена на «В лобби» в онлайн-режиме.\n\n' +
  'Print & Play\n' +
  'Белый фон для печати. 70 фишек каждого цвета (было 55 — при игре 1 vs 3 не хватало). Обновлённые правила.',
  'First playtest with real users. Here\'s what changed:\n\n' +
  'Rules completely rewritten\n' +
  'Rules section rebuilt from scratch. Removed interactive demos (annoying click-throughs). ' +
  'Replaced with static SVG diagrams for transfer and closing. Swap Rule renamed to "First Move Balance" — immediately clear why it exists.\n\n' +
  'Stands flipped\n' +
  'Chips now grow bottom-up. Before, stand tops were cut off. Now base is at bottom, rounded top — visually complete.\n\n' +
  'Chip counter\n' +
  'Always-visible counter under each stand. Red at 9+, yellow at 7+. No more manual counting — top pain point from testers.\n\n' +
  'Ghost transfer\n' +
  'After transfer during placement: source shows striped fading chips, destination shows pulsing green glow. Helps orient.\n\n' +
  'Online bugs\n' +
  'Fixed critical bug: going to Online without visiting Play first started AI game instead of multiplayer. Fixed empty buttons after resign. "New game" replaced with "Back to lobby" in online.\n\n' +
  'Print & Play\n' +
  'White background for printing. 70 chips each color (was 55). Updated rules text.',
  'release')

addPost('changelog-v3-4', 'Changelog: v3.4', 'Changelog: v3.4',
  'Полный список изменений v3.4:\n\n' +
  '• Правила полностью переписаны (SVG-схемы, точные формулировки, «Баланс первого хода»)\n' +
  '• Стойки перевёрнуты: скругление сверху, база внизу\n' +
  '• Счётчик фишек всегда виден (11px, цвет по заполнению)\n' +
  '• Призрачный перенос: ghost-out/ghost-in фишки, dashed/green стойки, стрелки\n' +
  '• Базовый шрифт 15px (было 13px), large-text 18px\n' +
  '• Критический онлайн-баг: Game+Online рендерятся всегда\n' +
  '• Пустые кнопки Share/Replay исправлены\n' +
  '• «В лобби» вместо «Ещё партию» в онлайне\n' +
  '• Settings мгновенное обновление (custom event)\n' +
  '• Fill bar: var(--surface2) вместо хардкод\n' +
  '• Reduced-motion: animation:none без мерцания\n' +
  '• Light тема: полная переработка (Apple-style)\n' +
  '• Print & Play: белый фон, 70 фишек, новые правила\n' +
  '• Game controls i18n (Режим/Сторона/Сложность)\n' +
  '• Аналитика: подзаголовок AI-исследования\n' +
  '• Dropdown active стиль исправлен\n' +
  '• Блог: индивидуальные URL (#blog/slug)',
  'Full changelog v3.4:\n\n' +
  '• Rules completely rewritten (SVG diagrams, precise wording, "First Move Balance")\n' +
  '• Stands flipped: rounded top, base at bottom\n' +
  '• Chip counter always visible (11px, colored by fill)\n' +
  '• Ghost transfer: ghost-out/in chips, dashed/green stands, arrows\n' +
  '• Base font 15px (was 13px), large-text 18px\n' +
  '• Critical online bug: Game+Online always render\n' +
  '• Empty Share/Replay buttons fixed\n' +
  '• "Back to lobby" instead of "New game" in online\n' +
  '• Settings instant update (custom event)\n' +
  '• Fill bar: var(--surface2) instead of hardcoded\n' +
  '• Reduced-motion: animation:none without flicker\n' +
  '• Light theme: full rework (Apple-style)\n' +
  '• Print & Play: white bg, 70 chips, new rules\n' +
  '• Game controls i18n\n' +
  '• Analytics subtitle: AI research\n' +
  '• Dropdown active style fixed\n' +
  '• Blog: individual URLs (#blog/slug)',
  'release')

// ═══ КОНТЕНТ (CMS) ═══

// Получить весь контент (публичный, кешируется)
app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, section, value_ru, value_en FROM site_content ORDER BY section, key').all()
  const content = {}
  for (const row of rows) {
    content[row.key] = { ru: row.value_ru, en: row.value_en }
  }
  res.set('Cache-Control', 'public, max-age=60')
  res.json(content)
})

// Админ: получить весь контент с метаданными
app.get('/api/admin/content', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM site_content ORDER BY section, key').all()
  res.json(rows)
})

// Админ: обновить один ключ
app.put('/api/admin/content/:key', auth, adminOnly, (req, res) => {
  const { value_ru, value_en } = req.body
  const existing = db.prepare('SELECT key FROM site_content WHERE key=?').get(req.params.key)
  if (!existing) return res.status(404).json({ error: 'Ключ не найден' })
  db.prepare("UPDATE site_content SET value_ru=?, value_en=?, updated_at=datetime('now') WHERE key=?")
    .run(value_ru ?? '', value_en ?? '', req.params.key)
  res.json({ ok: true })
})

// Админ: добавить новый ключ
app.post('/api/admin/content', auth, adminOnly, (req, res) => {
  const { key, section, value_ru, value_en, label } = req.body
  if (!key) return res.status(400).json({ error: 'key обязателен' })
  try {
    db.prepare('INSERT INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
      .run(key, section || 'general', value_ru || '', value_en || '', label || '')
    res.json({ ok: true })
  } catch (e) { res.status(409).json({ error: 'Ключ уже существует' }) }
})

// Админ: удалить ключ
app.delete('/api/admin/content/:key', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM site_content WHERE key=?').run(req.params.key)
  res.json({ ok: true })
})

// Админ: массовый импорт (i18n ключей)
app.post('/api/admin/content/bulk', auth, adminOnly, (req, res) => {
  const { items } = req.body // [{ key, section, value_ru, value_en, label }]
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items обязателен' })
  const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
  let added = 0
  for (const item of items) {
    const r = ins.run(item.key, item.section || 'i18n', item.value_ru || '', item.value_en || '', item.label || '')
    if (r.changes > 0) added++
  }
  res.json({ ok: true, added, total: items.length })
})

// ═══ Старт ═══
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Snatch Highrise API + WS: http://0.0.0.0:${PORT}`)
  console.log(`   WebSocket: ws://0.0.0.0:${PORT}/ws`)
  console.log(`   Health: http://0.0.0.0:${PORT}/api/health`)
})
