/**
 * WebSocket модуль — мультиплеер, валидация ходов, турниры, глобальный чат
 * Экспортирует setupWebSocket(app, { db, JWT_SECRET, rooms, matchQueue })
 * Возвращает { server } для последующего listen()
 */

import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import { GameState, applyAction, getLegalActions } from './game-engine.js'
import { parseRaw, sanitizeChat, sanitizeEmoji, sanitizeRoomId, sanitizeTimer } from './ws-messages.js'
import { filterText } from './routes/globalchat.js'
import { canChatNow } from './chat-limits.js'

export function setupWebSocket(app, { JWT_SECRET, rooms, matchQueue, db }) {
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 })

  // ─── Глобальный чат: подписчики ───
  // Set WS-клиентов подписанных на глобальный чат
  const chatSubscribers = new Map() // ws → { username, userId, channel }

  function broadcastGlobalChat(channel, msg) {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg)
    for (const [ws, meta] of chatSubscribers) {
      if (ws.readyState === 1 && meta.channel === channel) {
        try { ws.send(data) } catch {}
      }
    }
  }

  // ─── Heartbeat ───
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        try { ws.terminate() } catch {}
        return
      }
      ws.isAlive = false
      try { ws.ping() } catch {}
    })
  }, 30000)
  wss.on('close', () => clearInterval(heartbeat))

  function wsAuth(token) {
    if (!token) return null
    try { return jwt.verify(token, JWT_SECRET) } catch { return null }
  }

  function actionsEqual(a, b) {
    if (a.swap || b.swap) return !!a.swap === !!b.swap
    const at = a.transfer, bt = b.transfer
    if (!at && !bt) { /* ok */ }
    else if (!at || !bt) return false
    else if (at[0] !== bt[0] || at[1] !== bt[1]) return false
    const ap = a.placement || {}, bp = b.placement || {}
    const ak = Object.keys(ap).sort(), bk = Object.keys(bp).sort()
    if (ak.length !== bk.length) return false
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i] || ap[ak[i]] !== bp[bk[i]]) return false
    }
    return true
  }

  function gameToRoomPlayer(room, gamePlayer) {
    const firstP = room.firstPlayer ?? 0
    return gamePlayer === 0 ? firstP : 1 - firstP
  }

  function broadcastToSpectators(room, msg) {
    if (!room.spectators) return
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg)
    room.spectators = room.spectators.filter(s => s.readyState === 1)
    room.spectators.forEach(s => s.send(data))
  }

  function handleServerGameOver(room) {
    const gs = room.gameState
    if (!gs) return
    const winner = gs.winner
    if (winner >= 0) {
      const roomWinner = gameToRoomPlayer(room, winner)
      room.scores[roomWinner]++
    }
    if (room.moveHistory && room.moveHistory.length >= 5) {
      try {
        const gameData = JSON.stringify(room.moveHistory)
        if (gameData.length < 500000) {
          db.prepare('INSERT INTO training_data (user_id, game_data, winner, total_moves, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
            .run(null, gameData, winner, room.moveHistory.length, 'online', 0)
        }
      } catch {}
    }
    const gameOverMsg = JSON.stringify({
      type: 'serverGameOver',
      winner: winner >= 0 ? gameToRoomPlayer(room, winner) : -1,
      scores: room.scores,
    })
    room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(gameOverMsg))
    broadcastToSpectators(room, gameOverMsg)
    handleTournamentNext(room)
  }

  function handleTournamentNext(room) {
    if (room.currentGame < room.totalGames) {
      room.currentGame++
      room.firstPlayer = room.currentGame % 2 === 1 ? 0 : 1
      room.gameState = new GameState()
      room.moveHistory = []
      const nextMsg = JSON.stringify({
        type: 'nextGame',
        currentGame: room.currentGame, totalGames: room.totalGames,
        scores: room.scores,
        firstPlayer: room.firstPlayer,
      })
      room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(nextMsg))
    } else {
      const finalMsg = JSON.stringify({
        type: 'tournamentOver',
        scores: room.scores,
        winner: room.scores[0] > room.scores[1] ? 0 : room.scores[1] > room.scores[0] ? 1 : -1,
      })
      room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(finalMsg))
    }
  }

  // ═══ Обработка подключений ═══
  wss.on('connection', (ws, req) => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

    let playerRoom = null
    let playerIdx = -1
    let wsUser = null
    let isSpectator = false

    const url = new URL(req.url, 'http://localhost')
    const tokenFromUrl = url.searchParams.get('token')
    if (tokenFromUrl) {
      wsUser = wsAuth(tokenFromUrl)
      if (wsUser?.id && db) {
        const u = db.prepare('SELECT rating FROM users WHERE id=?').get(wsUser.id)
        if (u) wsUser.rating = u.rating
      }
    }

    let wsGameplayCount = 0
    let wsChatCount = 0
    let wsRateReset = Date.now()
    const CHAT_TYPES = new Set(['chat', 'reaction', 'drawOffer', 'drawResponse', 'rematchOffer', 'globalChat', 'joinGlobalChat', 'leaveGlobalChat'])

    ws.on('message', (raw) => {
      const now = Date.now()
      if (now - wsRateReset > 1000) { wsGameplayCount = 0; wsChatCount = 0; wsRateReset = now }

      const parsed = parseRaw(raw)
      if (!parsed.ok) return
      const msg = parsed.msg

      if (CHAT_TYPES.has(msg.type)) {
        if (++wsChatCount > 5) return
      } else {
        if (++wsGameplayCount > 20) return
      }

      if (msg.type === 'auth') {
        wsUser = wsAuth(msg.token)
        ws.send(JSON.stringify({ type: 'authResult', ok: !!wsUser, username: wsUser?.username }))
        return
      }

      // ─── ГЛОБАЛЬНЫЙ ЧАТ ───
      if (msg.type === 'joinGlobalChat') {
        const channel = (msg.channel || 'global').slice(0, 20)
        chatSubscribers.set(ws, {
          username: wsUser?.username || msg.username || 'Гость',
          userId: wsUser?.id || null,
          channel,
        })
        // Отправляем последние 50 сообщений
        try {
          const history = db.prepare(
            'SELECT id, username, text, created_at FROM chat_messages WHERE channel=? ORDER BY id DESC LIMIT 50'
          ).all(channel).reverse()
          ws.send(JSON.stringify({ type: 'chatHistory', channel, messages: history }))
        } catch {}
        // Рассылаем onlineCount
        const onlineCount = [...chatSubscribers.values()].filter(m => m.channel === channel).length
        broadcastGlobalChat(channel, { type: 'chatOnline', channel, count: onlineCount })
        return
      }

      if (msg.type === 'leaveGlobalChat') {
        chatSubscribers.delete(ws)
        return
      }

      if (msg.type === 'globalChat') {
        const meta = chatSubscribers.get(ws)
        if (!meta) return // не подписан
        if (!wsUser) return // только авторизованные

        const rawText = (msg.text || '').slice(0, 300)
        if (!rawText.trim()) return

        // Per-user rate limit + admin mute check
        const check = canChatNow(wsUser.id)
        if (!check.allowed) {
          try {
            ws.send(JSON.stringify({
              type: 'chatBlocked',
              reason: check.reason,
              until: check.until,
              retryAfterMs: check.retryAfterMs,
            }))
          } catch {}
          return
        }

        const text = filterText(rawText)
        const ts = Date.now()
        const channel = meta.channel

        // Сохраняем в БД
        let msgId = null
        try {
          const r = db.prepare(
            'INSERT INTO chat_messages (channel, user_id, username, text, created_at) VALUES (?,?,?,?,?)'
          ).run(channel, wsUser.id, wsUser.username, text, ts)
          msgId = r.lastInsertRowid
        } catch {}

        // Рассылаем всем подписчикам
        const outMsg = JSON.stringify({
          type: 'globalChat',
          id: msgId,
          channel,
          username: wsUser.username,
          text,
          created_at: ts,
        })
        broadcastGlobalChat(channel, outMsg)

        // Ограничиваем историю: удаляем старые сообщения старше 7 дней
        if (msgId && msgId % 100 === 0) {
          try {
            db.prepare("DELETE FROM chat_messages WHERE channel=? AND created_at < ?")
              .run(channel, ts - 7 * 86400000)
          } catch {}
        }
        return
      }

      // ─── MATCHMAKING ───
      if (msg.type === 'findMatch') {
        const name = wsUser?.username || msg.name || 'Player'
        const skins = msg.skins || {}
        const rating = wsUser?.rating || 1000
        for (let i = matchQueue.length - 1; i >= 0; i--) {
          if (matchQueue[i].ws.readyState !== 1) matchQueue.splice(i, 1)
        }
        if (matchQueue.some(q => q.ws === ws)) return

        const entry = { ws, name, userId: wsUser?.id || null, skins, rating, joinedAt: Date.now() }
        matchQueue.push(entry)

        let matched = null
        const maxWait = 30000
        for (const q of matchQueue) {
          if (q.ws === ws) continue
          if (q.ws.readyState !== 1) continue
          const ratingDiff = Math.abs(q.rating - rating)
          const waitTime = Date.now() - Math.min(q.joinedAt, entry.joinedAt)
          const allowedDiff = 200 + Math.floor(waitTime / 5000) * 50
          if (ratingDiff <= allowedDiff || waitTime > maxWait) { matched = q; break }
        }

        if (matched) {
          matchQueue.splice(matchQueue.indexOf(matched), 1)
          matchQueue.splice(matchQueue.indexOf(entry), 1)
          const roomId = (() => { let id; do { id = Math.random().toString(36).slice(2, 8).toUpperCase() } while (rooms.has(id)); return id })()
          const first = Math.random() < 0.5 ? 0 : 1
          const p1 = first === 0 ? entry : matched
          const p2 = first === 0 ? matched : entry
          const room = {
            id: roomId,
            players: [
              { ws: p1.ws, name: p1.name, userId: p1.userId, skins: p1.skins, rating: p1.rating },
              { ws: p2.ws, name: p2.name, userId: p2.userId, skins: p2.skins, rating: p2.rating },
            ],
            mode: 'single', totalGames: 1, currentGame: 1, scores: [0, 0],
            gameState: new GameState(), firstPlayer: 0, spectators: [],
            timer: msg.timer || null,
            playerTime: msg.timer ? [msg.timer * 60, msg.timer * 60] : null,
          }
          rooms.set(roomId, room)
          p1.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 0, opponentRating: p2.rating }))
          p2.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 1, opponentRating: p1.rating }))
          const startMsg = JSON.stringify({ type: 'start', players: [p1.name, p2.name], playerSkins: [p1.skins, p2.skins], ratings: [p1.rating, p2.rating], firstPlayer: 0, scores: [0, 0], currentGame: 1, timer: room.timer })
          p1.ws.send(startMsg); p2.ws.send(startMsg)
          room.lastMoveTime = Date.now()
        } else {
          ws.send(JSON.stringify({ type: 'queued', position: matchQueue.length, rating }))
        }
        return
      }

      if (msg.type === 'cancelMatch') {
        const idx = matchQueue.findIndex(q => q.ws === ws)
        if (idx !== -1) matchQueue.splice(idx, 1)
        ws.send(JSON.stringify({ type: 'matchCancelled' }))
        return
      }

      // ─── JOIN ───
      if (msg.type === 'join') {
        const roomId = sanitizeRoomId(msg.roomId)
        if (!roomId) return ws.send(JSON.stringify({ type: 'error', msg: 'Некорректный roomId' }))
        const room = rooms.get(roomId)
        if (!room) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната не найдена' }))
        if (room.players.length >= 2) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната полна' }))

        playerIdx = room.players.length
        room.players.push({ ws, name: wsUser?.username || msg.name || `Игрок ${playerIdx + 1}`, userId: wsUser?.id || null, skins: msg.skins || {} })
        playerRoom = room

        ws.send(JSON.stringify({ type: 'joined', roomId, playerIdx, mode: room.mode, totalGames: room.totalGames }))

        if (room.players.length === 2) {
          room.state = 'playing'
          room.currentGame = 1
          room.gameState = new GameState()
          room.moveHistory = []
          room.firstPlayer = 0
          const startMsg = JSON.stringify({
            type: 'start',
            players: room.players.map(p => p.name),
            playerSkins: room.players.map(p => p.skins || {}),
            currentGame: 1, totalGames: room.totalGames, scores: [0, 0],
            firstPlayer: 0,
          })
          room.players.forEach(p => p.ws.send(startMsg))
        } else {
          ws.send(JSON.stringify({ type: 'waiting', players: room.players.map(p => p.name) }))
        }
      }

      // ─── SPECTATE ───
      if (msg.type === 'spectate') {
        const roomId = sanitizeRoomId(msg.roomId)
        if (!roomId) return ws.send(JSON.stringify({ type: 'error', msg: 'Некорректный roomId' }))
        const room = rooms.get(roomId)
        if (!room) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната не найдена' }))
        if (!room.spectators) room.spectators = []
        room.spectators.push(ws)
        playerRoom = room
        isSpectator = true
        const gs = room.gameState
        ws.send(JSON.stringify({
          type: 'spectateJoined', roomId,
          players: room.players.map(p => p.name),
          playerSkins: room.players.map(p => p.skins || {}),
          scores: room.scores,
          firstPlayer: room.firstPlayer ?? 0,
          gameState: gs ? { stands: gs.stands, closed: gs.closed, currentPlayer: gs.currentPlayer, turn: gs.turn, swapAvailable: gs.swapAvailable, gameOver: gs.gameOver, winner: gs.winner } : null,
          spectators: room.spectators.filter(s => s.readyState === 1).length,
        }))
        const specCount = room.spectators.filter(s => s.readyState === 1).length
        room.players.forEach(p => {
          if (p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'spectatorCount', count: specCount }))
        })
      }

      // ─── RECONNECT ───
      if (msg.type === 'reconnect') {
        if (!wsUser?.id) { ws.send(JSON.stringify({ type: 'reconnectFailed', reason: 'no_auth' })); return }
        const roomId = sanitizeRoomId(msg.roomId)
        if (!roomId) { ws.send(JSON.stringify({ type: 'reconnectFailed', reason: 'bad_room_id' })); return }
        const room = rooms.get(roomId)
        if (!room) { ws.send(JSON.stringify({ type: 'reconnectFailed', reason: 'room_not_found' })); return }
        const slotIdx = room.players.findIndex(p => p.userId === wsUser.id)
        if (slotIdx === -1) { ws.send(JSON.stringify({ type: 'reconnectFailed', reason: 'not_a_player' })); return }
        room.players[slotIdx].ws = ws
        room.players[slotIdx].disconnectedAt = null
        playerRoom = room
        playerIdx = slotIdx
        if (room.deleteTimer) { clearTimeout(room.deleteTimer); room.deleteTimer = null }
        const gs = room.gameState
        ws.send(JSON.stringify({
          type: 'reconnected', roomId, playerIdx: slotIdx,
          players: room.players.map(p => p.name),
          playerSkins: room.players.map(p => p.skins || {}),
          scores: room.scores, currentGame: room.currentGame, totalGames: room.totalGames,
          firstPlayer: room.firstPlayer ?? 0, timer: room.timer || null, playerTime: room.playerTime || null,
          gameState: gs ? { stands: gs.stands, closed: gs.closed, currentPlayer: gs.currentPlayer, turn: gs.turn, swapAvailable: gs.swapAvailable, gameOver: gs.gameOver, winner: gs.winner } : null,
          moveHistory: room.moveHistory || [],
        }))
        const opponent = room.players[1 - slotIdx]
        if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'opponentReconnected', playerIdx: slotIdx }))
        broadcastToSpectators(room, { type: 'playerReconnected', playerIdx: slotIdx })
        return
      }

      // ─── MOVE ───
      if (msg.type === 'move' && playerRoom) {
        const room = playerRoom
        const gs = room.gameState
        if (!gs || gs.gameOver) {
          ws.send(JSON.stringify({ type: 'error', msg: 'Игра не активна' }))
        } else {
          const firstP = room.firstPlayer ?? 0
          const gamePlayer = playerIdx === firstP ? 0 : 1
          if (gs.currentPlayer !== gamePlayer) {
            ws.send(JSON.stringify({ type: 'error', msg: 'Не ваш ход' }))
          } else {
            const action = msg.action || {}
            const legal = getLegalActions(gs)
            const isLegal = legal.some(a => actionsEqual(a, action))
            if (!isLegal) {
              ws.send(JSON.stringify({ type: 'error', msg: 'Недопустимый ход' }))
            } else {
              if (room.playerTime && room.lastMoveTime) {
                const elapsed = (Date.now() - room.lastMoveTime) / 1000
                room.playerTime[playerIdx] = Math.max(0, room.playerTime[playerIdx] - elapsed)
                if (room.playerTime[playerIdx] <= 0) {
                  const timeMsg = JSON.stringify({ type: 'timeUp', loser: playerIdx, time: room.playerTime })
                  room.players.forEach(p => p?.ws?.readyState === 1 && p.ws.send(timeMsg))
                  broadcastToSpectators(room, { type: 'timeUp', loser: playerIdx })
                  return
                }
              }
              room.lastMoveTime = Date.now()
              room.gameState = applyAction(gs, action)
              if (!room.moveHistory) room.moveHistory = []
              room.moveHistory.push({ action: { ...action }, player: gamePlayer })
              const opponent = room.players[1 - playerIdx]
              const moveMsg = { type: 'move', action, from: playerIdx }
              if (room.playerTime) moveMsg.time = room.playerTime
              if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify(moveMsg))
              broadcastToSpectators(room, moveMsg)
              if (room.gameState.gameOver) handleServerGameOver(room)
            }
          }
        }
      }

      // ─── RESIGN ───
      if (msg.type === 'resign' && playerRoom) {
        const room = playerRoom
        const firstP = room.firstPlayer ?? 0
        const resignedGamePlayer = playerIdx === firstP ? 0 : 1
        const winnerGamePlayer = 1 - resignedGamePlayer
        if (room.gameState) { room.gameState.gameOver = true; room.gameState.winner = winnerGamePlayer }
        room.players.forEach((p, i) => {
          if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'resign', from: playerIdx }))
        })
        handleServerGameOver(room)
      }

      // ─── CHAT (комнатный) ───
      if (msg.type === 'chat' && playerRoom && msg.text) {
        const text = sanitizeChat(msg.text)
        if (!text) return
        if (isSpectator) {
          const name = wsUser?.username || 'Spectator'
          const chatMsg = JSON.stringify({ type: 'chat', text, from: -1, spectator: true, name })
          playerRoom.players.forEach(p => { if (p.ws?.readyState === 1) p.ws.send(chatMsg) })
          broadcastToSpectators(playerRoom, chatMsg)
        } else {
          playerRoom.players.forEach((p, i) => {
            if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'chat', text, from: playerIdx }))
          })
          broadcastToSpectators(playerRoom, { type: 'chat', text, from: playerIdx })
        }
      }

      // ─── EMOJI REACTIONS ───
      if (msg.type === 'reaction' && playerRoom && msg.emoji) {
        const emoji = sanitizeEmoji(msg.emoji)
        if (emoji) {
          playerRoom.players.forEach((p, i) => {
            if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type: 'reaction', emoji, from: playerIdx }))
          })
          broadcastToSpectators(playerRoom, { type: 'reaction', emoji, from: playerIdx })
        }
      }

      // ─── DRAW ───
      if (msg.type === 'drawOffer' && playerRoom) {
        const opponent = playerRoom.players[1 - playerIdx]
        if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'drawOffer', from: playerIdx }))
      }
      if (msg.type === 'drawResponse' && playerRoom) {
        const opponent = playerRoom.players[1 - playerIdx]
        if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'drawResponse', accepted: msg.accepted, from: playerIdx }))
        if (msg.accepted) {
          const room = playerRoom
          if (room.gameState) { room.gameState.gameOver = true; room.gameState.winner = -1 }
          handleServerGameOver(room)
        }
      }

      if (msg.type === 'gameOver' && playerRoom) {
        if (!playerRoom.gameState) {
          const room = playerRoom
          if (msg.winner === 0) room.scores[0]++
          else if (msg.winner === 1) room.scores[1]++
          handleTournamentNext(room)
        }
      }

      // ─── REMATCH ───
      if (msg.type === 'rematchOffer' && playerRoom) {
        const opponent = playerRoom.players[1 - playerIdx]
        if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'rematchOffer', from: playerIdx }))
      }
      if (msg.type === 'rematchResponse' && playerRoom) {
        const room = playerRoom
        const opponent = room.players[1 - playerIdx]
        if (msg.accepted) {
          room.firstPlayer = room.firstPlayer === 0 ? 1 : 0
          room.gameState = new GameState()
          room.moveHistory = []
          const startMsg = JSON.stringify({ type: 'rematchStart', players: room.players.map(p => p.name), firstPlayer: room.firstPlayer, scores: room.scores })
          room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(startMsg))
        } else {
          if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'rematchDeclined' }))
        }
      }
    })

    ws.on('close', () => {
      // Убираем из чата
      chatSubscribers.delete(ws)

      if (playerRoom) {
        const room = playerRoom
        if (isSpectator) {
          if (room.spectators) room.spectators = room.spectators.filter(s => s !== ws)
        } else {
          const player = room.players[playerIdx]
          if (player) player.disconnectedAt = Date.now()
          const dcMsg = JSON.stringify({ type: 'disconnected', playerIdx })
          room.players.forEach((p, i) => {
            if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(dcMsg)
          })
          broadcastToSpectators(room, dcMsg)
          room.deleteTimer = setTimeout(() => {
            const stillDisconnected = room.players.some(p => p.disconnectedAt && (p.ws?.readyState !== 1))
            if (stillDisconnected) {
              const abandonMsg = JSON.stringify({ type: 'opponentAbandoned' })
              room.players.forEach(p => { try { p.ws?.readyState === 1 && p.ws.send(abandonMsg) } catch {} })
              rooms.delete(room.id)
            }
          }, 90000)
        }
      }
    })
  })

  return { server }
}
