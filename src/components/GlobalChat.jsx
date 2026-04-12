/**
 * GlobalChat — глобальный чат в реальном времени
 * Issue #6: Социальный слой
 *
 * Подключается через тот же WS что и мультиплеер:
 *   - joinGlobalChat / leaveGlobalChat
 *   - globalChat { text }
 *   - chatHistory { messages }
 *   - chatOnline { count }
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import * as API from '../engine/api'

const MAX_MSG_LEN = 300
const CHANNEL = 'global'

export default function GlobalChat({ lang = 'ru', compact = false }) {
  const en = lang === 'en'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [online, setOnline] = useState(0)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const mounted = useRef(true)

  // WS-подключение
  useEffect(() => {
    mounted.current = true
    const token = localStorage.getItem('stolbiki_token')
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/ws${token ? `?token=${token}` : ''}`

    let ws
    let retryTimer = null
    let alive = true

    const connect = () => {
      if (!alive) return
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!alive) return
        ws.send(JSON.stringify({ type: 'joinGlobalChat', channel: CHANNEL }))
      }

      ws.onmessage = (e) => {
        if (!mounted.current) return
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'chatHistory') {
            setMessages(msg.messages || [])
          } else if (msg.type === 'globalChat') {
            setMessages(prev => [...prev.slice(-199), msg]) // держим макс 200 в памяти
          } else if (msg.type === 'chatOnline') {
            setOnline(msg.count || 0)
          }
        } catch {}
      }

      ws.onclose = () => {
        if (!alive || !mounted.current) return
        // Реконнект через 3с
        retryTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {}
    }

    connect()

    return () => {
      alive = false
      mounted.current = false
      clearTimeout(retryTimer)
      try { ws?.close() } catch {}
    }
  }, [])

  // Автоскролл вниз
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || text.length > MAX_MSG_LEN) return
    if (!API.isLoggedIn()) { setError(en ? 'Login to chat' : 'Войдите чтобы писать'); return }

    const ws = wsRef.current
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: 'globalChat', text }))
      setInput('')
    } else {
      // Fallback через REST
      setSending(true)
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({ channel: CHANNEL, text }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) { setInput(''); setMessages(prev => [...prev, d]) }
          else setError(d.error || 'Ошибка')
        })
        .catch(() => setError(en ? 'Network error' : 'Нет соединения'))
        .finally(() => setSending(false))
    }
  }, [input, en])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString(en ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit' })
  }

  const isLoggedIn = API.isLoggedIn()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: compact ? 340 : 480,
      border: '1px solid var(--surface2)',
      borderRadius: 12,
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      {/* Шапка */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          💬 {en ? 'Global Chat' : 'Глобальный чат'}
        </span>
        {online > 0 && (
          <span style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            {online} {en ? 'online' : 'онлайн'}
          </span>
        )}
      </div>

      {/* Список сообщений */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--ink3)', fontSize: 12, marginTop: 40 }}>
            {en ? 'Be the first to say hi 👋' : 'Будьте первым! 👋'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0, marginTop: 2, minWidth: 36 }}>
              {formatTime(m.created_at)}
            </span>
            <span style={{ fontSize: 12, flex: 1, wordBreak: 'break-word', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)', marginRight: 5 }}>{m.username}</span>
              <span style={{ color: 'var(--ink)' }}>{m.text}</span>
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--surface2)', display: 'flex', gap: 8 }}>
        {!isLoggedIn ? (
          <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', width: '100%', padding: '6px 0' }}>
            {en ? 'Login to participate' : 'Войдите чтобы написать'}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value.slice(0, MAX_MSG_LEN)); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder={en ? 'Write a message...' : 'Написать сообщение...'}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 8,
                border: '1px solid var(--surface3)',
                background: 'var(--surface2)',
                color: 'var(--ink)', fontSize: 13,
                outline: 'none',
              }}
              maxLength={MAX_MSG_LEN}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="btn primary"
              style={{ padding: '7px 14px', fontSize: 12, minWidth: 0, flexShrink: 0 }}
            >
              {en ? 'Send' : 'Отпр.'}
            </button>
          </>
        )}
      </div>
      {error && <div style={{ padding: '2px 14px 8px', fontSize: 11, color: 'var(--p2)' }}>{error}</div>}
    </div>
  )
}
