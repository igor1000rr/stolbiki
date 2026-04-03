import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import Mascot from './Mascot'
import Confetti from './Confetti'
import {
  GameState, getValidTransfers, applyAction,
  MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND
} from '../engine/game'
import { mctsSearch, preloadGpuNet } from '../engine/ai'
import { isGpuReady } from '../engine/neuralnet'
import { getHint } from '../engine/hints'
import { startRecording, setGameMeta, recordMove, finishRecording, cancelRecording } from '../engine/collector'
import * as MP from '../engine/multiplayer'
import * as API from '../engine/api'
import { getSettings } from '../engine/settings'
import { useI18n } from '../engine/i18n'
import { useGameContext } from '../engine/GameContext'
import { useGameTimer } from '../engine/useGameTimer'
import { soundPlace, soundTransfer, soundClose, soundWin, soundLose, soundSwap, soundClick } from '../engine/sounds'
import Board from './Board'
import GameResultPanel from './GameResultPanel'
import ReplayViewer, { describeAction } from './ReplayViewer'
import { useGameLog } from '../engine/useGameLog'
import { useSessionStats } from '../engine/useSessionStats'
import { useKeyboardShortcuts } from '../engine/useKeyboardShortcuts'
const GameReview = lazy(() => import('./GameReview'))

const isNative = !!window.Capacitor?.isNativePlatform?.()
import { startTitleBlink, sp, st, sc, sw, sl, ss, setSoundOn, generateShareImage, showNotification, requestNotificationPermission } from './gameUtils'

const SL = i => i === GOLDEN_STAND ? '★' : 'ABCDEFGHI'[i - 1] || String(i)


export default function Game() {
  const { t, lang } = useI18n()
  const en = lang === 'en'
  const gameCtx = useGameContext()
  const sw = soundWin, sl = soundLose, ss = soundSwap
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
  // Обновляем настройки мгновенно (focus + GameContext)
  useEffect(() => {
    const refresh = () => setUserSettings(getSettings())
    window.addEventListener('focus', refresh)
    const unsub = gameCtx?.on('settingsChanged', refresh)
    return () => { window.removeEventListener('focus', refresh); unsub?.() }
  }, [gameCtx])
  // Таймеры (extracted hook)
  const sk = soundClick // тик при <10с
  const { timerLimit, playerTime, setPlayerTime, elapsed, resetTimers, TIMER_LIMITS: _TL } = useGameTimer({
    timerSetting: userSettings.timer,
    gameOver: gs.gameOver,
    currentPlayer: gs.currentPlayer,
    humanPlayer,
    locked,
    aiRunning: aiRunning?.current,
    onTimeUp: (cp) => {
      setResult(1 - cp); setPhase('done'); setInfo(cp === humanPlayer ? t('game.timeUp') : t('game.oppTimeUp'))
      setLocked(false)
    },
    onTick: () => sk(),
  })
  const { log, setLog, addLog, resetLog, logRef } = useGameLog(lang)
  const [info, setInfo] = useState('')
  const [result, setResult] = useState(null)
  const [hint, setHint] = useState(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintMode, setHintMode] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [scoreBump, setScoreBump] = useState(null)
  const [locked, setLocked] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [ratingDelta, setRatingDelta] = useState(null)
  const [newAch, setNewAch] = useState(null)
  const { sessionStats, firstWinCelebration, setFirstWinCelebration } = useSessionStats({ result, mode, humanPlayer, difficultyRef, gs })
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
  const [showReview, setShowReview] = useState(false)
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

  // Синхронизируем gsRef с gs
  useEffect(() => { gsRef.current = gs }, [gs])

  // ─── Онлайн мультиплеер: слушаем события из Online.jsx ───
  useEffect(() => {
    function handleOnlineStart(e) {
      const { players, firstPlayer, roomId, playerIdx, nextGame, timer, ratings } = e.detail
      requestNotificationPermission()
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
      resetTimers()
      // Онлайн-таймер от сервера (минуты → секунды)
      if (timer && timer > 0) {
        setPlayerTime([timer * 60, timer * 60])
      }
      setUndoStack([])
      setPosEval(null)
      moveHistoryRef.current = []
      setShowReplay(false)
      setRematchOffered(false)
      setRematchPending(false)
      setDrawOffered(false)

      const myName = players[playerIdx] || t('game.you')
      const oppName = players[1 - playerIdx] || t('game.opponent')
      const ratingStr = ratings ? ` (${ratings[playerIdx]} vs ${ratings[1 - playerIdx]})` : ''
      setLog([{ text: `Онлайн: ${myName} vs ${oppName}${ratingStr}${nextGame ? ' (следующая партия)' : ''}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])

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
      if (action.transfer) { st() }
      else { sp() }

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

    // Регистрируем обработчики через GameContext (вместо window CustomEvents)
    const unsubscribers = []
    if (gameCtx) {
      unsubscribers.push(gameCtx.register('onOnlineStart', (detail) => handleOnlineStart({ detail })))
      unsubscribers.push(gameCtx.register('onOnlineMove', (action, serverTime) => {
        // Online mode: обработка хода оппонента
        handleOnlineMove({ detail: action })
        // Spectate mode: обработка хода любого игрока
        handleSpectateMove({ detail: action })
        // Синхронизация таймера от сервера
        if (serverTime && Array.isArray(serverTime)) {
          setPlayerTime([Math.round(serverTime[0]), Math.round(serverTime[1])])
        }
      }))
      // Время вышло (серверное)
      unsubscribers.push(gameCtx.register('onTimeUp', ({ loser }) => {
        const myIdx = onlineRef.current?.playerIdx ?? 0
        const won = loser !== myIdx
        setResult(won ? (onlineRef.current?.myColor ?? 0) : 1 - (onlineRef.current?.myColor ?? 0))
        setPhase('done'); setLocked(false)
        setInfo(won ? t('game.oppTimeUp') : t('game.timeUp'))
        setTimeout(() => { won ? sw() : sl(); if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) } }, 300)
      }))
    }

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
    function handleDrawResponse(detail) {
      if (detail?.accepted) {
        setResult(-1); setPhase('done'); setLocked(false)
        setInfo(t('game.drawAgreed'))
      } else {
        setInfo(t('game.drawDeclined'))
      }
      setDrawOffered(false)
    }

    if (gameCtx) {
      unsubscribers.push(gameCtx.register('onOnlineResign', handleOnlineResign))
      unsubscribers.push(gameCtx.register('onDrawOffer', handleDrawOffer))
      unsubscribers.push(gameCtx.register('onDrawResponse', handleDrawResponse))
    }

    // Серверное подтверждение gameOver (авторитетный источник)
    function handleServerGameOver(detail) {
      const { winner } = detail
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
    if (gameCtx) unsubscribers.push(gameCtx.register('onServerGameOver', handleServerGameOver))

    // Rematch
    function handleRematchOffer() {
      setRematchOffered(true)
      showNotification('Snatch Highrise', t('game.rematchOffer'))
    }
    function handleRematchDeclined() {
      setRematchPending(false)
      setInfo(t('game.rematchDeclined'))
    }
    if (gameCtx) {
      unsubscribers.push(gameCtx.register('onRematchOffer', handleRematchOffer))
      unsubscribers.push(gameCtx.register('onRematchDeclined', handleRematchDeclined))
    }

    // ─── Спектатор: наблюдение за чужой игрой ───
    function handleSpectateStart(detail) {
      const { players, firstPlayer, gameState: gsData } = detail
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
      setLog([{ text: `⊙ ${(players || []).join(' vs ')}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
    }

    // Спектатор получает ходы обоих игроков
    function handleSpectateMove(e) {
      if (modeRef.current !== 'spectate-online') return
      const action = e.detail
      const prevState = gsRef.current
      const ns = applyAction(prevState, action)
      setGs(ns)
      gsRef.current = ns
      if (action.transfer) { st() }
      else if (action.swap) { ss() }
      else { sp() }
      addLog(describeAction(action, prevState.currentPlayer, t), prevState.currentPlayer)
      if (ns.gameOver) {
        setTimeout(() => {
          setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver'))
        }, 500)
      }
    }
    if (gameCtx) unsubscribers.push(gameCtx.register('onSpectateStart', (detail) => handleSpectateStart(detail)))

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub())
    }
  }, [gameCtx]) // eslint-disable-line

  // ─── Daily Challenge: слушаем из Online.jsx через GameContext ───
  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('onDailyStart', (daily) => {
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
      resetTimers()
      setUndoStack([])
      setPosEval(null)
      moveHistoryRef.current = []
      setShowReplay(false)

      const seedLabel = (daily.seed || daily.date || '').toString().slice(-4)
      setLog([{ text: `Ежедневный челлендж #${seedLabel}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo(lang === 'en' ? `Challenge #${seedLabel} — beat AI in minimum moves!` : `Челлендж #${seedLabel} — победите AI за минимум ходов!`)
    })
  }, [gameCtx]) // eslint-disable-line

  // ─── Тренер: оценка позиции через MCTS ───
  function evaluatePosition(state) {
    if (!trainerMode || mode !== 'ai') return
    setTimeout(() => {
      try {
        const result = mctsSearch(state, 30)
        const score = result.bestValue || 0
        const ps = state.currentPlayer === humanPlayer ? score : -score
        let label, color
        if (ps > 0.3) { label = t('trainer.strong'); color = 'var(--green)' }
        else if (ps > 0.1) { label = t('trainer.slight'); color = 'var(--green)' }
        else if (ps > -0.1) { label = t('trainer.equal'); color = 'var(--ink2)' }
        else if (ps > -0.3) { label = t('trainer.weak'); color = 'var(--gold)' }
        else { label = t('trainer.bad'); color = 'var(--p2)' }
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
    setInfo(lang === 'en' ? `Daily challenge #${getDailySeed() % 10000} — beat AI!` : `Ежедневный челлендж #${getDailySeed() % 10000} — победите AI!`)
  }

  // ─── Турнирный режим ───
  function startTournament(total = 3) {
    setTournament({ total, games: [], currentGame: 1 })
    newGame(0, difficulty, 'ai')
    setInfo(lang === 'en' ? `Tournament: game 1 of ${total}` : `Турнир: партия 1 из ${total}`)
  }

  function tournamentNextGame() {
    if (!tournament) return
    const next = tournament.currentGame + 1
    if (next > tournament.total) return
    setTournament(prev => ({ ...prev, currentGame: next }))
    newGame((next - 1) % 2, difficulty, 'ai')
    setInfo(lang === 'en' ? `Tournament: game ${next} of ${tournament.total}` : `Турнир: партия ${next} из ${tournament.total}`)
  }

  // Слушаем новые ачивки через GameContext
  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('onAchievement', (ach) => {
      setNewAch(ach)
      setTimeout(() => setNewAch(null), 4000)
    })
  }, [gameCtx])

  // Сессионная статистика — extracted to useSessionStats

  useEffect(() => {
    const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
    if (s0 > prevScore.current[0]) { setScoreBump(0); setTimeout(() => setScoreBump(null), 700); sc() }
    if (s1 > prevScore.current[1]) { setScoreBump(1); setTimeout(() => setScoreBump(null), 700); sc() }
    prevScore.current = [s0, s1]
  }, [gs])

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
              if (gameCtx) {
                const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
                const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
                const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
                gameCtx.emit('recordGame', won, score, difficultyRef.current >= 400, closedGolden, false)
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
    setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setRatingDelta(null); setHint(null); setAiThinking(false)
    setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(d); difficultyRef.current = d; setMode(m)
    // Предзагрузка GPU-сети для hard+ (lazy, не блокирует)
    if (d >= 200) preloadGpuNet()
    aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = m
    startRecording()
    setGameMeta(m, d)
    setGameStartTime(Date.now())
    setElapsed(0)
    if (timerLimit) setPlayerTime([timerLimit, timerLimit])
    setUndoStack([])
    if (m === 'pvp') {
      setLog([{ text: lang === 'en' ? 'New game: player vs player' : 'Новая партия: игрок против игрока', player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
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

  // ELO дельта — получаем от Profile через GameContext
  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('onRatingDelta', (d) => setRatingDelta(d))
  }, [gameCtx])

  // Горячие клавиши — extracted hook

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
    soundClick()

    if (phase === 'transfer-select') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) {
        setSelected(i)
        setPhase('transfer-dst')
        setInfo(lang === 'en' ? `Where to transfer blocks from stand ${SL(i)}?` : `Куда перенести блоки со стойки ${SL(i)}?`)
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
        addLog(`${lang === 'en' ? 'Transfer' : 'Перенос'}: ${SL(selected)} → ${SL(i)}`, humanPlayer)
        setInfo(t('game.transferSelected'))
      } else {
        setInfo(lang === 'en' ? 'Cannot transfer here' : 'Нельзя перенести сюда')
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
      if (space <= 0) { setInfo(lang === 'en' ? `Stand ${SL(i)} is full` : `Стойка ${SL(i)} заполнена`); return }

      if (i in placement) {
        const current = placement[i]
        const remaining = maxTotal - currentTotal
        const spaceLeft = space - current

        if (remaining > 0 && spaceLeft > 0) {
          const newPlacement = { ...placement, [i]: current + 1 }
          setPlacement(newPlacement)
          sp()
          const newTotal = currentTotal + 1
          setInfo(`${newTotal}/${maxTotal} ${lang === 'en' ? 'blocks' : 'блоков'}${newTotal >= maxTotal ? (lang === 'en' ? ' — confirm' : ' — подтвердите') : ''}`)
        } else {
          // Достигнут макс — убираем с этой стойки
          const newPlacement = { ...placement }
          delete newPlacement[i]
          setPlacement(newPlacement)
          const newTotal = currentTotal - current
          setInfo(`${lang === 'en' ? 'Removed' : 'Убрано'}. ${newTotal}/${maxTotal}`)
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
      setInfo(`${newTotal}/${maxTotal} ${lang === 'en' ? 'blocks' : 'блоков'}${newTotal >= maxTotal ? (lang === 'en' ? ' — confirm' : ' — подтвердите') : ''}`)
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

    // Онлайн — отправляем ход противнику (с локальным временем для sync)
    if (mode === 'online') {
      MP.sendMove(action, playerTime)
    }

    const ns = applyAction(gs, action)
    // Звуки
    if (action.transfer) soundTransfer()
    else if (Object.keys(action.placement || {}).length) soundPlace()
    const newClosed = Object.keys(ns.closed).length
    const oldClosed = Object.keys(gs.closed).length
    if (newClosed > oldClosed) soundClose()

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
        if (gameCtx) {
          const w = ns.winner === humanPlayer
          const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
          const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
          const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
          gameCtx.emit('recordGame', w, score, difficulty >= 400, closedGolden, false, mode === 'online')
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
        if (dailyMode && API.isLoggedIn()) {
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
      setInfo(ns.isFirstTurn() ? `${name}: ${lang === 'en' ? 'place 1 block' : 'поставьте 1 блок'}` : `${name}: ${lang === 'en' ? 'place blocks' : 'расставьте блоки'}`)
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

  useKeyboardShortcuts({
    canConfirm, isMyTurn, phase, confirmTurn,
    inTransferMode, cancelTransfer,
    gameOver: gs.gameOver, result, newGame,
    mode, undoStack, undoMove,
    locked, numStands: gs.numStands, onStandClick,
    requestHint,
  })

  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('stolbiki_tutorial_seen'))

  function dismissTutorial() {
    setShowTutorial(false)
    localStorage.setItem('stolbiki_tutorial_seen', '1')
  }

  return (
    <div className={isNative ? 'native-game-wrapper' : ''}>
      {/* Туториал для новых игроков */}
      {showTutorial && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isNative ? 12 : 20, overflowY: 'auto' }}
          onClick={dismissTutorial}>
          <div style={{ maxWidth: 420, width: '100%', background: 'var(--surface)', borderRadius: 16, padding: isNative ? '20px 16px' : '28px 24px', border: '1px solid var(--surface3)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', margin: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: isNative ? 10 : 16 }}>
              <img src="/logo-text.webp" alt="Snatch Highrise" style={{ width: 180, height: 'auto', marginBottom: 8 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{lang === 'en' ? 'How to play' : 'Как играть'}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.9 }}>
              {lang === 'en' ? <>
                <p><b style={{ color: 'var(--p1-light)' }}>1.</b> <b>Click stands</b> to place blocks (up to 3 on 2 stands)</p>
                <p><b style={{ color: 'var(--p1-light)' }}>2.</b> <b>Transfer</b> — move top group from one stand to another</p>
                <p><b style={{ color: 'var(--p1-light)' }}>3.</b> <b>Completing</b> — stand with 11 blocks is complete. Top group color = owner</p>
                <p><b style={{ color: 'var(--gold)' }}>★</b> <b>Golden stand</b> breaks 5:5 ties</p>
                <p><b style={{ color: 'var(--green)' }}></b> Close <b>6+ stands</b> out of 10 to win</p>
              </> : <>
                <p><b style={{ color: 'var(--p1-light)' }}>1.</b> <b>Кликайте на стойки</b> чтобы ставить блоки (до 3 на 2 стойки)</p>
                <p><b style={{ color: 'var(--p1-light)' }}>2.</b> <b>Перенос</b> — кнопка «↗ Сделать перенос» (переместите верхнюю группу)</p>
                <p><b style={{ color: 'var(--p1-light)' }}>3.</b> <b>Достройка</b> — высотка с 11 блоками достроена. Цвет верхней группы = владелец</p>
                <p><b style={{ color: 'var(--gold)' }}>★</b> <b>Золотая стойка</b> решает при ничьей 5:5</p>
                <p><b style={{ color: 'var(--green)' }}></b> Достройте <b>6+ высоток</b> из 10 чтобы победить</p>
              </>}
            </div>
            <button className="btn primary" onClick={dismissTutorial} style={{ width: '100%', marginTop: 16, padding: '12px 0' }}>
              {lang === 'en' ? 'Got it, let\'s play!' : 'Понятно, играем!'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--ink3)' }}>
              {lang === 'en' ? 'Detailed rules — Rules tab' : 'Подробные правила — вкладка «Правила»'}
            </div>
          </div>
        </div>
      )}
      {mode === 'online' && (
        <div style={{ textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 12,
          background: 'rgba(61,214,140,0.08)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(61,214,140,0.15)' }}>
          <span style={{ fontSize: isNative ? 11 : 12, color: 'var(--green)', fontWeight: 600 }}>{lang === 'en' ? 'Online' : 'Онлайн'} — {onlinePlayers.join(' vs ')}</span>
        </div>
      )}
      {mode === 'spectate-online' && (
        <div style={{ textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 12,
          background: 'rgba(155,89,182,0.08)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(155,89,182,0.15)' }}>
          <span style={{ fontSize: isNative ? 11 : 12, color: 'var(--purple)', fontWeight: 600 }}>
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
            {isGpuReady() && <span style={{ fontSize: 8, color: 'var(--green)', marginLeft: 4 }}>GPU</span>}
          </label>
        )}
        {mode === 'ai' && (
          <label style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={hintMode} onChange={e => { setHintMode(e.target.checked); setHint(null) }} style={{ marginRight: 4 }} />
            {lang === 'en' ? 'Hints' : 'Подсказки'}
          </label>
        )}
        {mode === 'ai' && (
          <label style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={trainerMode} onChange={e => { setTrainerMode(e.target.checked); setPosEval(null) }} style={{ marginRight: 4 }} />
            {lang === 'en' ? 'Trainer' : 'Тренер'}
          </label>
        )}
        {mode === 'ai' && !tournament && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => startTournament(3)} style={{ fontSize: 10, padding: '4px 8px' }}>{lang === 'en' ? 'Best of 3' : 'Серия 3'}</button>
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
              {isGpuReady() && <span style={{ fontSize: 8, color: 'var(--green)', marginLeft: 3 }}>GPU</span>}
            </span>
            {mode === 'ai' && <span className="m-side-indicator" style={{ background: humanPlayer === 0 ? 'var(--p1)' : 'var(--p2)' }} />}
          </div>
          <button className="m-gear-btn" onClick={() => setShowMobileSettings(true)} aria-label="Settings">
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
            <div className="m-sheet-title">{lang === 'en' ? 'Game Settings' : 'Настройки игры'}</div>

            <div className="m-setting-row">
              <span className="m-setting-label">{lang === 'en' ? 'Mode' : 'Режим'}</span>
              <select value={mode} onChange={e => { newGame(humanPlayer, difficulty, e.target.value); setShowMobileSettings(false) }}>
                <option value="ai">{lang === 'en' ? 'vs AI' : 'Против AI'}</option>
                <option value="pvp">PvP</option>
                <option value="spectate">AI vs AI</option>
              </select>
            </div>

            {mode === 'ai' && (
              <div className="m-setting-row">
                <span className="m-setting-label">{lang === 'en' ? 'Difficulty' : 'Сложность'}</span>
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
        <div style={{ textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 10,
          background: 'rgba(240,160,48,0.06)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(255,193,69,0.12)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 4 }}>
            {lang === 'en' ? `Tournament — game ${tournament.currentGame} of ${tournament.total}` : `Турнир — партия ${tournament.currentGame} из ${tournament.total}`}
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
                  color: game ? (game.won ? 'var(--green)' : 'var(--p2)') : (i + 1 === tournament.currentGame ? 'var(--p1)' : 'var(--ink3)'),
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
            {lang === 'en' ? 'Cancel tournament' : 'Отменить турнир'}
          </button>
        </div>
      )}

      {/* Сессионная статистика */}
      {(sessionStats.wins > 0 || sessionStats.losses > 0) && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: isNative ? 2 : 8, fontSize: 11, color: 'var(--ink3)' }}>
          <span>{lang === 'en' ? 'Wins' : 'Побед'}: <b style={{ color: 'var(--green)' }}>{sessionStats.wins}</b></span>
          <span>{lang === 'en' ? 'Losses' : 'Поражений'}: <b style={{ color: 'var(--p2)' }}>{sessionStats.losses}</b></span>
          {sessionStats.streak > 1 && <span>{lang === 'en' ? 'Streak' : 'Серия'}: <b style={{ color: 'var(--gold)' }}>{sessionStats.streak}</b></span>}
        </div>
      )}

      {(mode === 'pvp' || mode === 'spectate' || mode === 'online' || mode === 'spectate-online') && !gs.gameOver && (
        <div style={{ textAlign: 'center', padding: isNative ? '3px 10px' : '6px 12px', margin: isNative ? '0 auto 2px' : '0 auto 8px', fontSize: isNative ? 12 : 13, fontWeight: 600,
          color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--p2)',
          background: gs.currentPlayer === 0 ? 'rgba(74,158,255,0.1)' : 'rgba(255,107,107,0.1)',
          borderRadius: 8, display: 'inline-block' }}>
          {mode === 'spectate' || mode === 'spectate-online' ? `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}` :
           mode === 'online' ? (gs.currentPlayer === humanPlayer ? (lang === 'en' ? 'Your turn' : 'Ваш ход') : (lang === 'en' ? 'Opponent\'s turn' : 'Ходит противник')) :
           `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}`}
        </div>
      )}

      <div className="scoreboard">
        <div className="score-player">
          <div className="score-label">{lang === 'en' ? 'Blue' : 'Синие'}</div>
          <div className={`score-num p0 ${scoreBump === 0 ? 'score-bump' : ''}`}>{gs.countClosed(0)}</div>
        </div>
        <div className="score-sep">:</div>
        <div className="score-player">
          <div className="score-label">{lang === 'en' ? 'Red' : 'Красные'}</div>
          <div className={`score-num p1 ${scoreBump === 1 ? 'score-bump' : ''}`}>{gs.countClosed(1)}</div>
        </div>
        <button onClick={() => gameCtx?.emit('openSkinShop')}
          style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 6, opacity: 0.4,
            color: 'var(--ink3)', fontSize: 16, lineHeight: 1 }}
          title={en ? 'Skin Shop' : 'Скины'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
          </button>
      </div>

      <div className={`game-info ${aiThinking ? 'thinking-dots' : ''}`} role="status" aria-live="polite">{info}</div>

      <Board state={gs} pending={placement} selected={selected} phase={phase}
        humanPlayer={mode === 'pvp' ? gs.currentPlayer : humanPlayer}
        onStandClick={onStandClick} aiThinking={aiThinking} onlineMode={mode === 'online'}
        flip={userSettings.boardFlip} showChipCount={userSettings.showChipCount} showFillBar={userSettings.showFillBar}
        ghostTransfer={transfer ? { from: transfer[0], to: transfer[1], color: gs.topGroup(transfer[0])[0], count: gs.topGroup(transfer[0])[1] } : null} />

      {/* Таймер игроков */}
      {timerLimit > 0 && !gs.gameOver && (
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: isNative ? '2px 12px 4px' : '4px 16px 8px', fontSize: isNative ? 12 : 13, fontFamily: 'monospace' }}>
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
      {isNative ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 8px', padding: '0' }}>
          <div style={{ display: 'flex', gap: 1, flex: 1 }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const owner = gs.closed[i]
              return (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 1.5,
                  background: owner === 0 ? 'var(--p1)' : owner === 1 ? 'var(--p2)' : 'var(--surface2)',
                  opacity: owner !== undefined ? 0.9 : 0.3,
                }} />
              )
            })}
          </div>
          <span style={{ fontSize: 9, color: 'var(--ink3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {lang === 'en' ? 'Move' : 'Ход'} {gs.turn} · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}
          </span>
        </div>
      ) : (
        <>
        <div style={{ display: 'flex', gap: 2, margin: '8px 0', padding: '0 4px' }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const owner = gs.closed[i]
            return (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: owner === 0 ? 'var(--p1)' : owner === 1 ? 'var(--p2)' : 'var(--surface2)',
                opacity: owner !== undefined ? 0.9 : 0.3,
                transition: 'all 0.3s',
              }} />
            )
          })}
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink3)', marginBottom: 6 }}>
          {lang === 'en' ? 'Turn' : 'Ход'} {gs.turn} · {lang === 'en' ? 'Open' : 'Открыто'}: {gs.numOpen()} · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}
        </div>
        </>
      )}

      {/* Тренер — оценка позиции */}
      {trainerMode && posEval && mode === 'ai' && !gs.gameOver && (
        <div style={{ margin: isNative ? '0 4px 4px' : '0 4px 8px', padding: isNative ? '4px 8px' : '6px 10px', background: 'rgba(26,26,42,0.6)',
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
            {totalPlaced}/{maxTotal} {lang === 'en' ? 'blocks' : 'блоков'} · {Object.keys(placement).length}/{MAX_PLACE_STANDS} {lang === 'en' ? 'stands' : 'стоек'}
            {transfer && ` · ${lang === 'en' ? 'transfer' : 'перенос'} ✓`}
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
              if (mode === 'online') MP.sendMove(action, playerTime)
              recordMove(gs, action, gs.currentPlayer)
              moveHistoryRef.current.push({ action, player: gs.currentPlayer })
              addLog(lang === 'en' ? 'Swap — colors swapped!' : 'Swap — цвета поменялись!', gs.currentPlayer)
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
            }} style={{ borderColor: 'var(--purple)', color: 'var(--purple)', padding: '10px 20px' }}>
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
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            {t('game.drawOfferReceived')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => {
              MP.send({ type: 'drawResponse', accepted: true })
              setResult(-1); setPhase('done'); setLocked(false)
              setInfo(t('game.drawAgreed'))
              setDrawOffered(false)
            }} style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
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
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            {t('game.rematchOffer')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => {
              MP.sendRematchResponse(true)
              setRematchOffered(false)
            }} style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
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
          <button className="btn" onClick={cancelTransfer} title="Esc">{t('game.cancelTransfer')}</button>
        )}
        {isMyTurn && transfer && phase === 'place' && (
          <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            ✓ {SL(transfer[0])} → {SL(transfer[1])}
          </span>
        )}
        {isMyTurn && transfer && phase === 'place' && (
          <button className="btn" onClick={cancelTransfer} title="Esc">{t('game.cancelTransfer')}</button>
        )}
        {isMyTurn && phase === 'place' && totalPlaced > 0 && (
          <button className="btn" onClick={() => {
            // Убрать 1 блок с последней стойки
            const keys = Object.keys(placement).map(Number)
            if (keys.length === 0) return
            const last = keys[keys.length - 1]
            const newP = { ...placement }
            if (newP[last] <= 1) delete newP[last]
            else newP[last]--
            setPlacement(newP)
          }} aria-label="Undo last block">↩</button>
        )}
        {isMyTurn && phase === 'place' && totalPlaced > 0 && (
          <button className="btn" onClick={() => setPlacement({})}>{t('game.reset')}</button>
        )}
        {isMyTurn && phase === 'place' && (
          <button className="btn primary" disabled={!canConfirm} onClick={confirmTurn} title="Enter">{ t('game.confirm') } ⏎</button>
        )}
        {hintMode && isMyTurn && (
          <button className="btn" onClick={requestHint} disabled={hintLoading} style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }} title="H">
            {hintLoading ? '...' : (t('game.hint'))}
          </button>
        )}
        <button className="btn" onClick={() => newGame()} title="N">{t('game.newGame')}</button>
        {mode === 'pvp' && undoStack.length > 0 && !gs.gameOver && (
          <button className="btn" onClick={undoMove} style={{ fontSize: 11, color: 'var(--gold)', borderColor: '#ffc14540' }} aria-label="Undo move">
            ↩ Undo
          </button>
        )}
        {!gs.gameOver && mode !== 'pvp' && mode !== 'spectate-online' && (
          <button className="btn" onClick={resign} style={{ fontSize: 11, color: 'var(--p2)', borderColor: '#ff606640' }}>
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
      </div>

      {isMyTurn && !gs.gameOver && !isNative && (
        <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--ink3)', marginTop: 4 }}>
          {lang === 'en' ? 'Enter — confirm · Esc — cancel transfer · N — new game' : 'Enter — подтвердить · Esc — отмена переноса · N — новая игра'}
        </div>
      )}

      {hint && hintMode && (
        <div className="hint-panel">
          <div className="hint-title">{lang === 'en' ? 'Hint' : 'Подсказка'}</div>
          {hint.explanation.map((l, i) => <p key={i} className="hint-line">{l}</p>)}
        </div>
      )}

      <GameResultPanel
        result={result} mode={mode} humanPlayer={humanPlayer} gs={gs}
        elapsed={elapsed} ratingDelta={ratingDelta} sessionStats={sessionStats}
        tournament={tournament} isNative={isNative} lang={lang} t={t} difficulty={difficulty}
        newGame={newGame} tournamentNextGame={tournamentNextGame} gameCtx={gameCtx}
        moveHistoryRef={moveHistoryRef} rematchPending={rematchPending}
        setRematchPending={setRematchPending} setInfo={setInfo}
        setShowReplay={setShowReplay} setShowReview={setShowReview}
      />

      <div className="game-log" ref={logRef}>
        {log.map((e, i) => (
          <div key={i}>
            <span style={{ color: 'var(--ink3)', fontSize: 10, marginRight: 6 }}>{e.time}</span>
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
              background: ['var(--gold)', 'var(--p1-light)', 'var(--p2)', 'var(--green)', 'var(--purple)', 'var(--coral)'][i % 6],
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
          <Mascot pose="celebrate" size={40} animate={false} />
          <div>
            <div className="ach-label">{lang === 'en' ? 'Achievement unlocked!' : 'Ачивка разблокирована!'}</div>
            <div className="ach-name">{lang === 'en' && newAch.nameEn ? newAch.nameEn : newAch.name}</div>
          </div>
        </div>
      )}

      {/* First win celebration — один раз */}
      {firstWinCelebration && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.5s ease',
        }} onClick={() => setFirstWinCelebration(false)}>
          <div style={{ textAlign: 'center', padding: 32, maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              <Mascot pose="celebrate" size={120} large className="mascot-enter" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
              {lang === 'en' ? 'First Victory!' : 'Первая победа!'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 20 }}>
              {lang === 'en' ? 'You beat the AI! Keep playing to unlock achievements and climb the leaderboard.' : 'Вы победили AI! Продолжайте играть чтобы открыть ачивки и подняться в рейтинге.'}
            </div>
            <button className="btn primary" onClick={() => setFirstWinCelebration(false)} style={{ width: '100%', padding: '14px 0', fontSize: 16, justifyContent: 'center' }}>
              {lang === 'en' ? 'Awesome!' : 'Отлично!'}
            </button>
          </div>
        </div>
      )}

      {/* Анимированный повтор */}
      {showReplay && moveHistoryRef.current.length > 0 && (
        <ReplayViewer moves={moveHistoryRef.current} onClose={() => setShowReplay(false)} />
      )}
      {showReview && moveHistoryRef.current.length > 0 && (
        <Suspense fallback={null}>
          <GameReview moveHistory={moveHistoryRef.current} humanPlayer={humanPlayer} onClose={() => setShowReview(false)} />
        </Suspense>
      )}
    </div>
  )
}
