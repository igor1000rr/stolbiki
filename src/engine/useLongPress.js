import { useRef, useCallback } from 'react'

/**
 * Хук длинного нажатия (long-press) на pointer events.
 * Работает одинаково на тач-экране и мыши.
 *
 * @param {Function} onLongPress - колбэк при срабатывании (получает payload, event)
 * @param {Object}   opts
 * @param {number}   opts.delay         - задержка в мс (по умолчанию 500)
 * @param {number}   opts.moveTolerance - допуск сдвига пальца в пикселях (по умолчанию 10)
 * @returns {(payload?: any) => Object} - фабрика props для целевого элемента
 */
export function useLongPress(onLongPress, { delay = 500, moveTolerance = 10 } = {}) {
  const timerRef = useRef(null)
  const startPosRef = useRef(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPosRef.current = null
  }, [])

  return useCallback((payload) => ({
    onPointerDown: (e) => {
      // Только основная кнопка мыши / касание
      if (e.button !== undefined && e.button !== 0) return
      firedRef.current = false
      startPosRef.current = { x: e.clientX, y: e.clientY }
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        onLongPress?.(payload, e)
        timerRef.current = null
      }, delay)
    },
    onPointerMove: (e) => {
      if (!startPosRef.current) return
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y
      if (dx * dx + dy * dy > moveTolerance * moveTolerance) clear()
    },
    onPointerUp: () => clear(),
    onPointerLeave: () => clear(),
    onPointerCancel: () => clear(),
    // Подавляем click, который браузер пошлёт после long-press,
    // чтобы он не сработал как обычный тап по стойке.
    onClickCapture: (e) => {
      if (firedRef.current) {
        e.stopPropagation()
        e.preventDefault()
        firedRef.current = false
      }
    },
  }), [onLongPress, delay, moveTolerance, clear])
}
