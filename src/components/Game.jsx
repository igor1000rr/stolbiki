import { useState, useRef, useEffect, useCallback } from 'react'
import {
  GameState, getValidTransfers, applyAction,
  MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND
} from '../engine/game'
import { mctsSearch } from '../engine/ai'
import { isGpuReady } from '../engine/neuralnet'
import { getHint } from '../engine/hints'
import { startRecording, setGameMeta, recordMove, finishRecording, cancelRecording } from '../engine/collector'
import * as MP from '../engine/multiplayer'
import { isLoggedIn } from '../engine/api'
import { getSettings } from '../engine/settings'
import { useI18n } from '../engine/i18n'
import Board from './Board'
import ReplayViewer, { describeAction } from './ReplayViewer'

const isNative = !!window.Capacitor?.isNativePlatform?.()
import { startTitleBlink, sp, st, sc, sw, sl, ss, setSoundOn, generateShareImage, showNotification, requestNotificationPermission } from './gameUtils'

const SL = i => i === GOLDEN_STAND ? '★' : 'ABCDEFGHI'[i - 1] || String(i)


export default function Game() {
  const { t, lang } = useI18n()
  const [gs, setGs] = useState(() => new GameState())
  const [phase, setPhase] = useState('place')
  const [selected, setSelected] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [humanPlayer, setHumanPlayer] = useState(0)
  const [difficulty, setDifficulty] = useState(150)
  const difficultyRef = useRef(150)
  const [mode, setMode] = useState('ai') // 'ai' | 'pvp'
  const [soundOn, setSoundOnState] = useState(true)
  useEffect(() => { setSoundOn(soundOn) }, [soundOn])
  // Настройки из Settings
  const [userSettings, setUserSettings] = useState(() => getSettings())
  useEffect(() => {
    setSoundOn(soundOn && userSettings.soundPack !== 'off')
  }, [userSettings, soundOn])
  // Обновляем настройки мгновенно (storage event + custom + focus)
  useEffect(() => {
    const refresh = () => setUserSettings(getSettings())
    window.addEventListener('focus', refresh)
    window.addEventListener('stolbiki-settings-changed', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('stolbiki-settings-changed', refresh) }
  }, [])
  // Таймеры игроков
  const TIMER_LIMITS = { off: 0, blitz: 180, rapid: 600, classical: 1800 }
  const timerLimit = TIMER_LIMITS[userSettings.timer] || 0
  const [playerTime, setPlayerTime] = useState([0, 0]) // секунды оставшиеся [p0, p1]
  const [log, setLog] = useState([])
  const [info, setInfo] = useState('')
  const [result, setResult] = useState(null)
  const [hint, setHint] = useState(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintMode, setHintMode] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [scoreBump, setScoreBump] = useState(null)
  const [locked, setLocked] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [newAch, setNewAch] = useState(null)
  const [sessionStats, setSessionStats] = useState({ wins: 0, losses: 0, streak: 0 })
  const [gameStartTime, setGameStartTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [undoStack, setUndoStack] = useState([])
  // Турнирный режим
  const [tournament, setTournament] = useState(null) // { total: 3|5, games: [{won, score}], currentGame: 1 }
  // Daily challenge
  const [dailyMode, setDailyMode] = useState(false)
  const [dailySeed, setDailySeed] = useState(null)
  // Тренер — оценка позиции после каждого хода
  const [trainerMode, setTrainerMode] = useState(false)
  const [posEval, setPosEval] = useState(null) // { score: -1..1, label, color }
  // Replay — история ходов для повтора
  const moveHistoryRef = useRef([]) // [{ action, player }]
  const [showReplay, setShowReplay] = useState(false)
  const [showMobileSettings, setShowMobileSettings] = useState(false)
  // Онлайн мультиплеер
  const [onlineRoom, setOnlineRoom] = useState(null)
  const [onlinePlayerIdx, setOnlinePlayerIdx] = useState(-1)
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [drawOffered, setDrawOffered] = useState(false)
  const [rematchOffered, setRematchOffered] = useState(false)  // получили предложение рематча
  const [rematchPending, setRematchPending] = useState(false)  // отправили предложение, ждём ответ
  const onlineRef = useRef(null) // { roomId, playerIdx, myColor }
  const gsRef = useRef(gs) // актуальное состояние для WS обработчиков
  const aiRunning = useRef(false)
  const modeRef = useRef('ai')
  const prevScore = useRef([0, 0])
  const logRef = useRef(null)

  // Синхронизируем gsRef с gs
  useEffect(() => { gsRef.current = gs }, [gs])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0 }, [log])

  // ─── Онлайн мультиплеер: слушаем события из Online.jsx ───
  useEffect(() => {
    function handleOnlineStart(e) {
      const { players, firstPlayer, roomId, playerIdx, nextGame } = e.detail
      requestNotificationPermission() // Запрашиваем разрешение для уведомлений
      // Кто первый ходит = синие (currentPlayer=0 в GameState)
      // firstPlayer — индекс игрока в комнате, который играет синими
      const myColor = (playerIdx === (firstPlayer ?? 0)) ? 0 : 1
      onlineRef.current = { roomId, playerIdx, myColor }
      setOnlineRoom(roomId)
      setOnlinePlayerIdx(playerIdx)
      setOnlinePlayers(players)

      // Новая игра в онлайн-режиме
      cancelRecording()
      const state = new GameState()
      gsRef.current = state
      setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setHint(null); setAiThinking(false)
      setScoreBump(null); setHumanPlayer(myColor); setMode('online')
      aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = 'online'
      startRecording()
      setGameMeta('online', 0)
      setGameStartTime(Date.now())
      setElapsed(0)
      if (timerLimit) setPlayerTime([timerLimit, timerLimit])
      setUndoStack([])
      setPosEval(null)
      moveHistoryRef.current = []
      setShowReplay(false)
      setRematchOffered(false)
      setRematchPending(false)
      setDrawOffered(false)

      const myName = players[playerIdx] || t('game.you')
      const oppName = players[1 - playerIdx] || t('game.opponent')
      setLog([{ text: `Онлайн: ${myName} vs ${oppName}${nextGame ? ' (следующая партия)' : ''}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])

      if (state.currentPlayer === myColor) {
        setLocked(false)
        setInfo(t('game.place1'))
      } else {
        setLocked(true)
        setInfo(t('game.opponentTurn'))
      }
    }

    function handleOnlineMove(e) {
      if (modeRef.current === 'spectate-online') return // Обрабатывается handleSpectateMove
      const action = e.detail
      const myColorBefore = onlineRef.current?.myColor ?? 0
      const opponentColor = 1 - myColorBefore

      // Берём актуальный стейт из ref, применяем ход
      const prevState = gsRef.current
      const ns = applyAction(prevState, action)
      setGs(ns)
      gsRef.current = ns

      addLog(describeAction(action, opponentColor, t), opponentColor)
      moveHistoryRef.current.push({ action: { ...action }, player: opponentColor })

      // Swap — особый случай: противник ещё не закончил ход (ему надо ставить фишки)
      if (action.swap) {
        ss()
        const newColor = 1 - myColorBefore
        if (onlineRef.current) onlineRef.current.myColor = newColor
        setHumanPlayer(newColor)
        setLocked(true)
        setInfo(t('game.swapOppDone'))
        return
      }

      // Обычный ход — звуки
      if (action.transfer) st()
      else sp()

      if (ns.gameOver) {
        setTimeout(() => {
          setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
          finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
          const myColor = onlineRef.current?.myColor ?? 0
          const won = ns.winner === myColor
          setTimeout(() => { won ? sw() : sl(); if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) } }, 300)
        }, 500)
      } else {
        const myColor = onlineRef.current?.myColor ?? 0
        if (ns.currentPlayer === myColor) {
          setTimeout(() => {
            setLocked(false)
            setPhase('place')
            setTransfer(null)
            setPlacement({})
            setInfo(ns.isFirstTurn() ? t('game.place1') : t('game.placeChips'))
            if (document.hidden) {
              startTitleBlink(t('game.yourTurnBlink'))
              showNotification('Snatch Highrise', t('game.yourTurnBlink'))
            }
          }, 300)
        } else {
          setLocked(true)
          setInfo(t('game.opponentTurn'))
        }
      }
    }

    window.addEventListener('stolbiki-online-start', handleOnlineStart)
    window.addEventListener('stolbiki-online-move', handleOnlineMove)

    // Opponent resigned
    function handleOnlineResign() {
      const myColor = onlineRef.current?.myColor ?? 0
      setResult(myColor); setPhase('done'); setLocked(false)
      setInfo(t('game.opponentResigned'))
      sw()
      showNotification('Snatch Highrise', t('game.opponentResigned'))
    }

    // Draw offer
    function handleDrawOffer() {
      setDrawOffered(true)
      showNotification('Snatch Highrise', t('game.drawOfferReceived'))
    }

    // Draw response
    function handleDrawResponse(e) {
      if (e.detail?.accepted) {
        setResult(-1); setPhase('done'); setLocked(false)
        setInfo(t('game.drawAgreed'))
      } else {
        setInfo(t('game.drawDeclined'))
      }
      setDrawOffered(false)
    }

    window.addEventListener('stolbiki-online-resign', handleOnlineResign)
    window.addEventListener('stolbiki-online-draw-offer', handleDrawOffer)
    window.addEventListener('stolbiki-online-draw-response', handleDrawResponse)

    // Серверное подтверждение gameOver (авторитетный источник)
    function handleServerGameOver(e) {
      const { winner } = e.detail
      const myColor = onlineRef.current?.myColor ?? 0
      // Если клиент ещё не показал gameOver — форсируем
      setResult(prev => {
        if (prev !== null) return prev // Уже показали
        const won = winner === (onlineRef.current?.playerIdx ?? 0)
        setTimeout(() => { won ? sw() : sl(); if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) } }, 300)
        setPhase('done'); setLocked(false); setInfo(t('game.gameOver'))
        return winner >= 0 ? (winner === (onlineRef.current?.playerIdx ?? 0) ? myColor : 1 - myColor) : -1
      })
    }
    window.addEventListener('stolbiki-online-server-gameover', handleServerGameOver)

    // Rematch
    function handleRematchOffer() {
      setRematchOffered(true)
      showNotification('Snatch Highrise', t('game.rematchOffer'))
    }
    function handleRematchDeclined() {
      setRematchPending(false)
      setInfo(t('game.rematchDeclined'))
    }
    window.addEventListener('stolbiki-online-rematch-offer', handleRematchOffer)
    window.addEventListener('stolbiki-online-rematch-declined', handleRematchDeclined)

    // ─── Спектатор: наблюдение за чужой игрой ───
    function handleSpectateStart(e) {
      const { players, firstPlayer, gameState: gsData } = e.detail
      cancelRecording()
      // Восстанавливаем GameState из серверных данных
      const state = new GameState()
      if (gsData) {
        state.stands = gsData.stands || state.stands
        state.closed = gsData.closed || state.closed
        state.currentPlayer = gsData.currentPlayer ?? 0
        state.turn = gsData.turn ?? 0
        state.swapAvailable = gsData.swapAvailable ?? true
        state.gameOver = gsData.gameOver ?? false
        state.winner = gsData.winner ?? null
      }
      gsRef.current = state
      setGs(state); setPhase('done'); setSelected(null); setTransfer(null); setPlacement({})
      setResult(null); setHint(null); setAiThinking(false); setScoreBump(null)
      setHumanPlayer(0); setMode('spectate-online')
      setLocked(true)
      aiRunning.current = false; modeRef.current = 'spectate-online'
      setOnlinePlayers(players || [])
      onlineRef.current = { roomId: null, playerIdx: -1, myColor: 0 }
      moveHistoryRef.current = []
      setShowReplay(false); setPosEval(null)
      setInfo(`${(players || []).join(' vs ')} — ${t('game.watching')}`)
      setLog([{ text: `👁 ${(players || []).join(' vs ')}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
    }

    // Спектатор получает ходы обоих игроков
    function handleSpectateMove(e) {
      if (modeRef.current !== 'spectate-online') return
      const action = e.detail
      const prevState = gsRef.current
      const ns = applyAction(prevState, action)
      setGs(ns)
      gsRef.current = ns
      if (action.transfer) st()
      else if (action.swap) ss()
      else sp()
      addLog(describeAction(action, prevState.currentPlayer, t), prevState.currentPlayer)
      if (ns.gameOver) {
        setTimeout(() => {
          setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver'))
        }, 500)
      }
    }
    // Спектатор слушает те же move-события что и online
    window.addEventListener('stolbiki-spectate-start', handleSpectateStart)
    window.addEventListener('stolbiki-online-move', handleSpectateMove)

    return () => {
      window.removeEventListener('stolbiki-online-start', handleOnlineStart)
      window.removeEventListener('stolbiki-online-move', handleOnlineMove)
      window.removeEventListener('stolbiki-online-resign', handleOnlineResign)
      window.removeEventListener('stolbiki-online-draw-offer', handleDrawOffer)
      window.removeEventListener('stolbiki-online-draw-response', handleDrawResponse)
      window.removeEventListener('stolbiki-online-server-gameover', handleServerGameOver)
      window.removeEventListener('stolbiki-online-rematch-offer', handleRematchOffer)
      window.removeEventListener('stolbiki-online-rematch-declined', handleRematchDeclined)
      window.removeEventListener('stolbiki-spectate-start', handleSpectateStart)
      window.removeEventListener('stolbiki-online-move', handleSpectateMove)
    }
  }, []) // eslint-disable-line

  // ─── Daily Challenge: слушаем событие из Online.jsx ───
  useEffect(() => {
    function handleDailyStart(e) {
      const daily = e.detail
      if (!daily) return

      setDailyMode(true)
      setDailySeed(daily.seed || daily.date)

      // Строим стартовую позицию из seed
      cancelRecording()
      let state = new GameState()

      // Ход 1: P1 ставит 1 фишку
      if (daily.firstMove) {
        state = applyAction(state, { placement: { [daily.firstMove.stand]: 1 } })
      }

      // Ход 2: P2 swap или установка
      if (daily.swapped) {
        state = applyAction(state, { swap: true })
      } else if (daily.secondMove?.stands?.length) {
        // Считаем фишки на каждую стойку
        const pl = {}
        for (const s of daily.secondMove.stands) {
          pl[s] = (pl[s] || 0) + 1
        }
        state = applyAction(state, { placement: pl })
      }

      // Теперь ход игрока (он всегда играет за текущего)
      const hp = state.currentPlayer
      gsRef.current = state
      setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setHint(null); setAiThinking(false)
      setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(400); difficultyRef.current = 400; setMode('ai')
      aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = 'ai'
      startRecording()
      setGameMeta('daily', 100)
      setGameStartTime(Date.now())
      setElapsed(0)
      if (timerLimit) setPlayerTime([timerLimit, timerLimit])
      setUndoStack([])
      setPosEval(null)
      moveHistoryRef.current = []
      setShowReplay(false)

      const seedLabel = (daily.seed || daily.date || '').toString().slice(-4)
      setLog([{ text: `Ежедневный челлендж #${seedLabel}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo(`Челлендж #${seedLabel} — победите AI за минимум ходов!`)
    }
    window.addEventListener('stolbiki-daily-start', handleDailyStart)
    return () => window.removeEventListener('stolbiki-daily-start', handleDailyStart)
  }, []) // eslint-disable-line

  // ─── Тренер: оценка позиции через MCTS ───
  function evaluatePosition(state) {
    if (!trainerMode || mode !== 'ai') return
    setTimeout(() => {
      try {
        const result = mctsSearch(state, 30)
        const score = result.bestValue || 0
        const ps = state.currentPlayer === humanPlayer ? score : -score
        let label, color
        if (ps > 0.3) { label = t('trainer.strong'); color = '#3dd68c' }
        else if (ps > 0.1) { label = t('trainer.slight'); color = '#89d68c' }
        else if (ps > -0.1) { label = t('trainer.equal'); color = '#a09cb0' }
        else if (ps > -0.3) { label = t('trainer.weak'); color = '#ffc145' }
        else { label = t('trainer.bad'); color = '#ff6066' }
        setPosEval({ score: ps, label, color })
      } catch { setPosEval(null) }
    }, 50)
  }

  // ─── Daily Challenge ───
  function getDailySeed() {
    const d = new Date()
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  }

  function startDaily() {
    setDailySeed(getDailySeed())
    setDailyMode(true)
    newGame(0, 100, 'ai')
    setInfo(`Ежедневный челлендж #${getDailySeed() % 10000} — победите AI!`)
  }

  // ─── Турнирный режим ───
  function startTournament(total = 3) {
    setTournament({ total, games: [], currentGame: 1 })
    newGame(0, difficulty, 'ai')
    setInfo(`Турнир: партия 1 из ${total}`)
  }

  function tournamentNextGame() {
    if (!tournament) return
    const next = tournament.currentGame + 1
    if (next > tournament.total) return
    setTournament(prev => ({ ...prev, currentGame: next }))
    newGame((next - 1) % 2, difficulty, 'ai')
    setInfo(`Турнир: партия ${next} из ${tournament.total}`)
  }

  // Слушаем новые ачивки
  useEffect(() => {
    window.stolbikiOnAchievement = (ach) => {
      setNewAch(ach)
      setTimeout(() => setNewAch(null), 4000)
    }
    return () => { delete window.stolbikiOnAchievement }
  }, [])

  // Сессионная статистика
  useEffect(() => {
    if (result === null) return
    if (result === -1) return // Ничья — не меняем статистику
    const won = (mode === 'pvp') ? true : result === humanPlayer
    setSessionStats(prev => ({
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
      streak: won ? prev.streak + 1 : 0,
    }))
  }, [result]) // eslint-disable-line

  useEffect(() => {
    const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
    if (s0 > prevScore.current[0]) { setScoreBump(0); setTimeout(() => setScoreBump(null), 700); sc() }
    if (s1 > prevScore.current[1]) { setScoreBump(1); setTimeout(() => setScoreBump(null), 700); sc() }
    prevScore.current = [s0, s1]
  }, [gs])

  function addLog(text, player) {
    setLog(prev => [{ text, player, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev])
  }

  // ─── AI ход ───
  const runAi = useCallback((state) => {
    if (aiRunning.current || state.gameOver) return
    if (modeRef.current === 'online') return // Никогда не запускаем AI в онлайне
    aiRunning.current = true
    setAiThinking(true)
    setLocked(true)
    setInfo(t('game.aiThinking'))
    const startTime = Date.now()
    setTimeout(() => {
      const gpu = isGpuReady()
      const diff = difficultyRef.current
      const action = mctsSearch(state, ...(
        diff >= 800 ? (gpu ? [1500, 0] : [1200, 10]) : // Экстрим: 1500 GPU-симуляций (~2с)
        diff >= 400 ? (gpu ? [600, 0] : [800, 8]) :    // Сложная: 600 GPU-симуляций (~0.8с)
        diff >= 150 ? (gpu ? [200, 1] : [500, 3]) :    // Средняя
                       (gpu ? [80, 1]  : [200, 1])      // Лёгкая
      ))
      const remaining = Math.max(0, 1000 - (Date.now() - startTime))
      setTimeout(() => {
        setAiThinking(false)
        addLog(describeAction(action, state.currentPlayer, t), state.currentPlayer)
        setTimeout(() => {
          recordMove(state, action, state.currentPlayer)
          moveHistoryRef.current.push({ action: { ...action }, player: state.currentPlayer })
          const ns = applyAction(state, action)
          setGs(ns)
          aiRunning.current = false
          if (ns.gameOver) {
            setTimeout(() => {
              setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
              finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
              const won = modeRef.current === 'spectate' ? true : ns.winner === humanPlayer
              setTimeout(() => { won ? sw() : sl(); if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) } }, 300)
              if (typeof window.stolbikiRecordGame === 'function') {
                const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
                const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
                const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
                window.stolbikiRecordGame(won, score, difficultyRef.current >= 400, closedGolden, false)
              }
              // Турнир — запись результата (AI gameOver)
              if (tournament) {
                const w = ns.winner === humanPlayer
                const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
                setTournament(prev => ({
                  ...prev,
                  games: [...prev.games, { won: w, score: `${s0}:${s1}`, side: humanPlayer }],
                }))
              }
            }, 800)
            return
          }
          if (ns.currentPlayer !== humanPlayer || modeRef.current === 'spectate') {
            setTimeout(() => runAi(ns), modeRef.current === 'spectate' ? 1200 : 600)
            return
          }
          setTimeout(() => {
            setLocked(false)
            setPhase('place')
            setTransfer(null)
            setPlacement({})
            setInfo(ns.isFirstTurn() ? t('game.place1') : t('game.clickStands'))
            evaluatePosition(ns)
          }, 500)
        }, 300)
      }, remaining)
    }, 50)
  }, [difficulty, humanPlayer])

  // ─── Новая игра ───
  function newGame(side, diff, gameMode) {
    cancelRecording()
    const hp = side ?? humanPlayer
    const d = diff ?? difficulty
    let m = gameMode ?? mode
    // Если были в онлайн-режиме и начинаем новую — сбрасываем в AI
    if ((m === 'online' || m === 'spectate-online') && !gameMode) m = 'ai'
    if (m === 'online' || m === 'spectate-online') return // Онлайн-игры стартуют через stolbiki-online-start
    // Сброс онлайн состояния
    setOnlineRoom(null); setOnlinePlayerIdx(-1); setOnlinePlayers([])
    onlineRef.current = null
    setPosEval(null)
    moveHistoryRef.current = []
    setShowReplay(false)
    const state = new GameState()
    gsRef.current = state
    setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setHint(null); setAiThinking(false)
    setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(d); difficultyRef.current = d; setMode(m)
    aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = m
    startRecording()
    setGameMeta(m, d)
    setGameStartTime(Date.now())
    setElapsed(0)
    if (timerLimit) setPlayerTime([timerLimit, timerLimit])
    setUndoStack([])
    if (m === 'pvp') {
      setLog([{ text: 'Новая партия: игрок против игрока', player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo(t('game.place1'))
    } else if (m === 'spectate') {
      setLog([{ text: 'AI vs AI — наблюдение', player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo('AI vs AI')
      setLocked(true)
      setTimeout(() => runAi(state), 800)
    } else {
      const c = hp === 0 ? t('game.blue').toLowerCase() : t('game.red').toLowerCase()
      setLog([{ text: `Новая партия. Вы — ${c}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      if (state.currentPlayer !== hp) {
        setInfo(t('game.aiFirst'))
        setLocked(true)
        setTimeout(() => runAi(state), 500)
      } else {
        setInfo(t('game.place1first'))
      }
    }
  }

  useEffect(() => { newGame(0, 50) }, []) // eslint-disable-line

  // Горячие клавиши
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'Enter' && canConfirm && isMyTurn && phase === 'place') { e.preventDefault(); confirmTurn() }
      if (e.key === 'Escape' && inTransferMode) cancelTransfer()
      if (e.key === 'n' && (gs.gameOver || result !== null)) newGame()
      if (e.key === 'z' && mode === 'pvp' && undoStack.length > 0) undoMove()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  // Таймер
  useEffect(() => {
    if (gs.gameOver) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - gameStartTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [gameStartTime, gs.gameOver])

  // Таймер игроков (блиц/рапид)
  useEffect(() => {
    if (!timerLimit || gs.gameOver || locked || aiRunning.current) return
    const cp = gs.currentPlayer
    const iv = setInterval(() => {
      setPlayerTime(prev => {
        const next = [...prev]
        next[cp] = Math.max(0, prev[cp] - 1)
        // Тиканье при <10с (только для текущего игрока-человека)
        if (next[cp] <= 10 && next[cp] > 0 && cp === humanPlayer) sk()
        if (next[cp] <= 0) {
          setResult(1 - cp); setPhase('done'); setInfo(cp === humanPlayer ? t('game.timeUp') : t('game.oppTimeUp'))
          setLocked(false)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [timerLimit, gs.gameOver, gs.currentPlayer, locked])

  // ─── Клик по стойке — ОБЫЧНАЯ ФУНКЦИЯ, всегда свежий state ───
  // Автоподтверждение — когда макс фишек расставлены
  useEffect(() => {
    if (!userSettings.autoConfirm || phase !== 'place' || gs.gameOver || locked) return
    const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
    const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
    if (totalPlaced >= maxTotal) {
      // Откладываем на следующий tick чтобы стейт обновился
      const t = setTimeout(() => confirmTurn(), 200)
      return () => clearTimeout(t)
    }
  }, [placement, userSettings.autoConfirm]) // eslint-disable-line

  function onStandClick(i) {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (gs.gameOver || !currentIsHuman || aiRunning.current || locked) return
    if (i in gs.closed) return

    if (phase === 'transfer-select') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) {
        setSelected(i)
        setPhase('transfer-dst')
        setInfo(`Куда перенести фишки со стойки ${SL(i)}?`)
      }
      return
    }

    if (phase === 'transfer-dst') {
      if (i === selected) { setSelected(null); setPhase('transfer-select'); setInfo(t('game.selectTransferFrom')); return }
      if (getValidTransfers(gs).some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i])
        setSelected(null)
        setPhase('place')
        st()
        addLog(`Перенос: ${SL(selected)} → ${SL(i)}`, humanPlayer)
        setInfo(t('game.transferSelected'))
      } else {
        setInfo(`Нельзя перенести сюда`)
      }
      return
    }

    if (phase === 'place') {
      const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
      const currentTotal = Object.values(placement).reduce((a, b) => a + b, 0)
      const numStands = Object.keys(placement).length
      const canClose = gs.canCloseByPlacement()

      let space = gs.standSpace(i)
      // Учитываем pending-перенос: фишки уже визуально ушли / пришли
      if (transfer) {
        const [src, dst] = transfer
        const [, grpSize] = gs.topGroup(src)
        if (i === src) space += grpSize   // фишки ушли — стало больше места
        if (i === dst) space -= grpSize   // фишки пришли — стало меньше места
      }
      if (!canClose) space = Math.max(0, space - 1)
      if (space <= 0) { setInfo(`Стойка ${SL(i)} заполнена`); return }

      if (i in placement) {
        const current = placement[i]
        const remaining = maxTotal - currentTotal
        const spaceLeft = space - current

        if (remaining > 0 && spaceLeft > 0) {
          const newPlacement = { ...placement, [i]: current + 1 }
          setPlacement(newPlacement)
          sp()
          const newTotal = currentTotal + 1
          setInfo(`${newTotal}/${maxTotal} фишек${newTotal >= maxTotal ? ' — подтвердите' : ''}`)
        } else {
          // Достигнут макс — убираем с этой стойки
          const newPlacement = { ...placement }
          delete newPlacement[i]
          setPlacement(newPlacement)
          const newTotal = currentTotal - current
          setInfo(`Убрано. ${newTotal}/${maxTotal}`)
        }
        return
      }

      // Новая стойка — ставим 1
      if (numStands >= MAX_PLACE_STANDS) { setInfo(t('game.max2stands')); return }
      if (currentTotal >= maxTotal) { setInfo(t('game.allPlaced')); return }

      const newPlacement = { ...placement, [i]: 1 }
      setPlacement(newPlacement)
      sp()
      const newTotal = currentTotal + 1
      setInfo(`${newTotal}/${maxTotal} фишек${newTotal >= maxTotal ? ' — подтвердите' : ''}`)
    }
  }

  // ─── Подтверждение ───
  function confirmTurn() {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (!currentIsHuman || gs.gameOver || locked) return
    if (mode === 'pvp') setUndoStack(prev => [...prev, gs].slice(-10))
    const action = { transfer, placement }
    recordMove(gs, action, gs.currentPlayer)
    moveHistoryRef.current.push({ action: { ...action }, player: gs.currentPlayer })
    addLog(describeAction(action, gs.currentPlayer, t), gs.currentPlayer)

    // Онлайн — отправляем ход противнику
    if (mode === 'online') {
      MP.sendMove(action)
    }

    const ns = applyAction(gs, action)
    setTransfer(null); setPlacement({}); setSelected(null); setHint(null)
    setGs(ns)
    setPosEval(null)
    if (ns.gameOver) {
      // Онлайн — сообщаем серверу о победителе
      if (mode === 'online') {
        MP.sendGameOver(ns.winner)
      }
      setTimeout(() => {
        setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
        finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
        const won = (mode === 'pvp') ? true : ns.winner === humanPlayer
        setTimeout(() => {
          won ? sw() : sl()
          if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) }
        }, 300)
        if (typeof window.stolbikiRecordGame === 'function') {
          const w = ns.winner === humanPlayer
          const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
          const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
          const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
          window.stolbikiRecordGame(w, score, difficulty >= 400, closedGolden, false, mode === 'online')
        }
        // Турнир — запись результата
        if (tournament) {
          const w = ns.winner === humanPlayer
          const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
          setTournament(prev => ({
            ...prev,
            games: [...prev.games, { won: w, score: `${s0}:${s1}`, side: humanPlayer }],
          }))
        }
        // Daily — отправка результата
        if (dailyMode && isLoggedIn()) {
          const w = ns.winner === humanPlayer ? 1 : 0
          fetch('/api/daily/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` },
            body: JSON.stringify({ turns: ns.turn, duration: Math.floor((Date.now() - gameStartTime) / 1000), won: w }),
          }).catch(() => {})
          setDailyMode(false)
        }
      }, 800)
      return
    }
    if (mode === 'online') {
      setLocked(true)
      setPhase('place')
      setInfo(t('game.opponentTurn'))
    } else if (mode === 'pvp') {
      setPhase('place')
      const name = ns.currentPlayer === 0 ? t('game.blue') : t('game.red')
      setInfo(ns.isFirstTurn() ? `${name}: поставьте 1 фишку` : `${name}: расставьте фишки`)
    } else {
      setLocked(true)
      evaluatePosition(ns)
      setPhase('ai')
      setTimeout(() => runAi(ns), 500)
    }
  }

  function startTransfer() {
    setPhase('transfer-select')
    setInfo(t('game.selectTransferFrom'))
  }

  function cancelTransfer() {
    setSelected(null); setTransfer(null); setPhase('place')
    setInfo(t('game.transferCancelled'))
  }

  function undoMove() {
    if (undoStack.length === 0 || mode !== 'pvp') return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setGs(prev)
    setPhase('place'); setTransfer(null); setPlacement({}); setSelected(null); setResult(null)
    setLog(l => [{ text: t('game.undone'), player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...l])
    setInfo(`${prev.currentPlayer === 0 ? t('game.blue') : t('game.red')}: ${t('game.yourTurn')}`)
  }

  function resign() {
    if (gs.gameOver) return
    const winner = mode === 'online' ? (1 - (onlineRef.current?.myColor ?? 0)) : (1 - humanPlayer)
    setResult(winner); setPhase('done'); setLocked(false)
    setInfo(t('game.resigned'))
    finishRecording(winner, [gs.countClosed(0), gs.countClosed(1)])
    // Notify opponent in online
    if (mode === 'online') {
      MP.send({ type: 'resign' })
    }
    sl()
  }

  function requestHint() {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (!currentIsHuman || gs.gameOver || locked) return
    setHintLoading(true)
    setTimeout(() => { setHint(getHint(gs, 60)); setHintLoading(false) }, 100)
  }

  // ─── Computed ───
  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canConfirm = gs.isFirstTurn() ? totalPlaced === 1 : (totalPlaced > 0 || transfer)
  const isMyTurn = (mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer) && !gs.gameOver && !aiRunning.current && !locked
  const hasTransfers = !gs.isFirstTurn() && getValidTransfers(gs).length > 0
  const inTransferMode = phase === 'transfer-select' || phase === 'transfer-dst'

  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('stolbiki_tutorial_seen'))

  function dismissTutorial() {
    setShowTutorial(false)
    localStorage.setItem('stolbiki_tutorial_seen', '1')
  }

  return (
    <div>
      {/* Туториал для новых игроков */}
      {showTutorial && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={dismissTutorial}>
          <div style={{ maxWidth: 420, background: 'var(--surface)', borderRadius: 16, padding: '28px 24px', border: '1px solid var(--surface3)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <svg width="40" height="40" viewBox="0 0 28 28" fill="none" style={{ marginBottom: 8 }}>
                <rect x="2" y="6" width="6" height="18" rx="2" fill="var(--gold)" opacity="0.9"/>
                <rect x="11" y="10" width="6" height="14" rx="2" fill="var(--p1)" opacity="0.7"/>
                <rect x="20" y="8" width="6" height="16" rx="2" fill="var(--p2)" opacity="0.7"/>
              </svg>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'en' ? 'How to play Snatch Highrise' : 'Как играть в Snatch Highrise'}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.9 }}>
              <p><b style={{ color: 'var(--p1-light)' }}>1.</b> <b>Кликайте на стойки</b> чтобы ставить фишки (до 3 на 2 стойки)</p>
              <p><b style={{ color: 'var(--p1-light)' }}>2.</b> <b>Перенос</b> — кнопка «↗ Сделать перенос» (переместите верхнюю группу)</p>
              <p><b style={{ color: 'var(--p1-light)' }}>3.</b> <b>Закрытие</b> — стойка с 11 фишками закрывается. Цвет верхней группы = владелец</p>
              <p><b style={{ color: '#ffc145' }}>★</b> <b>Золотая стойка</b> решает при ничьей 5:5</p>
              <p><b style={{ color: '#3dd68c' }}></b> Закройте <b>6+ стоек</b> из 10 чтобы победить</p>
            </div>
            <button className="btn primary" onClick={dismissTutorial} style={{ width: '100%', marginTop: 16, padding: '12px 0' }}>
              Понятно, играем!
            </button>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#555' }}>
              Подробные правила — вкладка «Правила»
            </div>
          </div>
        </div>
      )}
      {mode === 'online' && (
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12,
          background: 'rgba(61,214,140,0.08)', borderRadius: 12, border: '1px solid rgba(61,214,140,0.15)' }}>
          <span style={{ fontSize: 12, color: '#3dd68c', fontWeight: 600 }}>Онлайн — {onlinePlayers.join(' vs ')}</span>
        </div>
      )}
      {mode === 'spectate-online' && (
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12,
          background: 'rgba(155,89,182,0.08)', borderRadius: 12, border: '1px solid rgba(155,89,182,0.15)' }}>
          <span style={{ fontSize: 12, color: '#c8a4e8', fontWeight: 600 }}>
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="#c8a4e8" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}><circle cx="10" cy="10" r="3"/><path d="M1 10s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/></svg>
            {onlinePlayers.join(' vs ')}
          </span>
        </div>
      )}

      {mode !== 'online' && mode !== 'spectate-online' && !isNative && (
      <div className="game-settings">
        <label>{t('game.modeLabel')}
          <select value={mode} onChange={e => newGame(humanPlayer, difficulty, e.target.value)}>
            <option value="ai">{t('game.vsAI')}</option>
            <option value="pvp">{t('game.pvp')}</option>
            <option value="spectate">AI vs AI</option>
          </select>
        </label>
        {mode === 'ai' && (
          <label>{t('game.sideLabel')}
            <select value={humanPlayer} onChange={e => newGame(+e.target.value, difficulty, mode)}>
              <option value={0}>{t('game.blueFirst')}</option>
              <option value={1}>{t('game.redSwap')}</option>
            </select>
          </label>
        )}
        {mode === 'ai' && (
          <label>{t('game.diffLabel')}
            <select value={difficulty} onChange={e => newGame(humanPlayer, +e.target.value, mode)}>
              <option value={50}>{t('game.easy')}</option>
              <option value={150}>{t('game.medium')}</option>
              <option value={400}>{t('game.hard')}</option>
              <option value={800}>{t('game.extreme')}</option>
            </select>
            {isGpuReady() && <span style={{ fontSize: 8, color: '#3dd68c', marginLeft: 4 }}>GPU</span>}
          </label>
        )}
        {mode === 'ai' && (
          <label style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={hintMode} onChange={e => { setHintMode(e.target.checked); setHint(null) }} style={{ marginRight: 4 }} />
            Подсказки
          </label>
        )}
        {mode === 'ai' && (
          <label style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={trainerMode} onChange={e => { setTrainerMode(e.target.checked); setPosEval(null) }} style={{ marginRight: 4 }} />
            Тренер
          </label>
        )}
        {mode === 'ai' && !tournament && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => startTournament(3)} style={{ fontSize: 10, padding: '4px 8px' }}>Серия 3</button>
            <button className="btn" onClick={() => startTournament(5)} style={{ fontSize: 10, padding: '4px 8px' }}>x5</button>
          </div>
        )}
      </div>
      )}

      {/* ═══ NATIVE: компактный game bar ═══ */}
      {mode !== 'online' && mode !== 'spectate-online' && isNative && (
        <div className="m-game-bar">
          <div className="m-game-bar-info">
            <span className="m-diff-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                {difficulty >= 800 ? <path d="M12 2c-4 6-8 9-8 13a8 8 0 0016 0c0-4-4-7-8-13z"/> :
                 difficulty >= 400 ? <><path d="M12 22V2"/><path d="M4 12l4-4 4 4 4-4 4 4"/></> :
                 difficulty >= 150 ? <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></> :
                 <circle cx="12" cy="12" r="9"/>}
              </svg>
              {difficulty >= 800 ? (lang === 'en' ? 'Extreme' : 'Экстрим') : difficulty >= 400 ? t('game.hard') : difficulty >= 150 ? t('game.medium') : t('game.easy')}
              {isGpuReady() && <span style={{ fontSize: 8, color: '#3dd68c', marginLeft: 3 }}>GPU</span>}
            </span>
            {mode === 'ai' && <span className="m-side-indicator" style={{ background: humanPlayer === 0 ? 'var(--p1)' : 'var(--p2)' }} />}
          </div>
          <button className="m-gear-btn" onClick={() => setShowMobileSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/>
            </svg>
          </button>
        </div>
      )}

      {/* Mobile settings sheet */}
      {showMobileSettings && isNative && (
        <div className="m-sheet-overlay" onClick={() => setShowMobileSettings(false)}>
          <div className="m-sheet" onClick={e => e.stopPropagation()}>
            <div className="m-sheet-handle" />
            <div className="m-sheet-title">Настройки игры</div>

            <div className="m-setting-row">
              <span className="m-setting-label">Режим</span>
              <select value={mode} onChange={e => { newGame(humanPlayer, difficulty, e.target.value); setShowMobileSettings(false) }}>
                <option value="ai">Против AI</option>
                <option value="pvp">PvP</option>
                <option value="spectate">AI vs AI</option>
              </select>
            </div>

            {mode === 'ai' && (
              <div className="m-setting-row">
                <span className="m-setting-label">Сложность</span>
                <div className="m-difficulty-grid">
                  {[{v:50,l:lang === 'en' ? 'Easy' : 'Лёгкая'},{v:150,l:lang === 'en' ? 'Medium' : 'Средняя'},{v:400,l:lang === 'en' ? 'Hard' : 'Сложная'},{v:800,l:lang === 'en' ? 'Extreme' : 'Экстрим'}].map(d => (
                    <button key={d.v} className={`m-diff-opt ${difficulty === d.v ? 'active' : ''}`}
                      onClick={() => { newGame(humanPlayer, d.v, mode); setShowMobileSettings(false) }}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'ai' && (
              <div className="m-setting-row">
                <span className="m-setting-label">{lang === 'en' ? 'Side' : 'Сторона'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={`m-diff-opt ${humanPlayer === 0 ? 'active' : ''}`} style={{ flex: 1 }}
                    onClick={() => { newGame(0, difficulty, mode); setShowMobileSettings(false) }}>
                    <span className="m-color-dot" style={{ background: 'var(--p1)' }} />
                    {lang === 'en' ? 'Blue (first)' : 'Синие (первый ход)'}
                  </button>
                  <button className={`m-diff-opt ${humanPlayer === 1 ? 'active' : ''}`} style={{ flex: 1 }}
                    onClick={() => { newGame(1, difficulty, mode); setShowMobileSettings(false) }}>
                    <span className="m-color-dot" style={{ background: 'var(--p2)' }} />
                    {lang === 'en' ? 'Red (swap)' : 'Красные (swap)'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'ai' && (
              <>
                <div className="m-setting-row m-toggle-row" onClick={() => { setHintMode(!hintMode); setHint(null) }}>
                  <span className="m-setting-label">{lang === 'en' ? 'Hints' : 'Подсказки'}</span>
                  <div className={`m-toggle ${hintMode ? 'on' : ''}`}><div className="m-toggle-thumb" /></div>
                </div>
                <div className="m-setting-row m-toggle-row" onClick={() => { setTrainerMode(!trainerMode); setPosEval(null) }}>
                  <span className="m-setting-label">{lang === 'en' ? 'Trainer' : 'Тренер'}</span>
                  <div className={`m-toggle ${trainerMode ? 'on' : ''}`}><div className="m-toggle-thumb" /></div>
                </div>
              </>
            )}

            {mode === 'ai' && !tournament && (
              <div className="m-setting-row">
                <span className="m-setting-label">{lang === 'en' ? 'Series' : 'Серия'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="m-diff-opt" style={{ flex: 1 }} onClick={() => { startTournament(3); setShowMobileSettings(false) }}>3 {lang === 'en' ? 'games' : 'партии'}</button>
                  <button className="m-diff-opt" style={{ flex: 1 }} onClick={() => { startTournament(5); setShowMobileSettings(false) }}>5 {lang === 'en' ? 'games' : 'партий'}</button>
                </div>
              </div>
            )}

            <button className="m-sheet-close" onClick={() => setShowMobileSettings(false)}>{lang === 'en' ? 'Done' : 'Готово'}</button>
          </div>
        </div>
      )}

      {/* Турнирный прогресс */}
      {tournament && (
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 10,
          background: 'rgba(240,160,48,0.06)', borderRadius: 12, border: '1px solid rgba(255,193,69,0.12)' }}>
          <div style={{ fontSize: 11, color: '#a8a4b8', marginBottom: 4 }}>
            Турнир — партия {tournament.currentGame} из {tournament.total}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            {Array.from({ length: tournament.total }).map((_, i) => {
              const game = tournament.games[i]
              return (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: game ? (game.won ? 'rgba(61,214,140,0.15)' : 'rgba(255,96,102,0.15)') :
                    (i + 1 === tournament.currentGame ? 'rgba(74,158,255,0.15)' : 'rgba(42,42,56,0.5)'),
                  border: `1px solid ${game ? (game.won ? '#3dd68c33' : '#ff606633') :
                    (i + 1 === tournament.currentGame ? '#4a9eff33' : '#2a2a3833')}`,
                  color: game ? (game.won ? '#3dd68c' : '#ff6066') : (i + 1 === tournament.currentGame ? '#4a9eff' : '#555'),
                }}>
                  {game ? (game.won ? '✓' : '✕') : (i + 1)}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 4 }}>
            {tournament.games.filter(g => g.won).length} : {tournament.games.filter(g => !g.won).length}
            {tournament.currentGame > 1 && ` · ${humanPlayer === 0 ? t('game.blue') : t('game.red')}`}
          </div>
          <button className="btn" onClick={() => setTournament(null)} style={{ fontSize: 9, padding: '2px 8px', marginTop: 4 }}>
            Отменить турнир
          </button>
        </div>
      )}

      {/* Сессионная статистика */}
      {(sessionStats.wins > 0 || sessionStats.losses > 0) && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8, fontSize: 11, color: 'var(--ink3)' }}>
          <span>Побед: <b style={{ color: '#3dd68c' }}>{sessionStats.wins}</b></span>
          <span>Поражений: <b style={{ color: '#ff6066' }}>{sessionStats.losses}</b></span>
          {sessionStats.streak > 1 && <span>Серия: <b style={{ color: '#ffc145' }}>{sessionStats.streak}</b></span>}
        </div>
      )}

      {(mode === 'pvp' || mode === 'spectate' || mode === 'online' || mode === 'spectate-online') && !gs.gameOver && (
        <div style={{ textAlign: 'center', padding: '6px 12px', margin: '0 auto 8px', fontSize: 13, fontWeight: 600,
          color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--p2)',
          background: gs.currentPlayer === 0 ? 'rgba(74,158,255,0.1)' : 'rgba(255,107,107,0.1)',
          borderRadius: 8, display: 'inline-block' }}>
          {mode === 'spectate' || mode === 'spectate-online' ? `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}` :
           mode === 'online' ? (gs.currentPlayer === humanPlayer ? 'Ваш ход' : 'Ходит противник') :
           `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}`}
        </div>
      )}

      <div className="scoreboard">
        <div className="score-player">
          <div className="score-label">Синие</div>
          <div className={`score-num p0 ${scoreBump === 0 ? 'score-bump' : ''}`}>{gs.countClosed(0)}</div>
        </div>
        <div className="score-sep">:</div>
        <div className="score-player">
          <div className="score-label">Красные</div>
          <div className={`score-num p1 ${scoreBump === 1 ? 'score-bump' : ''}`}>{gs.countClosed(1)}</div>
        </div>
      </div>

      <div className={`game-info ${aiThinking ? 'thinking-dots' : ''}`} role="status" aria-live="polite">{info}</div>

      <Board state={gs} pending={placement} selected={selected} phase={phase}
        humanPlayer={mode === 'pvp' ? gs.currentPlayer : humanPlayer}
        onStandClick={onStandClick} aiThinking={aiThinking} onlineMode={mode === 'online'}
        flip={userSettings.boardFlip} showChipCount={userSettings.showChipCount} showFillBar={userSettings.showFillBar}
        ghostTransfer={transfer ? { from: transfer[0], to: transfer[1], color: gs.topGroup(transfer[0])[0], count: gs.topGroup(transfer[0])[1] } : null} />

      {/* Таймер игроков */}
      {timerLimit > 0 && !gs.gameOver && (
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 16px 8px', fontSize: 13, fontFamily: 'monospace' }}>
          <div style={{ color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--ink3)', fontWeight: gs.currentPlayer === 0 ? 700 : 400,
            opacity: playerTime[0] < 30 && gs.currentPlayer === 0 ? (playerTime[0] % 2 ? 1 : 0.5) : 1 }}>
            {Math.floor(playerTime[0] / 60)}:{String(playerTime[0] % 60).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', alignSelf: 'center' }}>
            {userSettings.timer === 'blitz' ? '3+0' : userSettings.timer === 'rapid' ? '10+0' : '30+0'}
          </div>
          <div style={{ color: gs.currentPlayer === 1 ? 'var(--p2)' : 'var(--ink3)', fontWeight: gs.currentPlayer === 1 ? 700 : 400,
            opacity: playerTime[1] < 30 && gs.currentPlayer === 1 ? (playerTime[1] % 2 ? 1 : 0.5) : 1 }}>
            {Math.floor(playerTime[1] / 60)}:{String(playerTime[1] % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Прогресс закрытия стоек */}
      <div style={{ display: 'flex', gap: 2, margin: '8px 0', padding: '0 4px' }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const owner = gs.closed[i]
          return (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: owner === 0 ? 'var(--p1)' : owner === 1 ? 'var(--p2)' : '#2a2a38',
              opacity: owner !== undefined ? 0.9 : 0.3,
              transition: 'all 0.3s',
            }} />
          )
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginBottom: 6 }}>
        Ход {gs.turn} · Открыто: {gs.numOpen()} · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}
      </div>

      {/* Тренер — оценка позиции */}
      {trainerMode && posEval && mode === 'ai' && !gs.gameOver && (
        <div style={{ margin: '0 4px 8px', padding: '6px 10px', background: 'rgba(26,26,42,0.6)',
          borderRadius: 8, border: `1px solid ${posEval.color}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: posEval.color }}>{posEval.label}</span>
            <span style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 'auto' }}>
              {posEval.score > 0 ? '+' : ''}{(posEval.score * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(5, Math.min(95, (posEval.score + 1) / 2 * 100))}%`,
              height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, #ff6066, #ffc145 40%, #3dd68c)`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Статус фишек */}
      {phase === 'place' && !gs.isFirstTurn() && isMyTurn && (
        <div className="place-controls">
          <span className="place-status">
            {totalPlaced}/{maxTotal} фишек · {Object.keys(placement).length}/{MAX_PLACE_STANDS} стоек
            {transfer && ` · перенос ✓`}
          </span>
        </div>
      )}

      {/* Swap кнопка */}
      {isMyTurn && gs.turn === 1 && gs.swapAvailable && phase === 'place' && (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            {t('game.swapQuestion')}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => {
              const action = { swap: true }
              if (mode === 'online') MP.sendMove(action)
              recordMove(gs, action, gs.currentPlayer)
              moveHistoryRef.current.push({ action, player: gs.currentPlayer })
              addLog('Swap — цвета поменялись!', gs.currentPlayer)
              ss()
              const ns = applyAction(gs, action)
              setGs(ns)
              setPhase('place')
              if (mode === 'online') {
                setHumanPlayer(0)
                onlineRef.current && (onlineRef.current.myColor = 0)
                setLocked(false)
                setInfo(t('game.swapOnlineDone'))
              } else {
                setInfo(t('game.swapDone'))
              }
            }} style={{ borderColor: '#9b59b6', color: '#9b59b6', padding: '10px 20px' }}>
              Swap
            </button>
            <button className="btn" onClick={() => {
              setInfo(t('game.swapDeclined'))
            }} style={{ fontSize: 12, padding: '10px 16px' }}>
              {t('game.noContinue')}
            </button>
          </div>
        </div>
      )}

      {/* Draw offer from opponent */}
      {drawOffered && !gs.gameOver && mode === 'online' && (
        <div style={{ textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(155,89,182,0.08)', borderRadius: 10, border: '1px solid rgba(155,89,182,0.2)' }}>
          <div style={{ fontSize: 12, color: '#c8c4d8', marginBottom: 8 }}>
            {t('game.drawOfferReceived')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => {
              MP.send({ type: 'drawResponse', accepted: true })
              setResult(-1); setPhase('done'); setLocked(false)
              setInfo(t('game.drawAgreed'))
              setDrawOffered(false)
            }} style={{ borderColor: '#3dd68c', color: '#3dd68c' }}>
              {t('game.accept')}
            </button>
            <button className="btn" onClick={() => {
              MP.send({ type: 'drawResponse', accepted: false })
              setDrawOffered(false)
            }} style={{ fontSize: 12 }}>
              {t('game.decline')}
            </button>
          </div>
        </div>
      )}

      {rematchOffered && gs.gameOver && mode === 'online' && (
        <div style={{ textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(61,214,140,0.08)', borderRadius: 10, border: '1px solid rgba(61,214,140,0.2)' }}>
          <div style={{ fontSize: 12, color: '#c8c4d8', marginBottom: 8 }}>
            {t('game.rematchOffer')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => {
              MP.sendRematchResponse(true)
              setRematchOffered(false)
            }} style={{ borderColor: '#3dd68c', color: '#3dd68c' }}>
              {t('game.accept')}
            </button>
            <button className="btn" onClick={() => {
              MP.sendRematchResponse(false)
              setRematchOffered(false)
            }} style={{ fontSize: 12 }}>
              {t('game.decline')}
            </button>
          </div>
        </div>
      )}

      <div className="actions">
        {isMyTurn && phase === 'place' && hasTransfers && !transfer && (
          <button className="btn" onClick={startTransfer}>{t('game.transfer')}</button>
        )}
        {isMyTurn && inTransferMode && (
          <button className="btn" onClick={cancelTransfer}>{t('game.cancelTransfer')}</button>
        )}
        {isMyTurn && transfer && phase === 'place' && (
          <span style={{ fontSize: 12, color: '#3dd68c', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            ✓ {SL(transfer[0])} → {SL(transfer[1])}
          </span>
        )}
        {isMyTurn && phase === 'place' && totalPlaced > 0 && (
          <button className="btn" onClick={() => setPlacement({})}>{t('game.reset')}</button>
        )}
        {isMyTurn && phase === 'place' && (
          <button className="btn primary" disabled={!canConfirm} onClick={confirmTurn}>{ t('game.confirm') }</button>
        )}
        {hintMode && isMyTurn && (
          <button className="btn" onClick={requestHint} disabled={hintLoading} style={{ borderColor: '#ffbe30', color: '#ffbe30' }}>
            {hintLoading ? '...' : (t('game.hint'))}
          </button>
        )}
        <button className="btn" onClick={() => newGame()}>{t('game.newGame')}</button>
        {!gs.gameOver && mode !== 'pvp' && mode !== 'spectate-online' && (
          <button className="btn" onClick={resign} style={{ fontSize: 11, color: '#ff6066', borderColor: '#ff606640' }}>
            {t('game.resign')}
          </button>
        )}
        {!gs.gameOver && mode === 'online' && (
          <button className="btn" onClick={() => {
            MP.send({ type: 'drawOffer' })
            setInfo(t('game.drawOffered'))
          }} style={{ fontSize: 11, opacity: 0.6 }}>
            {t('game.offerDraw')}
          </button>
        )}
        {mode === 'pvp' && undoStack.length > 0 && !gs.gameOver && (
          <button className="btn" onClick={undoMove} style={{ fontSize: 11 }}>{t('game.undo')}</button>
        )}
      </div>

      {isMyTurn && !gs.gameOver && !isNative && (
        <div style={{ textAlign: 'center', fontSize: 9, color: '#444', marginTop: 4 }}>
          Enter — подтвердить · Esc — отмена переноса · N — новая игра
        </div>
      )}

      {hint && hintMode && (
        <div className="hint-panel">
          <div className="hint-title">Подсказка</div>
          {hint.explanation.map((l, i) => <p key={i} className="hint-line">{l}</p>)}
        </div>
      )}

      {result !== null && (() => {
        const isDraw = result === -1
        const won = isDraw ? false : (mode === 'pvp') ? true : result === humanPlayer
        const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
        const goldenOwned = (0 in gs.closed)
        const shareText = `Snatch Highrise${mode === 'online' ? ' Online' : ''}: ${isDraw ? 'Draw' : won ? 'W' : 'L'} ${s0}:${s1} ${goldenOwned ? '⭐' : ''} — snatch-highrise.com`
        return (
          <div className="game-result" style={{ borderLeft: `3px solid ${isDraw ? '#9b59b6' : won ? '#3dd68c' : '#ff6066'}`, textAlign: 'center' }}>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
              {isDraw
                ? <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#9b59b6" strokeWidth="2"><path d="M6 13h20M6 19h20"/></svg>
                : won
                ? <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#3dd68c" strokeWidth="2.5"><path d="M6 17l7 7L26 8"/></svg>
                : <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#ff6066" strokeWidth="2.5"><path d="M8 8l16 16M24 8L8 24"/></svg>
              }
            </div>
            <span style={{ fontSize: 20 }}>{isDraw
              ? (t('game.draw'))
              : mode === 'pvp'
              ? `${result === 0 ? t('game.blueWin') : t('game.redWin')}`
              : mode === 'online'
              ? (won ? t('game.victory') : t('game.defeat'))
              : (won ? t('game.victory') : t('game.aiWins'))
            }</span>
            <div style={{ fontSize: 32, fontWeight: 700, margin: '6px 0', color: 'var(--ink)' }}>{s0} : {s1}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
              <span>{lang === 'en' ? 'Moves' : 'Ходов'}: {gs.turn}</span>
              <span>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
              {goldenOwned && <span style={{ color: 'var(--gold)' }}>★ {lang === 'en' ? 'Golden' : 'Золотая'}</span>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {!tournament && (
                <button className="btn primary" onClick={() => {
                  if (mode === 'online' || mode === 'spectate-online') window.dispatchEvent(new CustomEvent('stolbiki-back-to-lobby'))
                  else newGame()
                }} style={{ fontSize: 12, padding: '8px 16px' }}>
                  {(mode === 'online' || mode === 'spectate-online') ? (t('game.backToLobby')) : (t('game.anotherGame'))}
                </button>
              )}
              {mode === 'online' && !tournament && !rematchPending && (
                <button className="btn" onClick={() => {
                  MP.sendRematchOffer()
                  setRematchPending(true)
                  setInfo(t('game.rematchWaiting'))
                }} style={{ fontSize: 12, padding: '8px 16px', borderColor: '#3dd68c', color: '#3dd68c' }}>
                  {t('game.rematch')}
                </button>
              )}
              {mode === 'online' && rematchPending && (
                <span style={{ fontSize: 11, color: 'var(--ink3)', padding: '8px 12px' }}>{t('game.rematchWaiting')}</span>
              )}
              {mode === 'ai' && !tournament && (
                <button className="btn" onClick={() => newGame(humanPlayer === 0 ? 1 : 0, difficulty, mode)} style={{ fontSize: 12, padding: '8px 14px' }}>
                  Switch side
                </button>
              )}
              <button className="btn" onClick={async () => {
                try {
                  const c = generateShareImage(gs, won, isDraw, s0, s1)
                  const blob = await new Promise(r => c.toBlob(r, 'image/png'))
                  const file = new File([blob], 'stolbiki-result.png', { type: 'image/png' })

                  if (navigator.canShare?.({ files: [file] })) {
                    navigator.share({ text: shareText, files: [file] }).catch(() => {})
                  } else if (navigator.share) {
                    navigator.share({ text: shareText }).catch(() => {})
                  } else {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = 'stolbiki-result.png'; a.click()
                    URL.revokeObjectURL(url)
                  }
                } catch {
                  navigator.clipboard?.writeText(shareText)
                }
              }} style={{ fontSize: 12, padding: '8px 12px' }}>
                {t('game.share')}
              </button>
              {moveHistoryRef.current.length > 0 && (
                <button className="btn" onClick={() => setShowReplay(true)} style={{ fontSize: 12, padding: '8px 12px' }}>
                  {t('game.replay')}
                </button>
              )}
            </div>
            {sessionStats.streak > 1 && won && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#ffc145' }}>
                Серия побед: {sessionStats.streak}
              </div>
            )}
            {/* Турнир — межпартийный / финальный экран */}
            {tournament && (() => {
              const tWins = tournament.games.filter(g => g.won).length
              const tLosses = tournament.games.filter(g => !g.won).length
              const isFinished = tournament.games.length >= tournament.total
              const majorityNeeded = Math.ceil(tournament.total / 2)
              const earlyWin = tWins >= majorityNeeded || tLosses >= majorityNeeded
              const tournamentDone = isFinished || earlyWin
              const tournamentWon = tWins > tLosses
              const tournamentDraw = tWins === tLosses

              if (tournamentDone) {
                return (
                  <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,193,69,0.06)', borderRadius: 12, border: '1px solid rgba(255,193,69,0.12)' }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{tournamentDraw ? '=' : tournamentWon ? '+' : '-'}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                      {tournamentDraw ? t('tournament.draw') : tournamentWon ? t('tournament.won') : t('tournament.lost')}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{tWins} : {tLosses}</div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', margin: '8px 0' }}>
                      {tournament.games.map((g, i) => (
                        <div key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: g.won ? 'rgba(61,214,140,0.15)' : 'rgba(255,96,102,0.15)',
                          color: g.won ? '#3dd68c' : '#ff6066' }}>
                          {g.score}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                      <button className="btn primary" onClick={() => { setTournament(null); newGame() }} style={{ fontSize: 12 }}>
                        Обычная игра
                      </button>
                      <button className="btn" onClick={() => startTournament(tournament.total)} style={{ fontSize: 12 }}>
                        New tournament
                      </button>
                    </div>
                  </div>
                )
              }

              // Межпартийный экран
              return (
                <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(74,158,255,0.06)', borderRadius: 12, border: '1px solid rgba(74,158,255,0.1)' }}>
                  <div style={{ fontSize: 12, color: '#a8a4b8', marginBottom: 6 }}>
                    Турнир: {tWins} : {tLosses} · Партия {tournament.games.length} из {tournament.total}
                  </div>
                  <button className="btn primary" onClick={tournamentNextGame} style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px 0' }}>
                    ▶ Следующая партия
                  </button>
                </div>
              )
            })()}
          </div>
        )
      })()}

      <div className="game-log" ref={logRef}>
        {log.map((e, i) => (
          <div key={i}>
            <span style={{ color: '#6e6a82', fontSize: 10, marginRight: 6 }}>{e.time}</span>
            <span className={e.player >= 0 ? `log-p${e.player}` : ''}>{e.text}</span>
          </div>
        ))}
      </div>

      {/* Конфетти */}
      {confetti && (
        <div className="confetti-container">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="confetti" style={{
              left: `${Math.random() * 100}%`,
              background: ['#ffc145', '#6db4ff', '#ff6b6b', '#3dd68c', '#9b59b6', '#f0654a'][i % 6],
              width: `${6 + Math.random() * 8}px`,
              height: `${6 + Math.random() * 8}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDuration: `${1.5 + Math.random() * 2}s`,
              animationDelay: `${Math.random() * 0.8}s`,
            }} />
          ))}
        </div>
      )}

      {/* Ачивка popup */}
      {newAch && (
        <div className="achievement-popup">
          <div className="ach-icon">{newAch.icon}</div>
          <div>
            <div className="ach-label">Ачивка разблокирована!</div>
            <div className="ach-name">{newAch.name}</div>
          </div>
        </div>
      )}

      {/* Анимированный повтор */}
      {showReplay && moveHistoryRef.current.length > 0 && (
        <ReplayViewer moves={moveHistoryRef.current} onClose={() => setShowReplay(false)} />
      )}
    </div>
  )
}
