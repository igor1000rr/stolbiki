/**
 * Модуль базы данных — схема, сид-данные, ачивки, миграции
 * Экспортирует: db, JWT_SECRET, bcrypt, checkAchievements, __dirname
 *
 * Блог-посты вынесены в server/blog-seed.js — новый релиз добавляется
 * одной записью в массив BLOG_POSTS, этот файл больше не трогается.
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { seedBlogPosts } from './blog-seed.js'

// Загрузка .env
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim()
  }
}

// Конфиг
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

runMigration(7, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0') } catch {}
})

runMigration(8, () => {
  try { db.exec("ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50") } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN active_skin_blocks TEXT NOT NULL DEFAULT 'blocks_classic'") } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN active_skin_stands TEXT NOT NULL DEFAULT 'stands_classic'") } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_brick_tx_reason ON brick_transactions(user_id, reason, created_at)") } catch {}
})

runMigration(9, () => {
  try { db.exec('ALTER TABLE users ADD COLUMN rush_best INTEGER DEFAULT 0') } catch {}
})

console.log('Schema version: ' + getSchemaVersion() + ', миграций: 9')

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

// Сидконтента CMS
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
  console.log('Контент сайта засеян')
}

console.log('База данных готова:', DB_PATH)

// Сидинг блог-постов — вынесен в server/blog-seed.js.
// Для нового релиза добавь запись в BLOG_POSTS и обнови PINNED_SLUG.
seedBlogPosts(db)

// Ачивки
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
