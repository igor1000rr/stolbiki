/**
 * useOnlineGameHandlers — все WS-обработчики онлайн-мультиплеера из Game.jsx.
 *
 * Вынесено из монолитного Game.jsx (1424 строки). Принимает бандл сеттеров/refs,
 * регистрирует обработчики в GameContext, возвращает cleanup.
 *
 * Зависимости: GameContext, GameState/applyAction из движка, утилиты UI.
 */

import { useEffect } from 'react'
import { GameState, applyAction } from './game.js'
import { cancelRecording, startRecording, setGameMeta, finishRecording } from './collector.js'
import * as API from './api.js'

// Title для локальных браузерных уведомлений (Notification API).
// Синхронизируется с именем бренда — после ребрендинга snatch-highrise → highriseheist.
const NOTIF_TITLE = 'Highrise Heist'

/**
 * @param {object} opts
 * @param {object} opts.gameCtx — GameContext instance
 * @param {object} opts.gsRef — ref на текущий GameState
 * @param {object} opts.onlineRef — ref на { roomId, playerIdx, myColor }
 * @param {object} opts.aiRunningRef — ref на boolean
 * @param {object} opts.modeRef — ref на текущий mode ('ai'|'online'|'spectate-online')
 * @param {object} opts.prevScore — ref на [s1, s2]
 * @param {object} opts.moveHistoryRef — ref на массив ходов
 * @param {Function} opts.setGs
 * @param {Function} opts.setPhase
 * @param {Function} opts.setSelected
 * @param {Function} opts.setTransfer
 * @param {Function} opts.setPlacement
 * @param {Function} opts.setResult
 * @param {Function} opts.setHint
 * @param {Function} opts.setAiThinking
 * @param {Function} opts.setScoreBump
 * @param {Function} opts.setHumanPlayer
 * @param {Function} opts.setMode
 * @param {Function} opts.setLocked
 * @param {Function} opts.setInfo
 * @param {Function} opts.setLog
 * @param {Function} opts.addLog
 * @param {Function} opts.setUndoStack
 * @param {Function} opts.setShowReplay
 * @param {Function} opts.setOnlineRoom
 * @param {Function} opts.setOnlinePlayerIdx
 * @param {Function} opts.setOnlinePlayers
 * @param {Function} opts.setDrawOffered
 * @param {Function} opts.setRematchOffered
 * @param {Function} opts.setRematchPending
 * @param {Function} opts.setFloatingEmoji
 * @param {Function} opts.setSpectatorCount
 * @param {Function} opts.setPlayerTime
 * @param {Function} opts.setConfetti
 * @param {Function} opts.resetTimers
 * @param {Function} opts.requestNotificationPermission
 * @param {Function} opts.showNotification
 * @param {Function} opts.startTitleBlink
 * @param {Function} opts.describeAction
 * @param {Function} opts.t — i18n translator
 * @param {string} opts.lang
 * @param {object} opts.sounds — { sw, sl, ss, sp, st }
 */
export function useOnlineGameHandlers(opts) {
  const {
    gameCtx, gsRef, onlineRef, aiRunningRef, modeRef, prevScore, moveHistoryRef,
    setGs, setPhase, setSelected, setTransfer, setPlacement, setResult, setHint,
    setAiThinking, setScoreBump, setHumanPlayer, setMode, setLocked, setInfo,
    setLog, addLog, setUndoStack, setShowReplay,
    setOnlineRoom, setOnlinePlayerIdx, setOnlinePlayers,
    setDrawOffered, setRematchOffered, setRematchPending,
    setFloatingEmoji, setSpectatorCount, setPlayerTime, setConfetti,
    resetTimers, requestNotificationPermission, showNotification, startTitleBlink,
    describeAction, t, lang, sounds,
  } = opts

  const { sw, sl, ss, sp, st } = sounds

  useEffect(() => {
    if (!gameCtx) return

    // ─── Start новой онлайн-партии ───
    function handleOnlineStart(detail) {
      const { players, firstPlayer, roomId, playerIdx, nextGame, timer, ratings } = detail
      requestNotificationPermission()
      const myColor = (playerIdx === (firstPlayer ?? 0)) ? 0 : 1
      onlineRef.current = { roomId, playerIdx, myColor }
      setOnlineRoom(roomId)
      setOnlinePlayerIdx(playerIdx)
      setOnlinePlayers(players)

      cancelRecording()
      const state = new GameState()
      gsRef.current = state
      setGs(state); setPhase('place'); setSelected(null); setTransfer(null); setPlacement({})
      setResult(null); setHint(null); setAiThinking(false)
      API.track('game_start', 'game', { mode: 'online' })
      setScoreBump(null); setHumanPlayer(myColor); setMode('online')
      aiRunningRef.current = false; prevScore.current = [0, 0]; modeRef.current = 'online'
      startRecording()
      setGameMeta('online', 0)
      resetTimers()
      if (timer && timer > 0) setPlayerTime([timer * 60, timer * 60])
      setUndoStack([])
      moveHistoryRef.current = []
      setShowReplay(false)
      setRematchOffered(false)
      setRematchPending(false)
      setDrawOffered(false)

      const myName = players[playerIdx] || t('game.you')
      const oppName = players[1 - playerIdx] || t('game.opponent')
      const ratingStr = ratings ? ` (${ratings[playerIdx]} vs ${ratings[1 - playerIdx]})` : ''
      setLog([{
        text: `Онлайн: ${myName} vs ${oppName}${ratingStr}${nextGame ? ' (следующая партия)' : ''}`,
        player: -1,
        time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }])

      if (state.currentPlayer === myColor) { setLocked(false); setInfo(t('game.place1')) }
      else { setLocked(true); setInfo(t('game.opponentTurn')) }
    }

    // ─── Входящий ход соперника ───
    function handleOnlineMove(action) {
      if (modeRef.current === 'spectate-online') return
      const myColorBefore = onlineRef.current?.myColor ?? 0
      const opponentColor = 1 - myColorBefore

      const prevState = gsRef.current
      const ns = applyAction(prevState, action)
      setGs(ns); gsRef.current = ns

      addLog(describeAction(action, opponentColor, t), opponentColor)
      moveHistoryRef.current.push({ action: { ...action }, player: opponentColor })

      if (action.swap) {
        ss()
        const newColor = 1 - myColorBefore
        if (onlineRef.current) onlineRef.current.myColor = newColor
        setHumanPlayer(newColor); setLocked(true); setInfo(t('game.swapOppDone'))
        return
      }

      if (action.transfer) st(); else sp()

      if (ns.gameOver) {
        setTimeout(() => {
          setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
          finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
          const myColor = onlineRef.current?.myColor ?? 0
          const won = ns.winner === myColor
          setTimeout(() => {
            won ? sw() : sl()
            if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) }
          }, 300)
        }, 500)
      } else {
        const myColor = onlineRef.current?.myColor ?? 0
        if (ns.currentPlayer === myColor) {
          setTimeout(() => {
            setLocked(false); setPhase('place'); setTransfer(null); setPlacement({})
            setInfo(ns.isFirstTurn() ? t('game.place1') : t('game.placeChips'))
            if (document.hidden) {
              startTitleBlink(t('game.yourTurnBlink'))
              showNotification(NOTIF_TITLE, t('game.yourTurnBlink'))
            }
          }, 300)
        } else {
          setLocked(true); setInfo(t('game.opponentTurn'))
        }
      }
    }

    // ─── Спектатор: входящий ход любого из игроков ───
    function handleSpectateMove(action) {
      if (modeRef.current !== 'spectate-online') return
      const prevState = gsRef.current
      const ns = applyAction(prevState, action)
      setGs(ns); gsRef.current = ns
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

    // ─── Вход в спектатор-режим ───
    function handleSpectateStart(detail) {
      const { players, gameState: gsData } = detail
      cancelRecording()
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
      setHumanPlayer(0); setMode('spectate-online'); setLocked(true)
      aiRunningRef.current = false; modeRef.current = 'spectate-online'
      setOnlinePlayers(players || [])
      onlineRef.current = { roomId: null, playerIdx: -1, myColor: 0 }
      moveHistoryRef.current = []
      setShowReplay(false)
      setInfo(`${(players || []).join(' vs ')} — ${t('game.watching')}`)
      setLog([{
        text: `⊙ ${(players || []).join(' vs ')}`, player: -1,
        time: new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }])
    }

    // ─── Противник сдался / ничья / время / gameOver от сервера ───
    function handleOnlineResign() {
      const myColor = onlineRef.current?.myColor ?? 0
      setResult(myColor); setPhase('done'); setLocked(false)
      setInfo(t('game.opponentResigned')); sw()
      showNotification(NOTIF_TITLE, t('game.opponentResigned'))
    }

    function handleDrawOffer() {
      setDrawOffered(true)
      showNotification(NOTIF_TITLE, t('game.drawOfferReceived'))
    }

    function handleDrawResponse(detail) {
      if (detail?.accepted) {
        setResult(-1); setPhase('done'); setLocked(false); setInfo(t('game.drawAgreed'))
      } else {
        setInfo(t('game.drawDeclined'))
      }
      setDrawOffered(false)
    }

    function handleServerGameOver(detail) {
      const { winner } = detail
      const myColor = onlineRef.current?.myColor ?? 0
      setResult(prev => {
        if (prev !== null) return prev
        const won = winner === (onlineRef.current?.playerIdx ?? 0)
        setTimeout(() => {
          won ? sw() : sl()
          if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) }
        }, 300)
        setPhase('done'); setLocked(false); setInfo(t('game.gameOver'))
        return winner >= 0 ? (winner === (onlineRef.current?.playerIdx ?? 0) ? myColor : 1 - myColor) : -1
      })
    }

    function handleTimeUp({ loser }) {
      const myIdx = onlineRef.current?.playerIdx ?? 0
      const won = loser !== myIdx
      setResult(won ? (onlineRef.current?.myColor ?? 0) : 1 - (onlineRef.current?.myColor ?? 0))
      setPhase('done'); setLocked(false)
      setInfo(won ? t('game.oppTimeUp') : t('game.timeUp'))
      setTimeout(() => {
        won ? sw() : sl()
        if (won) { setConfetti(true); setTimeout(() => setConfetti(false), 3000) }
      }, 300)
    }

    // ─── Регистрация всех обработчиков в GameContext ───
    const unsubs = [
      gameCtx.register('onOnlineStart', handleOnlineStart),
      gameCtx.register('onOnlineMove', (action, serverTime) => {
        handleOnlineMove(action)
        handleSpectateMove(action)
        if (serverTime && Array.isArray(serverTime)) {
          setPlayerTime([Math.round(serverTime[0]), Math.round(serverTime[1])])
        }
      }),
      gameCtx.register('onTimeUp', handleTimeUp),
      gameCtx.register('onOnlineResign', handleOnlineResign),
      gameCtx.register('onDrawOffer', handleDrawOffer),
      gameCtx.register('onDrawResponse', handleDrawResponse),
      gameCtx.register('onServerGameOver', handleServerGameOver),
      gameCtx.register('onRematchOffer', () => {
        setRematchOffered(true)
        showNotification(NOTIF_TITLE, t('game.rematchOffer'))
      }),
      gameCtx.register('onRematchDeclined', () => {
        setRematchPending(false); setInfo(t('game.rematchDeclined'))
      }),
      gameCtx.register('onReaction', ({ emoji }) => {
        setFloatingEmoji({ emoji, key: Date.now() })
        setTimeout(() => setFloatingEmoji(null), 2000)
      }),
      gameCtx.register('onSpectatorCount', ({ count }) => setSpectatorCount(count)),
      gameCtx.register('onSpectateStart', handleSpectateStart),
    ]

    return () => unsubs.forEach(u => u && u())
  }, [gameCtx]) // eslint-disable-line react-hooks/exhaustive-deps
}
