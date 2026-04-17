/**
 * Клубы / гильдии — REST API
 * Issue #8: Sprint 5 — Клубы
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS clubs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    tag          TEXT    NOT NULL UNIQUE,
    description  TEXT,
    emblem_id    TEXT    NOT NULL DEFAULT 'raccoon',
    owner_id     INTEGER NOT NULL,
    created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    member_count INTEGER NOT NULL DEFAULT 1,
    total_wins   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS club_members (
    club_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'member',
    joined_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (club_id, user_id),
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
  -- SECURITY: юзер может быть только в ОДНОМ клубе.
  -- Раньше PRIMARY KEY (club_id, user_id) допускал членство сразу в N клубах
  -- при race condition (параллельные /create с разными именами проходили
  -- проверку существующего членства одновременно). UNIQUE на user_id закрывает.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_club_members_user_unique ON club_members(user_id);
`)

const MAX_CLUB_MEMBERS = 50

const router = Router()

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50)
  const clubs = db.prepare(`
    SELECT c.id, c.name, c.tag, c.description, c.emblem_id, c.member_count, c.total_wins, c.created_at,
           u.username as owner_name
    FROM clubs c LEFT JOIN users u ON u.id = c.owner_id
    ORDER BY c.total_wins DESC, c.member_count DESC LIMIT ?
  `).all(limit)
  res.set('Cache-Control', 'public, max-age=15')
  res.json(clubs)
})

router.get('/my', auth, (req, res) => {
  const membership = db.prepare('SELECT club_id, role FROM club_members WHERE user_id=?').get(req.user.id)
  if (!membership) return res.json({ club: null })
  const club = db.prepare(`
    SELECT c.*, u.username as owner_name
    FROM clubs c LEFT JOIN users u ON u.id = c.owner_id
    WHERE c.id=?
  `).get(membership.club_id)
  res.json({ club, role: membership.role })
})

// POST /api/clubs — создать клуб
// SECURITY-ФИКС: вся операция (CHECK + INSERT clubs + INSERT membership) в одной
// транзакции. Раньше при race двух параллельных POST юзер оказывался в 2 клубах.
router.post('/', auth, (req, res) => {
  const { name, tag, description, emblem_id } = req.body
  if (!name || !tag) return res.status(400).json({ error: 'name и tag обязательны' })
  const cleanName = String(name).trim().slice(0, 32)
  const cleanTag = String(tag).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
  if (cleanName.length < 3) return res.status(400).json({ error: 'Название от 3 символов' })
  if (cleanTag.length < 2) return res.status(400).json({ error: 'Тег от 2 символов' })

  try {
    const tx = db.transaction(() => {
      const existing = db.prepare('SELECT 1 FROM club_members WHERE user_id=?').get(req.user.id)
      if (existing) {
        throw { _status: 409, _error: 'Вы уже состоите в клубе' }
      }
      const result = db.prepare(`
        INSERT INTO clubs (name, tag, description, emblem_id, owner_id)
        VALUES (?,?,?,?,?)
      `).run(cleanName, cleanTag, (description || '').slice(0, 200), emblem_id || 'raccoon', req.user.id)

      db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?,?,?)').run(result.lastInsertRowid, req.user.id, 'owner')
      return { id: result.lastInsertRowid, name: cleanName, tag: cleanTag }
    })
    const created = tx()
    res.json({ ok: true, ...created })
  } catch (e) {
    if (e?._status) return res.status(e._status).json({ error: e._error })
    if (e?.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Название или тег уже заняты, либо вы уже в клубе' })
    console.error('[clubs] create error:', e)
    res.status(500).json({ error: 'Ошибка создания клуба' })
  }
})

router.get('/:id', (req, res) => {
  const club = db.prepare(`
    SELECT c.*, u.username as owner_name
    FROM clubs c LEFT JOIN users u ON u.id = c.owner_id
    WHERE c.id=?
  `).get(req.params.id)
  if (!club) return res.status(404).json({ error: 'Клуб не найден' })

  const members = db.prepare(`
    SELECT cm.user_id, cm.role, cm.joined_at, u.username, u.rating, u.wins
    FROM club_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.club_id=?
    ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, u.rating DESC
  `).all(req.params.id)

  res.json({ ...club, members })
})

router.post('/:id/join', auth, (req, res) => {
  const clubId = parseInt(req.params.id, 10)
  if (!clubId) return res.status(400).json({ error: 'invalid id' })

  try {
    const tx = db.transaction(() => {
      const club = db.prepare('SELECT id, member_count FROM clubs WHERE id=?').get(clubId)
      if (!club) throw { _status: 404, _error: 'Клуб не найден' }

      const existing = db.prepare('SELECT 1 FROM club_members WHERE user_id=?').get(req.user.id)
      if (existing) throw { _status: 409, _error: 'Вы уже состоите в клубе' }

      // Пересчитываем реальное количество внутри транзакции — member_count может
      // дрейфовать из-за старых bugs, COUNT(*) — истина.
      const realCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?').get(clubId).c
      if (realCount >= MAX_CLUB_MEMBERS) throw { _status: 400, _error: `Клуб заполнен (макс. ${MAX_CLUB_MEMBERS})` }

      db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?,?,?)').run(clubId, req.user.id, 'member')
      db.prepare('UPDATE clubs SET member_count=? WHERE id=?').run(realCount + 1, clubId)
    })
    tx()
    res.json({ ok: true })
  } catch (e) {
    if (e?._status) return res.status(e._status).json({ error: e._error })
    if (e?.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Вы уже состоите в клубе' })
    console.error('[clubs] join error:', e)
    res.status(500).json({ error: 'Ошибка вступления' })
  }
})

router.post('/:id/leave', auth, (req, res) => {
  const clubId = parseInt(req.params.id, 10)
  if (!clubId) return res.status(400).json({ error: 'invalid id' })

  try {
    const tx = db.transaction(() => {
      const membership = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?').get(clubId, req.user.id)
      if (!membership) throw { _status: 404, _error: 'Вы не в этом клубе' }

      let disbanded = false

      if (membership.role === 'owner') {
        const nextMember = db.prepare(`
          SELECT user_id FROM club_members
          WHERE club_id=? AND user_id!=?
          ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END, joined_at ASC LIMIT 1
        `).get(clubId, req.user.id)

        if (nextMember) {
          db.prepare('UPDATE club_members SET role=? WHERE club_id=? AND user_id=?').run('owner', clubId, nextMember.user_id)
          db.prepare('UPDATE clubs SET owner_id=? WHERE id=?').run(nextMember.user_id, clubId)
        } else {
          db.prepare('DELETE FROM clubs WHERE id=?').run(clubId)
          disbanded = true
          return { disbanded }
        }
      }

      db.prepare('DELETE FROM club_members WHERE club_id=? AND user_id=?').run(clubId, req.user.id)
      const realCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?').get(clubId).c
      db.prepare('UPDATE clubs SET member_count=? WHERE id=?').run(realCount, clubId)
      return { disbanded }
    })
    const result = tx()
    res.json({ ok: true, ...(result.disbanded ? { disbanded: true } : {}) })
  } catch (e) {
    if (e?._status) return res.status(e._status).json({ error: e._error })
    console.error('[clubs] leave error:', e)
    res.status(500).json({ error: 'Ошибка выхода' })
  }
})

router.delete('/:id/kick/:uid', auth, (req, res) => {
  const clubId = parseInt(req.params.id, 10)
  const targetId = parseInt(req.params.uid, 10)
  if (!clubId || !targetId) return res.status(400).json({ error: 'invalid ids' })
  if (targetId === req.user.id) return res.status(400).json({ error: 'Нельзя кикнуть себя (используйте /leave)' })

  try {
    const tx = db.transaction(() => {
      const myRole = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?').get(clubId, req.user.id)
      if (!myRole || !['owner', 'officer'].includes(myRole.role)) {
        throw { _status: 403, _error: 'Недостаточно прав' }
      }
      const targetRole = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?').get(clubId, targetId)
      if (!targetRole) throw { _status: 404, _error: 'Участник не найден' }
      if (targetRole.role === 'owner') throw { _status: 403, _error: 'Нельзя кикнуть владельца' }
      if (myRole.role === 'officer' && targetRole.role === 'officer') {
        throw { _status: 403, _error: 'Офицер не может кикнуть офицера' }
      }

      db.prepare('DELETE FROM club_members WHERE club_id=? AND user_id=?').run(clubId, targetId)
      const realCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?').get(clubId).c
      db.prepare('UPDATE clubs SET member_count=? WHERE id=?').run(realCount, clubId)
    })
    tx()
    res.json({ ok: true })
  } catch (e) {
    if (e?._status) return res.status(e._status).json({ error: e._error })
    console.error('[clubs] kick error:', e)
    res.status(500).json({ error: 'Ошибка кика' })
  }
})

router.put('/:id/role/:uid', auth, (req, res) => {
  const clubId = parseInt(req.params.id, 10)
  const targetId = parseInt(req.params.uid, 10)
  if (!clubId || !targetId) return res.status(400).json({ error: 'invalid ids' })
  if (targetId === req.user.id) return res.status(400).json({ error: 'Нельзя менять свою роль' })

  const myRole = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?').get(clubId, req.user.id)
  if (!myRole || myRole.role !== 'owner') return res.status(403).json({ error: 'Только владелец' })
  const { role } = req.body
  if (!['officer', 'member'].includes(role)) return res.status(400).json({ error: 'role: officer | member' })
  const upd = db.prepare('UPDATE club_members SET role=? WHERE club_id=? AND user_id=? AND role != ?').run(role, clubId, targetId, 'owner')
  if (upd.changes === 0) return res.status(404).json({ error: 'Участник не найден или роль не изменилась' })
  res.json({ ok: true })
})

export default router
