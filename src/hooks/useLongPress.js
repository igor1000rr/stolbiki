import { useRef, useCallback, useState } from 'react'

/**
 * Хук жестового долгого нажатия.
 * onClick вызывается только если long press НЕ сработал.
 * Возвращает { pressing, handlers } — pressing=true пока идёт удержание.
 *
 * @param {Function|null} onLongPress - колбэк при долгом нажатии
 * @param {Function|null} onClick - колбэк при обычном клике
 * @param {{ delay?: number }} options
 */
export function useLongPress(onLongPress, onClick, { delay = 500 } = {}) {
  const timerRef = useRef(null)
  const triggeredRef = useRef(false)
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
  }, [])

  const handleClick = useCallback(() => {
    if (!triggeredRef.current) {
      onClick?.()
    }
    triggeredRef.current = false
  }, [onClick])

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(timerRef.current)
    setPressing(false)
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
      onTouchStart: start,
      onTouchEnd: handleTouchEnd,
      onTouchMove: cancel,
      onContextMenu: (e) => e.preventDefault(),
    },
  }
}
