/**
 * WebSocket клиент для онлайн мультиплеера
 * JWT auth через query param, reconnect с лимитом
 */

const WS_BASE = window.__SH_WS_BASE || (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws'
const API = '/api'

function getWsUrl() {
  const token = localStorage.getItem('stolbiki_token')
  return token ? `${WS_BASE}?token=${encodeURIComponent(token)}` : WS_BASE
}

let ws = null
let onMessage = null
let reconnectTimer = null
let intentionalClose = false
let reconnectAttempts = 0
const MAX_RECONNECT = 10

export function connect(roomId, name, callback) {
  onMessage = callback
  intentionalClose = false
  reconnectAttempts = 0
  if (ws) { intentionalClose = true; ws.close() }
  intentionalClose = false

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    reconnectAttempts = 0
    ws.send(JSON.stringify({ type: 'join', roomId, name }))
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (onMessage) onMessage(msg)
    } catch {}
  }

  ws.onclose = () => {
    if (intentionalClose) return
    if (onMessage) onMessage({ type: 'disconnected', playerIdx: -1 })
    if (reconnectAttempts < MAX_RECONNECT) {
      const delay = Math.min(3000 * (reconnectAttempts + 1), 15000)
      reconnectAttempts++
      reconnectTimer = setTimeout(() => connect(roomId, name, callback), delay)
    }
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

export function sendRematchOffer() {
  send({ type: 'rematchOffer' })
}

export function sendRematchResponse(accepted) {
  send({ type: 'rematchResponse', accepted })
}

export function findMatch(name, callback) {
  onMessage = callback
  intentionalClose = false
  reconnectAttempts = 0
  if (ws) { intentionalClose = true; ws.close() }
  intentionalClose = false

  ws = new WebSocket(getWsUrl())
  ws.onopen = () => { reconnectAttempts = 0; ws.send(JSON.stringify({ type: 'findMatch', name })) }
  ws.onmessage = (e) => { try { if (onMessage) onMessage(JSON.parse(e.data)) } catch {} }
  ws.onclose = () => { if (!intentionalClose && onMessage) onMessage({ type: 'disconnected' }) }
  ws.onerror = () => {}
}

export function cancelMatch() {
  send({ type: 'cancelMatch' })
}

export function disconnect() {
  intentionalClose = true
  clearTimeout(reconnectTimer)
  onMessage = null
  reconnectAttempts = 0
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

export async function getActiveRooms() {
  const res = await fetch(`${API}/rooms/active`)
  if (!res.ok) return []
  return await res.json()
}

export function spectateRoom(roomId, callback) {
  onMessage = callback
  intentionalClose = false
  reconnectAttempts = 0
  if (ws) { intentionalClose = true; ws.close() }
  intentionalClose = false

  ws = new WebSocket(getWsUrl())
  ws.onopen = () => {
    reconnectAttempts = 0
    ws.send(JSON.stringify({ type: 'spectate', roomId }))
  }
  ws.onmessage = (e) => { try { if (onMessage) onMessage(JSON.parse(e.data)) } catch {} }
  ws.onclose = () => { if (!intentionalClose && onMessage) onMessage({ type: 'disconnected' }) }
  ws.onerror = () => {}
}

// Reconnect при возврате из фона (Capacitor + PWA)
if (typeof window !== 'undefined') {
  window.addEventListener('stolbiki-app-resume', () => {
    if (ws && ws.readyState !== 1 && onMessage && !intentionalClose) {
      console.log('WS reconnect on resume')
      reconnectAttempts = 0
      try {
        const newWs = new WebSocket(getWsUrl())
        newWs.onopen = () => { ws = newWs; reconnectAttempts = 0 }
        newWs.onmessage = (e) => { try { if (onMessage) onMessage(JSON.parse(e.data)) } catch {} }
        newWs.onclose = () => {}
        newWs.onerror = () => {}
      } catch {}
    }
  })
}
