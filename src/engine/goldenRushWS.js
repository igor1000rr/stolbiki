/**
 * Golden Rush Online — клиентский WS-хук.
 *
 * Единое соединение /ws с токеном из URL (тот же механизм что у 2p).
 * Обрабатывает gr.* сообщения, игнорирует остальные (они прилетают от 2p-игры).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { computeMyReward } from './goldenRushReward.js'

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
  const [status, setStatus] = useState('idle')
  const [roomId, setRoomId] = useState(null)
  const [state, setState] = useState(null)
  const [players, setPlayers] = useState([])
  const [yourSlot, setYourSlot] = useState(null)
  const [winner, setWinner] = useState(null)
  const [scores, setScores] = useState(null)
  const [queuePos, setQueuePos] = useState(null)
  const [queueMode, setQueueMode] = useState(null)
  const [error, setError] = useState(null)
  const [teamChat, setTeamChat] = useState([])
  const [reactions, setReactions] = useState([])
  const [playerLeftSlot, setPlayerLeftSlot] = useState(null)
  const [resignedBy, setResignedBy] = useState(null)
  const [myReward, setMyReward] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const savedRoomRef = useRef(null)
  // Текущий yourSlot храним в ref'е чтобы в handler'е message видеть актуальное
  // значение (handler замыкает старый state из-за единого connect вызова).
  const yourSlotRef = useRef(null)

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
        if (savedRoomRef.current) {
          try { ws.send(JSON.stringify({ type: 'gr.reconnect', roomId: savedRoomRef.current })) } catch {}
        }
      })

      ws.addEventListener('message', (ev) => {
        let msg
        try { msg = JSON.parse(ev.data) } catch { return }
        if (!msg?.type) return
        if (!msg.type.startsWith('gr.')) return

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
            yourSlotRef.current = msg.yourSlot
            setState(msg.state)
            setQueuePos(null)
            setStatus('playing')
            setWinner(null)
            setError(null)
            setTeamChat([])
            setResignedBy(null)
            setMyReward(null)
            break
          case 'gr.state':
            setState(msg.state)
            break
          case 'gr.gameOver':
            setState(msg.state)
            setWinner(msg.winner)
            setScores(msg.scores || msg.state?.scores || null)
            setResignedBy(msg.resignedBy != null ? msg.resignedBy : null)
            setMyReward(computeMyReward({
              state: msg.state,
              winner: msg.winner,
              resignedBy: msg.resignedBy,
              rewards: msg.rewards,
              yourSlot: yourSlotRef.current,
            }))
            setStatus('gameover')
            savedRoomRef.current = null
            break
          case 'gr.reconnected':
            setRoomId(msg.roomId)
            savedRoomRef.current = msg.roomId
            setPlayers(msg.players || [])
            setYourSlot(msg.slot)
            yourSlotRef.current = msg.slot
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
            if (msg.reason === 'no_room' && !savedRoomRef.current) break
            setError(msg.reason || 'unknown')
            setTimeout(() => setError(null), 4000)
            break
        }
      })

      ws.addEventListener('close', () => {
        wsRef.current = null
        if (savedRoomRef.current && (status === 'playing' || status === 'queued')) {
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
    yourSlotRef.current = null
    setWinner(null)
    setScores(null)
    setQueuePos(null)
    setTeamChat([])
    setError(null)
    setResignedBy(null)
    setMyReward(null)
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      try { wsRef.current?.close() } catch {}
      wsRef.current = null
    }
  }, [])

  const findMatch = useCallback((mode = '2v2') => {
    if (!wsRef.current || wsRef.current.readyState !== 1) connect()
    setQueueMode(mode)
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
    resignedBy, myReward,
    connect, disconnect,
    findMatch, cancelMatch, sendMove, resign, sendTeamChat, sendReaction,
    isConnected: !!wsRef.current && wsRef.current.readyState === 1,
    hasToken: !!getToken(),
  }
}
