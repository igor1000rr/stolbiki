import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import '../css/game.css'
import '../css/game-layout.css'
import MascotRunner from './MascotRunner'
import {
  GameState, getValidTransfers, applyAction,
  MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND
} from '../engine/game'
import { preloadGpuNet } from '../engine/ai'
import { getHint } from '../engine/hints'
import { startRecording, setGameMeta, recordMove, finishRecording, cancelRecording } from '../engine/collector'
import * as MP from '../engine/multiplayer'
import * as API from '../engine/api'
import { getSettings } from '../engine/settings'
import { useI18n } from '../engine/i18n'
import { useGameContext } from '../engine/GameContext'
import { useAuth } from '../engine/AuthContext'
import { useGameTimer } from '../engine/useGameTimer'
import { useAiRunner } from '../engine/useAiRunner'
import { soundPlace, soundTransfer, soundClose, soundWin, soundLose, soundSwap, soundClick, setMuted } from '../engine/sounds'
import Board from './Board'
import GameResultPanel from './GameResultPanel'
import ReplayViewer, { describeAction } from './ReplayViewer'
import { useGameLog } from '../engine/useGameLog'
import { useSessionStats } from '../engine/useSessionStats'
import { useOnlineGameHandlers } from '../engine/useOnlineGameHandlers'
import { startTitleBlink, sp, st, sc, setSoundOn, showNotification, requestNotificationPermission } from './gameUtils'
import { maybeShowInterstitial } from '../engine/admob'
import GameTutorialModal from './GameTutorialModal'
import GameShortcutsModal from './GameShortcutsModal'
import HintPanel from './HintPanel'
import GameLog from './GameLog'
import ConfettiOverlay from './ConfettiOverlay'
import TournamentBanner from './TournamentBanner'
// MobileGameBar заменён на GameModeBar (апр 2026 ревизия Александра):
// текстовая строка "Player vs AI • Medium" + модификаторы по центру, без
// кнопки шестерни (она переехала в GameActionsTop как Settings/City Style).
import GameModeBar from './GameModeBar'
import MobileSettingsSheet from './MobileSettingsSheet'
import GameScoreboard from './GameScoreboard'
import GameOnlineBanners from './GameOnlineBanners'
import GameActionsTop from './GameActionsTop'
import GameActionsBottom from './GameActionsBottom'
import GameOverlays from './GameOverlays'
import GameDesktopControls from './GameDesktopControls'
import GameStatusBar from './GameStatusBar'
import GameOffers from './GameOffers'
import GameReactions from './GameReactions'
import { triggerSnappy } from './Snappy'
const GameReview = lazy(() => import('./GameReview'))

const isNative = !!window.Capacitor?.isNativePlatform?.()

const SL = i => i === GOLDEN_STAND ? '★' : 'ABCDEFGHI'[i - 1] || String(i)

const DEFAULT_MODIFIERS = { fog: false, doubleTransfer: false, blitz: false }

const CHIP_STYLE_TO_SKIN_ID = {
  classic: 'blocks_classic', flat: 'blocks_flat', rounded: 'blocks_round',
  glass: 'blocks_glass', metal: 'blocks_metal', candy: 'blocks_candy',
  pixel: 'blocks_pixel', neon: 'blocks_neon', glow: 'blocks_glow',
}

function getActiveSkinId() {
  try {
    const s = JSON.parse(localStorage.getItem('stolbiki_settings') || '{}')
    const cs = s.chipStyle || 'classic'
    return cs.startsWith('blocks_') ? cs : (CHIP_STYLE_TO_SKIN_ID[cs] || 'blocks_classic')
  } catch { return 'blocks_classic' }
}

export default function Game() {
  const { t, lang } = useI18n()
  const en = lang === 'en'
  const gameCtx = useGameContext()
  const { authUser } = useAuth()
  const sw = soundWin, sl = soundLose, ss = soundSwap
  const [gs, setGs] = useState(() => new GameState())
  const [phase, setPhase] = useState('place')
  const [selected, setSelected] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [humanPlayer, setHumanPlayer] = useState(0)
  const [difficulty, setDifficulty] = useState(400)
  const difficultyRef = useRef(400)
  const [mode, setMode] = useState('ai')
  const [soundOn, setSoundOnState] = useState(true)
  useEffect(() => { setSoundOn(soundOn); setMuted(!soundOn) }, [soundOn])
  const [userSettings, setUserSettings] = useState(() => getSettings())
  useEffect(() => {
    setSoundOn(soundOn && userSettings.soundPack !== 'off')
    setMuted(!soundOn || userSettings.soundPack === 'off')
  }, [userSettings, soundOn])
  useEffect(() => {
    const refresh = () => setUserSettings(getSettings())
    window.addEventListener('focus', refresh)
    const unsub = gameCtx?.on('settingsChanged', refresh)
    return () => { window.removeEventListener('focus', refresh); unsub?.() }
  }, [gameCtx])

  const [modifiers, setModifiers] = useState({ ...DEFAULT_MODIFIERS })
  const [transfersLeft, setTransfersLeft] = useState(1)

  const { log, setLog, addLog, logRef } = useGameLog(lang)
  const [info, setInfo] = useState('')
  const [result, setResult] = useState(null)
  const [hint, setHint] = useState(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [scoreBump, setScoreBump] = useState(null)
  const [locked, setLocked] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [ratingDelta, setRatingDelta] = useState(null)
  const [newAch, setNewAch] = useState(null)
  const { sessionStats, firstWinCelebration, setFirstWinCelebration } = useSessionStats({ result, mode, humanPlayer, difficultyRef, gs })
  const [undoStack, setUndoStack] = useState([])
  const [mascotRun, setMascotRun] = useState(null)
  const [tournament, setTournament] = useState(null)
  const [dailyMode, setDailyMode] = useState(false)
  const [, setDailySeed] = useState(null)
  const moveHistoryRef = useRef([])
  const [showReplay, setShowReplay] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showMobileSettings, setShowMobileSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [, setOnlineRoom] = useState(null)
  const [, setOnlinePlayerIdx] = useState(-1)
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [drawOffered, setDrawOffered] = useState(false)
  const [rematchOffered, setRematchOffered] = useState(false)
  const [rematchPending, setRematchPending] = useState(false)
  const [floatingEmoji, setFloatingEmoji] = useState(null)
  const [spectatorCount, setSpectatorCount] = useState(0)
  const onlineRef = useRef(null)
  const gsRef = useRef(gs)
  const aiRunningRef = useRef(false)
  const modeRef = useRef('ai')
  const prevScore = useRef([0, 0])
  const modifiersRef = useRef(modifiers)
  useEffect(() => { modifiersRef.current = modifiers }, [modifiers])

  // saveBuildingOnWin определена перед useAiRunner, т.к. передаётся как зависимость
  async function saveBuildingOnWin(ns) {
    if (mode === 'pvp' || mode === 'spectate' || mode === 'spectate-online') return
    if (!API.isLoggedIn()) return
    const myColor = mode === 'online' ? (onlineRef.current?.myColor ?? humanPlayer) : humanPlayer
    if (ns.winner !== myColor) return
    const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
    const result = (s0 === s1) ? 'draw_won' : 'win'
    const opponentName = mode === 'ai' ? 'Snappy' : (onlinePlayers?.[1 - myColor] || null)
    try {
      await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({
          stands_snapshot: ns.stands.map((chips, idx) => ({ idx, chips, owner: ns.closed[idx] ?? null })),
          result, is_ai: mode === 'ai', ai_difficulty: mode === 'ai' ? difficultyRef.current : null,
          opponent_name: opponentName, player_skin_id: getActiveSkinId(), background_id: null,
        }),
      })
    } catch {}
  }

  // AI-ход — MCTS-поиск, применение, конец партии (хук из engine/useAiRunner)
  const runAi = useAiRunner({
    aiRunningRef, modeRef, difficultyRef, modifiersRef, moveHistoryRef,
    setGs, setPhase, setResult, setInfo, setLocked,
    setAiThinking, setTransfersLeft, setConfetti, setTournament,
    setTransfer, setPlacement,
    addLog,
    humanPlayer, difficulty,
    soundWin: sw, soundLose: sl,
    gameCtx, tournament, t,
    saveBuildingOnWin,
  })

  // БАГ-ФИКСx: убран onTick — soundClick не должен играть каждую секунду таймера
  const { timerLimit, playerTime, setPlayerTime, elapsed, startTime: timerStartTime, resetTimers } = useGameTimer({
    timerSetting: userSettings.timer,
    gameOver: gs.gameOver,
    currentPlayer: gs.currentPlayer,
    humanPlayer,
    locked,
    aiRunning: aiRunningRef?.current,
    onTimeUp: (cp) => {
      if (modifiersRef.current?.blitz && cp === humanPlayer) {
        setInfo(en ? "Time's up — auto-pass!" : 'Время вышло — авто-пас!')
        setTransfer(null); setPlacement({}); setSelected(null); setHint(null)
        const action = { transfer: null, placement: {} }
        recordMove(gsRef.current, action, gsRef.current.currentPlayer)
        moveHistoryRef.current.push({ action: { ...action }, player: gsRef.current.currentPlayer })
        addLog(en ? 'Auto-pass (time up)' : 'Авто-пас (время истекло)', humanPlayer)
        const ns = applyAction(gsRef.current, action)
        setGs(ns)
        if (ns.gameOver) {
          setResult(ns.winner); setPhase('done'); setLocked(false)
        } else {
          setLocked(true); setPhase('ai')
          setTimeout(() => runAi(ns), 500)
        }
        return
      }
      setResult(1 - cp); setPhase('done'); setInfo(cp === humanPlayer ? t('game.timeUp') : t('game.oppTimeUp'))
      setLocked(false)
    },
  })

  useEffect(() => { gsRef.current = gs }, [gs])

  useOnlineGameHandlers({
    gameCtx, gsRef, onlineRef, aiRunningRef, modeRef, prevScore, moveHistoryRef,
    setGs, setPhase, setSelected, setTransfer, setPlacement, setResult, setHint,
    setAiThinking, setScoreBump, setHumanPlayer, setMode, setLocked, setInfo,
    setLog, addLog, setUndoStack, setShowReplay,
    setOnlineRoom, setOnlinePlayerIdx, setOnlinePlayers,
    setDrawOffered, setRematchOffered, setRematchPending,
    setFloatingEmoji, setSpectatorCount, setPlayerTime, setConfetti,
    resetTimers, requestNotificationPermission, showNotification, startTitleBlink,
    describeAction, t, lang,
    sounds: { sw, sl, ss, sp, st },
  })

  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('onDailyStart', (daily) => {
      if (!daily) return
      setDailyMode(true)
      setDailySeed(daily.seed || daily.date)
      cancelRecording()
      let state = new GameState()
      if (daily.firstMove) state = applyAction(state, { placement: { [daily.firstMove.stand]: 1 } })
      if (daily.swapped) {
        state = applyAction(state, { swap: true })
      } else if (daily.secondMove?.stands?.length) {
        const pl = {}
        for (const s of daily.secondMove.stands) pl[s] = (pl[s] || 0) + 1
        state = applyAction(state, { placement: pl })
      }
      const hp = state.currentPlayer
      gsRef.current = state
      setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setHint(null); setAiThinking(false)
      setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(400); difficultyRef.current = 400; setMode('ai')
      aiRunningRef.current = false; prevScore.current = [0, 0]; modeRef.current = 'ai'
      startRecording(); setGameMeta('daily', 100); resetTimers(); setUndoStack([])
      moveHistoryRef.current = []; setShowReplay(false)
      setTransfersLeft(modifiersRef.current?.doubleTransfer ? 2 : 1)
      const seedLabel = (daily.seed || daily.date || '').toString().slice(-4)
      setLog([{ text: `Ежедневный челлендж #${seedLabel}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo(lang === 'en' ? `Challenge #${seedLabel} — beat AI in minimum moves!` : `Челлендж #${seedLabel} — победите AI за минимум ходов!`)
    })
  }, [gameCtx]) // eslint-disable-line

  function getDailySeed() {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  }
  function _startDaily() { setDailySeed(getDailySeed()); setDailyMode(true); newGame(0, 100, 'ai'); setInfo(lang === 'en' ? `Daily challenge — beat AI!` : `Ежедневный челлендж — победите AI!`) }

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

  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('onAchievement', (ach) => { setNewAch(ach); setTimeout(() => setNewAch(null), 4000) })
  }, [gameCtx])

  useEffect(() => {
    const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
    if (s0 > prevScore.current[0]) { setScoreBump(0); setTimeout(() => setScoreBump(null), 700); sc() }
    if (s1 > prevScore.current[1]) { setScoreBump(1); setTimeout(() => setScoreBump(null), 700); sc() }
    prevScore.current = [s0, s1]
  }, [gs])

  function newGame(side, diff, gameMode) {
    cancelRecording()
    const hp = side ?? humanPlayer
    const d = diff ?? difficulty
    let m = gameMode ?? mode
    if ((m === 'online' || m === 'spectate-online') && !gameMode) m = 'ai'
    if (m === 'online' || m === 'spectate-online') return
    setOnlineRoom(null); setOnlinePlayerIdx(-1); setOnlinePlayers([])
    onlineRef.current = null
    moveHistoryRef.current = []
    setShowReplay(false)
    const state = new GameState()
    gsRef.current = state
    setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setRatingDelta(null); setHint(null); setAiThinking(false)
    setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(d); difficultyRef.current = d; setMode(m)
    if (d >= 200) preloadGpuNet()
    aiRunningRef.current = false; prevScore.current = [0, 0]; modeRef.current = m
    startRecording(); setGameMeta(m, d); resetTimers(); setUndoStack([])
    setTransfersLeft(modifiersRef.current?.doubleTransfer ? 2 : 1)
    if (m === 'pvp') {
      setLog([{ text: lang === 'en' ? 'New game: player vs player' : 'Новая партия: игрок против игрока', player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo(t('game.place1'))
    } else if (m === 'spectate') {
      setLog([{ text: 'AI vs AI — наблюдение', player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo('AI vs AI'); setLocked(true)
      setTimeout(() => runAi(state), 800)
    } else {
      const c = hp === 0 ? t('game.blue').toLowerCase() : t('game.red').toLowerCase()
      const startMsg = lang === 'en' ? `New game. You are ${c}` : `Новая партия. Вы — ${c}`
      setLog([{ text: startMsg, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      if (state.currentPlayer !== hp) { setInfo(t('game.aiFirst')); setLocked(true); setTimeout(() => runAi(state), 500) }
      else setInfo(t('game.place1first'))
    }
  }

  useEffect(() => { newGame(0, 50) }, []) // eslint-disable-line

  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('onRatingDelta', (d) => setRatingDelta(d))
  }, [gameCtx])

  useEffect(() => {
    if (!userSettings.autoConfirm || phase !== 'place' || gs.gameOver || locked) return
    const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
    const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
    if (totalPlaced >= maxTotal) {
      const t = setTimeout(() => confirmTurn(), 200)
      return () => clearTimeout(t)
    }
  }, [placement, userSettings.autoConfirm]) // eslint-disable-line

  function onStandClick(i) {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (gs.gameOver || !currentIsHuman || aiRunningRef.current || locked) return
    if (i in gs.closed) return
    soundClick()

    if (phase === 'transfer-select') {
      const [, ts] = gs.topGroup(i)
      if (ts > 0) { setSelected(i); setPhase('transfer-dst'); setInfo(lang === 'en' ? `Where to transfer blocks from stand ${SL(i)}?` : `Куда перенести блоки со стойки ${SL(i)}?`) }
      return
    }

    if (phase === 'transfer-dst') {
      if (i === selected) { setSelected(null); setPhase('transfer-select'); setInfo(t('game.selectTransferFrom')); return }
      if (getValidTransfers(gs).some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i]); setSelected(null); setPhase('place'); st()
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
      if (transfer) {
        const [src, dst] = transfer
        const [, grpSize] = gs.topGroup(src)
        if (i === src) space += grpSize
        if (i === dst) space -= grpSize
      }
      if (!canClose) space = Math.max(0, space - 1)
      if (space <= 0) { setInfo(lang === 'en' ? `Stand ${SL(i)} is full` : `Стойка ${SL(i)} заполнена`); return }
      if (i in placement) {
        const current = placement[i]
        const remaining = maxTotal - currentTotal
        const spaceLeft = space - current
        if (remaining > 0 && spaceLeft > 0) {
          const newPlacement = { ...placement, [i]: current + 1 }
          setPlacement(newPlacement); sp()
          const newTotal = currentTotal + 1
          setInfo(`${newTotal}/${maxTotal} ${lang === 'en' ? 'blocks' : 'блоков'}${newTotal >= maxTotal ? (lang === 'en' ? ' — confirm' : ' — подтвердите') : ''}`)
        } else {
          const newPlacement = { ...placement }; delete newPlacement[i]; setPlacement(newPlacement)
          const newTotal = currentTotal - current
          setInfo(`${lang === 'en' ? 'Removed' : 'Убрано'}. ${newTotal}/${maxTotal}`)
        }
        return
      }
      if (numStands >= MAX_PLACE_STANDS) { setInfo(t('game.max2stands')); return }
      if (currentTotal >= maxTotal) { setInfo(t('game.allPlaced')); return }
      const newPlacement = { ...placement, [i]: 1 }
      setPlacement(newPlacement); sp()
      const newTotal = currentTotal + 1
      setInfo(`${newTotal}/${maxTotal} ${lang === 'en' ? 'blocks' : 'блоков'}${newTotal >= maxTotal ? (lang === 'en' ? ' — confirm' : ' — подтвердите') : ''}`)
    }
  }

  function onStandLongPress(i) {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (gs.gameOver || !currentIsHuman || aiRunningRef.current || locked) return
    if (i in gs.closed) return
    if (phase !== 'place') return
    if (gs.isFirstTurn()) return
    if (!getValidTransfers(gs).some(([s]) => s === i)) return
    try { window.Capacitor?.Plugins?.Haptics?.impact?.({ style: 'MEDIUM' }) } catch {}
    soundClick()
    setSelected(i)
    setPhase('transfer-dst')
    setInfo(lang === 'en' ? `Where to transfer from stand ${SL(i)}?` : `Куда перенести со стойки ${SL(i)}?`)
  }

  function confirmTurn() {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (!currentIsHuman || gs.gameOver || locked) return
    if (mode === 'pvp') setUndoStack(prev => [...prev, gs].slice(-10))
    const action = { transfer, placement }
    recordMove(gs, action, gs.currentPlayer)
    moveHistoryRef.current.push({ action: { ...action }, player: gs.currentPlayer })
    addLog(describeAction(action, gs.currentPlayer, t), gs.currentPlayer)
    if (mode === 'online') MP.sendMove(action, playerTime)

    if (action.transfer) {
      const [src, dst] = action.transfer
      const [topColor, topCount] = gs.topGroup(src) || [0, 0]
      if (topCount > 0) {
        setMascotRun({ from: src, to: dst, color: topColor, count: topCount, key: Date.now().toString() })
      }
    }

    const ns = applyAction(gs, action)
    if (action.transfer) soundTransfer()
    else if (Object.keys(action.placement || {}).length) soundPlace()
    const newClosed = Object.keys(ns.closed).length
    const oldClosed = Object.keys(gs.closed).length
    if (newClosed > oldClosed) soundClose()

    // Snappy: реакция на закрытие башни. Триггерим только в AI/online режимах
    // (в pvp на одном устройстве комментарий маскота сбивает второго игрока).
    // tower_takeover — игрок только что закрыл свою башню.
    // enemy_takeover — соперник закрыл башню (по ТЗ Александра 28.04.2026).
    // near_loss — у соперника стало 5 закрытых, ещё одна — победа игрока.
    if (newClosed > oldClosed && mode !== 'pvp' && mode !== 'spectate' && mode !== 'spectate-online') {
      const opponent = humanPlayer === 0 ? 1 : 0
      const opponentClosed = ns.countClosed(opponent)
      if (gs.currentPlayer === humanPlayer) {
        // Игрок закрыл башню. Если у соперника уже 5 — приоритет near_loss
        // (это сильнее по эмоции), иначе обычный takeover.
        if (opponentClosed === 5) triggerSnappy('near_loss')
        else triggerSnappy('tower_takeover')
      } else {
        // Соперник (AI / online-противник) закрыл башню.
        // Snappy подкалывает игрока — «у тебя забрали».
        triggerSnappy('enemy_takeover')
      }
    }

    setHint(null)

    if (modifiers.doubleTransfer && action.transfer && Object.keys(action.placement || {}).length === 0 && transfersLeft > 1) {
      setTransfersLeft(t => t - 1)
      setTransfer(null); setPlacement({}); setSelected(null)
      setGs(ns)
      setInfo(lang === 'en' ? `Transfer 1 done — transfer again or place blocks` : `Перенос 1/2 — перенесите ещё раз или раставьте блоки`)
      return
    }

    setTransfer(null); setPlacement({}); setSelected(null)
    setTransfersLeft(modifiers.doubleTransfer ? 2 : 1)
    setGs(ns)

    if (ns.gameOver) {
      if (mode === 'online') MP.sendGameOver(ns.winner)
      setTimeout(() => {
        setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
        finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
        saveBuildingOnWin(ns)
        const won = (mode === 'pvp') ? true : ns.winner === humanPlayer
        setTimeout(() => { won ? sw() : sl(); if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) } }, 300)
        if (gameCtx) {
          const w = ns.winner === humanPlayer
          const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
          const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
          const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
          gameCtx.emit('recordGame', w, score, difficulty >= 400, closedGolden, false, mode === 'online', moveHistoryRef.current)
        }
        if (tournament) {
          const w = ns.winner === humanPlayer
          const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
          setTournament(prev => ({ ...prev, games: [...prev.games, { won: w, score: `${s0}:${s1}`, side: humanPlayer }] }))
        }
        if (dailyMode && API.isLoggedIn()) {
          const w = ns.winner === humanPlayer ? 1 : 0
          fetch('/api/daily/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` }, body: JSON.stringify({ turns: ns.turn, duration: Math.floor((Date.now() - timerStartTime) / 1000), won: w }) }).catch(() => {})
          setDailyMode(false)
        }
        maybeShowInterstitial(3)
      }, 800)
      return
    }
    if (mode === 'online') { setLocked(true); setPhase('place'); setInfo(t('game.opponentTurn')) }
    else if (mode === 'pvp') {
      setPhase('place')
      const name = ns.currentPlayer === 0 ? t('game.blue') : t('game.red')
      setInfo(ns.isFirstTurn() ? `${name}: ${lang === 'en' ? 'place 1 block' : 'поставьте 1 блок'}` : `${name}: ${lang === 'en' ? 'place blocks' : 'расставьте блоки'}`)
    } else { setLocked(true); setPhase('ai'); setTimeout(() => runAi(ns), 500) }
  }

  function startTransfer() { setPhase('transfer-select'); setInfo(t('game.selectTransferFrom')) }
  function cancelTransfer() { setSelected(null); setTransfer(null); setPhase('place'); setInfo(t('game.transferCancelled')) }

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
    if (mode === 'online') MP.send({ type: 'resign' })
    sl()
  }

  function requestHint() {
    const currentIsHuman = mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer
    if (!currentIsHuman || gs.gameOver || locked) return
    setHintLoading(true)
    setTimeout(() => { setHint(getHint(gs, 60, lang)); setHintLoading(false) }, 100)
  }

  function handleSwapAccept() {
    const action = { swap: true }
    if (mode === 'online') MP.sendMove(action, playerTime)
    recordMove(gs, action, gs.currentPlayer)
    moveHistoryRef.current.push({ action, player: gs.currentPlayer })
    addLog(lang === 'en' ? 'Swap — colors swapped!' : 'Swap — цвета поменялись!', gs.currentPlayer)
    ss()
    const ns = applyAction(gs, action)
    setGs(ns); setPhase('place')
    if (mode === 'online') {
      setHumanPlayer(0)
      if (onlineRef.current) onlineRef.current.myColor = 0
      setLocked(false)
      setInfo(t('game.swapOnlineDone'))
    } else {
      setInfo(t('game.swapDone'))
    }
  }
  function handleDrawAccept() {
    MP.send({ type: 'drawResponse', accepted: true })
    setResult(-1); setPhase('done'); setLocked(false)
    setInfo(t('game.drawAgreed'))
    setDrawOffered(false)
  }

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canConfirm = gs.isFirstTurn() ? totalPlaced === 1 : (totalPlaced > 0 || transfer)
  const isMyTurn = (mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer) && !gs.gameOver && !aiRunningRef.current && !locked
  const hasTransfers = !gs.isFirstTurn() && getValidTransfers(gs).length > 0
  const inTransferMode = phase === 'transfer-select' || phase === 'transfer-dst'

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Enter' && canConfirm && isMyTurn && phase === 'place') { e.preventDefault(); confirmTurn() }
      if (e.key === 'Escape' && inTransferMode) cancelTransfer()
      if (e.key === 'n' && (gs.gameOver || result !== null)) newGame()
      if (e.key === 'z' && mode === 'pvp' && undoStack.length > 0) undoMove()
      if (!locked && !gs.gameOver && /^[0-9]$/.test(e.key)) {
        const standIdx = e.key === '0' ? 0 : parseInt(e.key)
        if (standIdx >= 0 && standIdx < gs.numStands) onStandClick(standIdx)
      }
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !locked && !gs.gameOver) requestHint?.()
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) setShowShortcuts(p => !p)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('stolbiki_tutorial_seen'))
  function dismissTutorial() { setShowTutorial(false); localStorage.setItem('stolbiki_tutorial_seen', '1') }

  const fogTogglePendingRef = useRef(false)
  useEffect(() => {
    if (!fogTogglePendingRef.current) return
    fogTogglePendingRef.current = false
    newGame()
  }, [modifiers.fog]) // eslint-disable-line

  function toggleFog() {
    setModifiers(m => { const nm = { ...m, fog: !m.fog }; modifiersRef.current = nm; return nm })
    fogTogglePendingRef.current = true
  }

  return (
    <div className={isNative ? 'native-game-wrapper' : ''}>
      <MascotRunner run={mascotRun} onDone={() => setMascotRun(null)} />

      {showTutorial && <GameTutorialModal lang={lang} onDismiss={dismissTutorial} />}

      <GameOnlineBanners
        mode={mode} lang={lang} isNative={isNative}
        onlinePlayers={onlinePlayers} spectatorCount={spectatorCount}
      />

      {mode !== 'online' && mode !== 'spectate-online' && !isNative && (
        <GameDesktopControls
          mode={mode} difficulty={difficulty} modifiers={modifiers}
          tournament={tournament} humanPlayer={humanPlayer} en={en} t={t}
          setTransfersLeft={setTransfersLeft}
          onModeChange={(m) => newGame(humanPlayer, difficulty, m)}
          onDifficultyChange={(d) => newGame(humanPlayer, d, mode)}
          onStartTournament={startTournament}
          toggleFog={toggleFog}
          setModifiers={setModifiers}
          modifiersRef={modifiersRef}
        />
      )}

      {/* Мелкие кнопки состояния (New/Undo/Resign/Offer Draw) + Settings + City Style.
          По ТЗ Александра (апр 2026): Settings и City Style — справа от New Game/Resign,
          City Style — золотая (акцент в сторону монетизации). Settings показывается
          только на native (на desktop селекты mode/diff в GameDesktopControls). */}
      <GameActionsTop
        mode={mode} undoStack={undoStack} gameOver={gs.gameOver} t={t} en={en}
        isNative={isNative}
        onNewGame={() => newGame()}
        onUndo={undoMove}
        onResign={resign}
        onOfferDraw={() => { MP.send({ type: 'drawOffer' }); setInfo(t('game.drawOffered')) }}
        onOpenSettings={() => setShowMobileSettings(true)}
        onOpenCityStyle={() => gameCtx?.emit('openSkinShop')}
      />

      {/* Текстовая строка "Player vs AI • Medium" + модификаторы — под кнопками.
          Заменила старый MobileGameBar (бейдж сложности слева + шестерня).
          Шестерня переехала в GameActionsTop как Settings. */}
      <GameModeBar
        mode={mode} difficulty={difficulty} modifiers={modifiers}
        lang={lang} t={t} en={en}
        onSettingsOpen={isNative ? () => setShowMobileSettings(true) : undefined}
      />

      <MobileSettingsSheet
        show={showMobileSettings} isNative={isNative}
        mode={mode} difficulty={difficulty} modifiers={modifiers}
        tournament={tournament} lang={lang} en={en} humanPlayer={humanPlayer}
        onClose={() => setShowMobileSettings(false)}
        onModeChange={(m) => newGame(humanPlayer, difficulty, m)}
        onDifficultyChange={(d) => newGame(humanPlayer, d, mode)}
        toggleFog={toggleFog}
        setModifiers={setModifiers}
        modifiersRef={modifiersRef}
        onStartTournament={startTournament}
      />

      <TournamentBanner
        tournament={tournament} isNative={isNative} lang={lang} t={t}
        humanPlayer={humanPlayer} onCancel={() => setTournament(null)}
      />

      <GameStatusBar
        gs={gs} mode={mode} isNative={isNative} lang={lang} t={t} en={en}
        sessionStats={sessionStats}
        humanPlayer={humanPlayer}
        timerLimit={timerLimit} playerTime={playerTime}
        userSettings={userSettings} modifiers={modifiers}
        elapsed={elapsed} phase={phase} isMyTurn={isMyTurn}
        totalPlaced={totalPlaced} maxTotal={maxTotal}
        transfer={transfer} transfersLeft={transfersLeft}
      />

      <GameScoreboard
        gs={gs} mode={mode} humanPlayer={humanPlayer} scoreBump={scoreBump}
        en={en} t={t} gameCtx={gameCtx} authUser={authUser}
      />

      <div className={`game-info ${aiThinking ? 'thinking-dots' : ''}`} role="status" aria-live="polite">{info}</div>

      <Board state={gs} pending={placement} selected={selected} phase={phase}
        humanPlayer={mode === 'pvp' ? gs.currentPlayer : humanPlayer}
        onStandClick={onStandClick} onStandLongPress={onStandLongPress}
        aiThinking={aiThinking} onlineMode={mode === 'online'}
        flip={userSettings.boardFlip} showChipCount={userSettings.showChipCount} showFillBar={userSettings.showFillBar}
        ghostTransfer={(() => {
          if (!transfer) return null
          const [topColor, topCount] = gs.topGroup(transfer[0]) || [0, 0]
          if (!topCount) return null
          return { from: transfer[0], to: transfer[1], color: topColor, count: topCount }
        })()}
        fogOfWar={modifiers.fog && mode !== 'spectate' && mode !== 'spectate-online'}
        fogPlayer={humanPlayer}
      />

      <GameOffers
        t={t}
        showSwap={isMyTurn && gs.turn === 1 && gs.swapAvailable && phase === 'place'}
        onSwapAccept={handleSwapAccept}
        onSwapDecline={() => setInfo(t('game.swapDeclined'))}
        drawOffered={drawOffered && !gs.gameOver && mode === 'online'}
        onDrawAccept={handleDrawAccept}
        onDrawDecline={() => { MP.send({ type: 'drawResponse', accepted: false }); setDrawOffered(false) }}
        rematchOffered={rematchOffered && gs.gameOver && mode === 'online'}
        onRematchAccept={() => { MP.sendRematchResponse(true); setRematchOffered(false) }}
        onRematchDecline={() => { MP.sendRematchResponse(false); setRematchOffered(false) }}
      />

      <GameActionsBottom
        isMyTurn={isMyTurn} phase={phase} inTransferMode={inTransferMode}
        transfer={transfer} totalPlaced={totalPlaced} canConfirm={canConfirm}
        modifiers={modifiers} transfersLeft={transfersLeft}
        hasTransfers={hasTransfers} mode={mode}
        gameOver={gs.gameOver}
        soundOn={soundOn} hintLoading={hintLoading}
        en={en} t={t}
        onCancelAction={(kind) => { if (kind === 'transfer') cancelTransfer(); if (kind === 'placement') setPlacement({}) }}
        onStartTransfer={startTransfer}
        onConfirm={confirmTurn}
        onToggleSound={() => setSoundOnState(p => !p)}
        onHint={requestHint}
      />

      {mode === 'online' && !gs.gameOver && (
        <GameReactions onSendReaction={(e) => MP.send({ type: 'reaction', emoji: e })} />
      )}

      <HintPanel hint={hint} lang={lang} />

      <GameResultPanel
        result={result} mode={mode} humanPlayer={humanPlayer} gs={gs}
        elapsed={elapsed} ratingDelta={ratingDelta} sessionStats={sessionStats}
        tournament={tournament} isNative={isNative} lang={lang} t={t} difficulty={difficulty}
        newGame={newGame} tournamentNextGame={tournamentNextGame} gameCtx={gameCtx}
        moveHistoryRef={moveHistoryRef} rematchPending={rematchPending}
        setRematchPending={setRematchPending} setInfo={setInfo}
        setShowReplay={setShowReplay} setShowReview={setShowReview}
      />

      <GameLog ref={logRef} log={log} />

      <ConfettiOverlay show={confetti} />

      <GameOverlays
        floatingEmoji={floatingEmoji}
        newAch={newAch} lang={lang}
        firstWinCelebration={firstWinCelebration}
        onFirstWinClose={() => setFirstWinCelebration(false)}
      />

      {showReplay && moveHistoryRef.current.length > 0 && (
        <ReplayViewer moves={moveHistoryRef.current} onClose={() => setShowReplay(false)} />
      )}
      {showReview && moveHistoryRef.current.length > 0 && (
        <Suspense fallback={null}>
          <GameReview moveHistory={moveHistoryRef.current} humanPlayer={humanPlayer} onClose={() => setShowReview(false)} />
        </Suspense>
      )}

      {showShortcuts && <GameShortcutsModal lang={lang} onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
