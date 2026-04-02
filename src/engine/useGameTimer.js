/**
 * useGameTimer — хук для управления таймерами партии
 * Извлечён из Game.jsx для чистоты архитектуры
 *
 * Управляет:
 * - elapsed: время с начала партии (секунды)
 * - playerTime: [p0_time, p1_time] (секунды, для блиц/рапид)
 * - timeUp callback при истечении
 */

import { useState, useEffect, useRef } from 'react'

const TIMER_LIMITS = { off: 0, blitz: 180, rapid: 600, classical: 1800 }

export function useGameTimer({ timerSetting, gameOver, currentPlayer, humanPlayer, locked, aiRunning, onTimeUp, onTick }) {
  const timerLimit = TIMER_LIMITS[timerSetting] || 0
  const [playerTime, setPlayerTime] = useState([0, 0])
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState(Date.now())

  // Сброс таймеров
  function resetTimers() {
    setStartTime(Date.now())
    setElapsed(0)
    if (timerLimit) setPlayerTime([timerLimit, timerLimit])
  }

  // Elapsed timer
  useEffect(() => {
    if (gameOver) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startTime, gameOver])

  // Player timer (blitz/rapid)
  useEffect(() => {
    if (!timerLimit || gameOver || locked || aiRunning) return
    const cp = currentPlayer
    const iv = setInterval(() => {
      setPlayerTime(prev => {
        const next = [...prev]
        next[cp] = Math.max(0, prev[cp] - 1)
        // Тиканье при <10с
        if (next[cp] <= 10 && next[cp] > 0 && cp === humanPlayer && onTick) onTick()
        if (next[cp] <= 0 && onTimeUp) onTimeUp(cp)
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [timerLimit, gameOver, currentPlayer, locked, aiRunning, humanPlayer]) // eslint-disable-line

  return {
    timerLimit,
    playerTime, setPlayerTime,
    elapsed,
    startTime,
    resetTimers,
    TIMER_LIMITS,
  }
}
