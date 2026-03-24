/**
 * WebSocket клиент для онлайн мультиплеера
 * Поддержка аутентификации через JWT token в query param
 */

const WS_BASE = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws'
const API = '/api'

function getWsUrl() {
  const token = localStorage.getItem('stolbiki_token')
  return token ? `${WS_BASE}?token=${encodeURIComponent(token)}` : WS_BASE
}

let ws = null
let onMessage = null
let reconnectTimer = null

export function connect(roomId, name, callback) {
  onMessage = callback
  if (ws) ws.close()

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', roomId, name }))
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (onMessage) onMessage(msg)
    } catch {}
  }

  ws.onclose = () => {
    if (onMessage) onMessage({ type: 'disconnected', playerIdx: -1 })
    // Реконнект через 3 сек
    reconnectTimer = setTimeout(() => connect(roomId, name, callback), 3000)
  }

  ws.onerror = () => {}
}

export function send(msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg))
}

export function sendMove(action) {
  send({ type: 'move', action })
}

export function sendGameOver(winner) {
  send({ type: 'gameOver', winner })
}

export function sendChat(text) {
  send({ type: 'chat', text })
}

export function findMatch(name, callback) {
  onMessage = callback
  if (ws) ws.close()
  ws = new WebSocket(getWsUrl())
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'findMatch', name })) }
  ws.onmessage = (e) => { try { if (onMessage) onMessage(JSON.parse(e.data)) } catch {} }
  ws.onclose = () => { if (onMessage) onMessage({ type: 'disconnected' }) }
  ws.onerror = () => {}
}

export function cancelMatch() {
  send({ type: 'cancelMatch' })
}

export function disconnect() {
  clearTimeout(reconnectTimer)
  onMessage = null
  if (ws) { ws.close(); ws = null }
}

export async function createRoom(mode = 'single') {
  const res = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  return (await res.json()).roomId
}

export async function getRoomInfo(roomId) {
  const res = await fetch(`${API}/rooms/${roomId}`)
  if (!res.ok) return null
  return await res.json()
}
