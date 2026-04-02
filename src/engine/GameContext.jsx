/**
 * GameContext — общий контекст для кросс-компонентного взаимодействия
 * Заменяет window.stolbikiRecordGame, window.stolbikiOnAchievement, и т.д.
 */

import { createContext, useContext, useCallback, useRef } from 'react'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  // Коллбэки регистрируются компонентами и вызываются другими
  const callbacks = useRef({
    recordGame: null,
    onAchievement: null,
    onRatingDelta: null,
    checkAdmin: null,
    // Онлайн-события (Online → Game)
    onOnlineStart: null,
    onOnlineMove: null,
    onOnlineResign: null,
    onDrawOffer: null,
    onDrawResponse: null,
    onServerGameOver: null,
    onRematchOffer: null,
    onRematchDeclined: null,
    onSpectateStart: null,
    onDailyStart: null,
  })

  const register = useCallback((name, fn) => {
    callbacks.current[name] = fn
    return () => { callbacks.current[name] = null }
  }, [])

  const emit = useCallback((name, ...args) => {
    const fn = callbacks.current[name]
    if (fn) fn(...args)
  }, [])

  return (
    <GameContext.Provider value={{ register, emit }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  return useContext(GameContext)
}

/**
 * Хук для регистрации обработчика (вместо window.addEventListener)
 * Автоматически убирает при unmount
 */
export function useGameEvent(name, handler) {
  const ctx = useContext(GameContext)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  // Регистрируем при mount, убираем при unmount
  // Используется в useEffect вызывающего компонента
  const register = useCallback(() => {
    if (!ctx) return () => {}
    return ctx.register(name, (...args) => handlerRef.current?.(...args))
  }, [ctx, name])

  return register
}
