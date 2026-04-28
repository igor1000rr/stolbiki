import { useCallback, useRef, useEffect } from 'react'
import { mctsSearch } from '../engine/ai'
import { isGpuReady } from '../engine/neuralnet'
import { applyAction } from '../engine/game'
import { recordMove, finishRecording } from '../engine/collector'
import { describeAction } from '../components/ReplayViewer'
import * as API from '../engine/api'
import { maybeShowInterstitial } from '../engine/admob'

/**
 * Хук, инкапсулирующий всю логику хода AI.
 */
export function useAiRunner({
  aiRunningRef, modeRef, difficultyRef, modifiersRef, moveHistoryRef,
  setGs, setPhase, setResult, setInfo, setLocked,
  setAiThinking, setTransfersLeft, setConfetti, setTournament,
  setTransfer, setPlacement,
  addLog,
  humanPlayer, difficulty,
  soundWin: sw, soundLose: sl,
  gameCtx, tournament, t,
  saveBuildingOnWin,
}) {
  // Ref для рекурсивного вызова runAi из вложенного setTimeout.
  const runAiRef = useRef(null)
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const runAi = useCallback((state) => {
    if (aiRunningRef.current || state.gameOver) return
    if (modeRef.current === 'online') return
    aiRunningRef.current = true; setAiThinking(true); setLocked(true); setInfo(t('game.aiThinking'))
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
          aiRunningRef.current = false
          setTransfersLeft(modifiersRef.current?.doubleTransfer ? 2 : 1)
          if (ns.gameOver) {
            setTimeout(() => {
              setResult(ns.winner); setPhase('done'); setInfo(t('game.gameOver')); setLocked(false)
              finishRecording(ns.winner, [ns.countClosed(0), ns.countClosed(1)])
              saveBuildingOnWin(ns)
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
              if (!isSpectate) maybeShowInterstitial(3)
            }, 800)
            return
          }
          if (ns.currentPlayer !== humanPlayer || modeRef.current === 'spectate') {
            setTimeout(() => runAiRef.current?.(ns), modeRef.current === 'spectate' ? 1200 : 600)
            return
          }
          /* По ТЗ Александра (28.04.2026, Проблема 1): «Ход противника
             происходит быстро, непонятно». Увеличена пауза после хода AI
             с 500 до 1300мс — это даёт подсветке стоек (recentAction
             в Board.jsx, длится 1200мс) полностью отыграть, чтобы игрок
             успел заметить «откуда → куда» (для переноса) или цвет
             установки. */
          setTimeout(() => {
            setLocked(false); setPhase('place'); setTransfer(null); setPlacement({})
            setInfo(ns.isFirstTurn() ? t('game.place1') : t('game.clickStands'))
          }, 1300)
        }, 300)
      }, remaining)
    }, 50)
  }, [difficulty, humanPlayer]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/preserve-manual-memoization */

  useEffect(() => { runAiRef.current = runAi }, [runAi])

  return runAi
}
