/**
 * Integration-тесты Golden Rush WS handler (server/golden-rush-ws.js).
 *
 * Покрывает только error paths (auth_required / not_in_room / no_room / unknown_gr_type) —
 * полный matchmaking flow для FFA 4 игроков и 2v2 слишком сложно для integration теста,
 * там требуются 4 параллельных JWT клиента и реальный AlphaZero AI для подсказок.
 *
 * Покрывает 5/7 типов сообщений gr.* (через error paths):
 *   gr.findMatch, gr.cancelMatch, gr.move, gr.resign, gr.teamChat, gr.reconnect
 * Не покрыто: gr.reaction (требует реальной комнаты)
 *
 * Реальные баги что мы ловим этим тестом:
 *  - регрессия SECURITY: gr.findMatch не должен работать без auth
 *  - регрессия sendErr: ошибки должны приходить с конкретным reason кодом
 *  - регрессия gr.reconnect: должен дать понятную ошибку no_room вместо краша
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

process.env.VITEST = 'true'
process.env.JWT_SECRET = 'gr_test_secret_' + Math.random().toString(36).slice(2)

let setupWebSocket, WebSocketClient, server, port, dbRef, express, jwt

try {
  express = (await import('express')).default
  const wsMod = await import('../server/ws.js')
  setupWebSocket = wsMod.setupWebSocket
  WebSocketClient = (await import('ws')).WebSocket
  const dbMod = await import('../server/db.js')
  dbRef = dbMod.db
  jwt = (await import('jsonwebtoken')).default
} catch {
  // sandbox: native deps недоступны
}

const run = (setupWebSocket && WebSocketClient && dbRef && express && jwt) ? describe : describe.skip

function makeClient(url) {
  const ws = new WebSocketClient(url)
  const queue = []
  const waiters = []
  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }
    queue.push(msg)
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
    waitFor: (type, timeout = 1500) => {
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
  }
}

run('Golden Rush WS — error paths', () => {
  let wsUrl

  beforeAll(async () => {
    const app = express()
    const { server: wsServer } = setupWebSocket(app, {
      JWT_SECRET: process.env.JWT_SECRET,
      rooms: new Map(),
      matchQueue: [],
      db: dbRef,
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

  function makeToken(id, username) {
    return jwt.sign({ id, username, isAdmin: false, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' })
  }

  it('gr.findMatch без auth → gr.error reason=auth_required', async () => {
    const client = makeClient(wsUrl)
    await client.opened
    client.send({ type: 'gr.findMatch', mode: 'ffa' })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('auth_required')
    client.close()
  })

  it('gr.move без комнаты → gr.error reason=not_in_room', async () => {
    const token = makeToken(96001, 'gr_user_1')
    const client = makeClient(`${wsUrl}?token=${token}`)
    await client.opened
    client.send({ type: 'gr.move', action: { type: 'pass' } })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('not_in_room')
    client.close()
  })

  it('gr.resign без комнаты → gr.error reason=not_in_room', async () => {
    const token = makeToken(96002, 'gr_user_2')
    const client = makeClient(`${wsUrl}?token=${token}`)
    await client.opened
    client.send({ type: 'gr.resign' })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('not_in_room')
    client.close()
  })

  it('gr.teamChat без комнаты → gr.error reason=not_in_room', async () => {
    const token = makeToken(96003, 'gr_user_3')
    const client = makeClient(`${wsUrl}?token=${token}`)
    await client.opened
    client.send({ type: 'gr.teamChat', text: 'hello team' })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('not_in_room')
    client.close()
  })

  it('gr.reconnect без auth → gr.error reason=auth_required', async () => {
    const client = makeClient(wsUrl)
    await client.opened
    client.send({ type: 'gr.reconnect', roomId: 'WHATEVR' })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('auth_required')
    client.close()
  })

  it('gr.reconnect с auth, но без активной комнаты → gr.error reason=no_room', async () => {
    const token = makeToken(96004, 'gr_user_4')
    const client = makeClient(`${wsUrl}?token=${token}`)
    await client.opened
    client.send({ type: 'gr.reconnect', roomId: 'NOEXST' })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('no_room')
    client.close()
  })

  it('gr.cancelMatch без активной очереди → gr.queued cancelled=true', async () => {
    const client = makeClient(wsUrl)
    await client.opened
    client.send({ type: 'gr.cancelMatch' })
    const msg = await client.waitFor('gr.queued')
    expect(msg.cancelled).toBe(true)
    client.close()
  })

  it('неизвестный gr.* type → gr.error reason=unknown_gr_type', async () => {
    const client = makeClient(wsUrl)
    await client.opened
    client.send({ type: 'gr.somethingMadeUp' })
    const msg = await client.waitFor('gr.error')
    expect(msg.reason).toBe('unknown_gr_type')
    client.close()
  })
})
