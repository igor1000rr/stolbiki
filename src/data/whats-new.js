/**
 * Список изменений для модалки "Что нового".
 * Синхронизирован с версией в package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    '🔧 Push-уведомления: фикс домена — клик по уведомлению ведёт на highriseheist.com',
    '🛡 Backend: защита от мусорных JWT в /api/auth/refresh',
    '📊 Push: не-404/410 ошибки теперь видны в error_reports',
    '⚙️ Service Worker: упрощён activate, корректная очистка старых кешей',
    '🏗 Victory City: фикс TDZ при раннем клике до окончания intro-анимации',
    '🧹 Серверная очистка памяти: LRU для lastSeenCache в middleware',
  ],
  en: [
    '🔧 Push notifications: domain fix — clicking now opens highriseheist.com',
    '🛡 Backend: protection against malformed JWTs in /api/auth/refresh',
    '📊 Push: non-404/410 errors now visible in error_reports',
    '⚙️ Service Worker: simplified activate, correct old cache cleanup',
    '🏗 Victory City: TDZ fix for early clicks during intro animation',
    '🧹 Server memory cleanup: LRU for lastSeenCache in middleware',
  ],
}
