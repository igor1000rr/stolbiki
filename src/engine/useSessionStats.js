/**
 * useSessionStats — сессионная статистика + mission tracking
 * Извлечён из Game.jsx для чистоты архитектуры
 *
 * Отслеживает: wins, losses, streak, loseStreak
 * Управляет: mission progress, first win celebration
 */

import { useState, useEffect, useRef } from 'react'
import * as API from './api'

export function useSessionStats({ result, mode, humanPlayer, difficultyRef, gs }) {
  const [sessionStats, setSessionStats] = useState({ wins: 0, losses: 0, streak: 0, loseStreak: 0 })
  const [firstWinCelebration, setFirstWinCelebration] = useState(false)
  const statsRef = useRef(sessionStats)
  statsRef.current = sessionStats

  useEffect(() => {
    if (result === null || result === -1) return
    const won = (mode === 'pvp') ? true : result === humanPlayer

    setSessionStats(prev => ({
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
      streak: won ? prev.streak + 1 : 0,
      loseStreak: won ? 0 : prev.loseStreak + 1,
    }))

    // Streak mission: при 3 победах подряд
    if (won && statsRef.current.streak + 1 >= 3 && API.isLoggedIn()) {
      API.missionProgress('streak_3').catch(() => {})
    }

    // First win celebration — один раз в жизни
    if (won && !localStorage.getItem('stolbiki_first_win')) {
      localStorage.setItem('stolbiki_first_win', '1')
      setTimeout(() => { setFirstWinCelebration(true); setTimeout(() => setFirstWinCelebration(false), 5000) }, 800)
    }

    // Mission progress tracking
    if (API.isLoggedIn()) {
      API.missionProgress('play_3').catch(() => {})
      API.missionProgress('play_5').catch(() => {})
      if (won) {
        API.missionProgress('win_1').catch(() => {})
        if (mode === 'ai' && difficultyRef?.current >= 200) API.missionProgress('win_ai_hard').catch(() => {})
      }
      if (mode === 'online') API.missionProgress('play_online').catch(() => {})
      if (gs && (0 in gs.closed) && gs.closed[0] === humanPlayer) API.missionProgress('close_golden').catch(() => {})
    }
  }, [result]) // eslint-disable-line

  return { sessionStats, firstWinCelebration, setFirstWinCelebration }
}
