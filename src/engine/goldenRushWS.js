/**
 * Golden Rush Online — клиентский WS-хук.
 *
 * Единое соединение /ws с токеном из URL (тот же механизм что у 2p).
 * Обрабатывает gr.* сообщения, игнорирует остальные (они прилетают от 2p-игры).
 *
 * Использование:
 *   const { status, roomId, state, players, yourSlot, winner, error, send, ... } = useGoldenRushWS()
 *   send({ type: 'gr.findMatch', mode: '2v2' })
 *   send({ type: 'gr.move', action: {...} })
 */

import { useEffect, useRef, useState, useCallback } from 'react'

function getToken() {
  try {
    const raw = localStorage.getItem('stolbiki_profile')
    if (!raw) return null
    const p = JSON.parse(raw)
    return p?.token || null
  } catch { return null }
}

function buildWsUrl() {
  const token = getToken()
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = location.host
  const q = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${proto}//${host}/ws${q}`
}

export function useGoldenRushWS() {
  const [status, setStatus] = useState('idle')     // idle | connecting | queued | playing | gameover | error
  const [roomId, setRoomId] = useState(null)
  const [state, setState] = useState(null)         // serialized GoldenRushState
  const [players, setPlayers] = useState([])       // [{ slot, name, rating }]
  const [yourSlot, setYourSlot] = useState(null)
  const [winner, setWinner] = useState(null)
  const [scores, setScores] = useState(null)
  const [queuePos, setQueuePos] = useState(null)
  const [queueMode, setQueueMode] = useState(null)
  const [error, setError] = useState(null)
  const [teamChat, setTeamChat] = useState([])     // [{ from, slot, text, ts }]
  const [reactions, setReactions] = useState([])   // ephemeral
  const [playerLeftSlot, setPlayerLeftSlot] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const savedRoomRef = useRef(null)

  const send = useCallback((obj) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1) {
      console.warn('[gr] send while not open:', obj?.type)
      return false
    }
    try { ws.send(JSON.stringify(obj)); return true }
    catch (e) { console.warn('[gr] send error:', e); return false }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return
    setStatus(s => s === 'idle' ? 'connecting' : s)
    try {
      const ws = new WebSocket(buildWsUrl())
      wsRef.current = ws

      ws.addEventListener('open', () => {
        // Если была комната — пробуем reconnect
        if (savedRoomRef.current) {
          try { ws.send(JSON.stringify({ type: 'gr.reconnect', roomId: savedRoomRef.current })) } catch {}
        }
      })

      ws.addEventListener('message', (ev) => {
        let msg
        try { msg = JSON.parse(ev.data) } catch { return }
        if (!msg?.type) return
        if (!msg.type.startsWith('gr.')) return // не наше

        switch (msg.type) {
          case 'gr.queued':
            setQueuePos(msg.cancelled ? null : msg.position)
            setStatus(msg.cancelled ? 'idle' : 'queued')
            break
          case 'gr.matchFound':
            setRoomId(msg.roomId)
            savedRoomRef.current = msg.roomId
            setPlayers(msg.players || [])
            setYourSlot(msg.yourSlot)
            setState(msg.state)
            setQueuePos(null)
            setStatus('playing')
            setWinner(null)
            setError(null)
            setTeamChat([])
            break
          case 'gr.state':
            setState(msg.state)
            break
          case 'gr.gameOver':
            setState(msg.state)
            setWinner(msg.winner)
            setScores(msg.scores || msg.state?.scores || null)
            setStatus('gameover')
            break
          case 'gr.reconnected':
            setRoomId(msg.roomId)
            savedRoomRef.current = msg.roomId
            setPlayers(msg.players || [])
            setYourSlot(msg.slot)
            setState(msg.state)
            setStatus(msg.state?.gameOver ? 'gameover' : 'playing')
            break
          case 'gr.teamChat':
            setTeamChat(list => [...list.slice(-19), {
              from: msg.from, slot: msg.slot, text: msg.text, ts: Date.now(),
            }])
            break
          case 'gr.reaction': {
            const id = Math.random().toString(36).slice(2)
            setReactions(rs => [...rs, { id, slot: msg.slot, emoji: msg.emoji, ts: Date.now() }])
            setTimeout(() => setReactions(rs => rs.filter(r => r.id !== id)), 2500)
            break
          }
          case 'gr.playerLeft':
            setPlayerLeftSlot(msg.slot)
            setTimeout(() => setPlayerLeftSlot(null), 3000)
            break
          case 'gr.error':
            setError(msg.reason || 'unknown')
            setTimeout(() => setError(null), 4000)
            break
        }
      })

      ws.addEventListener('close', () => {
        wsRef.current = null
        // Авто-реконнект если были в игре
        if (savedRoomRef.current && status !== 'idle') {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
          reconnectTimerRef.current = setTimeout(() => connect(), 2000)
        }
      })

      ws.addEventListener('error', () => {
        setError('connection_error')
      })
    } catch (e) {
      setError('connect_failed')
      console.error('[gr] connect error:', e)
    }
  }, [status])

  const disconnect = useCallback(() => {
    savedRoomRef.current = null
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null }
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setStatus('idle')
    setRoomId(null)
    setState(null)
    setPlayers([])
    setYourSlot(null)
    setWinner(null)
    setScores(null)
    setQueuePos(null)
    setTeamChat([])
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      try { wsRef.current?.close() } catch {}
      wsRef.current = null
    }
  }, [])

  // Высокоуровневые actions
  const findMatch = useCallback((mode = '2v2') => {
    if (!wsRef.current || wsRef.current.readyState !== 1) connect()
    setQueueMode(mode)
    // Ждём open и посылаем
    const trySend = () => {
      if (wsRef.current?.readyState === 1) {
        send({ type: 'gr.findMatch', mode })
      } else if (wsRef.current?.readyState === 0) {
        wsRef.current.addEventListener('open', () => send({ type: 'gr.findMatch', mode }), { once: true })
      }
    }
    trySend()
  }, [connect, send])

  const cancelMatch = useCallback(() => {
    send({ type: 'gr.cancelMatch' })
    setStatus('idle')
    setQueuePos(null)
    setQueueMode(null)
  }, [send])

  const sendMove = useCallback((action) => send({ type: 'gr.move', action }), [send])
  const resign = useCallback(() => send({ type: 'gr.resign' }), [send])
  const sendTeamChat = useCallback((text) => send({ type: 'gr.teamChat', text }), [send])
  const sendReaction = useCallback((emoji) => send({ type: 'gr.reaction', emoji }), [send])

  return {
    status, roomId, state, players, yourSlot, winner, scores,
    queuePos, queueMode, error, teamChat, reactions, playerLeftSlot,
    connect, disconnect,
    findMatch, cancelMatch, sendMove, resign, sendTeamChat, sendReaction,
    isConnected: !!wsRef.current && wsRef.current.readyState === 1,
    hasToken: !!getToken(),
  }
}
