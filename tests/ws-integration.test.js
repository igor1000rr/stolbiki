/**
 * Integration-тесты WebSocket протокола.
 *
 * Поднимает реальный HTTP + WS сервер на эфемерном порту, подключается через ws-клиент,
 * играет сценарии: join, move, chat, reaction, spectate, disconnect, invalid messages.
 *
 * Покрывает реальные фиксы:
 *  - type whitelist (неизвестные типы сообщений отклоняются)
 *  - roomId regex валидация
 *  - sanitizeChat / sanitizeEmoji
 *  - server-side move validation через движок
 *  - spectator broadcast (баг-регрессия: s.ws.send → s.send)
 *  - findMatch требует авторизации (SECURITY-ФИКС)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

process.env.VITEST = 'true'
process.env.JWT_SECRET = 'ws_test_secret_' + Math.random().toString(36).slice(2)

let setupWebSocket, WebSocketClient, server, port, dbRef, express, createServer, jwt

try {
  express = (await import('express')).default
  createServer = (await import('http')).createServer
  const wsMod = await import('../server/ws.js')
  setupWebSocket = wsMod.setupWebSocket
  WebSocketClient = (await import('ws')).WebSocket
  const dbMod = await import('../server/db.js')
  dbRef = dbMod.db
  jwt = (await import('jsonwebtoken')).default
} catch {
  // better-sqlite3, ws, express — native/сервер-deps не доступны в sandbox
}

const run = (setupWebSocket && WebSocketClient && dbRef && express && createServer && jwt) ? describe : describe.skip

/** Wrapper: создаёт ws-клиент и собирает входящие сообщения в очередь с ожиданием по типу */
function makeClient(url) {
  const ws = new WebSocketClient(url)
  const queue = []
  const waiters = []
  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }
    queue.push(msg)
    // Разбудить ждущих
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].match(msg)) {
        waiters[i].resolve(msg)
        waiters.splice(i, 1)
      }
    }
  })
  return {
    ws,
    opened: new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    }),
    send: (obj) => ws.send(JSON.stringify(obj)),
    /** Ждём следующее сообщение типа (или любое при type=undefined), timeout 2с */
    waitFor: (type, timeout = 2000) => {
      // Сначала проверим уже пришедшие
      const idx = queue.findIndex(m => !type || m.type === type)
      if (idx !== -1) return Promise.resolve(queue.splice(idx, 1)[0])
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const i = waiters.indexOf(waiter)
          if (i !== -1) waiters.splice(i, 1)
          reject(new Error(`timeout waiting for ${type || 'any message'}`))
        }, timeout)
        const waiter = {
          match: (m) => !type || m.type === type,
          resolve: (m) => { clearTimeout(timer); resolve(m) },
        }
        waiters.push(waiter)
      })
    },
    close: () => ws.close(),
    allMessages: () => [...queue],
  }
}

run('WebSocket integration', () => {
  let wsUrl, rooms, matchQueue

  beforeAll(async () => {
    const app = express()
    rooms = new Map()
    matchQueue = []
    // setupWebSocket создаёт свой http.Server внутри — используем его.
    const { server: wsServer } = setupWebSocket(app, {
      JWT_SECRET: process.env.JWT_SECRET,
      rooms, matchQueue, db: dbRef,
    })
    await new Promise((resolve) => {
      wsServer.listen(0, '127.0.0.1', () => {
        port = wsServer.address().port
        wsUrl = `ws://127.0.0.1:${port}/ws`
        resolve()
      })
    })
    server = wsServer
  })

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
  })

  describe('Валидация входящих сообщений', () => {
    it('отклоняет неизвестный type (type whitelist)', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      client.send({ type: 'shutdownServer' })
      // Сервер молча игнорирует неизвестные типы — убеждаемся через отсутствие ответа + живой сокет
      await new Promise(r => setTimeout(r, 100))
      expect(client.ws.readyState).toBe(1) // всё ещё открыт
      client.close()
    })

    it('отклоняет невалидный JSON', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      client.ws.send('not json {{{')
      await new Promise(r => setTimeout(r, 100))
      expect(client.ws.readyState).toBe(1)
      client.close()
    })

    it('дроп при spam >20 gameplay msg/sec', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      // Отправляем 40 join попыток подряд — лимит 20/сек, остальные должны быть дропнуты
      for (let i = 0; i < 40; i++) {
        client.send({ type: 'join', roomId: 'NONE01' })
      }
      await new Promise(r => setTimeout(r, 300))
      // Соединение не должно упасть, сообщения просто дропаются
      expect(client.ws.readyState).toBe(1)
      client.close()
    })
  })

  describe('Комнаты и join', () => {
    it('join в несуществующую комнату → error', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      client.send({ type: 'join', roomId: 'ZZZZZZ' })
      const msg = await client.waitFor('error')
      expect(msg.msg).toMatch(/не найдена/i)
      client.close()
    })

    it('join с невалидным roomId (3 символа) → error', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      client.send({ type: 'join', roomId: 'AB' })
      const msg = await client.waitFor('error')
      expect(msg.msg).toMatch(/некорректн/i)
      client.close()
    })

    it('join с символами вне [A-Z0-9] → error', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      client.send({ type: 'join', roomId: 'ABC-12' })
      const msg = await client.waitFor('error')
      expect(msg.msg).toMatch(/некорректн/i)
      client.close()
    })
  })

  describe('Happy path: 2 игрока присоединяются и ходят', () => {
    it('полный цикл: join → start → move → opponent получает move', async () => {
      // Создаём комнату напрямую (HTTP endpoint /api/rooms недоступен в этом test-setup)
      const roomId = 'TEST01'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })

      const p1 = makeClient(wsUrl)
      const p2 = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened])

      p1.send({ type: 'join', roomId, name: 'Alice' })
      await p1.waitFor('joined')

      p2.send({ type: 'join', roomId, name: 'Bob' })
      await p2.waitFor('joined')

      // Оба получают start
      const start1 = await p1.waitFor('start')
      const start2 = await p2.waitFor('start')
      expect(start1.players).toEqual(['Alice', 'Bob'])
      expect(start2.players).toEqual(['Alice', 'Bob'])

      // P1 делает первый ход — placement 1 блока на стойку 5
      p1.send({ type: 'move', action: { placement: { 5: 1 } } })

      // P2 получает move
      const moveRelay = await p2.waitFor('move')
      expect(moveRelay.action).toEqual({ placement: { 5: 1 } })
      expect(moveRelay.from).toBe(0)

      p1.close(); p2.close()
    })

    it('нелегальный ход → error, ход не принят', async () => {
      const roomId = 'TEST02'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })

      const p1 = makeClient(wsUrl)
      const p2 = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened])

      p1.send({ type: 'join', roomId })
      await p1.waitFor('joined')
      p2.send({ type: 'join', roomId })
      await p2.waitFor('joined')
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])

      // P1 пытается поставить 99 блоков на стойку 99
      p1.send({ type: 'move', action: { placement: { 99: 99 } } })
      const err = await p1.waitFor('error')
      expect(err.msg).toMatch(/недопустимый/i)

      p1.close(); p2.close()
    })

    it('ход не в свою очередь → error', async () => {
      const roomId = 'TEST03'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })

      const p1 = makeClient(wsUrl)
      const p2 = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened])
      p1.send({ type: 'join', roomId })
      await p1.waitFor('joined')
      p2.send({ type: 'join', roomId })
      await p2.waitFor('joined')
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])

      // P2 пытается ходить первым (первый ход у P1)
      p2.send({ type: 'move', action: { placement: { 5: 1 } } })
      const err = await p2.waitFor('error')
      expect(err.msg).toMatch(/не ваш ход/i)

      p1.close(); p2.close()
    })
  })

  describe('Chat и reactions', () => {
    let roomId, p1, p2

    beforeAll(async () => {
      roomId = 'CHAT01'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })
      p1 = makeClient(wsUrl)
      p2 = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened])
      p1.send({ type: 'join', roomId })
      await p1.waitFor('joined')
      p2.send({ type: 'join', roomId })
      await p2.waitFor('joined')
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])
    })

    afterAll(() => { p1?.close(); p2?.close() })

    it('chat: HTML теги удаляются', async () => {
      p1.send({ type: 'chat', text: '<script>alert(1)</script>hi' })
      const msg = await p2.waitFor('chat')
      expect(msg.text).toBe('alert(1)hi')
      expect(msg.from).toBe(0)
    })

    it('chat: обрезается до 50 символов', async () => {
      const long = 'x'.repeat(200)
      p1.send({ type: 'chat', text: long })
      const msg = await p2.waitFor('chat')
      expect(msg.text.length).toBeLessThanOrEqual(50)
    })

    it('chat: пустая строка игнорируется', async () => {
      p1.send({ type: 'chat', text: '   ' })
      // Ждём небольшое время, сообщения быть не должно
      await new Promise(r => setTimeout(r, 200))
      const chatMessages = p2.allMessages().filter(m => m.type === 'chat')
      expect(chatMessages.length).toBe(0)
    })

    it('reaction: whitelist эмоджи проходит', async () => {
      p1.send({ type: 'reaction', emoji: '🔥' })
      const msg = await p2.waitFor('reaction')
      expect(msg.emoji).toBe('🔥')
    })

    it('reaction: неразрешённый эмоджи дропается', async () => {
      p1.send({ type: 'reaction', emoji: '💀' })
      await new Promise(r => setTimeout(r, 200))
      // p2 не должен получить ничего
      const reacts = p2.allMessages().filter(m => m.type === 'reaction')
      expect(reacts.length).toBe(0)
    })
  })

  describe('Spectator (регрессия бага s.ws.send)', () => {
    it('spectator получает ходы игроков', async () => {
      const roomId = 'SPEC01'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })

      const p1 = makeClient(wsUrl)
      const p2 = makeClient(wsUrl)
      const spec = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened, spec.opened])

      p1.send({ type: 'join', roomId })
      await p1.waitFor('joined')
      p2.send({ type: 'join', roomId })
      await p2.waitFor('joined')
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])

      spec.send({ type: 'spectate', roomId })
      await spec.waitFor('spectateJoined')

      // P1 ходит — spectator должен получить move
      p1.send({ type: 'move', action: { placement: { 5: 1 } } })
      const moveMsg = await spec.waitFor('move')
      expect(moveMsg.action).toEqual({ placement: { 5: 1 } })

      p1.close(); p2.close(); spec.close()
    })

    it('[БАГ-РЕГРЕССИЯ] spectator получает reaction эмоджи', async () => {
      const roomId = 'SPEC02'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })

      const p1 = makeClient(wsUrl)
      const p2 = makeClient(wsUrl)
      const spec = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened, spec.opened])

      p1.send({ type: 'join', roomId })
      await p1.waitFor('joined')
      p2.send({ type: 'join', roomId })
      await p2.waitFor('joined')
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])

      spec.send({ type: 'spectate', roomId })
      await spec.waitFor('spectateJoined')

      // До фикса: p1.send(reaction) → spectator НЕ получал (баг s.ws.send)
      // После фикса: spectator получает через broadcastToSpectators
      p1.send({ type: 'reaction', emoji: '👍' })
      const msg = await spec.waitFor('reaction', 1000)
      expect(msg.emoji).toBe('👍')

      p1.close(); p2.close(); spec.close()
    })
  })

  describe('Disconnect', () => {
    it('closing клиент триггерит disconnected для оппонента', async () => {
      const roomId = 'DISC01'
      rooms.set(roomId, {
        id: roomId, created: Date.now(), mode: 'single', totalGames: 1,
        currentGame: 0, scores: [0, 0], players: [], state: 'waiting',
      })

      const p1 = makeClient(wsUrl)
      const p2 = makeClient(wsUrl)
      await Promise.all([p1.opened, p2.opened])
      p1.send({ type: 'join', roomId })
      await p1.waitFor('joined')
      p2.send({ type: 'join', roomId })
      await p2.waitFor('joined')
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])

      p1.close()
      const msg = await p2.waitFor('disconnected', 2000)
      expect(msg.playerIdx).toBe(0)

      p2.close()
    })
  })

  describe('Matchmaking', () => {
    // SECURITY-ФИКС: findMatch теперь требует авторизации. Создаём JWT
    // для тестовых юзеров. Реальные юзеры в DB не нужны — ws.js делает
    // SELECT rating WHERE id=? но gracefully обрабатывает отсутствие.
    function makeToken(id, username) {
      return jwt.sign({ id, username, isAdmin: false, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })
    }

    it('[SECURITY] findMatch без токена → error', async () => {
      const client = makeClient(wsUrl)
      await client.opened
      client.send({ type: 'findMatch' })
      const msg = await client.waitFor('error', 2000)
      expect(msg.msg).toMatch(/авториз/i)
      client.close()
    })

    it('один авторизованный игрок → queued', async () => {
      const token = makeToken(99001, 'solo_test')
      const client = makeClient(`${wsUrl}?token=${token}`)
      await client.opened
      client.send({ type: 'findMatch' })
      const msg = await client.waitFor('queued', 2000)
      expect(msg.position).toBeGreaterThanOrEqual(1)
      client.send({ type: 'cancelMatch' })
      await client.waitFor('matchCancelled')
      client.close()
    })

    it('два авторизованных игрока → matchFound + start', async () => {
      const token1 = makeToken(99002, 'm1_test')
      const token2 = makeToken(99003, 'm2_test')
      const p1 = makeClient(`${wsUrl}?token=${token1}`)
      const p2 = makeClient(`${wsUrl}?token=${token2}`)
      await Promise.all([p1.opened, p2.opened])
      p1.send({ type: 'findMatch' })
      await p1.waitFor('queued')
      p2.send({ type: 'findMatch' })
      const [mf1, mf2] = await Promise.all([
        p1.waitFor('matchFound', 3000),
        p2.waitFor('matchFound', 3000),
      ])
      expect(mf1.roomId).toBe(mf2.roomId)
      expect(mf1.playerIdx).not.toBe(mf2.playerIdx)
      // Оба получают start
      await Promise.all([p1.waitFor('start'), p2.waitFor('start')])
      p1.close(); p2.close()
    })
  })
})
