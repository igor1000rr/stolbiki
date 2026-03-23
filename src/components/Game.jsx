import { useState, useRef, useEffect, useCallback } from 'react'
import {
  GameState, getValidTransfers, applyAction,
  MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX, GOLDEN_STAND
} from '../engine/game'
import { mctsSearch } from '../engine/ai'
import { getHint } from '../engine/hints'
import { soundPlace as _sp, soundTransfer as _st, soundClose as _sc, soundWin as _sw, soundLose as _sl, soundClick as _sk, soundSwap as _ss } from '../engine/sounds'
import { startRecording, setGameMeta, recordMove, finishRecording, cancelRecording } from '../engine/collector'
import * as MP from '../engine/multiplayer'
import { isLoggedIn } from '../engine/api'
import Board from './Board'

const SL = i => i === GOLDEN_STAND ? '★' : String(i)

// Haptic feedback
const haptic = (ms = 10) => { try { navigator?.vibrate?.(ms) } catch {} }

// Звук через ref чтобы не пересоздавать
let _soundOn = true
const sp = () => { _soundOn && _sp(); haptic(5) }
const st = () => { _soundOn && _st(); haptic(8) }
const sc = () => { _soundOn && _sc(); haptic([15, 30, 15]) }
const sw = () => { _soundOn && _sw(); haptic([10, 20, 10, 20, 30]) }
const sl = () => { _soundOn && _sl(); haptic(20) }
const ss = () => { _soundOn && _ss(); haptic(12) }

function describeAction(a, p) {
  const name = p === 0 ? 'Синие' : 'Красные'
  if (a.swap) return `${name}: Swap — смена цветов`
  const parts = []
  if (a.transfer) parts.push(`перенос ${SL(a.transfer[0])} → ${SL(a.transfer[1])}`)
  if (a.placement && Object.keys(a.placement).length) {
    parts.push(`установка: ${Object.entries(a.placement).map(([k, v]) => `${v} на ${SL(+k)}`).join(', ')}`)
  }
  if (!parts.length) parts.push('пас')
  return `${name}: ${parts.join(' + ')}`
}

export default function Game() {
  const [gs, setGs] = useState(() => new GameState())
  const [phase, setPhase] = useState('place')
  const [selected, setSelected] = useState(null)
  const [transfer, setTransfer] = useState(null)
  const [placement, setPlacement] = useState({})
  const [humanPlayer, setHumanPlayer] = useState(0)
  const [difficulty, setDifficulty] = useState(50)
  const [mode, setMode] = useState('ai') // 'ai' | 'pvp'
  const [soundOn, setSoundOn] = useState(true)
  useEffect(() => { _soundOn = soundOn }, [soundOn])
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
  // Онлайн мультиплеер
  const [onlineRoom, setOnlineRoom] = useState(null)
  const [onlinePlayerIdx, setOnlinePlayerIdx] = useState(-1)
  const [onlinePlayers, setOnlinePlayers] = useState([])
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
      setUndoStack([])
      setPosEval(null)

      const myName = players[playerIdx] || 'Вы'
      const oppName = players[1 - playerIdx] || 'Противник'
      setLog([{ text: `Онлайн: ${myName} vs ${oppName}${nextGame ? ' (следующая партия)' : ''}`, player: -1, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])

      if (state.currentPlayer === myColor) {
        setLocked(false)
        setInfo('Ваш ход — поставьте 1 фишку')
      } else {
        setLocked(true)
        setInfo('Ходит противник...')
      }
    }

    function handleOnlineMove(e) {
      const action = e.detail
      const myColorBefore = onlineRef.current?.myColor ?? 0
      const opponentColor = 1 - myColorBefore

      // Берём актуальный стейт из ref, применяем ход
      const prevState = gsRef.current
      const ns = applyAction(prevState, action)
      setGs(ns)
      gsRef.current = ns

      addLog(describeAction(action, opponentColor), opponentColor)

      // Swap — особый случай: противник ещё не закончил ход (ему надо ставить фишки)
      if (action.swap) {
        ss()
        const newColor = 1 - myColorBefore
        if (onlineRef.current) onlineRef.current.myColor = newColor
        setHumanPlayer(newColor)
        setLocked(true)
        setInfo('Противник сделал Swap — ждём его ход...')
        return
      }

      // Обычный ход — звуки
      if (action.transfer) st()
      else sp()

      if (ns.gameOver) {
        setTimeout(() => {
          setResult(ns.winner); setPhase('done'); setInfo('Партия завершена'); setLocked(false)
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
            setInfo(ns.isFirstTurn() ? 'Ваш ход — поставьте 1 фишку' : 'Ваш ход — расставьте фишки')
          }, 300)
        } else {
          setLocked(true)
          setInfo('Ходит противник...')
        }
      }
    }

    window.addEventListener('stolbiki-online-start', handleOnlineStart)
    window.addEventListener('stolbiki-online-move', handleOnlineMove)
    return () => {
      window.removeEventListener('stolbiki-online-start', handleOnlineStart)
      window.removeEventListener('stolbiki-online-move', handleOnlineMove)
    }
  }, []) // eslint-disable-line

  // ─── Daily Challenge: слушаем событие из Online.jsx ───
  useEffect(() => {
    function handleDailyStart() {
      setDailyMode(true)
      setDailySeed(getDailySeed())
      newGame(0, 100, 'ai')
      setInfo(`Ежедневный челлендж #${getDailySeed() % 10000} — победите AI за минимум ходов!`)
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
        if (ps > 0.3) { label = '↑ Сильная позиция'; color = '#3dd68c' }
        else if (ps > 0.1) { label = '↗ Небольшое преимущество'; color = '#89d68c' }
        else if (ps > -0.1) { label = '→ Равная игра'; color = '#a09cb0' }
        else if (ps > -0.3) { label = '↘ Позиция ослабла'; color = '#ffc145' }
        else { label = '↓ Слабая позиция'; color = '#ff6066' }
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
    newGame(next % 2, difficulty, 'ai')
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
    setLog(prev => [{ text, player, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev])
  }

  // ─── AI ход ───
  const runAi = useCallback((state) => {
    if (aiRunning.current || state.gameOver) return
    aiRunning.current = true
    setAiThinking(true)
    setLocked(true)
    setInfo('AI думает')
    const startTime = Date.now()
    setTimeout(() => {
      const action = mctsSearch(state, difficulty)
      const remaining = Math.max(0, 1000 - (Date.now() - startTime))
      setTimeout(() => {
        setAiThinking(false)
        addLog(describeAction(action, state.currentPlayer), state.currentPlayer)
        setTimeout(() => {
          recordMove(state, action, state.currentPlayer)
          const ns = applyAction(state, action)
          setGs(ns)
          aiRunning.current = false
          if (ns.gameOver) {
            setTimeout(() => {
              setResult(ns.winner); setPhase('done'); setInfo('Партия завершена'); setLocked(false)
              finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
              const won = modeRef.current === 'spectate' ? true : ns.winner === humanPlayer
              setTimeout(() => { won ? sw() : sl(); if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) } }, 300)
              if (typeof window.stolbikiRecordGame === 'function') {
                const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
                const score = `${Math.max(s0,s1)}:${Math.min(s0,s1)}`
                const closedGolden = (0 in ns.closed) && ns.closed[0] === humanPlayer
                window.stolbikiRecordGame(won, score, difficulty >= 100, closedGolden, false)
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
            setInfo(ns.isFirstTurn() ? 'Поставьте 1 фишку' : 'Кликайте на стойки чтобы ставить фишки (макс 3, на 2 стойки)')
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
    if (m === 'online' && !gameMode) m = 'ai'
    if (m === 'online') return // Онлайн-игры стартуют через stolbiki-online-start
    // Сброс онлайн состояния
    setOnlineRoom(null); setOnlinePlayerIdx(-1); setOnlinePlayers([])
    onlineRef.current = null
    setPosEval(null)
    const state = new GameState()
    gsRef.current = state
    setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({}); setResult(null); setHint(null); setAiThinking(false)
    setScoreBump(null); setLocked(false); setHumanPlayer(hp); setDifficulty(d); setMode(m)
    aiRunning.current = false; prevScore.current = [0, 0]; modeRef.current = m
    startRecording()
    setGameMeta(m, d)
    setGameStartTime(Date.now())
    setElapsed(0)
    setUndoStack([])
    if (m === 'pvp') {
      setLog([{ text: 'Новая партия: игрок против игрока', player: -1, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo('Синие: поставьте 1 фишку')
    } else if (m === 'spectate') {
      setLog([{ text: 'AI vs AI — наблюдение', player: -1, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      setInfo('AI vs AI')
      setLocked(true)
      setTimeout(() => runAi(state), 800)
    } else {
      const c = hp === 0 ? 'синие' : 'красные'
      setLog([{ text: `Новая партия. Вы — ${c}`, player: -1, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }])
      if (state.currentPlayer !== hp) {
        setInfo('AI делает первый ход')
        setLocked(true)
        setTimeout(() => runAi(state), 500)
      } else {
        setInfo('Первый ход — поставьте 1 фишку на любую стойку')
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

  // ─── Клик по стойке — ОБЫЧНАЯ ФУНКЦИЯ, всегда свежий state ───
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
      if (i === selected) { setSelected(null); setPhase('transfer-select'); setInfo('Выберите стойку для переноса'); return }
      if (getValidTransfers(gs).some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i])
        setSelected(null)
        setPhase('place')
        st()
        addLog(`Перенос: ${SL(selected)} → ${SL(i)}`, humanPlayer)
        setInfo('Перенос выбран. Расставьте фишки')
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
      if (numStands >= MAX_PLACE_STANDS) { setInfo('Макс 2 стойки. Кликните занятую чтобы убрать'); return }
      if (currentTotal >= maxTotal) { setInfo('Все фишки расставлены — подтвердите'); return }

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
    addLog(describeAction(action, gs.currentPlayer), gs.currentPlayer)

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
        setResult(ns.winner); setPhase('done'); setInfo('Партия завершена'); setLocked(false)
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
          window.stolbikiRecordGame(w, score, difficulty >= 100, closedGolden, mode === 'online')
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
      setInfo('Ходит противник...')
    } else if (mode === 'pvp') {
      setPhase('place')
      const name = ns.currentPlayer === 0 ? 'Синие' : 'Красные'
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
    setInfo('Выберите стойку откуда перенести')
  }

  function cancelTransfer() {
    setSelected(null); setTransfer(null); setPhase('place')
    setInfo('Перенос отменён')
  }

  function undoMove() {
    if (undoStack.length === 0 || mode !== 'pvp') return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setGs(prev)
    setPhase('place'); setTransfer(null); setPlacement({}); setSelected(null); setResult(null)
    setLog(l => [{ text: '↩ Ход отменён', player: -1, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...l])
    setInfo(`${prev.currentPlayer === 0 ? 'Синие' : 'Красные'}: ваш ход`)
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
          <div style={{ maxWidth: 420, background: '#1e1e28', borderRadius: 16, padding: '28px 24px', border: '1px solid #36364a', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎮</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e6f0' }}>Как играть в Стойки</div>
            </div>
            <div style={{ fontSize: 13, color: '#a09cb0', lineHeight: 1.9 }}>
              <p><b style={{ color: '#6db4ff' }}>1.</b> <b>Кликайте на стойки</b> чтобы ставить фишки (до 3 на 2 стойки)</p>
              <p><b style={{ color: '#6db4ff' }}>2.</b> <b>Перенос</b> — кнопка «↗ Сделать перенос» (переместите верхнюю группу)</p>
              <p><b style={{ color: '#6db4ff' }}>3.</b> <b>Закрытие</b> — стойка с 11 фишками закрывается. Цвет верхней группы = владелец</p>
              <p><b style={{ color: '#ffc145' }}>★</b> <b>Золотая стойка</b> решает при ничьей 5:5</p>
              <p><b style={{ color: '#3dd68c' }}>🎯</b> Закройте <b>6+ стоек</b> из 10 чтобы победить</p>
            </div>
            <button className="btn primary" onClick={dismissTutorial} style={{ width: '100%', marginTop: 16, padding: '12px 0' }}>
              Понятно, играем!
            </button>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#555' }}>
              Подробные правила — вкладка «📖 Правила»
            </div>
          </div>
        </div>
      )}
      {mode === 'online' && (
        <div style={{ textAlign: 'center', padding: '8px 16px', marginBottom: 12,
          background: 'rgba(61,214,140,0.08)', borderRadius: 12, border: '1px solid rgba(61,214,140,0.15)' }}>
          <span style={{ fontSize: 12, color: '#3dd68c', fontWeight: 600 }}>🌐 Онлайн — {onlinePlayers.join(' vs ')}</span>
          <label style={{ cursor: 'pointer', marginLeft: 12 }}>
            <input type="checkbox" checked={soundOn} onChange={e => setSoundOn(e.target.checked)} style={{ marginRight: 4 }} />
            🔊
          </label>
        </div>
      )}

      {mode !== 'online' && (
      <div className="game-settings">
        <label>Режим:
          <select value={mode} onChange={e => newGame(humanPlayer, difficulty, e.target.value)}>
            <option value="ai">Против AI</option>
            <option value="pvp">Вдвоём</option>
            <option value="spectate">AI vs AI</option>
          </select>
        </label>
        {mode === 'ai' && (
          <label>Сторона:
            <select value={humanPlayer} onChange={e => newGame(+e.target.value, difficulty, mode)}>
              <option value={0}>Синие (первый ход)</option>
              <option value={1}>Красные (swap)</option>
            </select>
          </label>
        )}
        {mode === 'ai' && (
          <label>Сложность:
            <select value={difficulty} onChange={e => newGame(humanPlayer, +e.target.value, mode)}>
              <option value={20}>Лёгкая</option>
              <option value={50}>Средняя</option>
              <option value={100}>Сложная</option>
            </select>
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
        <label style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={soundOn} onChange={e => setSoundOn(e.target.checked)} style={{ marginRight: 4 }} />
          🔊
        </label>
      </div>
      )}

      {/* Сессионная статистика */}
      {(sessionStats.wins > 0 || sessionStats.losses > 0) && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8, fontSize: 11, color: '#6b6880' }}>
          <span>Побед: <b style={{ color: '#3dd68c' }}>{sessionStats.wins}</b></span>
          <span>Поражений: <b style={{ color: '#ff6066' }}>{sessionStats.losses}</b></span>
          {sessionStats.streak > 1 && <span>🔥 Серия: <b style={{ color: '#ffc145' }}>{sessionStats.streak}</b></span>}
        </div>
      )}

      {(mode === 'pvp' || mode === 'spectate' || mode === 'online') && !gs.gameOver && (
        <div style={{ textAlign: 'center', padding: '6px 12px', margin: '0 auto 8px', fontSize: 13, fontWeight: 600,
          color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--p2)',
          background: gs.currentPlayer === 0 ? 'rgba(74,158,255,0.1)' : 'rgba(255,107,107,0.1)',
          borderRadius: 8, display: 'inline-block' }}>
          {mode === 'spectate' ? `AI думает (${gs.currentPlayer === 0 ? 'Синие' : 'Красные'})` :
           mode === 'online' ? (gs.currentPlayer === humanPlayer ? '🟢 Ваш ход' : '⏳ Ходит противник') :
           `Ходят ${gs.currentPlayer === 0 ? 'Синие' : 'Красные'}`}
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

      <div className={`game-info ${aiThinking ? 'thinking-dots' : ''}`}>{info}</div>

      <Board state={gs} pending={placement} selected={selected} phase={phase} humanPlayer={mode === 'pvp' ? gs.currentPlayer : humanPlayer} onStandClick={onStandClick} aiThinking={aiThinking} onlineMode={mode === 'online'} />

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
            <span style={{ fontSize: 10, color: '#6b6880', marginLeft: 'auto' }}>
              {posEval.score > 0 ? '+' : ''}{(posEval.score * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#2a2a38', overflow: 'hidden' }}>
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
          <div style={{ fontSize: 12, color: '#a09cb0', marginBottom: 6 }}>
            Игрок 1 поставил первую фишку. Хотите поменять цвета?
          </div>
          <button className="btn" onClick={() => {
            const action = { swap: true }
            if (mode === 'online') MP.sendMove(action)
            recordMove(gs, action, gs.currentPlayer)
            addLog('Swap — цвета поменялись!', gs.currentPlayer)
            ss()
            const ns = applyAction(gs, action)
            setGs(ns)
            setPhase('place')
            if (mode === 'online') {
              // После swap в онлайне: мы забрали позицию P1, теперь наш ход
              setHumanPlayer(0) // Мы теперь синие
              onlineRef.current && (onlineRef.current.myColor = 0)
              setLocked(false)
              setInfo('Swap принят! Теперь вы синие — расставьте фишки')
            } else {
              setInfo('Swap принят! Теперь вы играете за синих')
            }
          }} style={{ borderColor: '#9b59b6', color: '#9b59b6', marginRight: 8 }}>
            🔄 Swap (забрать ход)
          </button>
          <button className="btn" onClick={() => {
            setInfo('Swap отклонён. Ставьте фишки')
          }} style={{ fontSize: 12 }}>
            Нет, продолжить
          </button>
        </div>
      )}

      <div className="actions">
        {isMyTurn && phase === 'place' && hasTransfers && !transfer && (
          <button className="btn" onClick={startTransfer}>↗ Сделать перенос</button>
        )}
        {isMyTurn && inTransferMode && (
          <button className="btn" onClick={cancelTransfer}>✕ Отменить перенос</button>
        )}
        {isMyTurn && transfer && phase === 'place' && (
          <span style={{ fontSize: 12, color: '#3dd68c', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
            ✓ {SL(transfer[0])} → {SL(transfer[1])}
          </span>
        )}
        {isMyTurn && phase === 'place' && totalPlaced > 0 && (
          <button className="btn" onClick={() => setPlacement({})}>Сброс</button>
        )}
        {isMyTurn && phase === 'place' && (
          <button className="btn primary" disabled={!canConfirm} onClick={confirmTurn}>Подтвердить</button>
        )}
        {hintMode && isMyTurn && (
          <button className="btn" onClick={requestHint} disabled={hintLoading} style={{ borderColor: '#ffbe30', color: '#ffbe30' }}>
            {hintLoading ? '...' : '💡'}
          </button>
        )}
        <button className="btn" onClick={() => newGame()}>Новая игра</button>
        {mode === 'pvp' && undoStack.length > 0 && !gs.gameOver && (
          <button className="btn" onClick={undoMove} style={{ fontSize: 11 }}>↩ Отмена</button>
        )}
      </div>

      {isMyTurn && !gs.gameOver && (
        <div style={{ textAlign: 'center', fontSize: 9, color: '#444', marginTop: 4 }}>
          Enter — подтвердить · Esc — отмена переноса · N — новая игра
        </div>
      )}

      {hint && hintMode && (
        <div className="hint-panel">
          <div className="hint-title">💡 Подсказка</div>
          {hint.explanation.map((l, i) => <p key={i} className="hint-line">{l}</p>)}
        </div>
      )}

      {result !== null && (() => {
        const won = (mode === 'pvp') ? true : result === humanPlayer
        const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
        const goldenOwned = (0 in gs.closed)
        const shareText = `Стойки${mode === 'online' ? ' Онлайн' : ''}: ${won ? 'Победа' : 'Поражение'} ${s0}:${s1} ${goldenOwned ? '⭐' : ''} — 178.212.12.71`
        return (
          <div className="game-result" style={{ borderLeft: `3px solid ${won ? '#3dd68c' : '#ff6066'}`, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{won ? '🎉' : '😔'}</div>
            <span style={{ fontSize: 20 }}>{mode === 'pvp'
              ? `${result === 0 ? 'Синие' : 'Красные'} победили!`
              : mode === 'online'
              ? (won ? '🏆 Победа!' : 'Противник победил')
              : (won ? 'Победа!' : 'AI побеждает')
            }</span>
            <div style={{ fontSize: 32, fontWeight: 700, margin: '6px 0', color: '#e8e6f0' }}>{s0} : {s1}</div>
            <div style={{ fontSize: 11, color: '#6b6880', display: 'flex', gap: 12, justifyContent: 'center' }}>
              <span>Ходов: {gs.turn}</span>
              <span>⏱ {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
              {goldenOwned && <span>⭐ Золотая: П{gs.closed[0] + 1}</span>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => newGame()} style={{ fontSize: 12, padding: '8px 16px' }}>
                Ещё партию
              </button>
              {mode === 'ai' && (
                <button className="btn" onClick={() => newGame(humanPlayer === 0 ? 1 : 0, difficulty, mode)} style={{ fontSize: 12, padding: '8px 14px' }}>
                  🔄 Сменить сторону
                </button>
              )}
              <button className="btn" onClick={async () => {
                // Генерируем картинку результата через canvas
                try {
                  const c = document.createElement('canvas')
                  c.width = 600; c.height = 320
                  const ctx = c.getContext('2d')
                  // Фон
                  ctx.fillStyle = '#14141e'
                  ctx.fillRect(0, 0, 600, 320)
                  ctx.fillStyle = '#1e1e28'
                  ctx.fillRect(0, 0, 600, 6)
                  // Заголовок
                  ctx.fillStyle = won ? '#3dd68c' : '#ff6066'
                  ctx.font = 'bold 32px sans-serif'
                  ctx.textAlign = 'center'
                  ctx.fillText(won ? '🎉 Победа!' : '😔 Поражение', 300, 60)
                  // Счёт
                  ctx.fillStyle = '#e8e6f0'
                  ctx.font = 'bold 72px sans-serif'
                  ctx.fillText(`${s0} : ${s1}`, 300, 150)
                  // Стойки визуализация
                  for (let si = 0; si < 10; si++) {
                    const x = 60 + si * 52
                    const owner = gs.closed[si]
                    ctx.fillStyle = owner === 0 ? '#4a9eff' : owner === 1 ? '#ff6b6b' : '#2a2a38'
                    ctx.globalAlpha = owner !== undefined ? 0.9 : 0.3
                    ctx.fillRect(x, 185, 40, 16)
                    ctx.globalAlpha = 1
                    if (si === 0) { ctx.fillStyle = '#ffc145'; ctx.font = '10px sans-serif'; ctx.fillText('★', x + 20, 218) }
                  }
                  // Инфо
                  ctx.fillStyle = '#6b6880'
                  ctx.font = '14px sans-serif'
                  ctx.fillText(`Ходов: ${gs.turn} · ⏱ ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}${goldenOwned ? ' · ⭐ Золотая' : ''}`, 300, 260)
                  // Подпись
                  ctx.fillStyle = '#444'
                  ctx.font = '12px sans-serif'
                  ctx.fillText('Стойки — 178.212.12.71', 300, 300)

                  const blob = await new Promise(r => c.toBlob(r, 'image/png'))
                  const file = new File([blob], 'stolbiki-result.png', { type: 'image/png' })

                  if (navigator.canShare?.({ files: [file] })) {
                    navigator.share({ text: shareText, files: [file] }).catch(() => {})
                  } else if (navigator.share) {
                    navigator.share({ text: shareText }).catch(() => {})
                  } else {
                    // Fallback: скачиваем картинку
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = 'stolbiki-result.png'; a.click()
                    URL.revokeObjectURL(url)
                  }
                } catch {
                  navigator.clipboard?.writeText(shareText)
                }
              }} style={{ fontSize: 12, padding: '8px 12px' }}>
                📤
              </button>
              <button className="btn" onClick={() => {
                const replay = { moves: log.map(e => e.text).reverse(), turns: gs.turn, winner: result,
                  score: `${s0}:${s1}`, mode, difficulty, elapsed, date: new Date().toISOString() }
                const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `stolbiki_${Date.now()}.json`; a.click()
                URL.revokeObjectURL(url)
              }} style={{ fontSize: 12, padding: '8px 12px' }}>
                💾
              </button>
            </div>
            {sessionStats.streak > 1 && won && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#ffc145' }}>
                🔥 Серия побед: {sessionStats.streak}
              </div>
            )}
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
    </div>
  )
}
