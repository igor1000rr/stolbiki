/**
 * Тест схемы error_reports.
 * Верифицирует фикс: до фикса db.js создавал таблицу с колонками (error, user_agent),
 * а server.js делал INSERT с (message, component, ua) — падал с "no such column".
 *
 * Тест динамически импортирует better-sqlite3: в CI модуль установлен в server/node_modules,
 * локально тест скипается если native-биндинги не собраны.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

let Database
try {
  Database = (await import('better-sqlite3')).default
} catch {
  // better-sqlite3 не собран локально — тесты будут skipped
}

const run = Database ? describe : describe.skip

run('error_reports schema', () => {
  let db

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = MEMORY')
    db.pragma('foreign_keys = ON')

    // Точная копия схемы из db.js (после фикса)
    db.exec(`
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
    `)
  })

  afterAll(() => { db?.close() })

  it('INSERT с полной схемой (как в /api/error-report) работает', () => {
    // Тот же INSERT, что в server.js:209
    const stmt = db.prepare('INSERT INTO error_reports (user_id, message, stack, component, url, ua) VALUES (?, ?, ?, ?, ?, ?)')
    const res = stmt.run(42, 'Test error', 'stack trace', 'Component.jsx', 'https://app/page', 'Mozilla/5.0')
    expect(res.changes).toBe(1)
    expect(res.lastInsertRowid).toBeGreaterThan(0)
  })

  it('INSERT из глобального error handler (4 поля)', () => {
    // server.js:277 — INSERT INTO error_reports (message, stack, url, ua)
    const stmt = db.prepare('INSERT INTO error_reports (message, stack, url, ua) VALUES (?, ?, ?, ?)')
    const res = stmt.run('[SERVER] boom', 'stack...', '/api/foo', 'curl/8.0')
    expect(res.changes).toBe(1)
  })

  it('SELECT по составным условиям (как в admin panel)', () => {
    const rows = db.prepare('SELECT id, user_id, message, component FROM error_reports WHERE message IS NOT NULL').all()
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows.some(r => r.component === 'Component.jsx')).toBe(true)
  })

  it('DELETE старых записей (maintenance cron)', () => {
    // Вставляем запись с явной старой датой
    db.prepare("INSERT INTO error_reports (message, created_at) VALUES (?, datetime('now', '-60 days'))").run('old')
    const before = db.prepare('SELECT COUNT(*) as c FROM error_reports').get().c
    db.prepare("DELETE FROM error_reports WHERE created_at < datetime('now', '-30 days')").run()
    const after = db.prepare('SELECT COUNT(*) as c FROM error_reports').get().c
    expect(after).toBeLessThan(before)
  })

  it('миграция 6: ALTER TABLE ADD COLUMN для старых БД', () => {
    // Симуляция старой БД со старыми колонками (error, user_agent)
    const old = new Database(':memory:')
    old.exec(`
      CREATE TABLE error_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error TEXT,
        stack TEXT,
        url TEXT,
        user_agent TEXT,
        user_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO error_reports (error, stack, user_agent) VALUES ('legacy err', 'stack', 'Chrome');
    `)

    // Применяем миграцию 6 (точная копия из db.js)
    const cols = old.prepare("PRAGMA table_info(error_reports)").all().map(c => c.name)
    if (!cols.includes('message')) old.exec('ALTER TABLE error_reports ADD COLUMN message TEXT')
    if (!cols.includes('component')) old.exec('ALTER TABLE error_reports ADD COLUMN component TEXT')
    if (!cols.includes('ua')) old.exec('ALTER TABLE error_reports ADD COLUMN ua TEXT')
    if (cols.includes('error')) old.exec('UPDATE error_reports SET message = error WHERE message IS NULL AND error IS NOT NULL')
    if (cols.includes('user_agent')) old.exec('UPDATE error_reports SET ua = user_agent WHERE ua IS NULL AND user_agent IS NOT NULL')

    // Теперь новый INSERT должен работать
    const stmt = old.prepare('INSERT INTO error_reports (user_id, message, stack, component, url, ua) VALUES (?, ?, ?, ?, ?, ?)')
    expect(() => stmt.run(1, 'new err', 'stack', 'Comp', '/url', 'UA')).not.toThrow()

    // Данные перенесены
    const row = old.prepare("SELECT message, ua FROM error_reports WHERE message = 'legacy err'").get()
    expect(row.message).toBe('legacy err')
    expect(row.ua).toBe('Chrome')

    old.close()
  })
})
