/**
 * Schema migrations runner. Каждая миграция — атомарная, идемпотентная.
 * Версия записывается в schema_version после успеха.
 *
 * Новая миграция = добавить migrate(N+1, () => {...}) в конец runMigrations.
 */

export function runMigrations(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)')

  const getVersion = () => db.prepare('SELECT MAX(version) as v FROM schema_version').get()?.v || 0
  const markDone = v => { try { db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(v) } catch {} }

  function migrate(version, fn) {
    if (getVersion() >= version) return
    try { fn() } catch { /* ALTER's catch their own errors */ }
    markDone(version)
  }

  migrate(1, () => {
    try { db.exec('ALTER TABLE users ADD COLUMN fast_wins INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN online_wins INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN puzzles_solved INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT "default"') } catch {}
    try { db.exec('ALTER TABLE games ADD COLUMN is_online INTEGER DEFAULT 0') } catch {}
  })

  migrate(2, () => {
    try { db.exec('ALTER TABLE users ADD COLUMN login_streak INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN best_login_streak INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN last_login_date TEXT') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN streak_freeze INTEGER DEFAULT 1') } catch {}
  })

  migrate(3, () => {
    try { db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1') } catch {}
  })

  migrate(4, () => {
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

  migrate(5, () => {
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

  migrate(6, () => {
    const cols = db.prepare('PRAGMA table_info(error_reports)').all().map(c => c.name)
    if (!cols.includes('message')) { try { db.exec('ALTER TABLE error_reports ADD COLUMN message TEXT') } catch {} }
    if (!cols.includes('component')) { try { db.exec('ALTER TABLE error_reports ADD COLUMN component TEXT') } catch {} }
    if (!cols.includes('ua')) { try { db.exec('ALTER TABLE error_reports ADD COLUMN ua TEXT') } catch {} }
    if (cols.includes('error')) { try { db.exec('UPDATE error_reports SET message = error WHERE message IS NULL AND error IS NOT NULL') } catch {} }
    if (cols.includes('user_agent')) { try { db.exec('UPDATE error_reports SET ua = user_agent WHERE ua IS NULL AND user_agent IS NOT NULL') } catch {} }
  })

  migrate(7, () => {
    try { db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0') } catch {}
  })

  migrate(8, () => {
    try { db.exec("ALTER TABLE users ADD COLUMN bricks INTEGER NOT NULL DEFAULT 50") } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN active_skin_blocks TEXT NOT NULL DEFAULT 'blocks_classic'") } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN active_skin_stands TEXT NOT NULL DEFAULT 'stands_classic'") } catch {}
    try { db.exec('CREATE INDEX IF NOT EXISTS idx_brick_tx_reason ON brick_transactions(user_id, reason, created_at)') } catch {}
  })

  migrate(9, () => {
    try { db.exec('ALTER TABLE users ADD COLUMN rush_best INTEGER DEFAULT 0') } catch {}
  })

  // Флаг прохождения обучающей партии. Идемпотентность награды построена на нём.
  migrate(10, () => {
    try { db.exec('ALTER TABLE users ADD COLUMN onboarding_done INTEGER DEFAULT 0') } catch {}
  })

  // Golden Rush матчи + per-user счётчики.
  migrate(11, () => {
    db.exec(`CREATE TABLE IF NOT EXISTS gr_matches (
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
    )`)
    db.exec('CREATE INDEX IF NOT EXISTS idx_gr_matches_created ON gr_matches(created_at)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_gr_matches_mode ON gr_matches(mode, created_at)')

    try { db.exec('ALTER TABLE users ADD COLUMN gr_games INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN gr_wins INTEGER DEFAULT 0') } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN gr_center_captures INTEGER DEFAULT 0') } catch {}
  })

  // Скины фонов. Колонка на users + сид фонов в skins делается в bricks.js.
  migrate(12, () => {
    try { db.exec("ALTER TABLE users ADD COLUMN active_skin_background TEXT NOT NULL DEFAULT 'bg_city_day'") } catch {}
  })

  console.log('Schema version: ' + getVersion() + ', миграций: 12')
}
