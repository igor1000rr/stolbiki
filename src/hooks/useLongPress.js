import { useRef, useCallback, useState } from 'react'

/**
 * Хук жестового долгого нажатия.
 * onClick вызывается только если long press НЕ сработал.
 * Возвращает { pressing, handlers } — pressing=true пока идёт удержание.
 *
 * moveTolerance — максимальный сдвиг пальца (px) до отмены (по умолчанию 10).
 * Это решает проблему случайных отмен при небольшом смещении на тачскрине.
 *
 * @param {Function|null} onLongPress
 * @param {Function|null} onClick
 * @param {{ delay?: number, moveTolerance?: number }} options
 */
export function useLongPress(onLongPress, onClick, { delay = 500, moveTolerance = 10 } = {}) {
  const timerRef = useRef(null)
  const triggeredRef = useRef(false)
  const touchStartRef = useRef(null)
  const [pressing, setPressing] = useState(false)

  const start = useCallback(() => {
    triggeredRef.current = false
    setPressing(true)
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true
      setPressing(false)
      onLongPress?.()
    }, delay)
  }, [onLongPress, delay])

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
    setPressing(false)
    touchStartRef.current = null
  }, [])

  const handleClick = useCallback(() => {
    if (!triggeredRef.current) {
      onClick?.()
    }
    triggeredRef.current = false
  }, [onClick])

  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    start()
  }, [start])

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > moveTolerance) {
      cancel()
    }
  }, [cancel, moveTolerance])

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(timerRef.current)
    setPressing(false)
    touchStartRef.current = null
    if (triggeredRef.current) {
      // Подавляем синтезированный click после long press
      e.preventDefault()
      triggeredRef.current = false
    }
  }, [])

  return {
    pressing,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onClick: handleClick,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchMove,
      onContextMenu: (e) => e.preventDefault(),
    },
  }
}
