/**
 * Входная точка базы данных.
 *
 * Содержит только инициализацию и схему. Остальное вынесено:
 *  - migrations.js   — версионированные ALTER'ы
 *  - achievements.js — определения и checkAchievements
 *  - seeds/cms.js    — сид site_content (site/landing/i18n)
 *  - blog-seed.js    — блог-посты
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { runMigrations } from './migrations.js'
import { initAchievements, checkAchievements } from './achievements.js'
import { seedCms } from './seeds/cms.js'
import { seedBlogPosts } from './blog-seed.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim()
  }
}

export const PORT = process.env.PORT || 3001
export const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('ОШИБКА: JWT_SECRET не задан! Установите в .env')
    process.exit(1)
  }
  if (process.env.VITEST) {
    return 'stolbiki_test_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
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

// Базовая схема.
//
// ВАЖНО: все колонки которые миграции 1-11 пытаются добавить через ALTER TABLE включены
// прямо в CREATE TABLE users. Причина: SQLite не поддерживает `ALTER TABLE ADD COLUMN ... UNIQUE`
// (документированное ограничение) — миграция 4 (referral_code TEXT UNIQUE) молча падала в
// try/catch, помечалась выполненной, и register крашился с "no such column: referral_code".
//
// На проде это работало потому что БД создана с древних версий где схема миграций накатывалась
// успешно (возможно более старый better-sqlite3 был мягче). В :memory: и на fresh install
// падало. CREATE TABLE IF NOT EXISTS не тронет существующую таблицу на проде, так что безопасно.
//
// ВАЖНО 2: все CREATE TABLE ДО CREATE INDEX ссылающихся на них.
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
    last_seen TEXT DEFAULT (datetime('now')),
    -- migration 1
    fast_wins INTEGER DEFAULT 0,
    online_wins INTEGER DEFAULT 0,
    puzzles_solved INTEGER DEFAULT 0,
    avatar TEXT DEFAULT 'default',
    -- migration 2
    login_streak INTEGER DEFAULT 0,
    best_login_streak INTEGER DEFAULT 0,
    last_login_date TEXT,
    streak_freeze INTEGER DEFAULT 1,
    -- migration 3
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    -- migration 4 (UNIQUE не работает через ALTER — только здесь)
    referral_code TEXT UNIQUE,
    referred_by INTEGER,
    -- migration 7
    token_version INTEGER DEFAULT 0,
    -- migration 8
    bricks INTEGER NOT NULL DEFAULT 50,
    active_skin_blocks TEXT NOT NULL DEFAULT 'blocks_classic',
    active_skin_stands TEXT NOT NULL DEFAULT 'stands_classic',
    -- migration 9
    rush_best INTEGER DEFAULT 0,
    -- migration 10
    onboarding_done INTEGER DEFAULT 0,
    -- migration 11
    gr_games INTEGER DEFAULT 0,
    gr_wins INTEGER DEFAULT 0,
    gr_center_captures INTEGER DEFAULT 0
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
    rating_before INTEGER, rating_after INTEGER, rating_delta INTEGER,
    difficulty INTEGER,
    closed_golden INTEGER DEFAULT 0,
    is_comeback INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'ai',
    turns INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    played_at TEXT DEFAULT (datetime('now')),
    is_online INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );
  CREATE TABLE IF NOT EXISTS error_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, message TEXT, stack TEXT, component TEXT, url TEXT, ua TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
    room_id TEXT, status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, game_data TEXT NOT NULL,
    winner INTEGER, total_moves INTEGER, mode TEXT, difficulty INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    xp_rewarded INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(referred_id),
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_ru TEXT NOT NULL, title_en TEXT,
    body_ru TEXT NOT NULL, body_en TEXT,
    tag TEXT DEFAULT 'update', pinned INTEGER DEFAULT 0, published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS season_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, season_id INTEGER NOT NULL,
    rating INTEGER DEFAULT 1000, games INTEGER DEFAULT 0, wins INTEGER DEFAULT 0,
    UNIQUE(user_id, season_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id)
  );
  CREATE TABLE IF NOT EXISTS rating_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, rating INTEGER NOT NULL, delta INTEGER NOT NULL,
    game_id INTEGER, created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    section TEXT NOT NULL DEFAULT 'general',
    value_ru TEXT NOT NULL DEFAULT '',
    value_en TEXT NOT NULL DEFAULT '',
    label TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
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
    puzzle_type TEXT NOT NULL, puzzle_id TEXT NOT NULL,
    solved INTEGER DEFAULT 0, moves_used INTEGER, duration INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, puzzle_type, puzzle_id)
  );
  CREATE TABLE IF NOT EXISTS daily_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, date TEXT NOT NULL,
    UNIQUE(user_id, date)
  );
  CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, token TEXT UNIQUE NOT NULL,
    platform TEXT DEFAULT 'android',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS replays (
    id TEXT PRIMARY KEY,
    user_id INTEGER, moves TEXT NOT NULL, result INTEGER, score TEXT,
    mode TEXT DEFAULT 'ai', turns INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS daily_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, date TEXT NOT NULL, mission_id TEXT NOT NULL,
    progress INTEGER DEFAULT 0, target INTEGER NOT NULL,
    completed INTEGER DEFAULT 0, xp_reward INTEGER DEFAULT 50,
    UNIQUE(user_id, date, mission_id)
  );
  CREATE TABLE IF NOT EXISTS puzzle_rush_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, score INTEGER NOT NULL,
    solved INTEGER DEFAULT 0, time_ms INTEGER DEFAULT 180000,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS arena_tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'waiting', rounds INTEGER DEFAULT 4,
    current_round INTEGER DEFAULT 0, max_players INTEGER DEFAULT 16,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT, finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS arena_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL, user_id INTEGER NOT NULL, username TEXT NOT NULL,
    score REAL DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, draws INTEGER DEFAULT 0,
    buchholz REAL DEFAULT 0,
    UNIQUE(tournament_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS arena_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL, round INTEGER NOT NULL,
    player1_id INTEGER NOT NULL, player2_id INTEGER,
    winner_id INTEGER, result TEXT, room_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL, page TEXT, user_id INTEGER, session_id TEXT,
    meta TEXT, ip TEXT, ua TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS season_rewards (
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
  );
  CREATE TABLE IF NOT EXISTS brick_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref_id INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS user_skins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    skin_id TEXT NOT NULL,
    purchased_at INTEGER NOT NULL,
    UNIQUE(user_id, skin_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS gr_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    players TEXT NOT NULL,
    teams TEXT,
    winner INTEGER,
    scores TEXT NOT NULL,
    turns INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    resigned_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id, played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
  CREATE INDEX IF NOT EXISTS idx_training_user ON training_data(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_season_ratings_season ON season_ratings(season_id, rating DESC);
  CREATE INDEX IF NOT EXISTS idx_daily_seed_score ON daily_results(seed, turns ASC, duration ASC);
  CREATE INDEX IF NOT EXISTS idx_puzzle_user_solved ON puzzle_results(user_id, solved);
  CREATE INDEX IF NOT EXISTS idx_daily_logins_user ON daily_logins(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_daily_missions_user ON daily_missions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_replays_user ON replays(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_season_rewards_user ON season_rewards(user_id, season_id);
  CREATE INDEX IF NOT EXISTS idx_puzzle_rush_user ON puzzle_rush_scores(user_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_arena_parts_tournament ON arena_participants(tournament_id, score DESC);
  CREATE INDEX IF NOT EXISTS idx_arena_matches_tournament ON arena_matches(tournament_id, round);
  CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event, created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_page ON analytics_events(page, created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
  CREATE INDEX IF NOT EXISTS idx_brick_tx_reason ON brick_transactions(user_id, reason, created_at);
  CREATE INDEX IF NOT EXISTS idx_gr_matches_created ON gr_matches(created_at);
  CREATE INDEX IF NOT EXISTS idx_gr_matches_mode ON gr_matches(mode, created_at);
`)

// На проде brick_transactions могла быть создана без ref_id — добавляем колонку через ALTER
// если её нет (идемпотентно). Для fresh :memory: и fresh прод она уже в CREATE TABLE.
try {
  const cols = db.prepare('PRAGMA table_info(brick_transactions)').all().map(c => c.name)
  if (!cols.includes('ref_id')) db.exec('ALTER TABLE brick_transactions ADD COLUMN ref_id INTEGER')
} catch {}

runMigrations(db)
seedCms(db)
seedBlogPosts(db)
initAchievements(db)

if (!process.env.VITEST) console.log('База данных готова:', DB_PATH)

export { bcrypt, checkAchievements }
export { __dirname as serverDir }
