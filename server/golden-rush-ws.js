/**
 * Golden Rush Online WebSocket handlers.
 *
 * Отдельный модуль, подключается в ws.js. Содержит:
 *  - grMatchQueue: очередь поиска матча (ждёт 4 игрока, разбивает на 2 команды)
 *  - grRooms: активные online-комнаты Golden Rush (отдельно от rooms основной 2p-игры)
 *  - setupGoldenRushHandlers(ctx) — регистрирует gr.* хендлеры на WS connection
 *
 * Протокол сообщений (клиент → сервер):
 *  gr.findMatch  { mode: 'ffa' | '2v2', teamPartner?: userId }
 *  gr.cancelMatch
 *  gr.move       { action: { transfer?, placement? } }
 *  gr.resign
 *  gr.teamChat   { text }
 *  gr.reaction   { emoji }
 *  gr.reconnect  { roomId }
 *
 * Протокол сообщений (сервер → клиент):
 *  gr.queued       { position }
 *  gr.matchFound   { roomId, mode, slot, state }
 *  gr.state        { state, lastMove? }
 *  gr.gameOver     { state, winner }
 *  gr.error        { reason }
 *  gr.teamChat     { text, from, slot }
 *  gr.reaction     { emoji, from, slot }
 *  gr.playerLeft   { slot }
 *  gr.reconnected  { roomId, slot, state }
 */

import jwt from 'jsonwebtoken'
import {
  GoldenRushState, applyAction, validateAction, computeScores,
} from './golden-rush-engine.js'

// Глобальные структуры (существуют в рамках процесса сервера)
export const grRooms = new Map()     // roomId → room
export const grMatchQueue = []       // { ws, userId, name, rating, mode, joinedAt }

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
 * Создаёт комнату из 4 записей очереди. Размешивает порядок рассаживания
 * чтобы команды сидели по диагонали (0 & 2 — команда 0, 1 & 3 — команда 1).
 */
function createRoomFromQueue(entries, mode) {
  // Простое сопоставление: первая пара — team0, вторая — team1.
  // Слоты: team0 получает slot 0 и 2 (диагональ), team1 — slot 1 и 3.
  const shuffled = [...entries].sort(() => Math.random() - 0.5)
  const players = []
  if (mode === '2v2') {
    players.push({ ws: shuffled[0].ws, userId: shuffled[0].userId, name: shuffled[0].name, rating: shuffled[0].rating, slot: 0, disconnectedAt: null })
    players.push({ ws: shuffled[1].ws, userId: shuffled[1].userId, name: shuffled[1].name, rating: shuffled[1].rating, slot: 1, disconnectedAt: null })
    players.push({ ws: shuffled[2].ws, userId: shuffled[2].userId, name: shuffled[2].name, rating: shuffled[2].rating, slot: 2, disconnectedAt: null })
    players.push({ ws: shuffled[3].ws, userId: shuffled[3].userId, name: shuffled[3].name, rating: shuffled[3].rating, slot: 3, disconnectedAt: null })
  } else {
    // FFA: произвольный порядок
    for (let i = 0; i < 4; i++) {
      players.push({ ws: shuffled[i].ws, userId: shuffled[i].userId, name: shuffled[i].name, rating: shuffled[i].rating, slot: i, disconnectedAt: null })
    }
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
  }
  grRooms.set(roomId, room)
  return room
}

/**
 * Отправляет всем игрокам в комнате стартовое сообщение matchFound.
 */
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
  // Группируем по mode. Для MVP: как только собралось 4 игрока одного mode — создаём комнату.
  const byMode = { 'ffa': [], '2v2': [] }
  for (const entry of grMatchQueue) {
    if (entry.ws.readyState !== 1) continue
    if (!(entry.mode in byMode)) continue
    byMode[entry.mode].push(entry)
  }

  for (const mode of ['ffa', '2v2']) {
    while (byMode[mode].length >= 4) {
      const four = byMode[mode].splice(0, 4)
      // Удаляем из основной очереди
      for (const e of four) {
        const idx = grMatchQueue.indexOf(e)
        if (idx >= 0) grMatchQueue.splice(idx, 1)
      }
      const room = createRoomFromQueue(four, mode)
      notifyMatchFound(room)
    }
  }

  // Обновляем position для тех кто остался в очереди
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

/**
 * Пытаемся обработать gr.* сообщение. Возвращает true если сообщение обработано
 * (или отклонено с ошибкой), false если тип не наш (пускаем дальше по цепочке).
 *
 * @param {Object} ctx
 * @param {WebSocket} ctx.ws — WS соединение
 * @param {Object} ctx.msg — распарсенное сообщение
 * @param {Object|null} ctx.wsUser — { id, username, rating? } или null
 * @returns {boolean}
 */
export function handleGoldenRushMessage({ ws, msg, wsUser }) {
  const type = msg.type
  if (!type.startsWith('gr.')) return false

  // ─── gr.findMatch ───
  if (type === 'gr.findMatch') {
    if (!wsUser) { sendErr(ws, 'auth_required'); return true }
    const mode = msg.mode === '2v2' ? '2v2' : 'ffa'

    // Удаляем старые записи этого юзера
    for (let i = grMatchQueue.length - 1; i >= 0; i--) {
      if (grMatchQueue[i].userId === wsUser.id || grMatchQueue[i].ws === ws) {
        grMatchQueue.splice(i, 1)
      }
    }
    // Проверяем что юзер не в активной комнате
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
      // Пишем в training_data на будущее + бриксы (TODO: Phase 3 вознаграждения)
      broadcast(room, {
        type: 'gr.gameOver',
        state: room.state.serialize(),
        winner: room.state.winner,
        scores: room.state.scores || computeScores(room.state),
      })
      // Комнату удалим через 5 минут (чтобы клиенты могли показать экран)
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

    // Resign = игрок автоматически проигрывает. В FFA — его очки обнуляются.
    // В 2v2 — команда проигрывает целиком. Для простоты прерываем игру.
    room.state.gameOver = true
    room.state.scores = computeScores(room.state)
    if (room.mode === 'ffa') {
      // Победитель — любой другой с макс.очками
      let best = -1, bestScore = -Infinity
      for (let p = 0; p < 4; p++) {
        if (p === slot) continue
        if (room.state.scores[p] > bestScore) { best = p; bestScore = room.state.scores[p] }
      }
      room.state.winner = best
    } else {
      // 2v2 — победа команды оппонентов
      const resignerTeam = room.state.teams.findIndex(t => t.includes(slot))
      room.state.winner = 1 - resignerTeam
    }

    broadcast(room, {
      type: 'gr.gameOver',
      state: room.state.serialize(),
      winner: room.state.winner,
      scores: room.state.scores,
      resignedBy: slot,
    })
    setTimeout(() => { if (grRooms.has(room.id)) grRooms.delete(room.id) }, 5 * 60 * 1000)
    return true
  }

  // ─── gr.teamChat (только 2v2, между союзниками) ───
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

  // Тип начинается с gr. но не совпал — возвращаем true чтобы не пытались обработать как обычный ход.
  sendErr(ws, 'unknown_gr_type')
  return true
}

/**
 * Вызывается при разрыве WS соединения. Ищет комнату и помечает игрока как disconnected.
 * Если все disconnected — удаляет комнату через 2 минуты.
 */
export function handleGoldenRushDisconnect(ws) {
  // Убираем из очереди
  for (let i = grMatchQueue.length - 1; i >= 0; i--) {
    if (grMatchQueue[i].ws === ws) grMatchQueue.splice(i, 1)
  }
  // Ищем комнату
  const found = findPlayerRoom(ws)
  if (!found) return
  const { room, slot } = found

  room.players[slot].disconnectedAt = Date.now()

  broadcast(room, { type: 'gr.playerLeft', slot, name: room.players[slot].name })

  // Если все disconnected — удаляем комнату через 2 мин
  const anyAlive = room.players.some(p => p.ws?.readyState === 1 && !p.disconnectedAt)
  if (!anyAlive && !room.deleteTimer) {
    room.deleteTimer = setTimeout(() => {
      if (grRooms.has(room.id)) grRooms.delete(room.id)
    }, 2 * 60 * 1000)
  }
}

/**
 * Периодическая очистка. Вызывать из ws.js каждые 2 мин.
 */
export function cleanupGoldenRush() {
  const now = Date.now()
  // Удаляем комнаты старше 30 мин без активности
  for (const [id, room] of grRooms) {
    if (now - (room.lastActivity || room.created) > 30 * 60 * 1000) {
      const anyAlive = room.players.some(p => p.ws?.readyState === 1)
      if (!anyAlive) grRooms.delete(id)
    }
  }
  // Убираем мёртвые коннекты из очереди
  for (let i = grMatchQueue.length - 1; i >= 0; i--) {
    if (grMatchQueue[i].ws.readyState !== 1) grMatchQueue.splice(i, 1)
  }
}

/**
 * Для /api/health и админки.
 */
export function getGoldenRushStats() {
  return {
    rooms: grRooms.size,
    queue: grMatchQueue.length,
    activeGames: [...grRooms.values()].filter(r => !r.state.gameOver).length,
  }
}
