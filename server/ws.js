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
import { sendPushTo, isPushConfigured } from './push-helpers.js'
import {
  handleGoldenRushMessage,
  handleGoldenRushDisconnect,
  cleanupGoldenRush,
} from './golden-rush-ws.js'

// ═══ Per-IP connection limit ═══
// Защита от amplification DoS через множественные WS коннекты с одного IP.
// Счётчики sub-second rate (5 chat/s, 20 gameplay/s) живут на замыкании одного
// WS — атакующий мог бы открыть N коннектов и получить N×лимиты. Per-IP cap
// это закрывает. 5 — щедро для одного юзера (вкладки + telegram web + прочее).
const MAX_CONN_PER_IP = 5

export function setupWebSocket(app, { JWT_SECRET, rooms, matchQueue, db }) {
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 })

  // IP → Set<ws>
  const ipConnections = new Map()

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

  // ─── Global timer tick ───
  // SECURITY/UX-ФИКС: раньше таймер декрементировался ТОЛЬКО при ходе — если
  // оппонент ушёл offline и не ходит, его время не тикает, и игрок висел 90 сек
  // deleteTimer — не fair. Теперь тик раз в секунду проверяет все комнаты: если
  // у текущего игрока вышло время — автоматическая победа оппонента.
  const timerTick = setInterval(() => {
    const now = Date.now()
    for (const room of rooms.values()) {
      if (!room.playerTime || !room.lastMoveTime) continue
      const gs = room.gameState
      if (!gs || gs.gameOver) continue
      const currentRoomPlayer = gameToRoomPlayer(room, gs.currentPlayer)
      const elapsed = (now - room.lastMoveTime) / 1000
      const remaining = room.playerTime[currentRoomPlayer] - elapsed
      if (remaining > 0) continue

      // Время вышло — победа оппонента по времени
      room.playerTime[currentRoomPlayer] = 0
      room.lastMoveTime = now
      gs.gameOver = true
      gs.winner = 1 - gs.currentPlayer
      const timeMsg = JSON.stringify({ type: 'timeUp', loser: currentRoomPlayer, time: room.playerTime })
      try {
        room.players.forEach(p => p?.ws?.readyState === 1 && p.ws.send(timeMsg))
        broadcastToSpectators(room, { type: 'timeUp', loser: currentRoomPlayer })
      } catch {}
      try { handleServerGameOver(room) } catch (e) { console.error('[ws] timer gameOver error:', e.message) }
    }
  }, 1000)

  // ─── Golden Rush cleanup ───
  const grCleanupIv = setInterval(() => { try { cleanupGoldenRush() } catch {} }, 120000)

  wss.on('close', () => { clearInterval(heartbeat); clearInterval(timerTick); clearInterval(grCleanupIv) })

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

  /**
   * Push-fallback: если у оппонента нет живого WS соединения, отправляем web-push.
   * Используется для критичных событий: ход соперника, draw offer, rematch offer.
   */
  function pushIfOffline(opponent, fromName, kind, room) {
    if (!opponent || !opponent.userId) return
    if (opponent.ws?.readyState === 1) return // онлайн — push не нужен
    if (!isPushConfigured()) return
    const titles = {
      move: 'Ваш ход!',
      draw: 'Ничья?',
      rematch: 'Рематч?',
    }
    const bodies = {
      move: `${fromName || 'Соперник'} сделал ход`,
      draw: `${fromName || 'Соперник'} предлагает ничью`,
      rematch: `${fromName || 'Соперник'} предлагает рематч`,
    }
    sendPushTo(opponent.userId, {
      title: titles[kind] || 'Highrise Heist',
      body: bodies[kind] || '',
      url: `https://highriseheist.com/online?room=${room.id}`,
      tag: `room-${room.id}-${kind}`,
    }).catch(err => console.warn('[ws] push failed:', err?.message || err))
  }

  function handleServerGameOver(room) {
    const gs = room.gameState
    if (!gs) return
    const winner = gs.winner
    if (winner >= 0) {
      const roomWinner = gameToRoomPlayer(room, winner)
      room.scores[roomWinner]++

      try {
        const winPlayer = room.players[roomWinner]
        if (winPlayer?.userId) {
          const tx = db.transaction(() => {
            db.prepare('UPDATE users SET bricks = COALESCE(bricks, 0) + 5 WHERE id = ?')
              .run(winPlayer.userId)
            db.prepare('INSERT INTO brick_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, ?)')
              .run(winPlayer.userId, 5, 'win:pvp_verified', Date.now())
          })
          tx()
        }
      } catch (e) { console.warn('[ws] award bricks error:', e.message) }
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
      if (room.playerTime && room.timer) {
        room.playerTime = [room.timer * 60, room.timer * 60]
        room.lastMoveTime = Date.now()
      }
      const nextMsg = JSON.stringify({
        type: 'nextGame',
        currentGame: room.currentGame, totalGames: room.totalGames,
        scores: room.scores,
        firstPlayer: room.firstPlayer,
        playerTime: room.playerTime || null,
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

    // SECURITY: IP extraction с учётом trust proxy (nginx → x-forwarded-for)
    const xff = req.headers['x-forwarded-for']
    const ip = (typeof xff === 'string' ? xff.split(',')[0].trim() : null) || req.socket.remoteAddress || 'unknown'

    // SECURITY: per-IP cap против amplification DoS через множественные коннекты
    if (!ipConnections.has(ip)) ipConnections.set(ip, new Set())
    const conns = ipConnections.get(ip)
    if (conns.size >= MAX_CONN_PER_IP) {
      try { ws.close(1008, 'Too many connections from IP') } catch {}
      return
    }
    conns.add(ws)
    ws._trackedIp = ip

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
    const CHAT_TYPES = new Set(['chat', 'reaction', 'drawOffer', 'drawResponse', 'rematchOffer', 'globalChat', 'joinGlobalChat', 'leaveGlobalChat', 'gr.teamChat', 'gr.reaction'])

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
        if (wsUser?.id && db) {
          try {
            const u = db.prepare('SELECT rating FROM users WHERE id=?').get(wsUser.id)
            if (u) wsUser.rating = u.rating
          } catch {}
        }
        ws.send(JSON.stringify({ type: 'authResult', ok: !!wsUser, username: wsUser?.username }))
        return
      }

      // ─── Golden Rush online: обрабатывается отдельным модулем ───
      // Если тип начинается с gr.* — делегируем в golden-rush-ws и выходим.
      if (msg.type.startsWith('gr.')) {
        try {
          handleGoldenRushMessage({ ws, msg, wsUser })
        } catch (e) {
          console.error('[gr] handler error:', e.message)
          try { ws.send(JSON.stringify({ type: 'gr.error', reason: 'server_error' })) } catch {}
        }
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
        try {
          const history = db.prepare(
            'SELECT id, username, text, created_at FROM chat_messages WHERE channel=? ORDER BY id DESC LIMIT 50'
          ).all(channel).reverse()
          ws.send(JSON.stringify({ type: 'chatHistory', channel, messages: history }))
        } catch {}
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
        if (!meta) return
        if (!wsUser) return

        const rawText = (msg.text || '').slice(0, 300)
        if (!rawText.trim()) return

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

        let msgId = null
        try {
          const r = db.prepare(
            'INSERT INTO chat_messages (channel, user_id, username, text, created_at) VALUES (?,?,?,?,?)'
          ).run(channel, wsUser.id, wsUser.username, text, ts)
          msgId = r.lastInsertRowid
        } catch {}

        const outMsg = JSON.stringify({
          type: 'globalChat',
          id: msgId,
          channel,
          username: wsUser.username,
          text,
          created_at: ts,
        })
        broadcastGlobalChat(channel, outMsg)

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
        if (!wsUser) {
          ws.send(JSON.stringify({ type: 'error', msg: 'Для рангового матча нужна авторизация' }))
          return
        }
        const name = wsUser.username
        const skins = msg.skins || {}
        const rating = wsUser.rating || 1000
        const safeTimer = sanitizeTimer(msg.timer)

        for (let i = matchQueue.length - 1; i >= 0; i--) {
          if (matchQueue[i].ws.readyState !== 1) matchQueue.splice(i, 1)
        }
        if (matchQueue.some(q => q.ws === ws)) return

        const entry = { ws, name, userId: wsUser.id, skins, rating, joinedAt: Date.now() }
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
            created: Date.now(),
            players: [
              { ws: p1.ws, name: p1.name, userId: p1.userId, skins: p1.skins, rating: p1.rating },
              { ws: p2.ws, name: p2.name, userId: p2.userId, skins: p2.skins, rating: p2.rating },
            ],
            mode: 'single', totalGames: 1, currentGame: 1, scores: [0, 0],
            gameState: new GameState(), firstPlayer: 0, spectators: [],
            timer: safeTimer,
            playerTime: safeTimer ? [safeTimer * 60, safeTimer * 60] : null,
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
          room.lastMoveTime = Date.now()
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
                  gs.gameOver = true
                  gs.winner = 1 - gs.currentPlayer
                  const timeMsg = JSON.stringify({ type: 'timeUp', loser: playerIdx, time: room.playerTime })
                  room.players.forEach(p => p?.ws?.readyState === 1 && p.ws.send(timeMsg))
                  broadcastToSpectators(room, { type: 'timeUp', loser: playerIdx })
                  try { handleServerGameOver(room) } catch (e) { console.error('[ws] move timeUp error:', e.message) }
                  return
                }
              }
              room.lastMoveTime = Date.now()
              room.gameState = applyAction(gs, action)
              if (!room.moveHistory) room.moveHistory = []
              room.moveHistory.push({ action: { ...action }, player: gamePlayer })
              const opponent = room.players[1 - playerIdx]
              const me = room.players[playerIdx]
              const moveMsg = { type: 'move', action, from: playerIdx }
              if (room.playerTime) moveMsg.time = room.playerTime
              if (opponent?.ws?.readyState === 1) {
                opponent.ws.send(JSON.stringify(moveMsg))
              } else {
                pushIfOffline(opponent, me?.name, 'move', room)
              }
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
        const me = playerRoom.players[playerIdx]
        if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'drawOffer', from: playerIdx }))
        else pushIfOffline(opponent, me?.name, 'draw', playerRoom)
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

      // ─── REMATCH ───
      if (msg.type === 'rematchOffer' && playerRoom) {
        const opponent = playerRoom.players[1 - playerIdx]
        const me = playerRoom.players[playerIdx]
        if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'rematchOffer', from: playerIdx }))
        else pushIfOffline(opponent, me?.name, 'rematch', playerRoom)
      }
      if (msg.type === 'rematchResponse' && playerRoom) {
        const room = playerRoom
        const opponent = room.players[1 - playerIdx]
        if (msg.accepted) {
          room.firstPlayer = room.firstPlayer === 0 ? 1 : 0
          room.gameState = new GameState()
          room.moveHistory = []
          if (room.playerTime && room.timer) {
            room.playerTime = [room.timer * 60, room.timer * 60]
            room.lastMoveTime = Date.now()
          }
          const startMsg = JSON.stringify({ type: 'rematchStart', players: room.players.map(p => p.name), firstPlayer: room.firstPlayer, scores: room.scores, playerTime: room.playerTime || null })
          room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(startMsg))
        } else {
          if (opponent?.ws?.readyState === 1) opponent.ws.send(JSON.stringify({ type: 'rematchDeclined' }))
        }
      }
    })

    ws.on('close', () => {
      // Per-IP cleanup
      if (ws._trackedIp) {
        const conns = ipConnections.get(ws._trackedIp)
        if (conns) {
          conns.delete(ws)
          if (conns.size === 0) ipConnections.delete(ws._trackedIp)
        }
      }

      // Убираем из чата
      chatSubscribers.delete(ws)

      // Golden Rush: помечаем игрока disconnected в grRooms + убираем из grMatchQueue
      try { handleGoldenRushDisconnect(ws) } catch (e) { console.error('[gr] disconnect error:', e.message) }

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
