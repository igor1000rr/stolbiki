/**
 * Конфигурация платформы — web vs native (Capacitor)
 * В Capacitor файлы грузятся локально, API/WS нужны абсолютные URL
 */

const SERVER = import.meta.env.VITE_SERVER_URL || 'https://snatch-highrise.com'

export const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

/** Базовый URL для API: '/api' на вебе, 'https://snatch-highrise.com/api' в приложении */
export const API_BASE = isNative ? `${SERVER}/api` : '/api'

/** WebSocket URL */
export function getWsBase() {
  if (isNative) return SERVER.replace(/^http/, 'ws') + '/ws'
  return (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws'
}
