/**
 * Модуль базы данных — схема, сид-данные, ачивки, миграции
 * Экспортирует: db, JWT_SECRET, bcrypt, checkAchievements, __dirname
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
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
  const secretPath = resolve(__dirname, '.jwt-secret')
  if (existsSync(secretPath)) return readFileSync(secretPath, 'utf8').trim()
  const secret = 'stolbiki_dev_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  try { writeFileSync(secretPath, secret, { mode: 0o600 }) } catch {}
  return secret
})()
const DB_PATH = process.env.VITEST ? ':memory:' : (process.env.DB_PATH || './data/stolbiki.db')

if (DB_PATH !== ':memory:') {
  const dbDir = dirname(resolve(DB_PATH))
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })
}

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

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

  CREATE TABLE IF NOT EXISTS error_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT,
    stack TEXT,
    component TEXT,
    url TEXT,
    ua TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    room_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id)
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
    try { db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(version) } catch {}
  }
}

runMigration(1, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN fast_wins INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN online_wins INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN puzzles_solved INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT "default"') } catch {}
  try { db.exec('ALTER TABLE games ADD COLUMN is_online INTEGER DEFAULT 0') } catch {}
})

runMigration(2, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN best_login_streak INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN last_login_date TEXT') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN streak_freeze INTEGER DEFAULT 1') } catch {}
})

runMigration(3, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1') } catch {}
})

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
  const users = db.prepare('SELECT id, username FROM users WHERE referral_code IS NULL').all()
  const update = db.prepare('UPDATE users SET referral_code=? WHERE id=?')
  for (const u of users) {
    const code = u.username.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') + u.id.toString(36).toUpperCase()
    update.run(code, u.id)
  }
})

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

runMigration(6, () => {
  const cols = db.prepare("PRAGMA table_info(error_reports)").all().map(c => c.name)
  if (!cols.includes('message')) { try { db.exec('ALTER TABLE error_reports ADD COLUMN message TEXT') } catch {} }
  if (!cols.includes('component')) { try { db.exec('ALTER TABLE error_reports ADD COLUMN component TEXT') } catch {} }
  if (!cols.includes('ua')) { try { db.exec('ALTER TABLE error_reports ADD COLUMN ua TEXT') } catch {} }
  if (cols.includes('error')) { try { db.exec('UPDATE error_reports SET message = error WHERE message IS NULL AND error IS NOT NULL') } catch {} }
  if (cols.includes('user_agent')) { try { db.exec('UPDATE error_reports SET ua = user_agent WHERE ua IS NULL AND user_agent IS NOT NULL') } catch {} }
})

// Миграция 7: token_version для отзыва JWT
runMigration(7, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0') } catch {}
})

// Миграция 8: bricks + active_skin колонки в users (ранее try/catch в bricks.js)
runMigration(8, () => {
  try { db.exec("ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50") } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN active_skin_blocks TEXT NOT NULL DEFAULT 'blocks_classic'") } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN active_skin_stands TEXT NOT NULL DEFAULT 'stands_classic'") } catch {}
  // Индекс для быстрой проверки rate limit rewarded_ad (10/день)
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_brick_tx_reason ON brick_transactions(user_id, reason, created_at)") } catch {}
})

// Миграция 9: rush_best для ачивок Puzzle Rush
runMigration(9, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN rush_best INTEGER DEFAULT 0') } catch {}
})

console.log(`📦 Schema version: ${getSchemaVersion()}, миграций: 9`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_daily_logins_user ON daily_logins(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_daily_missions_user ON daily_missions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_replays_user ON replays(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_season_rewards_user ON season_rewards(user_id, season_id);
  CREATE INDEX IF NOT EXISTS idx_puzzle_rush_user ON puzzle_rush_scores(user_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_arena_parts_tournament ON arena_participants(tournament_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_arena_matches_tournament ON arena_matches(tournament_id, round);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    page TEXT,
    user_id INTEGER,
    session_id TEXT,
    meta TEXT,
    ip TEXT,
    ua TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event, created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_page ON analytics_events(page, created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    UNIQUE(user_id, date)
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE NOT NULL,
    platform TEXT DEFAULT 'android',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

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
  const siteSeed = [
    ['site.name', 'Перехват высотки', 'Highrise Heist', 'Название игры'],
    ['site.tagline', 'Стратегическая настолка с AI', 'Strategy board game powered by AI', 'Слоган / подзаголовок'],
    ['site.description', 'Стратегическая настольная игра с AI-противником на базе AlphaZero. Играйте онлайн, решайте головоломки, соревнуйтесь.', 'Strategy board game with AlphaZero AI. Play online, solve puzzles, compete.', 'Описание для поисковиков (meta)'],
    ['site.beta_text', 'Открытая бета — активная разработка', 'Open beta — active development', 'Текст под логотипом'],
    ['footer.tagline', 'Настольные игры и AI-исследования', 'Board games meet AI research', 'Подпись в футере'],
  ]
  for (const [key, ru, en, label] of siteSeed) ins.run(key, 'Сайт', ru, en, label)
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
  const i18nMap = { 'nav': 'Навигация', 'game': 'Игра', 'tournament': 'Турниры', 'online': 'Онлайн', 'daily': 'Ежедневный челлендж', 'puzzle': 'Головоломки', 'trainer': 'Тренер', 'swap': 'Swap / Баланс', 'replay': 'Повтор партии', 'tutorial': 'Обучение', 'header': 'Шапка сайта', 'common': 'Общее' }
  const i18nLabels = { 'nav.play': 'Меню: Играть', 'nav.online': 'Меню: Онлайн', 'nav.profile': 'Меню: Профиль', 'nav.rules': 'Меню: Правила', 'nav.puzzles': 'Меню: Головоломки', 'nav.simulator': 'Меню: Симулятор', 'nav.analytics': 'Меню: Аналитика', 'nav.replays': 'Меню: Реплеи', 'game.newGame': 'Кнопка «Новая игра»', 'game.confirm': 'Кнопка «Подтвердить»', 'game.reset': 'Кнопка «Сброс»', 'game.transfer': 'Кнопка «Сделать перенос»', 'game.cancelTransfer': 'Кнопка «Отменить перенос»', 'game.blue': 'Название: Синие', 'game.red': 'Название: Красные', 'game.victory': 'Текст: Победа', 'game.defeat': 'Текст: Поражение', 'game.aiWins': 'Текст: AI победил', 'game.gameOver': 'Текст: Игра окончена', 'game.place1': 'Подсказка: поставьте 1 блок', 'game.placeChips': 'Подсказка: расставьте блоки', 'game.aiThinking': 'Текст: AI думает', 'game.opponentTurn': 'Текст: Ход противника', 'game.timeUp': 'Текст: Время вышло', 'header.title': 'Логотип: название в шапке', 'tutorial.title': 'Заголовок обучения', 'common.online': 'Статус: Онлайн', 'common.offline': 'Статус: Оффлайн' }
  const i18nRu = { 'nav.play': 'Играть', 'nav.online': 'Онлайн', 'nav.profile': 'Профиль', 'nav.rules': 'Правила', 'nav.puzzles': 'Головоломки', 'nav.simulator': 'Симулятор', 'nav.analytics': 'Аналитика', 'nav.replays': 'Реплеи', 'game.newGame': 'Новая игра', 'game.confirm': 'Подтвердить', 'game.reset': 'Сброс', 'game.transfer': '↗ Сделать перенос', 'game.cancelTransfer': '✕ Отменить перенос', 'game.mode': 'Режим', 'game.vsAI': 'Против AI', 'game.pvp': 'Вдвоём', 'game.spectate': 'AI vs AI', 'game.side': 'Сторона', 'game.blue': 'Синие', 'game.red': 'Красные', 'game.blueFirst': 'Синие (первый ход)', 'game.redSwap': 'Красные (swap)', 'game.difficulty': 'Сложность', 'game.easy': 'Лёгкая', 'game.medium': 'Средняя', 'game.hard': 'Сложная', 'game.hints': 'Подсказки', 'game.trainer': 'Тренер', 'game.victory': 'Победа!', 'game.defeat': 'Поражение', 'game.aiWins': 'AI победил', 'game.blueWin': 'Синие победили!', 'game.redWin': 'Красные победили!', 'game.gameOver': 'Игра окончена', 'game.place1': 'Поставьте 1 блок', 'game.place1first': 'Ваш ход — поставьте 1 блок', 'game.placeChips': 'Расставьте блоки', 'game.clickStands': 'Кликайте на стойки', 'game.aiFirst': 'AI ходит первым...', 'game.aiThinking': 'AI думает...', 'game.opponentTurn': 'Ход противника', 'game.timeUp': 'Время вышло!', 'game.oppTimeUp': 'У соперника вышло время!', 'game.max2stands': 'Макс 2 стойки', 'game.allPlaced': 'Все блоки расставлены', 'game.undone': 'Ход отменён', 'game.yourTurn': 'ваш ход', 'game.pass': 'пас', 'game.swapDone': 'Swap выполнен — цвета поменялись', 'game.swapOnlineDone': 'Swap — вы теперь синие', 'game.selectTransferFrom': 'Выберите стойку для переноса', 'game.transferSelected': 'Перенос выбран, расставьте блоки', 'game.transferCancelled': 'Перенос отменён', 'game.swap': 'Swap — смена цветов', 'header.title': 'Перехват высотки', 'header.totalUsers': 'игроков', 'header.totalGames': 'партий', 'header.avgRating': 'ср. рейтинг', 'tutorial.title': 'Как играть', 'common.online': 'Онлайн', 'common.offline': 'Оффлайн', 'tournament.won': 'Турнир выигран!', 'tournament.lost': 'Турнир проигран', 'tournament.draw': 'Ничья в турнире', 'trainer.strong': 'Сильная позиция', 'trainer.slight': 'Небольшое преимущество', 'trainer.equal': 'Равная позиция', 'trainer.weak': 'Слабая позиция', 'trainer.bad': 'Плохая позиция' }
  const i18nEn = { 'nav.play': 'Play', 'nav.online': 'Online', 'nav.profile': 'Profile', 'nav.rules': 'Rules', 'nav.puzzles': 'Puzzles', 'nav.simulator': 'Simulator', 'nav.analytics': 'Analytics', 'nav.replays': 'Replays', 'game.newGame': 'New game', 'game.confirm': 'Confirm', 'game.reset': 'Reset', 'game.transfer': '↗ Transfer', 'game.cancelTransfer': '✕ Cancel transfer', 'game.mode': 'Mode', 'game.vsAI': 'vs AI', 'game.pvp': 'PvP', 'game.spectate': 'AI vs AI', 'game.side': 'Side', 'game.blue': 'Blue', 'game.red': 'Red', 'game.blueFirst': 'Blue (first move)', 'game.redSwap': 'Red (swap)', 'game.difficulty': 'Difficulty', 'game.easy': 'Easy', 'game.medium': 'Medium', 'game.hard': 'Hard', 'game.hints': 'Hints', 'game.trainer': 'Trainer', 'game.victory': 'Victory!', 'game.defeat': 'Defeat', 'game.aiWins': 'AI wins', 'game.blueWin': 'Blue wins!', 'game.redWin': 'Red wins!', 'game.gameOver': 'Game over', 'game.place1': 'Place 1 block', 'game.place1first': 'Your turn — place 1 block', 'game.placeChips': 'Place blocks', 'game.clickStands': 'Click stands to place', 'game.aiFirst': 'AI goes first...', 'game.aiThinking': 'AI thinking...', 'game.opponentTurn': "Opponent's turn", 'game.timeUp': 'Time up!', 'game.oppTimeUp': "Opponent's time is up!", 'game.max2stands': 'Max 2 stands', 'game.allPlaced': 'All blocks placed', 'game.undone': 'Move undone', 'game.yourTurn': 'your turn', 'game.pass': 'pass', 'game.swapDone': 'Swap done — colors changed', 'game.swapOnlineDone': 'Swap — you are now blue', 'game.selectTransferFrom': 'Select stand to transfer from', 'game.transferSelected': 'Transfer set, place blocks', 'game.transferCancelled': 'Transfer cancelled', 'game.swap': 'Swap colors', 'header.title': 'Highrise Heist', 'header.totalUsers': 'players', 'header.totalGames': 'games', 'header.avgRating': 'avg rating', 'tutorial.title': 'How to play', 'common.online': 'Online', 'common.offline': 'Offline', 'tournament.won': 'Tournament won!', 'tournament.lost': 'Tournament lost', 'tournament.draw': 'Tournament draw', 'trainer.strong': 'Strong position', 'trainer.slight': 'Slight advantage', 'trainer.equal': 'Equal position', 'trainer.weak': 'Weak position', 'trainer.bad': 'Bad position' }
  for (const key of Object.keys(i18nRu)) {
    const prefix = key.split('.')[0]
    const section = i18nMap[prefix] || 'Другое'
    const label = i18nLabels[key] || key
    ins.run(key, section, i18nRu[key], i18nEn[key] || '', label)
  }
  console.log('Контент сайта засеян: сайт + главная + i18n')
}

console.log('База данных готова:', DB_PATH)

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

// ─── Блог-посты ───
const blogExists = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v3-4-security-spectator'").get()
if (!blogExists) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('v3-4-security-spectator', 'v3.4 — Безопасность, спектатор, рематч и публичные профили', 'v3.4 — Security, spectator mode, rematch & public profiles',
      `Большое обновление серверной части и онлайн-функционала!\n\n**Безопасность:** Сервер теперь валидирует каждый ход через игровой движок.\n\n**Рематч:** После онлайн-партии можно предложить рематч.\n\n**Спектатор-режим:** В лобби появился раздел «Живые партии».\n\n**Публичные профили:** Клик по нику в лидерборде открывает карточку игрока.\n\n**Push-уведомления:** Когда таб в фоне — браузер покажет уведомление «Ваш ход!».\n\n**Под капотом:** server.js разбит на 3 модуля. Game.jsx декомпозирован. 84 хардкодных текста заменены на CMS-ключи.`,
      `Major server-side and online functionality update!\n\n**Security:** Server now validates every move through the game engine.\n\n**Rematch:** After an online game you can offer a rematch.\n\n**Spectator mode:** The lobby now has a "Live games" section.\n\n**Public profiles:** Click a username in the leaderboard to view their player card.\n\n**Push notifications:** When the tab is in background, browser shows notifications.\n\n**Under the hood:** server.js split into 3 modules. Game.jsx decomposed. 84 hardcoded texts replaced with CMS keys.`,
      'update', 0, 1)
  console.log('Блог: добавлен пост v3.4')
}

const blog35 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v3-5-gpu-neural-extreme'").get()
if (!blog35) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v3-5-gpu-neural-extreme', 'v3.5 — GPU-нейросеть, экстрим, рематч, спектатор', 'v3.5 — GPU neural network, extreme, rematch, spectator',
    `Самое большое обновление!\n\n**GPU-нейросеть в браузере:** ResNet с 840K параметрами (93× больше предыдущей).\n\n**Экстрим-сложность:** Новый уровень — 600 GPU-симуляций.\n\n**Серверная валидация:** Сервер валидирует каждый ход через движок.\n\n**Рематч, спектатор, публичные профили, push-уведомления.** Под капотом: server.js → 3 модуля, 84 текста на CMS.`,
    `The biggest update yet!\n\n**GPU neural network in browser:** ResNet with 840K parameters (93× larger).\n\n**Extreme difficulty:** New level — 600 GPU simulations.\n\n**Server-side validation:** Server validates every move.\n\n**Rematch, spectator, public profiles, push notifications.** Under the hood: server.js split into 3 modules, 84 texts to CMS.`,
    'update', 0, 1)
  console.log('Блог: добавлен пост v3.5')
}

const blog450 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-5-0-code-audit'").get()
if (!blog450) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-5-0-code-audit', 'v4.5.0 — Аудит кода, очистка, Node 22', 'v4.5.0 — Code audit, cleanup, Node 22',
    `Технический аудит всей кодовой базы.\n\n**Node.js 22:** VPS обновлён с Node 20 на 22.22.2.\n\n**–8.1MB из репо:** Удалён мёртвый gpu_weights.json.\n\n**Мёртвый код удалён.** PM2 fork mode. Vite chunks. ELO-график с тирами.`,
    `Full code audit.\n\n**Node.js 22:** VPS upgraded from Node 20 to 22.22.2.\n\n**–8.1MB from repo:** Removed dead gpu_weights.json.\n\n**Dead code removed.** PM2 fork mode. Vite chunks. ELO chart with tiers.`,
    'update', 0, 1)
  db.prepare("UPDATE blog_posts SET pinned=0").run()
  console.log('Блог: добавлен пост v4.5.0')
}

const blog451 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-5-1-virality'").get()
if (!blog451) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-5-1-virality', 'v4.5.1 — Share-карточки и реферальная система', 'v4.5.1 — Share cards and referral system',
    `Виральные фичи.\n\n**Share-карточка:** Canvas → PNG → Web Share API.\n\n**Реферальная система:** Уникальный код и ссылка. +100 XP за приглашённого друга.`,
    `Viral features.\n\n**Share card:** Canvas → PNG → Web Share API.\n\n**Referral system:** Unique code and link. +100 XP per invited friend.`,
    'update', 0, 1)
  console.log('Блог: добавлен пост v4.5.1')
}

const blog460 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-6-0-challenge-css'").get()
if (!blog460) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-6-0-challenge-css', 'v4.6.0 — Вызов друзьям, CSS –81%, рефералы', 'v4.6.0 — Friend Challenge, CSS –81%, referrals',
    `Большое обновление.\n\n**Вызов друзьям:** Кнопка «Вызвать» создаёт комнату с таймером 5 минут.\n\n**CSS рефакторинг:** app.css разделён с 3093 до 595 строк (–81%).\n\n**Реферальная система, share-карточка (680×400), Node.js 22, HTTPS, UFW, SQLite бэкапы каждые 6 часов.**`,
    `Major update.\n\n**Friend Challenge:** "Challenge" button creates a room with 5-minute timer.\n\n**CSS Refactor:** app.css split from 3093 to 595 lines (–81%).\n\n**Referral system, share card (680×400), Node.js 22, HTTPS, UFW, SQLite backups every 6h.**`,
    'update', 0, 1)
  console.log('Блог: добавлен пост v4.6.0')
}

const blog461 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-6-1-10m-spectator'").get()
if (!blog461) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-6-1-10m-spectator', 'v4.6.1 — 10M партий, spectator chat, сезонные награды', 'v4.6.1 — 10M games, spectator chat, season rewards',
    `Масштабное обновление.\n\n**10M self-play партий:** P0 36.35% vs P1 36.33% — идеальный баланс.\n\n**AI v5:** Checkpoint v1493, 840K параметров.\n\n**Spectator chat, сезонные награды top-10, +4 сложные головоломки.**`,
    `Major update.\n\n**10M self-play games:** P0 36.35% vs P1 36.33% — perfect balance.\n\n**AI v5:** Checkpoint v1493, 840K params.\n\n**Spectator chat, season rewards top-10, +4 hard puzzles.**`,
    'update', 0, 1)
  console.log('Блог: добавлен пост v4.6.1')
}

const blog462 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-6-2-analytics-gdpr'").get()
if (!blog462) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-6-2-analytics-gdpr', 'v4.6.2 — AI Impossible, Profile/Settings redesign, Legal', 'v4.6.2 — AI Impossible, Profile/Settings redesign, Legal',
    `Большое обновление.\n\n**AI Impossible:** 5000 MCTS симуляций (~6 сек). 99%+ побед против людей. Теперь 5 уровней.\n\n**Profile/Settings redesign.** Training data сбор. Privacy Policy, Terms of Service. Cookie consent. Landing redesign. 9 аналитических событий.`,
    `Major update.\n\n**AI Impossible:** 5000 MCTS simulations (~6 sec). 99%+ win rate vs humans. Now 5 levels.\n\n**Profile/Settings redesign.** Training data collection. Privacy Policy, Terms of Service. Cookie consent. Landing redesign. 9 analytics events.`,
    'update', 0, 1)
  console.log('Блог: добавлен пост v4.6.2')
}

const blog470 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v4-7-0-alphazero-android'").get()
if (!blog470) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'v4-7-0-alphazero-android', 'v4.7.0 — AlphaZero AI v7, Android, полный редизайн UX', 'v4.7.0 — AlphaZero AI v7, Android, full UX redesign',
    `Крупнейшее обновление.\n\n**AlphaZero AI v7:** policy+value архитектура (859K параметров). PUCT формула вместо UCB1.\n\n**5 уровней сложности:** Easy (50) → Medium (150) → Hard (400) → Extreme (800) → Impossible (1500).\n\n**Android-приложение:** Capacitor 8, 6 плагинов. Редизайн игры и лендинга. 52 строки мёртвого кода удалены.`,
    `The biggest update.\n\n**AlphaZero AI v7:** policy+value architecture (859K params). PUCT formula instead of UCB1.\n\n**5 difficulty levels:** Easy (50) → Medium (150) → Hard (400) → Extreme (800) → Impossible (1500).\n\n**Android app:** Capacitor 8, 6 plugins. Game and landing redesign. 52 lines of dead code removed.`,
    'update', 0, 1)
  db.prepare("UPDATE blog_posts SET pinned=0").run()
  console.log('Блог: добавлен пост v4.7.0')
}

// ─── Блог-пост v5.3.0 ───
const blog530 = db.prepare("SELECT id FROM blog_posts WHERE slug = 'v530-bugfixes'").get()
if (!blog530) {
  db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      'v530-bugfixes',
      'v5.3.0: Баг-фиксы CI/CD, /api/training, rewarded field',
      'v5.3.0: Bug fixes CI/CD, /api/training, rewarded field',
      `**🐛 Исправлен CI/CD**
deploy.yml использовал actions/checkout@v5 и setup-node@v5 — эти версии не существуют. Все деплои с момента создания CI падали на первом шаге. Исправлено на @v4.

**🐛 /api/training runtime error**
Переменная safeDifficulty была объявлена только внутри POST /api/games, в POST /api/training она была undefined. Все записи тренировочных данных содержали difficulty=0. Исправлено.

**🐛 rewarded field в /api/bricks/award-rewarded**
Ответ содержал amount но не rewarded — тест падал в CI. Теперь оба поля присутствуют.

**🗄 DB migration 8+9**
Колонки bricks, active_skin_blocks, active_skin_stands и rush_best теперь добавляются через proper versioned migration вместо try/catch в route-файлах. Добавлен индекс по (user_id, reason, created_at) для reward rate limit — ускоряет проверку лимита 10/день.`,
      `**🐛 Fixed CI/CD**
deploy.yml was using actions/checkout@v5 and setup-node@v5 — these versions don't exist. All deploys were failing on the first step. Fixed to @v4.

**🐛 /api/training runtime error**
Variable safeDifficulty was declared only inside POST /api/games, in POST /api/training it was undefined. All training data records had difficulty=0. Fixed.

**🐛 rewarded field in /api/bricks/award-rewarded**
Response had amount but not rewarded — test was failing in CI. Both fields now present.

**🗄 DB migration 8+9**
Columns bricks, active_skin_blocks, active_skin_stands and rush_best are now added via proper versioned migration instead of try/catch in route files. Added index on (user_id, reason, created_at) for reward rate limit.`,
      'release', 1, 1, '2026-04-14 12:00:00'
    )
  db.prepare("UPDATE blog_posts SET pinned=0 WHERE slug != 'v530-bugfixes'").run()
  console.log('Блог: добавлен пост v5.3.0')
}

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
  { id: 'level_5', check: u => (u.level || 1) >= 5 },
  { id: 'level_10', check: u => (u.level || 1) >= 10 },
  { id: 'level_20', check: u => (u.level || 1) >= 20 },
]

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
    if (!existing.includes(ach.id) && ach.check(user)) { insert.run(userId, ach.id); newAch.push(ach.id) }
  }
  for (const ach of CROSS_TABLE_ACHIEVEMENTS) {
    if (!existing.includes(ach.id) && ach.check(userId)) { insert.run(userId, ach.id); newAch.push(ach.id) }
  }
  return newAch
}

export { bcrypt }
export { __dirname as serverDir }
