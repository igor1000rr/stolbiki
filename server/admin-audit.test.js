import { describe, it, expect, beforeEach } from 'vitest'
import { logAdminAction, getRecentAudit } from './admin-audit.js'
import { db } from './db.js'

function mkReq({ userId = 1, username = 'admin', ip = '1.2.3.4', xff = null } = {}) {
  const headers = xff ? { 'x-forwarded-for': xff } : {}
  return {
    user: userId ? { id: userId, username } : null,
    headers,
    socket: { remoteAddress: ip },
  }
}

beforeEach(() => {
  // Чистая таблица перед каждым тестом — audit шарится между vitest воркерами если разные файлы,
  // но в одном файле все тесты используют один in-memory db.
  db.prepare('DELETE FROM admin_audit').run()
})

describe('logAdminAction — basic write', () => {
  it('inserts a row with admin_id, action, target, metadata', () => {
    logAdminAction(mkReq({ userId: 42, username: 'igor' }), 'user_update', {
      targetType: 'user',
      targetId: 100,
      metadata: { field: 'rating', from: 1000, to: 2000 },
    })
    const rows = db.prepare('SELECT * FROM admin_audit').all()
    expect(rows.length).toBe(1)
    const r = rows[0]
    expect(r.admin_id).toBe(42)
    expect(r.admin_name).toBe('igor')
    expect(r.action).toBe('user_update')
    expect(r.target_type).toBe('user')
    expect(r.target_id).toBe(100)
    expect(JSON.parse(r.metadata).field).toBe('rating')
  })

  it('silently skips if req has no user (not throws)', () => {
    const req = { headers: {}, socket: {} }
    expect(() => logAdminAction(req, 'anything')).not.toThrow()
    expect(db.prepare('SELECT COUNT(*) as c FROM admin_audit').get().c).toBe(0)
  })

  it('silently skips if req.user has no id', () => {
    const req = { user: { username: 'x' }, headers: {}, socket: {} }
    expect(() => logAdminAction(req, 'anything')).not.toThrow()
    expect(db.prepare('SELECT COUNT(*) as c FROM admin_audit').get().c).toBe(0)
  })

  it('defaults admin_name to "unknown" when username missing', () => {
    logAdminAction({ user: { id: 1 }, headers: {}, socket: {} }, 'test_action')
    const r = db.prepare('SELECT admin_name FROM admin_audit').get()
    expect(r.admin_name).toBe('unknown')
  })

  it('uses x-forwarded-for IP when present (takes first in chain)', () => {
    logAdminAction(
      mkReq({ userId: 1, xff: '10.0.0.5, 10.0.0.1, 192.168.1.1' }),
      'test'
    )
    const r = db.prepare('SELECT ip FROM admin_audit').get()
    expect(r.ip).toBe('10.0.0.5')
  })

  it('falls back to socket.remoteAddress when no xff', () => {
    logAdminAction(mkReq({ userId: 1, ip: '127.0.0.1' }), 'test')
    const r = db.prepare('SELECT ip FROM admin_audit').get()
    expect(r.ip).toBe('127.0.0.1')
  })

  it('truncates metadata larger than 2000 chars', () => {
    const huge = 'x'.repeat(10000)
    logAdminAction(mkReq(), 'test', { metadata: { blob: huge } })
    const r = db.prepare('SELECT metadata FROM admin_audit').get()
    expect(r.metadata.length).toBeLessThanOrEqual(2000)
  })

  it('accepts targetId as string and coerces to number', () => {
    logAdminAction(mkReq(), 'test', { targetType: 'user', targetId: '42' })
    const r = db.prepare('SELECT target_id FROM admin_audit').get()
    expect(r.target_id).toBe(42)
  })

  it('invalid targetId (non-numeric string) stored as null', () => {
    logAdminAction(mkReq(), 'test', { targetType: 'user', targetId: 'not-a-number' })
    const r = db.prepare('SELECT target_id FROM admin_audit').get()
    expect(r.target_id).toBe(null)
  })

  it('null metadata stays null (no JSON stringify)', () => {
    logAdminAction(mkReq(), 'simple_action', { metadata: null })
    const r = db.prepare('SELECT metadata FROM admin_audit').get()
    expect(r.metadata).toBe(null)
  })
})

describe('getRecentAudit — filters and pagination', () => {
  beforeEach(() => {
    // 10 записей от 2 админов, 2 типа actions
    for (let i = 0; i < 5; i++) {
      logAdminAction(mkReq({ userId: 1, username: 'adm1' }), 'user_update', { targetId: i })
    }
    for (let i = 0; i < 5; i++) {
      logAdminAction(mkReq({ userId: 2, username: 'adm2' }), 'user_delete', { targetId: i + 100 })
    }
  })

  it('returns all with default limit', () => {
    const { rows, total } = getRecentAudit()
    expect(total).toBe(10)
    expect(rows.length).toBe(10)
  })

  it('filters by action', () => {
    const { rows, total } = getRecentAudit({ action: 'user_delete' })
    expect(total).toBe(5)
    expect(rows.every(r => r.action === 'user_delete')).toBe(true)
  })

  it('filters by adminId', () => {
    const { rows, total } = getRecentAudit({ adminId: 1 })
    expect(total).toBe(5)
    expect(rows.every(r => r.admin_id === 1)).toBe(true)
  })

  it('combined action + adminId filter', () => {
    const { rows, total } = getRecentAudit({ action: 'user_update', adminId: 1 })
    expect(total).toBe(5)
    expect(rows.every(r => r.admin_id === 1 && r.action === 'user_update')).toBe(true)
  })

  it('honours limit', () => {
    const { rows } = getRecentAudit({ limit: 3 })
    expect(rows.length).toBe(3)
  })

  it('honours offset', () => {
    const first = getRecentAudit({ limit: 5, offset: 0 }).rows
    const second = getRecentAudit({ limit: 5, offset: 5 }).rows
    expect(first[0].id).not.toBe(second[0].id)
  })

  it('clamps limit to [1, 500]', () => {
    expect(getRecentAudit({ limit: 0 }).limit).toBe(100) // 0 → fallback to 100
    expect(getRecentAudit({ limit: -5 }).limit).toBe(1)
    expect(getRecentAudit({ limit: 99999 }).limit).toBe(500)
  })

  it('orders DESC by created_at', () => {
    const { rows } = getRecentAudit({ limit: 10 })
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].created_at).toBeLessThanOrEqual(rows[i - 1].created_at)
    }
  })
})
