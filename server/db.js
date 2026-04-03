/**
 * Модуль базы данных — схема, сид-данные, ачивки, миграции
 * Экспортирует: db, JWT_SECRET, bcrypt, checkAchievements, __dirname
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

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
export const PORT = process.env.PORT || 3001
export const JWT_SECRET = process.env.JWT_SECRET || (() => {
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
export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')  // Ждать до 5с при блокировке вместо немедленной ошибки
db.pragma('synchronous = NORMAL') // Баланс между скоростью и надёжностью (WAL+NORMAL — безопасно)

// ─── Основные таблицы ───
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
  CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
  CREATE INDEX IF NOT EXISTS idx_training_user ON training_data(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_season_ratings_season ON season_ratings(season_id, rating DESC);

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

// ─── CMS ───
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

// ─── Daily + Puzzles ───
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, username TEXT, seed TEXT,
    turns INTEGER, duration INTEGER, won INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, seed)
  );
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
  );
  CREATE INDEX IF NOT EXISTS idx_daily_seed_score ON daily_results(seed, turns ASC, duration ASC);
  CREATE INDEX IF NOT EXISTS idx_puzzle_user_solved ON puzzle_results(user_id, solved);
`)

// ═══ Версионные миграции ═══
// Каждая миграция выполняется только один раз. Версия хранится в schema_version.
db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`)

function getSchemaVersion() {
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get()
  return row?.v || 0
}

function runMigration(version, sql) {
  if (getSchemaVersion() >= version) return
  try {
    if (typeof sql === 'function') sql()
    else db.exec(sql)
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version)
  } catch (e) {
    // ALTER TABLE ADD COLUMN может упасть если колонка уже есть (от старых миграций)
    try { db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(version) } catch {}
  }
}

// Миграция 1: базовые поля users
runMigration(1, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN fast_wins INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN online_wins INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN puzzles_solved INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT "default"') } catch {}
  try { db.exec('ALTER TABLE games ADD COLUMN is_online INTEGER DEFAULT 0') } catch {}
})

// Миграция 2: login streak
runMigration(2, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN best_login_streak INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN last_login_date TEXT') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN streak_freeze INTEGER DEFAULT 1') } catch {}
})

// Миграция 3: XP / Level
runMigration(3, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1') } catch {}
})

// Следующие миграции добавлять так:
// runMigration(N, 'ALTER TABLE ...')
// runMigration(N, () => { db.exec(...); db.exec(...) })

// Миграция 4: реферальная система
runMigration(4, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER') } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    xp_rewarded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(referred_id),
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_id) REFERENCES users(id)
  )`)
  db.exec('CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)')
  // Генерируем реф-коды для существующих юзеров
  const users = db.prepare('SELECT id, username FROM users WHERE referral_code IS NULL').all()
  const update = db.prepare('UPDATE users SET referral_code=? WHERE id=?')
  for (const u of users) {
    const code = u.username.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') + u.id.toString(36).toUpperCase()
    update.run(code, u.id)
  }
})

// Миграция 5: сезонные награды
runMigration(5, () => {
  db.exec(`CREATE TABLE IF NOT EXISTS season_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    placement INTEGER NOT NULL,
    reward_type TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    claimed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, season_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id)
  )`)
})

console.log(`📦 Schema version: ${getSchemaVersion()}, миграций: 5`)

// ─── Таблицы (CREATE IF NOT EXISTS — идемпотентны) ───

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    UNIQUE(user_id, date)
  )
`)

// Push-токены
db.exec(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE NOT NULL,
    platform TEXT DEFAULT 'android',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

// Shared replays
db.exec(`
  CREATE TABLE IF NOT EXISTS replays (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    moves TEXT NOT NULL,
    result INTEGER,
    score TEXT,
    mode TEXT DEFAULT 'ai',
    turns INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

// Daily missions
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    target INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 50,
    UNIQUE(user_id, date, mission_id)
  )
`)

// XP / Level — handled by schema migration 3

// Puzzle Rush scores
db.exec(`
  CREATE TABLE IF NOT EXISTS puzzle_rush_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    solved INTEGER DEFAULT 0,
    time_ms INTEGER DEFAULT 180000,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

// Live Arena
db.exec(`
  CREATE TABLE IF NOT EXISTS arena_tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'waiting',
    rounds INTEGER DEFAULT 4,
    current_round INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 16,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    finished_at TEXT
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS arena_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    score REAL DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    buchholz REAL DEFAULT 0,
    UNIQUE(tournament_id, user_id)
  )
`)
db.exec(`
  CREATE TABLE IF NOT EXISTS arena_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round INTEGER NOT NULL,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER,
    winner_id INTEGER,
    result TEXT,
    room_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

// ─── Сид контента CMS ───
const contentCount = db.prepare('SELECT COUNT(*) as c FROM site_content').get().c
if (contentCount === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')

  // Секция: Сайт
  const siteSeed = [
    ['site.name', 'Перехват высотки', 'Snatch Highrise', 'Название игры'],
    ['site.tagline', 'Стратегическая настолка с AI', 'Strategy board game powered by AI', 'Слоган / подзаголовок'],
    ['site.description', 'Стратегическая настольная игра с AI-противником на базе AlphaZero. Играйте онлайн, решайте головоломки, соревнуйтесь.', 'Strategy board game with AlphaZero AI. Play online, solve puzzles, compete.', 'Описание для поисковиков (meta)'],
    ['site.beta_text', 'Открытая бета — активная разработка', 'Open beta — active development', 'Текст под логотипом'],
    ['footer.tagline', 'Настольные игры и AI-исследования', 'Board games meet AI research', 'Подпись в футере'],
  ]
  for (const [key, ru, en, label] of siteSeed) ins.run(key, 'Сайт', ru, en, label)

  // Секция: Главная страница
  const landingSeed = [
    ['landing.play_btn', 'Играть', 'Play free', 'Кнопка «Играть»'],
    ['landing.learn_btn', 'Обучение за 2 мин', 'Learn in 2 min', 'Кнопка «Обучение»'],
    ['landing.stat_games', 'партий', 'games analyzed', 'Подпись под числом 239K+'],
    ['landing.stat_winrate', 'винрейт AI', 'AI win rate', 'Подпись под числом 97%'],
    ['landing.stat_balance', 'баланс', 'balance', 'Подпись под числом 50:50'],
    ['landing.steps_title', 'Научитесь за 3 шага', 'Learn in 3 steps', 'Заголовок блока «3 шага»'],
    ['landing.step1_title', 'Ставьте', 'Place', 'Шаг 1 — заголовок'],
    ['landing.step1_desc', 'До 3 блоков на 2 стойки за ход. Первый ход — 1 блок.', 'Up to 3 blocks on max 2 stands per turn. First move — 1 block.', 'Шаг 1 — описание'],
    ['landing.step2_title', 'Переносите', 'Transfer', 'Шаг 2 — заголовок'],
    ['landing.step2_desc', 'Переместите верхнюю группу блоков. Ключевой тактический приём, решающий партии.', 'Move the top group of blocks to another stand. The key tactical move that decides games.', 'Шаг 2 — описание'],
    ['landing.step3_title', 'Закрывайте', 'Close', 'Шаг 3 — заголовок'],
    ['landing.step3_desc', 'При 11 блоках высотка построена. Цвет сверху = владелец. Достройте 6 из 10!', 'At 11 blocks the highrise is complete. Top color = owner. Complete 6 of 10!', 'Шаг 3 — описание'],
    ['landing.features_title', 'Что внутри', "What's inside", 'Заголовок блока фич'],
    ['landing.ai_title', 'AI на нейросети', 'Neural network AI', 'Фича: AI'],
    ['landing.ai_desc', '239K партий self-play, архитектура AlphaZero. Играйте против сильнейшего AI.', '239K self-play games, AlphaZero architecture. Challenge the strongest AI.', 'Фича: AI описание'],
    ['landing.puzzles_title', 'Головоломки', 'Puzzles', 'Фича: Головоломки'],
    ['landing.puzzles_desc', 'Ежедневные и еженедельные головоломки. Найдите лучший ход.', 'Daily & weekly puzzles. Find the best move.', 'Фича: Головоломки описание'],
    ['landing.online_title', 'Онлайн мультиплеер', 'Online multiplayer', 'Фича: Онлайн'],
    ['landing.online_desc', 'Играйте с друзьями или случайным соперником. Турниры Best-of-3/5.', 'Play with friends or random opponents. Best-of-3/5 tournaments.', 'Фича: Онлайн описание'],
  ]
  for (const [key, ru, en, label] of landingSeed) ins.run(key, 'Главная', ru, en, label)

  // i18n ключи
  const i18nMap = {
    'nav': 'Навигация', 'game': 'Игра', 'tournament': 'Турниры', 'online': 'Онлайн',
    'daily': 'Ежедневный челлендж', 'puzzle': 'Головоломки', 'trainer': 'Тренер',
    'swap': 'Swap / Баланс', 'replay': 'Повтор партии', 'tutorial': 'Обучение',
    'header': 'Шапка сайта', 'common': 'Общее',
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
    'game.place1': 'Подсказка: поставьте 1 блок', 'game.placeChips': 'Подсказка: расставьте блоки',
    'game.aiThinking': 'Текст: AI думает', 'game.opponentTurn': 'Текст: Ход противника',
    'game.timeUp': 'Текст: Время вышло',
    'header.title': 'Логотип: название в шапке',
    'tutorial.title': 'Заголовок обучения',
    'common.online': 'Статус: Онлайн', 'common.offline': 'Статус: Оффлайн',
  }
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
    'game.gameOver': 'Игра окончена', 'game.place1': 'Поставьте 1 блок',
    'game.place1first': 'Ваш ход — поставьте 1 блок',
    'game.placeChips': 'Расставьте блоки', 'game.clickStands': 'Кликайте на стойки',
    'game.aiFirst': 'AI ходит первым...', 'game.aiThinking': 'AI думает...',
    'game.opponentTurn': 'Ход противника', 'game.timeUp': 'Время вышло!',
    'game.oppTimeUp': 'У соперника вышло время!', 'game.max2stands': 'Макс 2 стойки',
    'game.allPlaced': 'Все блоки расставлены', 'game.undone': 'Ход отменён',
    'game.yourTurn': 'ваш ход', 'game.pass': 'пас',
    'game.swapDone': 'Swap выполнен — цвета поменялись', 'game.swapOnlineDone': 'Swap — вы теперь синие',
    'game.selectTransferFrom': 'Выберите стойку для переноса', 'game.transferSelected': 'Перенос выбран, расставьте блоки',
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
    'game.gameOver': 'Game over', 'game.place1': 'Place 1 block',
    'game.place1first': 'Your turn — place 1 block', 'game.placeChips': 'Place blocks',
    'game.clickStands': 'Click stands to place', 'game.aiFirst': 'AI goes first...',
    'game.aiThinking': 'AI thinking...', 'game.opponentTurn': "Opponent's turn",
    'game.timeUp': 'Time up!', 'game.oppTimeUp': "Opponent's time is up!",
    'game.max2stands': 'Max 2 stands', 'game.allPlaced': 'All blocks placed',
    'game.undone': 'Move undone', 'game.yourTurn': 'your turn', 'game.pass': 'pass',
    'game.swapDone': 'Swap done — colors changed', 'game.swapOnlineDone': 'Swap — you are now blue',
    'game.selectTransferFrom': 'Select stand to transfer from', 'game.transferSelected': 'Transfer set, place blocks',
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

// ─── Миграция: добавляем новые i18n ключи если их нет в CMS ───
const newKeys = {
  'common.loading': ['Общее', 'Загрузка...', 'Loading...', 'Текст загрузки'],
  'game.you': ['Игра', 'Вы', 'You', 'Имя: Вы'],
  'game.opponent': ['Игра', 'Противник', 'Opponent', 'Имя: Противник'],
  'game.yourTurnBlink': ['Игра', 'Ваш ход!', 'Your turn!', 'Мигание таба при ходе'],
  'game.opponentResigned': ['Игра', 'Противник сдался!', 'Opponent resigned!', 'Текст: противник сдался'],
  'game.drawAgreed': ['Игра', 'Согласована ничья', 'Draw agreed', 'Текст: ничья принята'],
  'game.drawDeclined': ['Игра', 'Ничья отклонена', 'Draw declined', 'Текст: ничья отклонена'],
  'game.resigned': ['Игра', 'Сдались', 'Resigned', 'Текст: вы сдались'],
  'game.hint': ['Игра', 'Подсказка', 'Hint', 'Кнопка подсказки'],
  'game.resign': ['Игра', 'Сдаться', 'Resign', 'Кнопка сдаться'],
  'game.drawOffered': ['Игра', 'Ничья предложена...', 'Draw offered...', 'Текст: ничья отправлена'],
  'game.offerDraw': ['Игра', 'Ничья', 'Offer draw', 'Кнопка предложить ничью'],
  'game.undo': ['Игра', 'Отмена', 'Undo', 'Кнопка отмены хода'],
  'game.draw': ['Игра', 'Ничья', 'Draw', 'Результат: ничья'],
  'game.backToLobby': ['Игра', 'В лобби', 'Back to lobby', 'Кнопка назад в лобби'],
  'game.share': ['Игра', 'Поделиться', 'Share', 'Кнопка поделиться'],
  'game.replay': ['Игра', 'Повтор', 'Replay', 'Кнопка повтора'],
  'game.swapQuestion': ['Игра', 'Игрок 1 поставил первый блок. Хотите поменять цвета?', 'Player 1 placed first block. Swap colors?', 'Вопрос swap'],
  'game.swapDeclined': ['Игра', 'Swap отклонён', 'Swap declined', 'Текст: swap отклонён'],
  'game.noContinue': ['Игра', 'Нет, продолжить', 'No, continue', 'Кнопка отказа от swap'],
  'game.drawOfferReceived': ['Игра', 'Противник предлагает ничью', 'Opponent offers a draw', 'Текст: предложение ничьи'],
  'game.accept': ['Игра', 'Принять', 'Accept', 'Кнопка принять'],
  'game.decline': ['Игра', 'Отклонить', 'Decline', 'Кнопка отклонить'],
  'game.modeLabel': ['Игра', 'Режим:', 'Mode:', 'Лейбл: режим'],
  'game.sideLabel': ['Игра', 'Сторона:', 'Side:', 'Лейбл: сторона'],
  'game.diffLabel': ['Игра', 'Сложность:', 'Difficulty:', 'Лейбл: сложность'],
  'puzzle.leaderboard': ['Головоломки', 'Лидерборд', 'Leaderboard', 'Заголовок лидерборда'],
  'puzzle.movesShort': ['Головоломки', 'ход.', 'moves', 'Сокращение: ходы'],
  'puzzle.movesCount': ['Головоломки', 'ходов', 'moves', 'Подпись: ходов'],
  'puzzle.solveRate': ['Головоломки', 'Решаемость', 'Solve rate', 'Решаемость %'],
  'puzzle.solvedCount': ['Головоломки', 'решили', 'solved', 'Подпись: решили'],
  'puzzle.solvedStatus': ['Головоломки', 'Решено!', 'Solved!', 'Статус: решено'],
  'puzzle.failedStatus': ['Головоломки', 'Не удалось', 'Failed', 'Статус: не решено'],
  'puzzle.retryBtn': ['Головоломки', 'Заново', 'Retry', 'Кнопка повтора'],
  'puzzle.backBtn': ['Головоломки', 'К списку', 'Back', 'Кнопка назад'],
  'puzzle.closeStands': ['Головоломки', 'Перехватывайте высотки за ограниченное число ходов', 'Complete highrises in limited moves', 'Подзаголовок головоломок'],
  'puzzle.solvedLabel': ['Головоломки', 'решено', 'solved', 'Подпись: решено'],
  'puzzle.featured': ['Головоломки', 'Избранные', 'Featured', 'Вкладка: избранные'],
  'puzzle.allPuzzles': ['Головоломки', 'Все головоломки', 'All puzzles', 'Вкладка: все'],
  'puzzle.dailyTitle': ['Головоломки', 'Головоломка дня', 'Daily Puzzle', 'Заголовок дневной'],
  'puzzle.weeklyTitle': ['Головоломки', 'Задача недели', 'Weekly Challenge', 'Заголовок недельной'],
  'puzzle.nextIn': ['Головоломки', 'Новая через', 'Next in', 'Таймер: новая через'],
  'puzzle.replayBtn': ['Головоломки', '↻ Переиграть', '↻ Replay', 'Кнопка переиграть'],
  'puzzle.playBtn': ['Головоломки', '▶ Играть', '▶ Play', 'Кнопка играть'],
  'puzzle.loadingPuzzles': ['Головоломки', 'Загрузка головоломок...', 'Loading puzzles...', 'Загрузка'],
  'puzzle.filterAll': ['Головоломки', 'Все', 'All', 'Фильтр: все'],
  'puzzle.filterEasy': ['Головоломки', 'Лёгкие', 'Easy', 'Фильтр: лёгкие'],
  'puzzle.filterMedium': ['Головоломки', 'Средние', 'Medium', 'Фильтр: средние'],
  'puzzle.filterHard': ['Головоломки', 'Сложные', 'Hard', 'Фильтр: сложные'],
  'openings.title': ['Аналитика', 'Книга дебютов и карта стоек', 'Opening Book & Heatmap', 'Заголовок дебютов'],
  'openings.subtitle': ['Аналитика', 'На основании AI-исследования · 239K+ партий', 'Based on AI research · 239K+ games analyzed', 'Подзаголовок'],
  'openings.tabOpenings': ['Аналитика', 'Дебюты', 'Openings', 'Вкладка: дебюты'],
  'openings.tabHeatmap': ['Аналитика', 'Тепловая карта', 'Heatmap', 'Вкладка: карта'],
  'openings.usage': ['Аналитика', 'популярность', 'usage', 'Подпись: популярность'],
  'openings.insights': ['Аналитика', 'Выводы', 'Key insights', 'Заголовок выводов'],
  'blog.title': ['Блог', 'Блог', 'Blog', 'Заголовок блога'],
  'blog.subtitle': ['Блог', 'Новости, обновления и дневник разработки', 'News, updates, and development log', 'Подзаголовок блога'],
  'blog.allPosts': ['Блог', 'Все записи', 'All posts', 'Ссылка: все записи'],
  'blog.noPosts': ['Блог', 'Пока нет записей', 'No posts yet', 'Текст: нет записей'],
  'tutorial.start': ['Обучение', 'Начать играть!', 'Start playing!', 'Кнопка: начать'],
  'tutorial.next': ['Обучение', 'Далее →', 'Next →', 'Кнопка: далее'],
  'tutorial.skip': ['Обучение', 'Пропустить', 'Skip', 'Кнопка: пропустить'],
  'game.rematch': ['Игра', 'Рематч', 'Rematch', 'Кнопка рематча'],
  'game.rematchOffer': ['Игра', 'Противник предлагает рематч', 'Opponent offers a rematch', 'Текст: предложение рематча'],
  'game.rematchWaiting': ['Игра', 'Рематч предложен...', 'Rematch offered...', 'Текст: ожидание рематча'],
  'game.rematchDeclined': ['Игра', 'Рематч отклонён', 'Rematch declined', 'Текст: рематч отклонён'],
  'game.extreme': ['Игра', 'Экстрим', 'Extreme', 'Сложность: экстрим'],
  'game.watching': ['Игра', 'наблюдение', 'watching', 'Текст: режим наблюдения'],
}
const migrateIns = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')
let migrated = 0
for (const [key, [section, ru, en, label]] of Object.entries(newKeys)) {
  const r = migrateIns.run(key, section, ru, en, label)
  if (r.changes > 0) migrated++
}
if (migrated > 0) console.log(`CMS миграция: добавлено ${migrated} новых ключей`)

// ─── Миграция: блог-пост v3.4 ───
const blogExists = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v3-4-security-spectator'").get()
if (!blogExists) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      'v3-4-security-spectator',
      'v3.4 — Безопасность, спектатор, рематч и публичные профили',
      'v3.4 — Security, spectator mode, rematch & public profiles',
      `Большое обновление серверной части и онлайн-функционала!

**Безопасность:** Сервер теперь валидирует каждый ход через игровой движок. Раньше клиент мог отправить «я выиграл» — больше нет. Все ходы проверяются через getLegalActions, очерёдность контролируется, gameOver определяет сервер.

**Рематч:** После онлайн-партии можно предложить рематч — сервер автоматически меняет стороны. Если оппонент принял — новая игра начинается мгновенно.

**Спектатор-режим:** В лобби появился раздел «Живые партии». Можно наблюдать за чужими играми в реальном времени — ходы, звуки, счёт.

**Публичные профили:** Клик по нику в лидерборде открывает карточку игрока: рейтинг, статистика, ачивки.

**Push-уведомления:** Когда таб в фоне — браузер покажет уведомление «Ваш ход!», «Ничья предложена» или «Рематч».

**Под капотом:** server.js разбит на 3 модуля (db.js, ws.js, server.js). Game.jsx декомпозирован. 84 хардкодных текста заменены на CMS-ключи.`,
      `Major server-side and online functionality update!

**Security:** Server now validates every move through the game engine. Previously a client could send "I won" — not anymore. All moves are checked via getLegalActions, turn order is enforced, gameOver is determined server-side.

**Rematch:** After an online game you can offer a rematch — server automatically swaps sides. If opponent accepts, new game starts instantly.

**Spectator mode:** The lobby now has a "Live games" section. Watch others play in real-time — moves, sounds, score.

**Public profiles:** Click a username in the leaderboard to view their player card: rating, stats, achievements.

**Push notifications:** When the tab is in background, browser shows notifications for "Your turn!", "Draw offered", "Rematch".

**Under the hood:** server.js split into 3 modules (db.js, ws.js, server.js). Game.jsx decomposed. 84 hardcoded texts replaced with CMS keys.`,
      'update', 1, 1
    )
  console.log('Блог: добавлен пост v3.4')
}

// ─── Блог-пост v3.5 ───
const blog35 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v3-5-gpu-neural-extreme'").get()
if (!blog35) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v3-5-gpu-neural-extreme',
    'v3.5 — GPU-нейросеть, экстрим, рематч, спектатор',
    'v3.5 — GPU neural network, extreme, rematch, spectator',
    `Самое большое обновление Snatch Highrise!

**GPU-нейросеть в браузере:** ResNet с 840K параметрами (93× больше предыдущей) теперь работает прямо в браузере. Обучена через 500 итераций self-play на NVIDIA GPU. AI стал значительно сильнее — каждая оценка позиции точнее.

**Экстрим-сложность:** Новый уровень — 600 GPU-симуляций. Самый сильный AI в игре. Сеть продолжает обучаться на партиях реальных игроков.

**Серверная валидация:** Сервер валидирует каждый ход через движок. Раньше клиент мог подменить результат — теперь gameOver определяет сервер.

**Рематч:** После онлайн-партии — кнопка рематча, сервер автоматически меняет стороны.

**Спектатор-режим:** В лобби «Живые партии» — наблюдайте за чужими играми в реальном времени.

**Публичные профили:** Клик по нику в лидерборде — карточка с рейтингом, статистикой и ачивками.

**Push-уведомления:** Браузер покажет «Ваш ход!» когда таб в фоне.

**Под капотом:** server.js → 3 модуля, Game.jsx декомпозирован, 84 текста на CMS.`,
    `The biggest Snatch Highrise update yet!

**GPU neural network in browser:** ResNet with 840K parameters (93× larger than previous) now runs directly in the browser. Trained through 500 iterations of self-play on NVIDIA GPU. AI is significantly stronger — each position evaluation is more accurate.

**Extreme difficulty:** New level — 600 GPU simulations. The strongest AI in the game. The network continues learning from real player games.

**Server-side validation:** Server validates every move through the game engine. Previously clients could fake results — now gameOver is determined server-side.

**Rematch:** After an online game — rematch button, server automatically swaps sides.

**Spectator mode:** "Live games" in lobby — watch others play in real-time.

**Public profiles:** Click username in leaderboard — player card with rating, stats, achievements.

**Push notifications:** Browser shows "Your turn!" when tab is in background.

**Under the hood:** server.js split into 3 modules, Game.jsx decomposed, 84 texts moved to CMS.`,
    'update', 1, 1
  )
  console.log('Блог: добавлен пост v3.5')
}

// ─── Блог-пост v4.5.0 ───
const blog4469 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-5-0-code-audit'").get()
if (!blog4469) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-5-0-code-audit',
    'v4.5.0 — Аудит кода, очистка, Node 22',
    'v4.5.0 — Code audit, cleanup, Node 22',
    `Технический аудит всей кодовой базы: сервер, клиент, CI/CD, инфраструктура.

**Node.js 22:** VPS обновлён с Node 20 на 22.22.2. Capacitor CLI требует 22+, CI уже использовал 22 — теперь всё синхронизировано. better-sqlite3 пересобран под новый ABI.

**–8.1MB из репо:** Удалён мёртвый gpu_weights.json — в коде загружается только бинарный формат gpu_weights.bin (3.3MB). JSON-копия весов не использовалась, но попадала в каждый билд.

**Мёртвый код:** Удалены дублированные 404 и error handlers в server.js (4 handler'а вместо 2), дублирующий setInterval очистки в middleware.js, фейковый aggregateRating из JSON-LD.

**PM2 оптимизация:** Переключён на fork mode — cluster mode с 1 инстансом и SQLite добавлял лишний overhead без пользы.

**Vite chunks:** AI-движок и chart-библиотеки выделены в отдельные чанки. Основной бандл стал легче, тяжёлые модули кешируются отдельно.

**ELO-график:** Добавлены линии рейтинг-тиров (1200/1500/1800) и точка текущего рейтинга. Визуально понятно, до какого ранга осталось расти.`,
    `Full code audit of the entire codebase: server, client, CI/CD, infrastructure.

**Node.js 22:** VPS upgraded from Node 20 to 22.22.2. Capacitor CLI requires 22+, CI already used 22 — now everything is in sync. better-sqlite3 rebuilt for new ABI.

**–8.1MB from repo:** Removed dead gpu_weights.json — code only loads binary gpu_weights.bin (3.3MB). The JSON copy was unused but included in every build.

**Dead code:** Removed duplicate 404 and error handlers in server.js (4 handlers instead of 2), duplicate setInterval cleanup in middleware.js, fake aggregateRating from JSON-LD.

**PM2 optimization:** Switched to fork mode — cluster mode with 1 instance and SQLite added overhead with no benefit.

**Vite chunks:** AI engine and chart libraries split into separate chunks. Main bundle is lighter, heavy modules cached separately.

**ELO chart:** Added rating tier lines (1200/1500/1800) and current rating dot. Visually clear how far to the next rank.`,
    'update', 1, 1
  )
  // Убираем pinned с предыдущих постов
  db.prepare("UPDATE blog_posts SET pinned=0 WHERE slug != 'v4-5-0-code-audit'").run()
  console.log('Блог: добавлен пост v4.5.0')
}

// ─── Блог-пост v4.5.1 ───
const blog451 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-5-1-virality'").get()
if (!blog451) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-5-1-virality',
    'v4.5.1 — Share-карточки и реферальная система',
    'v4.5.1 — Share cards and referral system',
    `Виральные фичи — чтобы игроки приводили игроков.

**Share-карточка:** После каждой партии можно поделиться красивой карточкой с результатом. На ней: имя игрока, рейтинг, изменение ELO, сложность AI, визуальное состояние стоек и брендинг. Работает через Canvas → PNG → Web Share API (или скачивание).

**Реферальная система:** У каждого игрока есть уникальный код и ссылка. Отправляете другу — он регистрируется по вашей ссылке, вы получаете +100 XP. В профиле новая вкладка «Пригласить»: ссылка, код, кнопка «Поделиться», количество приглашённых и заработанный XP.

**Как работает:** Ссылка вида snatch-highrise.com?ref=CODE. При переходе код сохраняется в localStorage. При регистрации — автоматически привязывается к аккаунту.`,
    `Viral features — so players bring more players.

**Share card:** After each game you can share a beautiful result card. It shows: player name, rating, ELO change, AI difficulty, visual stand state, and branding. Works via Canvas → PNG → Web Share API (or download).

**Referral system:** Every player gets a unique code and link. Send it to a friend — they register via your link, you get +100 XP. New "Invite" tab in profile: link, code, share button, referral count and earned XP.

**How it works:** Link format: snatch-highrise.com?ref=CODE. On visit, the code is saved to localStorage. On registration — automatically linked to the account.`,
    'update', 1, 1
  )
  db.prepare("UPDATE blog_posts SET pinned=0 WHERE slug NOT IN ('v4-5-1-virality')").run()
  console.log('Блог: добавлен пост v4.5.1')
}

// ─── Блог-пост v4.6.0 ───
const blog460 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-6-0-challenge-css'").get()
if (!blog460) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-6-0-challenge-css',
    'v4.6.0 — Вызов друзьям, CSS –81%, рефералы',
    'v4.6.0 — Friend Challenge, CSS –81%, referrals',
    `Большое обновление: социальные фичи + масштабный рефакторинг.

**Вызов друзьям:** Теперь можно бросить вызов конкретному другу из списка друзей. Кнопка «Вызвать» создаёт комнату, друг видит входящий вызов с таймером 5 минут. Принял — оба попадают в игру.

**Share-карточка:** После партии можно поделиться красивой карточкой (680×400) с именем, рейтингом, ELO-дельтой, сложностью AI и визуальным состоянием стоек. Шрифт Outfit, тёмный градиент, акцент-бар по результату.

**Реферальная система:** Уникальный код и ссылка для каждого игрока. Друг регистрируется по ссылке — вы получаете +100 XP. Новая вкладка «Пригласить» в профиле с копированием, шарингом и статистикой.

**CSS рефакторинг:** app.css разделён с 3093 до 595 строк (–81%). Создано 8 модулей: game.css (доска), landing.css, themes.css (10 тем), native.css (Capacitor) и др.

**Инфраструктура:** Node.js 22, HTTPS с HSTS, UFW firewall, SQLite бэкапы каждые 6 часов, PM2 fork mode, Vite chunk splitting.`,
    `Major update: social features + massive refactoring.

**Friend Challenge:** Challenge a specific friend from your friends list. The "Challenge" button creates a room, your friend sees an incoming challenge with a 5-minute timer. Accept — both enter the game.

**Share Card:** After a game, share a beautiful card (680×400) with name, rating, ELO delta, AI difficulty, and visual stand state. Outfit font, dark gradient, accent bar by result.

**Referral System:** Unique code and link for every player. Friend registers via your link — you get +100 XP. New "Invite" tab in profile with copy, share, and stats.

**CSS Refactor:** app.css split from 3093 to 595 lines (–81%). Created 8 modules: game.css (board), landing.css, themes.css (10 themes), native.css (Capacitor) etc.

**Infrastructure:** Node.js 22, HTTPS with HSTS, UFW firewall, SQLite backups every 6h, PM2 fork mode, Vite chunk splitting.`,
    'update', 1, 1
  )
  db.prepare("UPDATE blog_posts SET pinned=0 WHERE slug != 'v4-6-0-challenge-css'").run()
  console.log('Блог: добавлен пост v4.6.0')
}

// Убираем pinned с v3.4 (старый пост) + восстанавливаем оригинальное содержание
db.prepare("UPDATE blog_posts SET pinned=0, title_ru='v3.4 — Безопасность, спектатор, рематч и публичные профили', title_en='v3.4 — Security, spectator mode, rematch & public profiles' WHERE slug='v3-4-security-spectator'").run()

// ═══ Ачивки ═══
const ALL_ACHIEVEMENTS = [
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
  // v4.0
  { id: 'level_5', check: u => (u.level || 1) >= 5 },
  { id: 'level_10', check: u => (u.level || 1) >= 10 },
  { id: 'level_20', check: u => (u.level || 1) >= 20 },
]

// Ачивки требующие данные из других таблиц
const CROSS_TABLE_ACHIEVEMENTS = [
  { id: 'rush_5', check: userId => { const r = db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(userId); return (r?.best || 0) >= 5 } },
  { id: 'rush_15', check: userId => { const r = db.prepare('SELECT MAX(score) as best FROM puzzle_rush_scores WHERE user_id=?').get(userId); return (r?.best || 0) >= 15 } },
  { id: 'arena_join', check: userId => { const r = db.prepare('SELECT COUNT(*) as c FROM arena_participants WHERE user_id=?').get(userId); return (r?.c || 0) >= 1 } },
  { id: 'arena_top3', check: userId => {
    try {
      const ts = db.prepare('SELECT DISTINCT tournament_id FROM arena_participants WHERE user_id=?').all(userId)
      for (const t of ts) {
        const top = db.prepare('SELECT user_id FROM arena_participants WHERE tournament_id=? ORDER BY score DESC LIMIT 3').all(t.tournament_id)
        if (top.some(p => p.user_id === userId)) return true
      }
    } catch {}
    return false
  } },
]

export function checkAchievements(userId) {
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
  for (const ach of CROSS_TABLE_ACHIEVEMENTS) {
    if (!existing.includes(ach.id) && ach.check(userId)) {
      insert.run(userId, ach.id)
      newAch.push(ach.id)
    }
  }
  return newAch
}

export { bcrypt }
export { __dirname as serverDir }
