import { useState, useEffect, useRef } from 'react'
import * as MP from '../engine/multiplayer'
import { useI18n } from '../engine/i18n'
import * as API from '../engine/api'
import { useGameContext } from '../engine/GameContext'
import { getSettings } from '../engine/settings'
import Icon from './Icon'
import DailyChallenge from './DailyChallenge'
import GlobalChat from './GlobalChat'
import PushPromptBanner from './PushPromptBanner'

function QRCode({ text, size = 160 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !text) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=1a1a2a&color=eae8f2`
    img.onload = () => {
      const ctx = ref.current.getContext('2d')
      ctx.fillStyle = 'var(--surface)'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
    }
  }, [text, size])
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }} />
}

export default function Online() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const gameCtx = useGameContext()
  const isNative = !!window.Capacitor?.isNativePlatform?.()
  const [screen, setScreen] = useState('lobby')
  const [roomId, setRoomId] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [playerName, setPlayerName] = useState(localStorage.getItem('stolbiki_online_name') || '')
  const [playerIdx, setPlayerIdx] = useState(-1)
  const [players, setPlayers] = useState([])
  const [mode, setMode] = useState('single')
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
  const [opponentSkins, setOpponentSkins] = useState(null)
  const [reconnectInfo, setReconnectInfo] = useState(null)
  const [, setOpponentRating] = useState(null)

  function getMySkins() {
    const s = getSettings()
    return { chipStyle: s.chipStyle, standStyle: s.standStyle }
  }

  const roomIdRef = useRef('')
  const playerIdxRef = useRef(-1)
  const playersRef = useRef([])
  const gameCtxRef = useRef(gameCtx)
  useEffect(() => { roomIdRef.current = roomId }, [roomId])
  useEffect(() => { playerIdxRef.current = playerIdx }, [playerIdx])
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { gameCtxRef.current = gameCtx }, [gameCtx])

  function handleWS(msg) {
    switch (msg.type) {
      case 'joined':
        setRoomId(msg.roomId); roomIdRef.current = msg.roomId
        setPlayerIdx(msg.playerIdx); playerIdxRef.current = msg.playerIdx
        setMode(msg.mode || 'single'); setTotalGames(msg.totalGames || 1)
        setScreen('waiting'); setStatus(en ? 'Waiting for opponent...' : 'Ждём второго игрока...')
        break
      case 'waiting':
        setPlayers(msg.players); playersRef.current = msg.players; setScreen('waiting')
        break
      case 'start':
        setPlayers(msg.players); playersRef.current = msg.players
        setScores(msg.scores || [0, 0]); setCurrentGame(msg.currentGame || 1)
        setScreen('playing'); setStatus(''); setReconnectInfo(null)
        if (msg.playerSkins) { const oppIdx = playerIdxRef.current === 0 ? 1 : 0; setOpponentSkins(msg.playerSkins[oppIdx] || null) }
        gameCtxRef.current?.emit('onOnlineStart', { players: msg.players, firstPlayer: msg.firstPlayer, roomId: roomIdRef.current, playerIdx: playerIdxRef.current, timer: msg.timer || null, ratings: msg.ratings || null })
        break
      case 'move':
        gameCtxRef.current?.emit('onOnlineMove', msg.action, msg.time || null)
        break
      case 'timeUp':
        gameCtxRef.current?.emit('onTimeUp', { loser: msg.loser, time: msg.time })
        break
      case 'nextGame':
        setScores(msg.scores); setCurrentGame(msg.currentGame)
        gameCtxRef.current?.emit('onOnlineStart', { players: playersRef.current, firstPlayer: msg.firstPlayer, roomId: roomIdRef.current, playerIdx: playerIdxRef.current, nextGame: true })
        break
      case 'tournamentOver':
        setTournamentResult(msg); setScreen('result')
        break
      case 'chat':
        setMessages(prev => [...prev.slice(-50), { from: msg.from, text: msg.text, time: Date.now() }])
        break
      case 'reaction':
        gameCtxRef.current?.emit('onReaction', { emoji: msg.emoji, from: msg.from })
        break
      case 'spectatorCount':
        gameCtxRef.current?.emit('onSpectatorCount', { count: msg.count })
        break
      case 'resign':
        gameCtxRef.current?.emit('onOnlineResign', { from: msg.from })
        break
      case 'serverGameOver':
        setScores(msg.scores)
        gameCtxRef.current?.emit('onServerGameOver', { winner: msg.winner, scores: msg.scores })
        break
      case 'drawOffer':
        gameCtxRef.current?.emit('onDrawOffer', { from: msg.from })
        break
      case 'drawResponse':
        gameCtxRef.current?.emit('onDrawResponse', { accepted: msg.accepted })
        break
      case 'rematchOffer':
        gameCtxRef.current?.emit('onRematchOffer', { from: msg.from })
        break
      case 'rematchDeclined':
        gameCtxRef.current?.emit('onRematchDeclined')
        break
      case 'rematchStart':
        setScores(msg.scores || [0, 0]); setScreen('playing')
        gameCtxRef.current?.emit('onOnlineStart', { players: msg.players, firstPlayer: msg.firstPlayer, roomId: roomIdRef.current, playerIdx: playerIdxRef.current, nextGame: true })
        break
      case 'disconnected':
        if (msg.playerIdx !== playerIdxRef.current) setStatus(en ? 'Opponent disconnected... waiting' : 'Противник отключился... ждём реконнект')
        break
      case 'reconnecting':
        setReconnectInfo({ attempt: msg.attempt, maxAttempts: msg.maxAttempts, delay: msg.delay })
        break
      case 'reconnectFailed':
        setReconnectInfo(null); setStatus(en ? 'Connection lost' : 'Соединение потеряно'); setScreen('lobby')
        break
      case 'error':
        setError(msg.msg)
        break
      case 'queued':
        setScreen('searching')
        break
      case 'matchFound':
        setRoomId(msg.roomId); roomIdRef.current = msg.roomId
        setPlayerIdx(msg.playerIdx); playerIdxRef.current = msg.playerIdx
        setOpponentRating(msg.opponentRating || null); setReconnectInfo(null)
        break
      case 'matchCancelled':
        setScreen('lobby')
        break
      case 'spectateJoined':
        setScreen('spectating'); setPlayers(msg.players || []); playersRef.current = msg.players || []
        setScores(msg.scores || [])
        gameCtxRef.current?.emit('onSpectateStart', { players: msg.players, firstPlayer: msg.firstPlayer ?? 0, gameState: msg.gameState, spectators: msg.spectators })
        break
    }
  }

  async function createRoom() {
    if (!playerName.trim()) { setError(en ? 'Enter name' : 'Введите имя'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    try { const id = await MP.createRoom(mode); setRoomId(id); MP.connect(id, playerName.trim(), handleWS, getMySkins()) }
    catch { setError(en ? 'Failed to create room' : 'Ошибка создания комнаты') }
  }

  async function joinRoom() {
    if (!playerName.trim()) { setError(en ? 'Enter name' : 'Введите имя'); return }
    if (!joinCode.trim()) { setError(en ? 'Enter room code' : 'Введите код комнаты'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    MP.connect(joinCode.trim().toUpperCase(), playerName.trim(), handleWS, getMySkins())
  }

  function sendChat() {
    if (!chatInput.trim()) return
    MP.sendChat(chatInput.trim())
    setMessages(p => [...p.slice(-50), { from: playerIdx, text: chatInput.trim(), time: Date.now() }])
    setChatInput('')
  }

  function findMatch() {
    if (!playerName.trim()) { setError(en ? 'Enter name' : 'Введите имя'); return }
    setError('')
    localStorage.setItem('stolbiki_online_name', playerName.trim())
    setScreen('searching')
    API.track('matchmaking', 'online'); MP.findMatch(playerName.trim(), handleWS, getMySkins())
  }

  function cancelSearch() { MP.cancelMatch(); MP.disconnect(); setScreen('lobby') }

  function backToLobby() {
    MP.disconnect(); setScreen('lobby'); setRoomId(''); setError(''); setStatus('')
    setTournamentResult(null); setMessages([]); setScores([0, 0])
  }

  async function loadActiveRooms() {
    setLoadingRooms(true)
    try { const list = await MP.getActiveRooms(); setActiveRooms(list) } catch { setActiveRooms([]) }
    setLoadingRooms(false)
  }

  function startSpectate(targetRoomId) { MP.spectateRoom(targetRoomId, handleWS) }

  useEffect(() => () => MP.disconnect(), [])

  useEffect(() => { if (screen === 'lobby') loadActiveRooms() }, [screen])

  useEffect(() => {
    const back = () => backToLobby()
    window.addEventListener('stolbiki-back-to-lobby', back)
    return () => window.removeEventListener('stolbiki-back-to-lobby', back)
  }, [])

  const roomUrl = roomId ? `${location.origin}?room=${roomId}` : ''

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const room = params.get('room')
    if (room) { setJoinCode(room); history.replaceState(null, '', location.pathname) }
    const handleDeepLink = (e) => { if (e.detail?.room) { setJoinCode(e.detail.room); setScreen('lobby') } }
    window.addEventListener('stolbiki-deeplink-room', handleDeepLink)
    return () => window.removeEventListener('stolbiki-deeplink-room', handleDeepLink)
  }, [])

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--surface3)',
    background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, boxSizing: 'border-box', marginBottom: 10,
    fontFamily: 'Outfit, sans-serif',
  }

  // ─── LOBBY ───
  if (screen === 'lobby') {
    return (
      <div>
        <PushPromptBanner en={en} />
        <div className="dash-card" style={{ maxWidth: 560, margin: isNative ? '8px auto' : '20px auto', textAlign: 'center' }}>
          <h3 style={{ fontSize: 18, marginBottom: 4, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0 }}>{en ? 'Online' : 'Онлайн'}</h3>
          <p style={{ color: 'var(--ink3)', fontSize: 12, marginBottom: 12 }}>{en ? 'Play with a friend via link — no registration' : 'Играй с другом по ссылке — без регистрации'}</p>
          {activeRooms.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 12, display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
              {activeRooms.length} {en ? 'game' : 'игр'}{activeRooms.length > 1 && (en ? 's' : '')} {en ? 'live' : 'сейчас'}
            </div>
          )}
          {error && <div style={{ color: 'var(--p2)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <input type="text" placeholder={en ? 'Your name' : 'Ваше имя'} value={playerName}
            onChange={e => setPlayerName(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['single', en ? '1 game' : '1 партия'], ['tournament3', en ? 'Best of 3' : 'Серия 3'], ['tournament5', en ? 'Best of 5' : 'Серия 5']].map(([m, l]) => (
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
            style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '11px 0', marginBottom: 10, borderColor: '#3dd68c40', color: 'var(--green)' }}>
            {en ? 'Find random opponent' : 'Найти случайного соперника'}
          </button>
          <button className="btn" onClick={() => gameCtx?.emit('openArena')}
            style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '11px 0', marginBottom: 16, borderColor: '#ffc14540', color: 'var(--gold)' }}>
            {en ? 'Arena Tournament' : 'Турнир Arena'}
          </button>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <p style={{ color: 'var(--ink3)', fontSize: 11, marginBottom: 8 }}>{en ? 'Or enter friend\'s code:' : 'Или введите код друга:'}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="КОД" value={joinCode} maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{ ...inputStyle, marginBottom: 0, textAlign: 'center', letterSpacing: 4, fontWeight: 700, fontSize: 18, flex: 1 }} />
              <button className="btn" onClick={joinRoom} style={{ whiteSpace: 'nowrap' }}>{en ? 'Join' : 'Войти'}</button>
            </div>
          </div>
        </div>

        {!isNative && (
          <div className="dash-card" style={{ maxWidth: 560, margin: isNative ? '8px auto' : '16px auto', textAlign: 'center' }}>
            <h3 style={{ marginBottom: 12 }}>{en ? 'QR — open on phone' : 'QR — открой с телефона'}</h3>
            <QRCode text={location.origin} size={180} />
            <p style={{ color: 'var(--ink3)', fontSize: 11, marginTop: 10 }}>{en ? 'Scan to play on mobile' : 'Отсканируй чтобы играть на телефоне'}</p>
          </div>
        )}

        <DailyChallenge />

        {/* Глобальный чат */}
        <div style={{ maxWidth: 560, margin: isNative ? '8px auto' : '16px auto' }}>
          <GlobalChat lang={lang} compact />
        </div>

        <div className="dash-card" style={{ maxWidth: 560, margin: isNative ? '8px auto' : '16px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 0 }}>{en ? 'Live games' : 'Живые партии'}</h3>
            <button className="btn" onClick={loadActiveRooms} disabled={loadingRooms} style={{ fontSize: 10, padding: '4px 10px' }}>
              {loadingRooms ? '...' : (en ? 'Refresh' : 'Обновить')}
            </button>
          </div>
          {activeRooms.length === 0 ? (
            <p style={{ color: 'var(--ink3)', fontSize: 12 }}>{en ? 'No active games right now' : 'Сейчас нет активных игр'}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeRooms.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{r.players.join(' vs ')}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink3)', marginLeft: 8 }}>
                      {r.scores[0]}:{r.scores[1]} · {en ? 'turn' : 'ход'} {r.turn}
                      {r.spectators > 0 && ` · ${r.spectators} ${en ? 'watching' : 'зрит.'}`}
                    </span>
                  </div>
                  <button className="btn" onClick={() => startSpectate(r.id)} style={{ fontSize: 10, padding: '4px 10px' }}>
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
    const userRating = (() => { try { return JSON.parse(localStorage.getItem('stolbiki_profile'))?.rating || 1000 } catch { return 1000 } })()
    return (
      <div style={isNative ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 130px)' } : undefined}>
        <div className="dash-card" style={{ maxWidth: 400, margin: isNative ? '0 auto' : '40px auto', textAlign: 'center', width: '100%' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', gap: 4 }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: `pulse 1s ease ${d}s infinite` }} />
              ))}
            </div>
          </div>
          <h3 style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>{en ? 'Looking for opponent...' : 'Ищем соперника...'}</h3>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 4 }}>{en ? 'Your rating' : 'Ваш рейтинг'}: <b style={{ color: 'var(--gold)' }}>{userRating}</b></div>
          <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 20 }}>{en ? 'ELO ±200, range expands over time' : 'ELO ±200, диапазон расширяется со временем'}</p>
          {/* Cancel — обёрнут в flex-row с justify-center.
              .btn = display:flex, поэтому text-align:center на родителе её
              не центрирует. Этот див делает явное центрирование. */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn" onClick={cancelSearch}
              style={{ fontSize: 12, minWidth: 120 }}>
              {en ? 'Cancel' : 'Отмена'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── WAITING ───
  if (screen === 'waiting') {
    return (
      <div className="dash-card" style={{ maxWidth: 560, margin: isNative ? '8px auto' : '20px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <h3 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          {en ? 'Room' : 'Комната'} {roomId}
        </h3>
        <p style={{ color: 'var(--ink2)', fontSize: 13, marginBottom: 16 }}>
          {mode === 'tournament3' ? (en ? 'Tournament: best of 3' : 'Турнир: серия из 3') : mode === 'tournament5' ? (en ? 'Tournament: best of 5' : 'Турнир: серия из 5') : (en ? 'Single game' : 'Одна партия')}
        </p>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: 'var(--gold)', marginBottom: 16, fontFamily: 'DM Serif Display, serif' }}>{roomId}</div>
        <QRCode text={roomUrl} size={160} />
        <p style={{ color: 'var(--ink3)', fontSize: 11, marginTop: 10, marginBottom: 8 }}>{en ? 'Send link or code to a friend' : 'Отправь ссылку или код другу'}</p>
        <button className="btn" onClick={() => {
          if (navigator.share) navigator.share({ text: en ? `Play Highrise Heist! Room: ${roomId}` : `Играем в Highrise Heist! Комната: ${roomId}`, url: roomUrl }).catch(() => {})
          else navigator.clipboard?.writeText(roomUrl)
        }} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
          {en ? 'Share link' : 'Поделиться ссылкой'}
        </button>
        <div className="thinking-dots" style={{ color: 'var(--ink3)', fontSize: 13 }}>{en ? 'Waiting for opponent' : 'Ждём второго игрока'}</div>
        <button className="btn" onClick={backToLobby} style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: 12 }}>{en ? '← Back' : '← Назад'}</button>
      </div>
    )
  }

  // ─── PLAYING ───
  if (screen === 'playing') {
    return (
      <div>
        {totalGames > 1 && (
          <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12, background: 'rgba(240,96,64,0.06)', borderRadius: 12, border: '1px solid rgba(240,96,64,0.1)' }}>
            <span style={{ fontSize: 11, color: 'var(--ink2)' }}>{en ? 'Game' : 'Партия'} {currentGame}/{totalGames}</span>
            <span style={{ fontSize: 16, fontWeight: 700, margin: '0 12px', color: 'var(--ink)' }}>{scores[0]} : {scores[1]}</span>
            <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{players[0]} vs {players[1]}</span>
          </div>
        )}
        {status && <div style={{ textAlign: 'center', padding: 8, color: 'var(--gold)', fontSize: 12, marginBottom: 8 }}>{status}</div>}
        {reconnectInfo && (
          <div style={{ textAlign: 'center', padding: '10px 16px', marginBottom: 8, borderRadius: 8, background: 'rgba(255,193,69,0.08)', border: '1px solid rgba(255,193,69,0.15)' }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>{en ? 'Reconnecting...' : 'Переподключение...'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
              {en ? `Attempt ${reconnectInfo.attempt}/${reconnectInfo.maxAttempts}` : `Попытка ${reconnectInfo.attempt}/${reconnectInfo.maxAttempts}`}
              {reconnectInfo.delay > 0 && ` · ${reconnectInfo.delay}${en ? 's' : 'с'}`}
            </div>
            <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'rgba(255,193,69,0.1)', overflow: 'hidden' }}>
              <div style={{ width: `${(reconnectInfo.attempt / reconnectInfo.maxAttempts) * 100}%`, height: '100%', background: 'var(--gold)', borderRadius: 2 }} />
            </div>
          </div>
        )}
        {opponentSkins && (opponentSkins.chipStyle !== 'classic' || opponentSkins.standStyle !== 'classic') && (
          <div style={{ textAlign: 'center', padding: '4px 12px', marginBottom: 8, fontSize: 11, color: 'var(--ink3)' }}>
            {players[playerIdx === 0 ? 1 : 0]}
            {opponentSkins.chipStyle !== 'classic' && <span style={{ margin: '0 4px', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--ink2)' }}>🧱 {opponentSkins.chipStyle}</span>}
            {opponentSkins.standStyle !== 'classic' && <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--ink2)' }}>🏗 {opponentSkins.standStyle}</span>}
          </div>
        )}
        {messages.length > 0 && (
          <div style={{ maxHeight: 80, overflowY: 'auto', padding: '6px 10px', marginBottom: 8, background: 'rgba(26,26,42,0.5)', borderRadius: 8, fontSize: 11 }}>
            {messages.slice(-5).map((m, i) => (
              <div key={i} style={{ color: m.from === playerIdx ? 'var(--p1)' : 'var(--p2)' }}>
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
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12, background: 'rgba(155,89,182,0.08)', borderRadius: 12, border: '1px solid rgba(155,89,182,0.15)' }}>
          <span style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="#c8a4e8" strokeWidth="2"><circle cx="10" cy="10" r="3"/><path d="M1 10s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/></svg>
            {en ? 'Spectating' : 'Наблюдение'} — {players.join(' vs ')}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, margin: '0 10px', color: 'var(--ink)' }}>{scores[0]}:{scores[1]}</span>
        </div>
        {status && <div style={{ textAlign: 'center', padding: 8, color: 'var(--gold)', fontSize: 12, marginBottom: 8 }}>{status}</div>}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button className="btn" onClick={backToLobby} style={{ fontSize: 12 }}>{en ? '← Back to lobby' : '← В лобби'}</button>
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
      <div className="dash-card" style={{ maxWidth: 560, margin: isNative ? '8px auto' : '20px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{draw ? '=' : won ? '+' : '-'}</div>
        <h3 style={{ fontSize: 20, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          {draw ? (en ? 'Draw!' : 'Ничья!') : won ? (en ? 'You won the tournament!' : 'Вы победили в турнире!') : (en ? 'Opponent won' : 'Противник победил')}
        </h3>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink)', margin: '12px 0' }}>
          <span style={{ color: won || draw ? 'var(--green)' : 'var(--p2)' }}>{tournamentResult.scores[playerIdx]}</span>
          <span style={{ color: 'var(--surface3)', margin: '0 8px' }}>:</span>
          <span style={{ color: !won || draw ? 'var(--green)' : 'var(--p2)' }}>{tournamentResult.scores[1 - playerIdx]}</span>
        </div>
        <p style={{ color: 'var(--ink3)', fontSize: 12, marginBottom: 16 }}>{players[0]} vs {players[1]} • {totalGames} {en ? 'games' : 'партий'}</p>
        <button className="btn primary" onClick={backToLobby} style={{ width: '100%', justifyContent: 'center' }}>{en ? 'New match' : 'Новый матч'}</button>
      </div>
    )
  }

  return null
}
