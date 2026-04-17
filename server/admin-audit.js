/**
 * Admin Audit — трейс всех критичных admin-действий.
 *
 * Использование:
 *   import { logAdminAction } from '../admin-audit.js'
 *   logAdminAction(req, 'user_update', { targetType: 'user', targetId: 123, metadata: { field: 'rating', from: 1000, to: 2000 } })
 *
 * Почему важно: компрометация одного admin-аккаунта = компрометация
 * всей админки, включая возможность сделать новых админов (PUT /users/:id {is_admin:true}).
 * Без audit-лога невозможно узнать что было сделано и кем.
 */

import { db } from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER NOT NULL,
    admin_name TEXT    NOT NULL,
    action     TEXT    NOT NULL,
    target_type TEXT,
    target_id   INTEGER,
    metadata    TEXT,
    ip          TEXT,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit(admin_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit(action, created_at DESC);
`)

const insertStmt = db.prepare(`
  INSERT INTO admin_audit (admin_id, admin_name, action, target_type, target_id, metadata, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

/**
 * @param {import('express').Request} req
 * @param {string} action  — short snake_case name: user_update, user_delete, chat_mute, etc.
 * @param {Object} [opts]
 * @param {string} [opts.targetType]
 * @param {number|string} [opts.targetId]
 * @param {Object} [opts.metadata]  — произвольные детали, JSON-сериализуется и тримится до 2000 символов
 */
export function logAdminAction(req, action, { targetType = null, targetId = null, metadata = null } = {}) {
  try {
    const adminId = req?.user?.id
    const adminName = req?.user?.username || 'unknown'
    if (!adminId) return
    const xff = req.headers?.['x-forwarded-for']
    const ip = (typeof xff === 'string' ? xff.split(',')[0].trim() : null) || req.socket?.remoteAddress || null
    const metaStr = metadata ? JSON.stringify(metadata).slice(0, 2000) : null
    const tid = (targetId === null || targetId === undefined) ? null : (Number.isFinite(+targetId) ? +targetId : null)
    insertStmt.run(adminId, adminName, action, targetType, tid, metaStr, ip)
  } catch (e) {
    console.error('[admin-audit] log error:', e.message)
  }
}

/**
 * Выборка последних записей (для GET /api/admin/audit).
 */
export function getRecentAudit({ limit = 100, offset = 0, action = null, adminId = null } = {}) {
  const lim = Math.min(500, Math.max(1, +limit || 100))
  const off = Math.max(0, +offset || 0)
  let sql = 'SELECT id, admin_id, admin_name, action, target_type, target_id, metadata, ip, created_at FROM admin_audit'
  const where = []
  const params = []
  if (action) { where.push('action = ?'); params.push(action) }
  if (adminId) { where.push('admin_id = ?'); params.push(+adminId) }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(lim, off)
  const rows = db.prepare(sql).all(...params)
  const totalRow = db.prepare(
    where.length
      ? `SELECT COUNT(*) as c FROM admin_audit WHERE ${where.join(' AND ')}`
      : 'SELECT COUNT(*) as c FROM admin_audit'
  ).get(...params.slice(0, params.length - 2))
  return { rows, total: totalRow?.c || 0, limit: lim, offset: off }
}
