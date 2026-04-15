import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import '../css/game.css'
import Mascot from './Mascot'
import MascotRunner from './MascotRunner'
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
import { useAuth } from '../engine/AuthContext'
import { useGameTimer } from '../engine/useGameTimer'
import { soundPlace, soundTransfer, soundClose, soundWin, soundLose, soundSwap, soundClick, setMuted } from '../engine/sounds'
import Board from './Board'
import GameResultPanel from './GameResultPanel'
import ReplayViewer, { describeAction } from './ReplayViewer'
import { useGameLog } from '../engine/useGameLog'
import { useSessionStats } from '../engine/useSessionStats'
import { useOnlineGameHandlers } from '../engine/useOnlineGameHandlers'
import { startTitleBlink, sp, st, sc, setSoundOn, generateShareImage, showNotification, requestNotificationPermission } from './gameUtils'
import { maybeShowInterstitial } from '../engine/admob'
import GameTutorialModal from './GameTutorialModal'
import GameShortcutsModal from './GameShortcutsModal'
import HintPanel from './HintPanel'
import GameLog from './GameLog'
import ConfettiOverlay from './ConfettiOverlay'
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

function ModifierBadge({ label, active, onToggle, color = 'var(--accent)' }) {
  return (
    <button
      onClick={onToggle}
      style={{
        fontSize: 10, padding: '3px 8px', borderRadius: 6, border: `1px solid ${active ? color : 'var(--surface3)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--ink3)',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  )
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

  const { log, setLog, addLog, resetLog, logRef } = useGameLog(lang)
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
  const [dailySeed, setDailySeed] = useState(null)
  const moveHistoryRef = useRef([])
  const [showReplay, setShowReplay] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showMobileSettings, setShowMobileSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [onlineRoom, setOnlineRoom] = useState(null)
  const [onlinePlayerIdx, setOnlinePlayerIdx] = useState(-1)
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [drawOffered, setDrawOffered] = useState(false)
  const [rematchOffered, setRematchOffered] = useState(false)
  const [rematchPending, setRematchPending] = useState(false)
  const [floatingEmoji, setFloatingEmoji] = useState(null)
  const [spectatorCount, setSpectatorCount] = useState(0)
  const onlineRef = useRef(null)
  const gsRef = useRef(gs)
  const aiRunning = useRef(false)
  const modeRef = useRef('ai')
  const prevScore = useRef([0, 0])
  const modifiersRef = useRef(modifiers)
  useEffect(() => { modifiersRef.current = modifiers }, [modifiers])

  // БАГ-ФИКСx: убран onTick — soundClick не должен играть каждую секунду таймера
  const { timerLimit, playerTime, setPlayerTime, elapsed, startTime: timerStartTime, resetTimers, TIMER_LIMITS: _TL } = useGameTimer({
    timerSetting: userSettings.timer,
    gameOver: gs.gameOver,
    currentPlayer: gs.currentPlayer,
    humanPlayer,
    locked,
    aiRunning: aiRunning?.current,
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
    gameCtx, gsRef, onlineRef, aiRunning, modeRef, prevScore, moveHistoryRef,
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
      aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = 'ai'
      startRecording(); setGameMeta('daily', 100); resetTimers(); setUndoStack([])
      moveHistoryRef.current = []; setShowReplay(false)
      setTransfersLeft(modifiersRef.current?.doubleTransfer ? 2 : 1)
      const seedLabel = (daily.seed || daily.date || '').toString().slice(-4)
      setLog([{ text: `Ежедневный челлендж #${seedLabel}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo(lang === 'en' ? `Challenge #${seedLabel} — beat AI in minimum moves!` : `Челлендж #${seedLabel} — победите AI за минимум ходов!`)
    })
  }, [gameCtx]) // eslint-disable-line

  // getDailySeed: ISO формат совпадает с сервером (server/helpers.js)
  function getDailySeed() {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  }
  function startDaily() { setDailySeed(getDailySeed()); setDailyMode(true); newGame(0, 100, 'ai'); setInfo(lang === 'en' ? `Daily challenge — beat AI!` : `Ежедневный челлендж — победите AI!`) }

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

  const runAi = useCallback((state) => {
    if (aiRunning.current || state.gameOver) return
    if (modeRef.current === 'online') return
    aiRunning.current = true; setAiThinking(true); setLocked(true); setInfo(t('game.aiThinking'))
    const startTime = Date.now()
    setTimeout(() => {
      const gpu = isGpuReady()
      const diff = difficultyRef.current
      const action = mctsSearch(state, ...(
        diff >= 1500 ? (gpu ? [5000, 0] : [3000, 15]) :
        diff >= 800 ? (gpu ? [1500, 0] : [1200, 10]) :
        diff >= 400 ? (gpu ? [600, 0] : [800, 8]) :
        diff >= 150 ? (gpu ? [200, 1] : [500, 3]) :
                       (gpu ? [80, 1]  : [200, 1])
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
          setTransfersLeft(modifiersRef.current?.doubleTransfer ? 2 : 1)
          if (ns.gameOver) {
            setTimeout(() => {
              setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
              finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
              saveBuildingOnWin(ns)
              // БАГ-ФИКС: spectate — confetti не показываем, won только для реального игрока
              const isSpectate = modeRef.current === 'spectate'
              const won = isSpectate ? false : ns.winner === humanPlayer
              setTimeout(() => {
                if (!isSpectate) { won ? sw() : sl() }
                if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) }
              }, 300)
              if (gameCtx && !isSpectate) {
                const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
                const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
                const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
                gameCtx.emit('recordGame', won, score, difficultyRef.current >= 400, closedGolden, false, false, moveHistoryRef.current)
                API.track('game_end', 'game', { won, score, difficulty: difficultyRef.current, mode: 'ai' })
              }
              if (tournament) {
                const w = ns.winner === humanPlayer
                const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
                setTournament(prev => ({ ...prev, games: [...prev.games, { won: w, score: `${s0}:${s1}`, side: humanPlayer }] }))
              }
              // AdMob interstitial каждые 3 партии (только в AI режиме, не spectate)
              if (!isSpectate) maybeShowInterstitial(3)
            }, 800)
            return
          }
          if (ns.currentPlayer !== humanPlayer || modeRef.current === 'spectate') {
            setTimeout(() => runAi(ns), modeRef.current === 'spectate' ? 1200 : 600)
            return
          }
          setTimeout(() => {
            setLocked(false); setPhase('place'); setTransfer(null); setPlacement({})
            setInfo(ns.isFirstTurn() ? t('game.place1') : t('game.clickStands'))
          }, 500)
        }, 300)
      }, remaining)
    }, 50)
  }, [difficulty, humanPlayer])

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
    aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = m
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
      setLog([{ text: `Новая партия. Вы — ${c}`, player: -1, time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
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
    if (gs.gameOver || !currentIsHuman || aiRunning.current || locked) return
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
    if (gs.gameOver || !currentIsHuman || aiRunning.current || locked) return
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
      // БАГ-ФИКС: guard от null если topGroup вернул пустой результат
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
        // AdMob interstitial каждые 3 партии (pvp/ai/online, кроме spectate)
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
    setTimeout(() => { setHint(getHint(gs, 60)); setHintLoading(false) }, 100)
  }

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? FIRST_TURN_MAX : MAX_PLACE
  const canConfirm = gs.isFirstTurn() ? totalPlaced === 1 : (totalPlaced > 0 || transfer)
  const isMyTurn = (mode === 'pvp' || mode === 'online' || gs.currentPlayer === humanPlayer) && !gs.gameOver && !aiRunning.current && !locked
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

  // БАГ-ФИКС: fog toggle — используем useEffect чтобы newGame запустился ПОСЛЕ применения нового modifiers
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

      {mode === 'online' && (
        <div style={{ textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 12,
          background: 'rgba(61,214,140,0.08)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(61,214,140,0.15)' }}>
          <span style={{ fontSize: isNative ? 11 : 12, color: 'var(--green)', fontWeight: 600 }}>{lang === 'en' ? 'Online' : 'Онлайн'} — {onlinePlayers.join(' vs ')}</span>
          {spectatorCount > 0 && <span style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 8 }}>👁 {spectatorCount}</span>}
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
          <label>{t('game.diffLabel')}
            <select value={difficulty} onChange={e => newGame(humanPlayer, +e.target.value, mode)}>
              <option value={50}>{t('game.easy')}</option>
              <option value={150}>{t('game.medium')}</option>
              <option value={400}>{t('game.hard')}</option>
              <option value={800}>{t('game.extreme')}</option>
              <option value={1500}>{lang === 'en' ? 'Hardcore' : 'Хардкор'}</option>
            </select>
            {isGpuReady() && <span style={{ fontSize: 8, color: 'var(--green)', marginLeft: 4 }}>GPU</span>}
          </label>
        )}
        {mode === 'ai' && !tournament && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => startTournament(3)} style={{ fontSize: 10, padding: '4px 8px' }}>{lang === 'en' ? 'Best of 3' : 'Серия 3'}</button>
            <button className="btn" onClick={() => startTournament(5)} style={{ fontSize: 10, padding: '4px 8px' }}>{lang === 'en' ? 'Best of 5' : 'Серия 5'}</button>
          </div>
        )}
      </div>
      )}

      {mode !== 'online' && mode !== 'spectate-online' && !isNative && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--ink3)', marginRight: 2 }}>{en ? 'Mods:' : 'Моды:'}</span>
          <ModifierBadge label={en ? '🌫 Fog' : '🌫 Туман'} active={modifiers.fog}
            onToggle={toggleFog} color="#4a9eff" />
          <ModifierBadge label={en ? '⇄ ×2 Transfer' : '⇄ ×2 перенос'} active={modifiers.doubleTransfer}
            onToggle={() => { setModifiers(m => { const nm = { ...m, doubleTransfer: !m.doubleTransfer }; modifiersRef.current = nm; return nm }); setTransfersLeft(!modifiers.doubleTransfer ? 2 : 1) }} color="#9b59b6" />
          <ModifierBadge label={en ? '⚡ Auto-pass' : '⚡ Авто-пас'} active={modifiers.blitz}
            onToggle={() => setModifiers(m => { const nm = { ...m, blitz: !m.blitz }; modifiersRef.current = nm; return nm })} color="#ff9800" />
        </div>
      )}

      {mode !== 'online' && mode !== 'spectate-online' && isNative && (
        <div className="m-game-bar">
          <div className="m-game-bar-info">
            <span className="m-diff-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                {difficulty >= 1500 ? <><circle cx="12" cy="10" r="7"/><path d="M9 14v2M15 14v2M8 20h8"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/></> :
                 difficulty >= 800 ? <path d="M12 2c-4 6-8 9-8 13a8 8 0 0016 0c0-4-4-7-8-13z"/> :
                 difficulty >= 400 ? <><path d="M12 22V2"/><path d="M4 12l4-4 4 4 4-4 4 4"/></> :
                 difficulty >= 150 ? <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></> :
                 <circle cx="12" cy="12" r="9"/>}
              </svg>
              {difficulty >= 1500 ? (lang === 'en' ? 'Hardcore' : 'Хардкор') : difficulty >= 800 ? (lang === 'en' ? 'Extreme' : 'Экстрим') : difficulty >= 400 ? t('game.hard') : difficulty >= 150 ? t('game.medium') : t('game.easy')}
              {isGpuReady() && <span style={{ fontSize: 8, color: 'var(--green)', marginLeft: 3 }}>GPU</span>}
            </span>
            {mode === 'ai' && <span className="m-side-indicator" style={{ background: humanPlayer === 0 ? 'var(--p1)' : 'var(--p2)' }} />}
            {modifiers.fog && <span style={{ fontSize: 9, color: '#4a9eff' }}>🌫</span>}
            {modifiers.doubleTransfer && <span style={{ fontSize: 9, color: '#9b59b6' }}>⇄×2</span>}
            {modifiers.blitz && <span style={{ fontSize: 9, color: '#ff9800' }}>⚡</span>}
          </div>
          <button className="m-gear-btn" onClick={() => setShowMobileSettings(true)} aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/>
            </svg>
          </button>
        </div>
      )}

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
                  {[{v:50,l:lang === 'en' ? 'Easy' : 'Лёгкая'},{v:150,l:lang === 'en' ? 'Medium' : 'Средняя'},{v:400,l:lang === 'en' ? 'Hard' : 'Сложная'},{v:800,l:lang === 'en' ? 'Extreme' : 'Экстрим'},{v:1500,l:lang === 'en' ? 'Hardcore' : 'Хардкор'}].map(d => (
                    <button key={d.v} className={`m-diff-opt ${difficulty === d.v ? 'active' : ''}`}
                      onClick={() => { newGame(humanPlayer, d.v, mode); setShowMobileSettings(false) }}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="m-setting-row" style={{ flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span className="m-setting-label">{en ? 'Modifiers' : 'Модификаторы'}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ModifierBadge label={en ? '🌫 Fog' : '🌫 Туман'} active={modifiers.fog} onToggle={toggleFog} color="#4a9eff" />
                <ModifierBadge label={en ? '⇄ ×2 Transfer' : '⇄ ×2 перенос'} active={modifiers.doubleTransfer} onToggle={() => setModifiers(m => { const nm = { ...m, doubleTransfer: !m.doubleTransfer }; modifiersRef.current = nm; return nm })} color="#9b59b6" />
                <ModifierBadge label={en ? '⚡ Auto-pass' : '⚡ Авто-пас'} active={modifiers.blitz} onToggle={() => setModifiers(m => { const nm = { ...m, blitz: !m.blitz }; modifiersRef.current = nm; return nm })} color="#ff9800" />
              </div>
            </div>
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
           mode === 'online' ? (gs.currentPlayer === humanPlayer ? (lang === 'en' ? 'Your turn' : 'Ваш ход') : (lang === 'en' ? "Opponent's turn" : 'Ходит противник')) :
           `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}`}
        </div>
      )}

      {/* РЕФАКТОР: имя игрока берётся из useAuth() вместо localStorage IIFE */}
      <div className="scoreboard">
        <div className="score-player">
          <div className="score-label">{mode === 'ai'
            ? (humanPlayer === 0 ? (authUser?.name || t('game.player')) : 'Snappy')
            : (en ? 'Blue' : 'Синие')}</div>
          <div className={`score-num p0 ${scoreBump === 0 ? 'score-bump' : ''}`}>{gs.countClosed(0)}</div>
        </div>
        <div className="score-sep">:</div>
        <div className="score-player">
          <div className="score-label">{mode === 'ai'
            ? (humanPlayer === 1 ? (authUser?.name || t('game.player')) : 'Snappy')
            : (en ? 'Red' : 'Красные')}</div>
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

      {timerLimit > 0 && !gs.gameOver && (
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: isNative ? '2px 12px 4px' : '4px 16px 8px', fontSize: isNative ? 12 : 13, fontFamily: 'monospace' }}>
          <div style={{ color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--ink3)', fontWeight: gs.currentPlayer === 0 ? 700 : 400,
            opacity: playerTime[0] < 30 && gs.currentPlayer === 0 ? (playerTime[0] % 2 ? 1 : 0.5) : 1 }}>
            {Math.floor(playerTime[0] / 60)}:{String(playerTime[0] % 60).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', alignSelf: 'center' }}>
            {userSettings.timer === 'blitz' ? '3+0' : userSettings.timer === 'rapid' ? '10+0' : '30+0'}
            {modifiers.blitz && <span style={{ color: '#ff9800', marginLeft: 4 }}>⚡пас</span>}
          </div>
          <div style={{ color: gs.currentPlayer === 1 ? 'var(--p2)' : 'var(--ink3)', fontWeight: gs.currentPlayer === 1 ? 700 : 400,
            opacity: playerTime[1] < 30 && gs.currentPlayer === 1 ? (playerTime[1] % 2 ? 1 : 0.5) : 1 }}>
            {Math.floor(playerTime[1] / 60)}:{String(playerTime[1] % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: isNative ? 10 : 11, color: 'var(--ink3)', padding: isNative ? '3px 8px' : '4px 8px', minHeight: isNative ? 16 : 18 }}>
        {t('game.turn')} {gs.turn} · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}
        {phase === 'place' && !gs.isFirstTurn() && isMyTurn && (
          <> · {totalPlaced}/{maxTotal}{transfer ? ` · ✓` : ''}
          {modifiers.doubleTransfer && transfersLeft === 2 && !gs.isFirstTurn() && <span style={{ color: '#9b59b6', marginLeft: 4 }}>⇄×2</span>}
          {modifiers.doubleTransfer && transfersLeft === 1 && transfer && <span style={{ color: '#9b59b6', marginLeft: 4 }}>⇄×1</span>}
          </>
        )}
      </div>

      {isMyTurn && gs.turn === 1 && gs.swapAvailable && phase === 'place' && (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{t('game.swapQuestion')}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => {
              const action = { swap: true }
              if (mode === 'online') MP.sendMove(action, playerTime)
              recordMove(gs, action, gs.currentPlayer)
              moveHistoryRef.current.push({ action, player: gs.currentPlayer })
              addLog(lang === 'en' ? 'Swap — colors swapped!' : 'Swap — цвета поменялись!', gs.currentPlayer)
              ss()
              const ns = applyAction(gs, action)
              setGs(ns); setPhase('place')
              if (mode === 'online') { setHumanPlayer(0); onlineRef.current && (onlineRef.current.myColor = 0); setLocked(false); setInfo(t('game.swapOnlineDone')) }
              else setInfo(t('game.swapDone'))
            }} style={{ borderColor: 'var(--purple)', color: 'var(--purple)', padding: '10px 20px' }}>Swap</button>
            <button className="btn" onClick={() => setInfo(t('game.swapDeclined'))} style={{ fontSize: 12, padding: '10px 16px' }}>{t('game.noContinue')}</button>
          </div>
        </div>
      )}

      {drawOffered && !gs.gameOver && mode === 'online' && (
        <div style={{ textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(155,89,182,0.08)', borderRadius: 10, border: '1px solid rgba(155,89,182,0.2)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{t('game.drawOfferReceived')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => { MP.send({ type: 'drawResponse', accepted: true }); setResult(-1); setPhase('done'); setLocked(false); setInfo(t('game.drawAgreed')); setDrawOffered(false) }} style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>{t('game.accept')}</button>
            <button className="btn" onClick={() => { MP.send({ type: 'drawResponse', accepted: false }); setDrawOffered(false) }} style={{ fontSize: 12 }}>{t('game.decline')}</button>
          </div>
        </div>
      )}

      {rematchOffered && gs.gameOver && mode === 'online' && (
        <div style={{ textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(61,214,140,0.08)', borderRadius: 10, border: '1px solid rgba(61,214,140,0.2)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{t('game.rematchOffer')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => { MP.sendRematchResponse(true); setRematchOffered(false) }} style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>{t('game.accept')}</button>
            <button className="btn" onClick={() => { MP.sendRematchResponse(false); setRematchOffered(false) }} style={{ fontSize: 12 }}>{t('game.decline')}</button>
          </div>
        </div>
      )}

      <div className="actions">
        {(() => {
          const transferActive = isMyTurn && (inTransferMode || !!transfer)
          const hasPlacements = isMyTurn && phase === 'place' && totalPlaced > 0
          const inCancelMode = transferActive || hasPlacements
          if (inCancelMode) {
            return (
              <button key="slot1-cancel" className="btn action-slot action-slot--swap"
                onClick={() => { if (transferActive) cancelTransfer(); if (hasPlacements) setPlacement({}) }}
                title="Esc">
                {t('game.cancelTransfer')}
              </button>
            )
          }
          return (
            <button key="slot1-transfer" className="btn action-slot action-slot--swap"
              disabled={!(isMyTurn && phase === 'place' && hasTransfers)}
              onClick={startTransfer}>
              {modifiers.doubleTransfer && transfersLeft > 1 && !transfer
                ? (en ? '⇄⇄ Transfer' : '⇄⇄ Перенос')
                : t('game.transfer')}
            </button>
          )
        })()}

        <button className="btn primary action-slot" disabled={!(isMyTurn && phase === 'place' && canConfirm)} onClick={confirmTurn} title="Enter">
          {t('game.confirm')} ⏎
        </button>

        <button className="btn" onClick={() => newGame()} title="N">{t('game.newGame')}</button>
        {mode === 'pvp' && undoStack.length > 0 && !gs.gameOver && (
          <button className="btn" onClick={undoMove} style={{ fontSize: 11, color: 'var(--gold)', borderColor: '#ffc14540' }} aria-label="Undo move">↩ Undo</button>
        )}
        {!gs.gameOver && mode !== 'pvp' && mode !== 'spectate-online' && (
          <button className="btn" onClick={resign} style={{ fontSize: 11, color: 'var(--p2)', borderColor: '#ff606640' }}>{t('game.resign')}</button>
        )}
        {!gs.gameOver && mode === 'online' && (
          <button className="btn" onClick={() => { MP.send({ type: 'drawOffer' }); setInfo(t('game.drawOffered')) }} style={{ fontSize: 11, opacity: 0.6 }}>{t('game.offerDraw')}</button>
        )}
        <button className="btn" onClick={() => setSoundOnState(p => !p)}
          style={{ fontSize: 13, opacity: 0.5, padding: '6px 8px', minWidth: 0 }}
          aria-label={soundOn ? 'Mute' : 'Unmute'}>
          {soundOn
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>}
        </button>
        {mode === 'ai' && isMyTurn && !gs.gameOver && (
          <button className="btn" onClick={requestHint} disabled={hintLoading} style={{ borderColor: 'var(--gold)', color: 'var(--gold)', fontSize: 11, padding: '6px 8px', minWidth: 0 }} title="H">
            {hintLoading ? '...' : '💡'}
          </button>
        )}
      </div>

      {mode === 'online' && !gs.gameOver && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 }}>
          {['👍', '🔥', '😮', '😂', '💪', '🎉'].map(e => (
            <button key={e} onClick={() => MP.send({ type: 'reaction', emoji: e })}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
                padding: '4px 6px', fontSize: 16, cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseDown={ev => ev.currentTarget.style.transform = 'scale(1.3)'}
              onMouseUp={ev => ev.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}
              aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
        </div>
      )}

      {floatingEmoji && (
        <div key={floatingEmoji.key} style={{
          position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 64, zIndex: 9999, pointerEvents: 'none',
          animation: 'emojiFloat 2s ease-out forwards',
        }}>{floatingEmoji.emoji}</div>
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

      {newAch && (
        <div className="achievement-popup">
          <Mascot pose="celebrate" size={40} animate={false} />
          <div>
            <div className="ach-label">{lang === 'en' ? 'Achievement unlocked!' : 'Ачивка разблокирована!'}</div>
            <div className="ach-name">{lang === 'en' && newAch.nameEn ? newAch.nameEn : newAch.name}</div>
          </div>
        </div>
      )}

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
