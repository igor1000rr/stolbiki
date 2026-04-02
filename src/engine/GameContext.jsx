/**
 * GameContext — общий EventEmitter для кросс-компонентного взаимодействия
 * Поддерживает несколько слушателей на одно событие.
 * Заменяет все window.dispatchEvent(new CustomEvent(...)) между компонентами.
 *
 * Использование:
 *   const gameCtx = useGameContext()
 *   // Подписка (возвращает функцию отписки):
 *   useEffect(() => gameCtx?.on('onOnlineStart', handler), [gameCtx])
 *   // Эмит:
 *   gameCtx.emit('onOnlineStart', payload)
 */

import { createContext, useContext, useCallback, useRef } from 'react'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  // Map<string, Set<Function>> — несколько слушателей на событие
  const listeners = useRef(new Map())

  /** Подписаться на событие. Возвращает функцию отписки. */
  const on = useCallback((name, fn) => {
    if (!listeners.current.has(name)) {
      listeners.current.set(name, new Set())
    }
    listeners.current.get(name).add(fn)
    return () => {
      const set = listeners.current.get(name)
      if (set) {
        set.delete(fn)
        if (set.size === 0) listeners.current.delete(name)
      }
    }
  }, [])

  /** Backward-compat alias: register = on */
  const register = on

  /** Вызвать все слушатели события */
  const emit = useCallback((name, ...args) => {
    const set = listeners.current.get(name)
    if (set) {
      for (const fn of set) {
        try { fn(...args) } catch (e) { console.error(`[GameContext] ${name}:`, e) }
      }
    }
  }, [])

  return (
    <GameContext.Provider value={{ on, register, emit }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  return useContext(GameContext)
}
