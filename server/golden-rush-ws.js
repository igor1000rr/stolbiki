/**
 * Golden Rush Online WebSocket handlers.
 *
 * Отдельный модуль, подключается в ws.js. Содержит:
 *  - grMatchQueue: очередь поиска матча (ждёт 4 игрока)
 *  - grRooms: активные online-комнаты Golden Rush
 *  - handleGoldenRushMessage / handleGoldenRushDisconnect / cleanupGoldenRush / getGoldenRushStats
 *
 * При старте модуля ожидает setDatabase(db) от ws.js чтобы persistGameResult имел доступ к БД.
 *
 * Протокол: см. docstring в предыдущей версии — не изменился.
 */

import {
  GoldenRushState, applyAction, validateAction, computeScores,
  CENTER_IDX,
} from './golden-rush-engine.js'

// Глобальные структуры
export const grRooms = new Map()
export const grMatchQueue = []

// Ссылка на БД (инжектится из ws.js при setup)
let _db = null
export function setDatabase(db) { _db = db }

// ═══ Константы наград ═══
// В 2p PvP за победу даём 5 бриксов (см. ws.js handleServerGameOver).
// В GR 4-player матч длиннее и сложнее — даём больше за участие и победу.
const GR_REWARDS = {
  win: 10,           // Победитель FFA или оба в выигравшей команде 2v2
  participation: 2,  // Каждому сыгравшему (не resign'нувшему)
  centerCapture: 3,  // Бонус тому кто замкнул центр
}

// ═══ Генерация id ═══
function generateGrRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = 'GR'
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

// ═══ Утилиты ═══
function broadcast(room, msg) {
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg)
  for (const p of room.players) {
    if (p.ws?.readyState === 1) {
      try { p.ws.send(data) } catch {}
    }
  }
}

function broadcastTo(room, slots, msg) {
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg)
  for (const p of room.players) {
    if (!slots.includes(p.slot)) continue
    if (p.ws?.readyState === 1) {
      try { p.ws.send(data) } catch {}
    }
  }
}

function sendErr(ws, reason) {
  try { ws.send(JSON.stringify({ type: 'gr.error', reason })) } catch {}
}

function findPlayerRoom(ws) {
  for (const room of grRooms.values()) {
    const slot = room.players.findIndex(p => p.ws === ws)
    if (slot >= 0) return { room, slot }
  }
  return null
}

function findPlayerRoomByUserId(userId) {
  if (!userId) return null
  for (const room of grRooms.values()) {
    const slot = room.players.findIndex(p => p.userId === userId)
    if (slot >= 0) return { room, slot }
  }
  return null
}

/**
 * Пишет результат матча в БД + начисляет бриксы + обновляет счётчики пользователей.
 * Идемпотентна через флаг room.persisted.
 * Никогда не кидает — логирует и отдаёт дальше, чтобы не сломать gr.gameOver broadcast.
 */
function persistGameResult(room, opts = {}) {
  if (!_db || room.persisted) return
  room.persisted = true

  const { resignedBy = null } = opts
  const state = room.state
  const scores = state.scores || computeScores(state)
  const durationSec = Math.round((Date.now() - room.created) / 1000)

  // Определяем кто замкнул центр — за бонус
  const centerOwner = state.closed?.[CENTER_IDX]

  try {
    const tx = _db.transaction(() => {
      // 1. Запись матча
      const playersJson = JSON.stringify(room.players.map(p => ({
        slot: p.slot,
        userId: p.userId || null,
        name: p.name,
        rating: p.rating,
      })))
      const teamsJson = state.teams ? JSON.stringify(state.teams) : null
      const scoresJson = JSON.stringify(scores)

      _db.prepare(`
        INSERT INTO gr_matches (room_id, mode, players, teams, winner, scores, turns, duration_sec, resigned_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        room.id, room.mode, playersJson, teamsJson,
        state.winner, scoresJson, state.turn, durationSec, resignedBy
      )

      // 2. Определяем победителей per-user
      const winners = new Set()
      if (state.mode === 'ffa' && state.winner >= 0) {
        winners.add(state.winner)
      } else if (state.mode === '2v2' && state.winner >= 0 && state.teams) {
        for (const slot of state.teams[state.winner]) winners.add(slot)
      }

      // 3. Награды и счётчики per-player
      for (const p of room.players) {
        if (!p.userId) continue // анонимы пропускаются

        let bricks = 0
        const reasons = []

        // Участие (кроме resigner'а — он не получает)
        if (p.slot !== resignedBy) {
          bricks += GR_REWARDS.participation
          reasons.push('participation')
        }

        // Победа
        if (winners.has(p.slot)) {
          bricks += GR_REWARDS.win
          reasons.push('win')
        }

        // Бонус за центр
        if (p.slot === centerOwner && p.slot !== resignedBy) {
          bricks += GR_REWARDS.centerCapture
          reasons.push('center')
        }

        // Счётчики
        const isWinner = winners.has(p.slot) ? 1 : 0
        const isCenterCapture = p.slot === centerOwner ? 1 : 0

        _db.prepare(`
          UPDATE users SET
            gr_games = COALESCE(gr_games, 0) + 1,
            gr_wins = COALESCE(gr_wins, 0) + ?,
            gr_center_captures = COALESCE(gr_center_captures, 0) + ?,
            bricks = COALESCE(bricks, 0) + ?
          WHERE id = ?
        `).run(isWinner, isCenterCapture, bricks, p.userId)

        // Транзакция бриксов (если были)
        if (bricks > 0) {
          const reason = `gr:${room.mode}:${reasons.join('+')}`
          _db.prepare(`
            INSERT INTO brick_transactions (user_id, amount, reason, created_at)
            VALUES (?, ?, ?, ?)
          `).run(p.userId, bricks, reason.slice(0, 50), Date.now())
        }
      }
    })
    tx()
  } catch (e) {
    console.error('[gr] persistGameResult error:', e.message)
    // Флаг оставляем true — не пытаемся повторно при другой ошибке
  }
}

/**
 * Создаёт комнату из 4 записей очереди. В 2v2 команды по диагонали: 0+2 vs 1+3.
 */
function createRoomFromQueue(entries, mode) {
  const shuffled = [...entries].sort(() => Math.random() - 0.5)
  const players = []
  for (let i = 0; i < 4; i++) {
    players.push({
      ws: shuffled[i].ws,
      userId: shuffled[i].userId,
      name: shuffled[i].name,
      rating: shuffled[i].rating,
      slot: i,
      disconnectedAt: null,
    })
  }

  let roomId = generateGrRoomId()
  while (grRooms.has(roomId)) roomId = generateGrRoomId()

  const state = new GoldenRushState({ mode, numPlayers: 4 })
  const room = {
    id: roomId,
    mode,
    players,
    state,
    created: Date.now(),
    lastActivity: Date.now(),
    deleteTimer: null,
    persisted: false, // флаг идемпотентности persistGameResult
  }
  grRooms.set(roomId, room)
  return room
}

function notifyMatchFound(room) {
  const playersView = room.players.map(p => ({ slot: p.slot, name: p.name, rating: p.rating }))
  for (const p of room.players) {
    if (p.ws?.readyState !== 1) continue
    try {
      p.ws.send(JSON.stringify({
        type: 'gr.matchFound',
        roomId: room.id,
        mode: room.mode,
        yourSlot: p.slot,
        players: playersView,
        state: room.state.serialize(),
      }))
    } catch {}
  }
}

// ═══ Matchmaking ═══
function tryMatch() {
  const byMode = { 'ffa': [], '2v2': [] }
  for (const entry of grMatchQueue) {
    if (entry.ws.readyState !== 1) continue
    if (!(entry.mode in byMode)) continue
    byMode[entry.mode].push(entry)
  }

  for (const mode of ['ffa', '2v2']) {
    while (byMode[mode].length >= 4) {
      const four = byMode[mode].splice(0, 4)
      for (const e of four) {
        const idx = grMatchQueue.indexOf(e)
        if (idx >= 0) grMatchQueue.splice(idx, 1)
      }
      const room = createRoomFromQueue(four, mode)
      notifyMatchFound(room)
    }
  }

  for (let i = 0; i < grMatchQueue.length; i++) {
    const entry = grMatchQueue[i]
    if (entry.ws?.readyState === 1) {
      try {
        entry.ws.send(JSON.stringify({
          type: 'gr.queued',
          position: i + 1,
          needed: 4 - (byMode[entry.mode]?.length || 0),
        }))
      } catch {}
    }
  }
}

// ═══ Публичный API для ws.js ═══

export function handleGoldenRushMessage({ ws, msg, wsUser }) {
  const type = msg.type
  if (!type.startsWith('gr.')) return false

  // ─── gr.findMatch ───
  if (type === 'gr.findMatch') {
    if (!wsUser) { sendErr(ws, 'auth_required'); return true }
    const mode = msg.mode === '2v2' ? '2v2' : 'ffa'

    for (let i = grMatchQueue.length - 1; i >= 0; i--) {
      if (grMatchQueue[i].userId === wsUser.id || grMatchQueue[i].ws === ws) {
        grMatchQueue.splice(i, 1)
      }
    }
    const existing = findPlayerRoomByUserId(wsUser.id)
    if (existing && !existing.room.state.gameOver) {
      sendErr(ws, 'already_in_room')
      try {
        ws.send(JSON.stringify({
          type: 'gr.reconnected',
          roomId: existing.room.id,
          slot: existing.slot,
          state: existing.room.state.serialize(),
          players: existing.room.players.map(p => ({ slot: p.slot, name: p.name, rating: p.rating })),
        }))
      } catch {}
      return true
    }

    grMatchQueue.push({
      ws,
      userId: wsUser.id,
      name: wsUser.username,
      rating: wsUser.rating || 1000,
      mode,
      joinedAt: Date.now(),
    })
    tryMatch()
    return true
  }

  // ─── gr.cancelMatch ───
  if (type === 'gr.cancelMatch') {
    const idx = grMatchQueue.findIndex(q => q.ws === ws)
    if (idx >= 0) grMatchQueue.splice(idx, 1)
    try { ws.send(JSON.stringify({ type: 'gr.queued', position: 0, cancelled: true })) } catch {}
    tryMatch()
    return true
  }

  // ─── gr.move ───
  if (type === 'gr.move') {
    const found = findPlayerRoom(ws)
    if (!found) { sendErr(ws, 'not_in_room'); return true }
    const { room, slot } = found
    if (room.state.gameOver) { sendErr(ws, 'game_over'); return true }
    if (room.state.currentPlayer !== slot) { sendErr(ws, 'not_your_turn'); return true }

    const action = msg.action || {}
    const v = validateAction(room.state, action)
    if (!v.ok) { sendErr(ws, v.reason); return true }

    room.state = applyAction(room.state, action)
    room.lastActivity = Date.now()

    broadcast(room, {
      type: 'gr.state',
      state: room.state.serialize(),
      lastMove: { slot, action },
    })

    if (room.state.gameOver) {
      persistGameResult(room)
      broadcast(room, {
        type: 'gr.gameOver',
        state: room.state.serialize(),
        winner: room.state.winner,
        scores: room.state.scores || computeScores(room.state),
        rewards: GR_REWARDS, // клиент покажет "+10 бриксов"
      })
      setTimeout(() => { if (grRooms.has(room.id)) grRooms.delete(room.id) }, 5 * 60 * 1000)
    }
    return true
  }

  // ─── gr.resign ───
  if (type === 'gr.resign') {
    const found = findPlayerRoom(ws)
    if (!found) { sendErr(ws, 'not_in_room'); return true }
    const { room, slot } = found
    if (room.state.gameOver) return true

    room.state.gameOver = true
    room.state.scores = computeScores(room.state)
    if (room.mode === 'ffa') {
      let best = -1, bestScore = -Infinity
      for (let p = 0; p < 4; p++) {
        if (p === slot) continue
        if (room.state.scores[p] > bestScore) { best = p; bestScore = room.state.scores[p] }
      }
      room.state.winner = best
    } else {
      const resignerTeam = room.state.teams.findIndex(t => t.includes(slot))
      room.state.winner = 1 - resignerTeam
    }

    persistGameResult(room, { resignedBy: slot })
    broadcast(room, {
      type: 'gr.gameOver',
      state: room.state.serialize(),
      winner: room.state.winner,
      scores: room.state.scores,
      resignedBy: slot,
      rewards: GR_REWARDS,
    })
    setTimeout(() => { if (grRooms.has(room.id)) grRooms.delete(room.id) }, 5 * 60 * 1000)
    return true
  }

  // ─── gr.teamChat ───
  if (type === 'gr.teamChat') {
    const found = findPlayerRoom(ws)
    if (!found) { sendErr(ws, 'not_in_room'); return true }
    const { room, slot } = found
    if (room.mode !== '2v2') { sendErr(ws, 'team_chat_ffa_disabled'); return true }

    const text = typeof msg.text === 'string' ? msg.text.replace(/<[^>]*>/g, '').slice(0, 100).trim() : ''
    if (!text) return true

    const team = room.state.teams.find(t => t.includes(slot)) || []
    broadcastTo(room, team, {
      type: 'gr.teamChat',
      text,
      from: room.players[slot]?.name || '',
      slot,
    })
    return true
  }

  // ─── gr.reaction ───
  if (type === 'gr.reaction') {
    const found = findPlayerRoom(ws)
    if (!found) { sendErr(ws, 'not_in_room'); return true }
    const { room, slot } = found
    const ALLOWED = ['👍', '🔥', '😮', '😂', '💪', '🎉', '⭐']
    const emoji = typeof msg.emoji === 'string' && ALLOWED.includes(msg.emoji) ? msg.emoji : null
    if (!emoji) return true
    broadcast(room, { type: 'gr.reaction', emoji, slot })
    return true
  }

  // ─── gr.reconnect ───
  if (type === 'gr.reconnect') {
    if (!wsUser) { sendErr(ws, 'auth_required'); return true }
    const roomId = typeof msg.roomId === 'string' ? msg.roomId.toUpperCase() : null
    let target = null
    if (roomId && grRooms.has(roomId)) {
      const room = grRooms.get(roomId)
      const slot = room.players.findIndex(p => p.userId === wsUser.id)
      if (slot >= 0) target = { room, slot }
    }
    if (!target) target = findPlayerRoomByUserId(wsUser.id)
    if (!target) { sendErr(ws, 'no_room'); return true }

    const { room, slot } = target
    room.players[slot].ws = ws
    room.players[slot].disconnectedAt = null
    if (room.deleteTimer) { clearTimeout(room.deleteTimer); room.deleteTimer = null }

    try {
      ws.send(JSON.stringify({
        type: 'gr.reconnected',
        roomId: room.id,
        slot,
        state: room.state.serialize(),
        players: room.players.map(p => ({ slot: p.slot, name: p.name, rating: p.rating })),
      }))
    } catch {}
    return true
  }

  sendErr(ws, 'unknown_gr_type')
  return true
}

export function handleGoldenRushDisconnect(ws) {
  for (let i = grMatchQueue.length - 1; i >= 0; i--) {
    if (grMatchQueue[i].ws === ws) grMatchQueue.splice(i, 1)
  }
  const found = findPlayerRoom(ws)
  if (!found) return
  const { room, slot } = found

  room.players[slot].disconnectedAt = Date.now()
  broadcast(room, { type: 'gr.playerLeft', slot, name: room.players[slot].name })

  const anyAlive = room.players.some(p => p.ws?.readyState === 1 && !p.disconnectedAt)
  if (!anyAlive && !room.deleteTimer) {
    room.deleteTimer = setTimeout(() => {
      if (grRooms.has(room.id)) grRooms.delete(room.id)
    }, 2 * 60 * 1000)
  }
}

export function cleanupGoldenRush() {
  const now = Date.now()
  for (const [id, room] of grRooms) {
    if (now - (room.lastActivity || room.created) > 30 * 60 * 1000) {
      const anyAlive = room.players.some(p => p.ws?.readyState === 1)
      if (!anyAlive) grRooms.delete(id)
    }
  }
  for (let i = grMatchQueue.length - 1; i >= 0; i--) {
    if (grMatchQueue[i].ws.readyState !== 1) grMatchQueue.splice(i, 1)
  }
}

export function getGoldenRushStats() {
  return {
    rooms: grRooms.size,
    queue: grMatchQueue.length,
    activeGames: [...grRooms.values()].filter(r => !r.state.gameOver).length,
  }
}
