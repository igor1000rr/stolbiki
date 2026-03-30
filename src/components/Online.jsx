import { useState, useEffect, useRef } from 'react'
import * as MP from '../engine/multiplayer'
import { useI18n } from '../engine/i18n'
import Icon from './Icon'

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
    <div className="dash-card" style={{ maxWidth: 560, margin: '16px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24, opacity: 0.5 }}>Daily</span>
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
        Играть
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
  const { lang } = useI18n()
  const en = lang === 'en'
  const [screen, setScreen] = useState('lobby') // lobby | waiting | playing | result | searching
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
  const [activeRooms, setActiveRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)

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
      case 'resign':
        window.dispatchEvent(new CustomEvent('stolbiki-online-resign', { detail: { from: msg.from } }))
        break
      case 'serverGameOver':
        // Серверное подтверждение gameOver — обновляем счёт
        setScores(msg.scores)
        // Если клиент ещё не показал gameOver — форсируем через событие
        window.dispatchEvent(new CustomEvent('stolbiki-online-server-gameover', {
          detail: { winner: msg.winner, scores: msg.scores }
        }))
        break
      case 'drawOffer':
        window.dispatchEvent(new CustomEvent('stolbiki-online-draw-offer', { detail: { from: msg.from } }))
        break
      case 'drawResponse':
        window.dispatchEvent(new CustomEvent('stolbiki-online-draw-response', { detail: { accepted: msg.accepted } }))
        break
      case 'rematchOffer':
        window.dispatchEvent(new CustomEvent('stolbiki-online-rematch-offer', { detail: { from: msg.from } }))
        break
      case 'rematchDeclined':
        window.dispatchEvent(new CustomEvent('stolbiki-online-rematch-declined'))
        break
      case 'rematchStart':
        setScores(msg.scores || [0, 0])
        setScreen('playing')
        window.dispatchEvent(new CustomEvent('stolbiki-online-start', {
          detail: { players: msg.players, firstPlayer: msg.firstPlayer, roomId: roomIdRef.current, playerIdx: playerIdxRef.current, nextGame: true }
        }))
        break
      case 'disconnected':
        if (msg.playerIdx !== playerIdxRef.current) setStatus('Противник отключился... ждём реконнект')
        break
      case 'error':
        setError(msg.msg)
        break
      case 'queued':
        setScreen('searching')
        break
      case 'matchFound':
        setRoomId(msg.roomId)
        roomIdRef.current = msg.roomId
        setPlayerIdx(msg.playerIdx)
        playerIdxRef.current = msg.playerIdx
        break
      case 'matchCancelled':
        setScreen('lobby')
        break
      case 'spectateJoined':
        setScreen('spectating')
        setPlayers(msg.players || [])
        playersRef.current = msg.players || []
        setScores(msg.scores || [0, 0])
        // Передаём состояние в Game.jsx через событие
        window.dispatchEvent(new CustomEvent('stolbiki-spectate-start', {
          detail: {
            players: msg.players,
            firstPlayer: msg.firstPlayer ?? 0,
            gameState: msg.gameState,
            spectators: msg.spectators,
          }
        }))
        break
    }
  }

  async function createRoom() {
    if (!playerName.trim()) { setError(en ? 'Enter name' : 'Введите имя'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    try {
      const id = await MP.createRoom(mode)
      setRoomId(id)
      MP.connect(id, playerName.trim(), handleWS)
    } catch { setError('Ошибка создания комнаты') }
  }

  async function joinRoom() {
    if (!playerName.trim()) { setError(en ? 'Enter name' : 'Введите имя'); return }
    if (!joinCode.trim()) { setError('Введите код комнаты'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    const code = joinCode.trim().toUpperCase()
    MP.connect(code, playerName.trim(), handleWS)
  }

  function sendChat() {
    if (!chatInput.trim()) return
    MP.sendChat(chatInput.trim())
    setMessages(p => [...p.slice(-50), { from: playerIdx, text: chatInput.trim(), time: Date.now() }])
    setChatInput('')
  }

  function findMatch() {
    if (!playerName.trim()) { setError(en ? 'Enter name' : en ? 'Enter name' : 'Введите имя'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    setScreen('searching')
    MP.findMatch(playerName.trim(), handleWS)
  }

  function cancelSearch() {
    MP.cancelMatch()
    MP.disconnect()
    setScreen('lobby')
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

  async function loadActiveRooms() {
    setLoadingRooms(true)
    try {
      const list = await MP.getActiveRooms()
      setActiveRooms(list)
    } catch { setActiveRooms([]) }
    setLoadingRooms(false)
  }

  function startSpectate(targetRoomId) {
    MP.spectateRoom(targetRoomId, handleWS)
  }

  useEffect(() => () => MP.disconnect(), [])

  // Из Game.jsx: кнопка "В лобби" после завершения онлайн-партии
  useEffect(() => {
    const back = () => backToLobby()
    window.addEventListener('stolbiki-back-to-lobby', back)
    return () => window.removeEventListener('stolbiki-back-to-lobby', back)
  }, [])

  const roomUrl = roomId ? `${location.origin}?room=${roomId}` : ''

  // Проверяем URL при загрузке
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const room = params.get('room')
    if (room) {
      setJoinCode(room)
      history.replaceState(null, '', location.pathname)
    }
    // Deep link из Capacitor native app
    const handleDeepLink = (e) => {
      if (e.detail?.room) {
        setJoinCode(e.detail.room)
        setScreen('lobby')
      }
    }
    window.addEventListener('stolbiki-deeplink-room', handleDeepLink)
    return () => window.removeEventListener('stolbiki-deeplink-room', handleDeepLink)
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
        <div className="dash-card" style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center' }}>
          
          <h3 style={{ fontSize: 18, marginBottom: 4, color: '#eae8f2', textTransform: 'none', letterSpacing: 0 }}>{en ? 'Online' : 'Онлайн'}</h3>
          <p style={{ color: '#6e6a82', fontSize: 12, marginBottom: 16 }}>Играй с другом по ссылке — без регистрации</p>

          {error && <div style={{ color: '#ff6066', fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <input type="text" placeholder={en ? 'Your name' : 'Ваше имя'} value={playerName}
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
            style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 0', marginBottom: 10 }}>
            {en ? 'Create room' : 'Создать комнату'}
          </button>

          <button className="btn" onClick={findMatch}
            style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '11px 0', marginBottom: 16,
              borderColor: '#3dd68c40', color: '#3dd68c' }}>
            {en ? 'Find random opponent' : 'Найти случайного соперника'}
          </button>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <p style={{ color: '#6e6a82', fontSize: 11, marginBottom: 8 }}>Или введите код друга:</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="КОД" value={joinCode} maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{ ...inputStyle, marginBottom: 0, textAlign: 'center', letterSpacing: 4, fontWeight: 700, fontSize: 18, flex: 1 }} />
              <button className="btn" onClick={joinRoom} style={{ whiteSpace: 'nowrap' }}>{en ? 'Join' : 'Войти'}</button>
            </div>
          </div>
        </div>

        {/* QR код сайта */}
        <div className="dash-card" style={{ maxWidth: 560, margin: '16px auto', textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>QR — открой с телефона</h3>
          <QRCode text={location.origin} size={180} />
          <p style={{ color: '#6e6a82', fontSize: 11, marginTop: 10 }}>Отсканируй чтобы играть на телефоне</p>
        </div>

        {/* Ежедневный челлендж */}
        <DailyChallenge />

        {/* Наблюдение за играми */}
        <div className="dash-card" style={{ maxWidth: 560, margin: '16px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, color: '#eae8f2', marginBottom: 0 }}>{en ? 'Live games' : 'Живые партии'}</h3>
            <button className="btn" onClick={loadActiveRooms} disabled={loadingRooms}
              style={{ fontSize: 10, padding: '4px 10px' }}>
              {loadingRooms ? '...' : (en ? 'Refresh' : 'Обновить')}
            </button>
          </div>
          {activeRooms.length === 0 ? (
            <p style={{ color: '#6e6a82', fontSize: 12 }}>
              {en ? 'No active games right now' : 'Сейчас нет активных игр'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeRooms.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: 13, color: '#eae8f2', fontWeight: 600 }}>{r.players.join(' vs ')}</span>
                    <span style={{ fontSize: 11, color: '#6e6a82', marginLeft: 8 }}>
                      {r.scores[0]}:{r.scores[1]} · {en ? 'turn' : 'ход'} {r.turn}
                      {r.spectators > 0 && ` · 👁 ${r.spectators}`}
                    </span>
                  </div>
                  <button className="btn" onClick={() => startSpectate(r.id)}
                    style={{ fontSize: 10, padding: '4px 10px' }}>
                    {en ? 'Watch' : 'Смотреть'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── SEARCHING ───
  if (screen === 'searching') {
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 400, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3dd68c', animation: `pulse 1s ease ${d}s infinite` }} />
              ))}
            </div>
          </div>
          <h3 style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>
            {en ? 'Looking for opponent...' : 'Ищем соперника...'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 20 }}>
            {en ? 'You\'ll be matched with the first available player' : 'Вас соединят с первым доступным игроком'}
          </p>
          <button className="btn" onClick={cancelSearch} style={{ fontSize: 12 }}>
            {en ? 'Cancel' : 'Отмена'}
          </button>
        </div>
      </div>
    )
  }

  // ─── WAITING ───
  if (screen === 'waiting') {
    return (
      <div className="dash-card" style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center' }}>
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
          if (navigator.share) navigator.share({ text: `Играем в Snatch Highrise! Комната: ${roomId}`, url: roomUrl }).catch(() => {})
          else navigator.clipboard?.writeText(roomUrl)
        }} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
          Поделиться ссылкой
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

        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {['gg', 'gl', 'nice', 'wp', '!'].map(q => (
            <button key={q} className="btn" onClick={() => { MP.sendChat(q); setMessages(p => [...p.slice(-50), { from: playerIdx, text: q, time: Date.now() }]) }}
              style={{ fontSize: 10, padding: '3px 8px', minHeight: 0, flex: 1, opacity: 0.7 }}>{q}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder={en ? 'Message...' : 'Сообщение...'} style={{ ...inputStyle, marginBottom: 0, flex: 1, fontSize: 12, padding: '6px 10px' }} />
          <button className="btn" onClick={sendChat} style={{ fontSize: 11, padding: '6px 12px', minHeight: 0 }}>
            <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ─── SPECTATING ───
  if (screen === 'spectating') {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12,
          background: 'rgba(155,89,182,0.08)', borderRadius: 12, border: '1px solid rgba(155,89,182,0.15)' }}>
          <span style={{ fontSize: 12, color: '#c8a4e8', fontWeight: 600 }}>
            👁 {en ? 'Spectating' : 'Наблюдение'} — {players.join(' vs ')}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, margin: '0 10px', color: '#eae8f2' }}>
            {scores[0]}:{scores[1]}
          </span>
        </div>
        {status && (
          <div style={{ textAlign: 'center', padding: 8, color: '#ffc145', fontSize: 12, marginBottom: 8 }}>
            {status}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="btn" onClick={backToLobby} style={{ fontSize: 12 }}>
            {en ? '← Back to lobby' : '← В лобби'}
          </button>
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
      <div className="dash-card" style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{draw ? '=' : won ? '+' : '-'}</div>
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
