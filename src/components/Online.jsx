import { useState, useEffect, useRef } from 'react'
import * as MP from '../engine/multiplayer'

// Ежедневный челлендж
function DailyChallenge() {
  const [daily, setDaily] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/daily').then(r => r.json()).catch(() => null),
      fetch('/api/daily/leaderboard').then(r => r.json()).catch(() => ({ results: [] })),
    ]).then(([d, lb]) => {
      setDaily(d)
      setLeaderboard(lb?.results || [])
      setLoading(false)
    })
  }, [])

  function startDaily() {
    // Передаём событие в Game.jsx для запуска daily
    window.dispatchEvent(new CustomEvent('stolbiki-daily-start', { detail: daily }))
  }

  if (loading) return <div style={{ textAlign: 'center', color: '#6e6a82', fontSize: 12, padding: 20 }}>Загрузка...</div>
  if (!daily) return null

  const dateStr = daily.date || daily.seed
  return (
    <div className="dash-card" style={{ maxWidth: 440, margin: '16px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 32 }}>📅</span>
        <div>
          <h3 style={{ fontSize: 16, color: '#eae8f2', textTransform: 'none', letterSpacing: 0, margin: 0 }}>
            Ежедневный челлендж
          </h3>
          <span style={{ fontSize: 11, color: '#6e6a82' }}>#{dateStr} · Одинаковый для всех</span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#a09cb0', marginBottom: 12, lineHeight: 1.6 }}>
        У всех одинаковая начальная позиция. Победите AI за минимум ходов!
      </p>

      <button className="btn primary" onClick={startDaily}
        style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 0', marginBottom: 12 }}>
        🎯 Играть
      </button>

      {leaderboard.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#6e6a82', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Таблица лидеров
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {leaderboard.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                borderRadius: 6, background: i === 0 ? 'rgba(255,193,69,0.06)' : 'transparent',
                fontSize: 12,
              }}>
                <span style={{ width: 20, fontWeight: 700, color: i === 0 ? '#ffc145' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#6e6a82' }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, color: '#e8e6f0' }}>{r.username}</span>
                <span style={{ color: '#a09cb0', fontSize: 11 }}>{r.turns} ходов</span>
                <span style={{ color: '#6e6a82', fontSize: 10 }}>
                  {r.duration ? `${Math.floor(r.duration/60)}:${String(r.duration%60).padStart(2,'0')}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {leaderboard.length === 0 && (
        <div style={{ textAlign: 'center', color: '#6e6a82', fontSize: 11, padding: '8px 0' }}>
          Пока никто не играл сегодня — будьте первым!
        </div>
      )}
    </div>
  )
}

// QR генерация через canvas (без библиотек)
function QRCode({ text, size = 160 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !text) return
    // Простой QR через Google Charts API (fallback)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=1a1a2a&color=eae8f2`
    img.onload = () => {
      const ctx = ref.current.getContext('2d')
      ctx.fillStyle = '#1a1a2a'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
    }
  }, [text, size])
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }} />
}

export default function Online() {
  const [screen, setScreen] = useState('lobby') // lobby | waiting | playing | result
  const [roomId, setRoomId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [playerName, setPlayerName] = useState(localStorage.getItem('stolbiki_online_name') || '')
  const [playerIdx, setPlayerIdx] = useState(-1)
  const [players, setPlayers] = useState([])
  const [mode, setMode] = useState('single') // single | tournament3 | tournament5
  const [scores, setScores] = useState([0, 0])
  const [currentGame, setCurrentGame] = useState(0)
  const [totalGames, setTotalGames] = useState(1)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [tournamentResult, setTournamentResult] = useState(null)

  // Refs для актуальных значений в WS callback (не stale)
  const roomIdRef = useRef('')
  const playerIdxRef = useRef(-1)
  const playersRef = useRef([])
  useEffect(() => { roomIdRef.current = roomId }, [roomId])
  useEffect(() => { playerIdxRef.current = playerIdx }, [playerIdx])
  useEffect(() => { playersRef.current = players }, [players])

  // Обработчик WS сообщений
  function handleWS(msg) {
    switch (msg.type) {
      case 'joined':
        setRoomId(msg.roomId)
        roomIdRef.current = msg.roomId
        setPlayerIdx(msg.playerIdx)
        playerIdxRef.current = msg.playerIdx
        setMode(msg.mode || 'single')
        setTotalGames(msg.totalGames || 1)
        setScreen('waiting')
        setStatus('Ждём второго игрока...')
        break
      case 'waiting':
        setPlayers(msg.players)
        playersRef.current = msg.players
        setScreen('waiting')
        break
      case 'start':
        setPlayers(msg.players)
        playersRef.current = msg.players
        setScores(msg.scores || [0, 0])
        setCurrentGame(msg.currentGame || 1)
        setScreen('playing')
        setStatus('')
        // Передаём в Game через window event (используем refs — актуальные значения)
        window.dispatchEvent(new CustomEvent('stolbiki-online-start', {
          detail: { players: msg.players, firstPlayer: msg.firstPlayer, roomId: roomIdRef.current, playerIdx: playerIdxRef.current }
        }))
        break
      case 'move':
        window.dispatchEvent(new CustomEvent('stolbiki-online-move', { detail: msg.action }))
        break
      case 'nextGame':
        setScores(msg.scores)
        setCurrentGame(msg.currentGame)
        window.dispatchEvent(new CustomEvent('stolbiki-online-start', {
          detail: { players: playersRef.current, firstPlayer: msg.firstPlayer, roomId: roomIdRef.current, playerIdx: playerIdxRef.current, nextGame: true }
        }))
        break
      case 'tournamentOver':
        setTournamentResult(msg)
        setScreen('result')
        break
      case 'chat':
        setMessages(prev => [...prev.slice(-50), { from: msg.from, text: msg.text, time: Date.now() }])
        break
      case 'disconnected':
        if (msg.playerIdx !== playerIdxRef.current) setStatus('Противник отключился... ждём реконнект')
        break
      case 'error':
        setError(msg.msg)
        break
    }
  }

  async function createRoom() {
    if (!playerName.trim()) { setError('Введите имя'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    try {
      const id = await MP.createRoom(mode)
      setRoomId(id)
      MP.connect(id, playerName.trim(), handleWS)
    } catch { setError('Ошибка создания комнаты') }
  }

  async function joinRoom() {
    if (!playerName.trim()) { setError('Введите имя'); return }
    if (!joinCode.trim()) { setError('Введите код комнаты'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    const code = joinCode.trim().toUpperCase()
    MP.connect(code, playerName.trim(), handleWS)
  }

  function sendChat() {
    if (!chatInput.trim()) return
    MP.sendChat(chatInput.trim())
    setChatInput('')
  }

  function backToLobby() {
    MP.disconnect()
    setScreen('lobby')
    setRoomId('')
    setError('')
    setStatus('')
    setTournamentResult(null)
    setMessages([])
    setScores([0, 0])
  }

  useEffect(() => () => MP.disconnect(), [])

  const roomUrl = roomId ? `${location.origin}?room=${roomId}` : ''

  // Проверяем URL при загрузке
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const room = params.get('room')
    if (room) {
      setJoinCode(room)
      // Убираем room из URL
      history.replaceState(null, '', location.pathname)
    }
  }, [])

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(20,20,32,0.8)', color: '#eae8f2', fontSize: 14, boxSizing: 'border-box', marginBottom: 10,
    fontFamily: 'Outfit, sans-serif',
  }

  // ─── LOBBY ───
  if (screen === 'lobby') {
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 440, margin: '20px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
          <h3 style={{ fontSize: 18, marginBottom: 4, color: '#eae8f2', textTransform: 'none', letterSpacing: 0 }}>Онлайн</h3>
          <p style={{ color: '#6e6a82', fontSize: 12, marginBottom: 16 }}>Играй с другом по ссылке — без регистрации</p>

          {error && <div style={{ color: '#ff6066', fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <input type="text" placeholder="Ваше имя" value={playerName}
            onChange={e => setPlayerName(e.target.value)} style={inputStyle} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['single', '1 партия'], ['tournament3', 'Серия 3'], ['tournament5', 'Серия 5']].map(([m, l]) => (
              <button key={m} className={`btn ${mode === m ? 'primary' : ''}`}
                onClick={() => setMode(m)} style={{ flex: 1, fontSize: 11, padding: '8px 6px', justifyContent: 'center' }}>
                {l}
              </button>
            ))}
          </div>

          <button className="btn primary" onClick={createRoom}
            style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 0', marginBottom: 16 }}>
            🎮 Создать комнату
          </button>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <p style={{ color: '#6e6a82', fontSize: 11, marginBottom: 8 }}>Или введите код друга:</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="КОД" value={joinCode} maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{ ...inputStyle, marginBottom: 0, textAlign: 'center', letterSpacing: 4, fontWeight: 700, fontSize: 18, flex: 1 }} />
              <button className="btn" onClick={joinRoom} style={{ whiteSpace: 'nowrap' }}>Войти</button>
            </div>
          </div>
        </div>

        {/* QR код сайта */}
        <div className="dash-card" style={{ maxWidth: 440, margin: '16px auto', textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>QR — открой с телефона</h3>
          <QRCode text={location.origin} size={180} />
          <p style={{ color: '#6e6a82', fontSize: 11, marginTop: 10 }}>Отсканируй чтобы играть на телефоне</p>
        </div>

        {/* Ежедневный челлендж */}
        <DailyChallenge />
      </div>
    )
  }

  // ─── WAITING ───
  if (screen === 'waiting') {
    return (
      <div className="dash-card" style={{ maxWidth: 440, margin: '20px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <h3 style={{ fontSize: 16, color: '#eae8f2', textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          Комната {roomId}
        </h3>
        <p style={{ color: '#a8a4b8', fontSize: 13, marginBottom: 16 }}>
          {mode === 'tournament3' ? 'Турнир: серия из 3' : mode === 'tournament5' ? 'Турнир: серия из 5' : 'Одна партия'}
        </p>

        {/* Код */}
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: '#f06040', marginBottom: 16,
          fontFamily: 'DM Serif Display, serif' }}>
          {roomId}
        </div>

        {/* QR ссылки на комнату */}
        <QRCode text={roomUrl} size={160} />

        <p style={{ color: '#6e6a82', fontSize: 11, marginTop: 10, marginBottom: 8 }}>
          Отправь ссылку или код другу
        </p>

        <button className="btn" onClick={() => {
          if (navigator.share) navigator.share({ text: `Играем в Стойки! Комната: ${roomId}`, url: roomUrl }).catch(() => {})
          else navigator.clipboard?.writeText(roomUrl)
        }} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
          📤 Поделиться ссылкой
        </button>

        <div className="thinking-dots" style={{ color: '#6e6a82', fontSize: 13 }}>Ждём второго игрока</div>

        <button className="btn" onClick={backToLobby} style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: 12 }}>
          ← Назад
        </button>
      </div>
    )
  }

  // ─── PLAYING ───
  if (screen === 'playing') {
    return (
      <div>
        {/* Турнирный счёт */}
        {totalGames > 1 && (
          <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12,
            background: 'rgba(240,96,64,0.06)', borderRadius: 12, border: '1px solid rgba(240,96,64,0.1)' }}>
            <span style={{ fontSize: 11, color: '#a8a4b8' }}>Партия {currentGame}/{totalGames}</span>
            <span style={{ fontSize: 16, fontWeight: 700, margin: '0 12px', color: '#eae8f2' }}>
              {scores[0]} : {scores[1]}
            </span>
            <span style={{ fontSize: 11, color: '#6e6a82' }}>
              {players[0]} vs {players[1]}
            </span>
          </div>
        )}

        {status && (
          <div style={{ textAlign: 'center', padding: 8, color: '#ffc145', fontSize: 12, marginBottom: 8 }}>
            {status}
          </div>
        )}

        {/* Чат */}
        {messages.length > 0 && (
          <div style={{ maxHeight: 80, overflowY: 'auto', padding: '6px 10px', marginBottom: 8,
            background: 'rgba(26,26,42,0.5)', borderRadius: 8, fontSize: 11 }}>
            {messages.slice(-5).map((m, i) => (
              <div key={i} style={{ color: m.from === playerIdx ? '#4a9eff' : '#ff6066' }}>
                <b>{players[m.from] || '?'}:</b> {m.text}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder="Сообщение..." style={{ ...inputStyle, marginBottom: 0, flex: 1, fontSize: 12, padding: '6px 10px' }} />
          <button className="btn" onClick={sendChat} style={{ fontSize: 11, padding: '6px 12px', minHeight: 0 }}>↑</button>
        </div>
      </div>
    )
  }

  // ─── TOURNAMENT RESULT ───
  if (screen === 'result' && tournamentResult) {
    const w = tournamentResult.winner
    const won = w === playerIdx
    const draw = w === -1
    return (
      <div className="dash-card" style={{ maxWidth: 440, margin: '20px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{draw ? '🤝' : won ? '🏆' : '😔'}</div>
        <h3 style={{ fontSize: 20, color: '#eae8f2', textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          {draw ? 'Ничья!' : won ? 'Вы победили в турнире!' : 'Противник победил'}
        </h3>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#eae8f2', margin: '12px 0' }}>
          <span style={{ color: won || draw ? '#3dd68c' : '#ff6066' }}>{tournamentResult.scores[playerIdx]}</span>
          <span style={{ color: '#32324a', margin: '0 8px' }}>:</span>
          <span style={{ color: !won || draw ? '#3dd68c' : '#ff6066' }}>{tournamentResult.scores[1 - playerIdx]}</span>
        </div>
        <p style={{ color: '#6e6a82', fontSize: 12, marginBottom: 16 }}>
          {players[0]} vs {players[1]} • {totalGames} партий
        </p>
        <button className="btn primary" onClick={backToLobby} style={{ width: '100%', justifyContent: 'center' }}>
          Новый матч
        </button>
      </div>
    )
  }

  return null
}
