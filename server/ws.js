/**
 * WebSocket модуль — мультиплеер, валидация ходов, турниры
 * Экспортирует setupWebSocket(app, { db, JWT_SECRET, rooms, matchQueue })
 * Возвращает { server } для последующего listen()
 */

import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import { GameState, applyAction, getLegalActions } from './game-engine.js'

export function setupWebSocket(app, { JWT_SECRET, rooms, matchQueue }) {
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Верификация WS-клиента по токену
  function wsAuth(token) {
    if (!token) return null
    try { return jwt.verify(token, JWT_SECRET) } catch { return null }
  }

  // ─── Хелперы серверной валидации ходов ───

  /** Сравнение двух action объектов (transfer, placement, swap) */
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

  /** Конвертация game player index → room player index */
  function gameToRoomPlayer(room, gamePlayer) {
    const firstP = room.firstPlayer ?? 0
    return gamePlayer === 0 ? firstP : 1 - firstP
  }

  /** Обработка gameOver сервером: обновление счёта + турнирная логика */
  function handleServerGameOver(room) {
    const gs = room.gameState
    if (!gs) return
    const winner = gs.winner
    if (winner >= 0) {
      const roomWinner = gameToRoomPlayer(room, winner)
      room.scores[roomWinner]++
    }
    const gameOverMsg = JSON.stringify({
      type: 'serverGameOver',
      winner: winner >= 0 ? gameToRoomPlayer(room, winner) : -1,
      scores: room.scores,
    })
    room.players.forEach(p => p.ws?.readyState === 1 && p.ws.send(gameOverMsg))
    handleTournamentNext(room)
  }

  /** Турнирная логика: следующая партия или финал */
  function handleTournamentNext(room) {
    if (room.currentGame < room.totalGames) {
      room.currentGame++
      room.firstPlayer = room.currentGame % 2 === 1 ? 0 : 1
      room.gameState = new GameState()
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
    let playerRoom = null
    let playerIdx = -1
    let wsUser = null

    const url = new URL(req.url, 'http://localhost')
    const tokenFromUrl = url.searchParams.get('token')
    if (tokenFromUrl) wsUser = wsAuth(tokenFromUrl)

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      // Аутентификация через сообщение
      if (msg.type === 'auth') {
        wsUser = wsAuth(msg.token)
        ws.send(JSON.stringify({ type: 'authResult', ok: !!wsUser, username: wsUser?.username }))
        return
      }

      // ─── MATCHMAKING ───
      if (msg.type === 'findMatch') {
        const name = wsUser?.username || msg.name || 'Player'
        for (let i = matchQueue.length - 1; i >= 0; i--) {
          if (matchQueue[i].ws.readyState !== 1) matchQueue.splice(i, 1)
        }
        if (matchQueue.some(q => q.ws === ws)) return
        matchQueue.push({ ws, name, userId: wsUser?.id || null })

        if (matchQueue.length >= 2) {
          const p1 = matchQueue.shift()
          const p2 = matchQueue.shift()
          const roomId = Math.random().toString(36).slice(2, 8).toUpperCase()
          const room = {
            id: roomId,
            players: [
              { ws: p1.ws, name: p1.name, userId: p1.userId },
              { ws: p2.ws, name: p2.name, userId: p2.userId },
            ],
            mode: 'single', totalGames: 1, currentGame: 1, scores: [0, 0],
            gameState: new GameState(), firstPlayer: 0,
          }
          rooms.set(roomId, room)
          p1.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 0 }))
          p2.ws.send(JSON.stringify({ type: 'matchFound', roomId, playerIdx: 1 }))
          const startMsg = JSON.stringify({ type: 'start', players: [p1.name, p2.name], firstPlayer: 0, scores: [0, 0], currentGame: 1 })
          p1.ws.send(startMsg); p2.ws.send(startMsg)
        } else {
          ws.send(JSON.stringify({ type: 'queued', position: matchQueue.length }))
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
        const roomId = (msg.roomId || '').toUpperCase()
        const room = rooms.get(roomId)
        if (!room) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната не найдена' }))
        if (room.players.length >= 2) return ws.send(JSON.stringify({ type: 'error', msg: 'Комната полна' }))

        playerIdx = room.players.length
        room.players.push({ ws, name: wsUser?.username || msg.name || `Игрок ${playerIdx + 1}`, userId: wsUser?.id || null })
        playerRoom = room

        ws.send(JSON.stringify({ type: 'joined', roomId, playerIdx, mode: room.mode, totalGames: room.totalGames }))

        if (room.players.length === 2) {
          room.state = 'playing'
          room.currentGame = 1
          room.gameState = new GameState()
          room.firstPlayer = 0
          const startMsg = JSON.stringify({
            type: 'start',
            players: room.players.map(p => p.name),
            currentGame: 1, totalGames: room.totalGames, scores: [0, 0],
            firstPlayer: 0,
          })
          room.players.forEach(p => p.ws.send(startMsg))
        } else {
          ws.send(JSON.stringify({ type: 'waiting', players: room.players.map(p => p.name) }))
        }
      }

      // ─── MOVE (серверная валидация) ───
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
              room.gameState = applyAction(gs, action)
              const opponent = room.players[1 - playerIdx]
              if (opponent?.ws?.readyState === 1) {
                opponent.ws.send(JSON.stringify({ type: 'move', action, from: playerIdx }))
              }
              if (room.gameState.gameOver) {
                handleServerGameOver(room)
              }
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
        if (room.gameState) {
          room.gameState.gameOver = true
          room.gameState.winner = winnerGamePlayer
        }
        room.players.forEach((p, i) => {
          if (i !== playerIdx && p.ws?.readyState === 1) {
            p.ws.send(JSON.stringify({ type: 'resign', from: playerIdx }))
          }
        })
        handleServerGameOver(room)
      }

      // ─── CHAT ───
      if (msg.type === 'chat' && playerRoom && msg.text) {
        const text = String(msg.text).slice(0, 50)
        playerRoom.players.forEach((p, i) => {
          if (i !== playerIdx && p.ws?.readyState === 1) {
            p.ws.send(JSON.stringify({ type: 'chat', text, from: playerIdx }))
          }
        })
      }

      // ─── DRAW ───
      if (msg.type === 'drawOffer' && playerRoom) {
        const opponent = playerRoom.players[1 - playerIdx]
        if (opponent?.ws?.readyState === 1) {
          opponent.ws.send(JSON.stringify({ type: 'drawOffer', from: playerIdx }))
        }
      }

      if (msg.type === 'drawResponse' && playerRoom) {
        const opponent = playerRoom.players[1 - playerIdx]
        if (opponent?.ws?.readyState === 1) {
          opponent.ws.send(JSON.stringify({ type: 'drawResponse', accepted: msg.accepted, from: playerIdx }))
        }
        if (msg.accepted) {
          const room = playerRoom
          if (room.gameState) {
            room.gameState.gameOver = true
            room.gameState.winner = -1
          }
          handleServerGameOver(room)
        }
      }

      // Клиентский gameOver — backward compat для старых сессий
      if (msg.type === 'gameOver' && playerRoom) {
        if (!playerRoom.gameState) {
          const room = playerRoom
          if (msg.winner === 0) room.scores[0]++
          else if (msg.winner === 1) room.scores[1]++
          handleTournamentNext(room)
        }
      }
    })

    ws.on('close', () => {
      if (playerRoom) {
        const room = playerRoom
        const dcMsg = JSON.stringify({ type: 'disconnected', playerIdx })
        room.players.forEach((p, i) => {
          if (i !== playerIdx && p.ws?.readyState === 1) p.ws.send(dcMsg)
        })
        setTimeout(() => {
          if (room.players.some(p => p.ws?.readyState !== 1)) rooms.delete(room.id)
        }, 60000)
      }
    })
  })

  return { server }
}
