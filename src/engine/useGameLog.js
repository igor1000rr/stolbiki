/**
 * useGameLog — хук для лога ходов
 * Управляет массивом записей, авто-скроллом и форматированием времени
 */

import { useState, useRef, useEffect, useCallback } from 'react'

export function useGameLog(lang = 'ru') {
  const [log, setLog] = useState([])
  const logRef = useRef(null)

  // Авто-скролл при новой записи
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0
  }, [log])

  const timeStr = useCallback(() => {
    return new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [lang])

  const addLog = useCallback((text, player) => {
    setLog(prev => [{ text, player, time: timeStr() }, ...prev])
  }, [timeStr])

  const resetLog = useCallback((text, player = -1) => {
    setLog([{ text, player, time: timeStr() }])
  }, [timeStr])

  return { log, setLog, addLog, resetLog, logRef }
}
