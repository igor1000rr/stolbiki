/**
 * Клубы / гильдии — REST API
 * Issue #8: Sprint 5 — Клубы
 *
 * Таблицы: clubs, club_members
 *
 * Эндпоинты:
 *   GET    /api/clubs              — список клубов (топ по wins)
 *   POST   /api/clubs              — создать клуб
 *   GET    /api/clubs/my           — мой клуб
 *   GET    /api/clubs/:id          — детали клуба + члены
 *   POST   /api/clubs/:id/join     — вступить
 *   POST   /api/clubs/:id/leave    — выйти
 *   DELETE /api/clubs/:id/kick/:uid — кикнуть (owner/officer)
 */

import { Router } from 'express'
import { db } from '../db.js'
import { auth } from '../middleware.js'

// ─── Миграция ───
// SECURITY-ФИКС: UNIQUE индекс на user_id в club_members гарантирует что юзер
// может быть только в одном клубе — раньше при race-условии юзер мог числиться
// в двух клубах одновременно (в POST / и POST /:id/join проверка existing и
// INSERT не были атомарными).
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
`)

// UNIQUE на user_id создаём отдельно с try/catch — если в legacy-данных уже
// есть дубликаты (юзер в 2 клубах), индекс не создастся, но сервер не падает.
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_club_members_user_unique ON club_members(user_id)`)
} catch (e) {
  console.warn('[clubs] UNIQUE index on user_id not created:', e.message)
}

const router = Router()

// ─── GET /api/clubs — топ клубов ───
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

// ─── GET /api/clubs/my — мой клуб ───
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

// ─── POST /api/clubs — создать клуб ───
// SECURITY-ФИКС: INSERT clubs + INSERT club_members обёрнуты в db.transaction() —
// если второй INSERT падает (UNIQUE на user_id), клуб не создаётся.
router.post('/', auth, (req, res) => {
  const { name, tag, description, emblem_id } = req.body
  if (!name || !tag) return res.status(400).json({ error: 'name и tag обязательны' })
  const cleanName = String(name).trim().slice(0, 32)
  const cleanTag = String(tag).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
  if (cleanName.length < 3) return res.status(400).json({ error: 'Название от 3 символов' })
  if (cleanTag.length < 2) return res.status(400).json({ error: 'Тег от 2 символов' })

  try {
    const clubId = db.transaction(() => {
      const existing = db.prepare('SELECT 1 FROM club_members WHERE user_id=?').get(req.user.id)
      if (existing) {
        const err = new Error('already_in_club')
        err.code = 'ALREADY_IN_CLUB'
        throw err
      }
      const result = db.prepare(`
        INSERT INTO clubs (name, tag, description, emblem_id, owner_id)
        VALUES (?,?,?,?,?)
      `).run(cleanName, cleanTag, (description || '').slice(0, 200), emblem_id || 'raccoon', req.user.id)
      db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?,?,?)')
        .run(result.lastInsertRowid, req.user.id, 'owner')
      return result.lastInsertRowid
    })()
    res.json({ ok: true, id: clubId, name: cleanName, tag: cleanTag })
  } catch (e) {
    if (e.code === 'ALREADY_IN_CLUB') return res.status(409).json({ error: 'Вы уже состоите в клубе' })
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Название или тег уже заняты' })
    res.status(500).json({ error: 'Ошибка создания клуба' })
  }
})

// ─── GET /api/clubs/:id — детали ───
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

// ─── POST /api/clubs/:id/join — вступить ───
// SECURITY-ФИКС: INSERT member + пересчёт member_count через COUNT(*) внутри
// транзакции — раньше UPDATE member_count=+1 мог расходиться с реальным кол-вом.
router.post('/:id/join', auth, (req, res) => {
  try {
    const result = db.transaction(() => {
      const club = db.prepare('SELECT * FROM clubs WHERE id=?').get(req.params.id)
      if (!club) {
        const err = new Error('not_found'); err.code = 'NOT_FOUND'; throw err
      }
      const existing = db.prepare('SELECT 1 FROM club_members WHERE user_id=?').get(req.user.id)
      if (existing) {
        const err = new Error('already_in_club'); err.code = 'ALREADY_IN_CLUB'; throw err
      }
      const currentCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?').get(club.id).c
      if (currentCount >= 50) {
        const err = new Error('full'); err.code = 'FULL'; throw err
      }
      db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?,?,?)')
        .run(club.id, req.user.id, 'member')
      const newCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?').get(club.id).c
      db.prepare('UPDATE clubs SET member_count=? WHERE id=?').run(newCount, club.id)
      return { newCount }
    })()
    res.json({ ok: true, member_count: result.newCount })
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: 'Клуб не найден' })
    if (e.code === 'ALREADY_IN_CLUB') return res.status(409).json({ error: 'Вы уже состоите в клубе' })
    if (e.code === 'FULL') return res.status(400).json({ error: 'Клуб заполнен (макс. 50)' })
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Вы уже состоите в клубе' })
    console.error('[clubs] join error:', e)
    res.status(500).json({ error: 'Ошибка вступления' })
  }
})

// ─── POST /api/clubs/:id/leave — выйти ───
// SECURITY-ФИКС: передача владения + DELETE member + пересчёт member_count в
// одной транзакции.
router.post('/:id/leave', auth, (req, res) => {
  try {
    const result = db.transaction(() => {
      const membership = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?')
        .get(req.params.id, req.user.id)
      if (!membership) {
        const err = new Error('not_in_club'); err.code = 'NOT_IN_CLUB'; throw err
      }

      if (membership.role === 'owner') {
        // Передаём владение первому офицеру или члену
        const nextMember = db.prepare(`
          SELECT user_id FROM club_members
          WHERE club_id=? AND user_id!=?
          ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END LIMIT 1
        `).get(req.params.id, req.user.id)

        if (nextMember) {
          db.prepare('UPDATE club_members SET role=? WHERE club_id=? AND user_id=?')
            .run('owner', req.params.id, nextMember.user_id)
          db.prepare('UPDATE clubs SET owner_id=? WHERE id=?')
            .run(nextMember.user_id, req.params.id)
        } else {
          // Последний участник — удаляем клуб (CASCADE почистит club_members)
          db.prepare('DELETE FROM clubs WHERE id=?').run(req.params.id)
          return { disbanded: true }
        }
      }

      db.prepare('DELETE FROM club_members WHERE club_id=? AND user_id=?')
        .run(req.params.id, req.user.id)
      const newCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?')
        .get(req.params.id).c
      db.prepare('UPDATE clubs SET member_count=? WHERE id=?').run(newCount, req.params.id)
      return { disbanded: false, member_count: newCount }
    })()
    res.json({ ok: true, ...result })
  } catch (e) {
    if (e.code === 'NOT_IN_CLUB') return res.status(404).json({ error: 'Вы не в этом клубе' })
    console.error('[clubs] leave error:', e)
    res.status(500).json({ error: 'Ошибка выхода' })
  }
})

// ─── DELETE /api/clubs/:id/kick/:uid — кикнуть ───
router.delete('/:id/kick/:uid', auth, (req, res) => {
  try {
    const result = db.transaction(() => {
      const myRole = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?')
        .get(req.params.id, req.user.id)
      if (!myRole || !['owner', 'officer'].includes(myRole.role)) {
        const err = new Error('forbidden'); err.code = 'FORBIDDEN'; throw err
      }
      const targetRole = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?')
        .get(req.params.id, req.params.uid)
      if (!targetRole) {
        const err = new Error('not_found'); err.code = 'NOT_FOUND'; throw err
      }
      if (targetRole.role === 'owner') {
        const err = new Error('cant_kick_owner'); err.code = 'CANT_KICK_OWNER'; throw err
      }
      if (myRole.role === 'officer' && targetRole.role === 'officer') {
        const err = new Error('officer_vs_officer'); err.code = 'OFFICER_VS_OFFICER'; throw err
      }

      db.prepare('DELETE FROM club_members WHERE club_id=? AND user_id=?')
        .run(req.params.id, req.params.uid)
      const newCount = db.prepare('SELECT COUNT(*) as c FROM club_members WHERE club_id=?')
        .get(req.params.id).c
      db.prepare('UPDATE clubs SET member_count=? WHERE id=?').run(newCount, req.params.id)
      return { member_count: newCount }
    })()
    res.json({ ok: true, ...result })
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: 'Недостаточно прав' })
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: 'Участник не найден' })
    if (e.code === 'CANT_KICK_OWNER') return res.status(403).json({ error: 'Нельзя кикнуть владельца' })
    if (e.code === 'OFFICER_VS_OFFICER') return res.status(403).json({ error: 'Офицер не может кикнуть офицера' })
    console.error('[clubs] kick error:', e)
    res.status(500).json({ error: 'Ошибка' })
  }
})

// ─── PUT /api/clubs/:id/role/:uid — изменить роль ───
// SECURITY-ФИКС: нельзя менять собственную роль — раньше owner мог разжаловать
// сам себя в 'member' и клуб оставался без владельца.
router.put('/:id/role/:uid', auth, (req, res) => {
  const myRole = db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?')
    .get(req.params.id, req.user.id)
  if (!myRole || myRole.role !== 'owner') return res.status(403).json({ error: 'Только владелец' })
  if (+req.params.uid === req.user.id) return res.status(400).json({ error: 'Нельзя менять свою роль' })
  const { role } = req.body
  if (!['officer', 'member'].includes(role)) return res.status(400).json({ error: 'role: officer | member' })
  db.prepare('UPDATE club_members SET role=? WHERE club_id=? AND user_id=?').run(role, req.params.id, req.params.uid)
  res.json({ ok: true })
})

export default router
