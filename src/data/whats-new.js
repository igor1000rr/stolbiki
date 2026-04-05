/**
 * Список изменений для модалки "Что нового".
 * Синхронизирован с версией в package.json через APP_VERSION.
 * Обновляется при каждом релизе.
 */
export const WHATS_NEW = {
  ru: [
    'Новый favicon — золотой SH на синем',
    'WebSocket reconnect: возврат в партию после разрыва связи',
    'AuthContext: единый источник auth-состояния',
    'Token revocation: админ может отозвать все токены юзера',
    'Раздельные WS rate limits: спам в чате не ломает геймплей',
    'APP_VERSION автоматически из package.json',
    'SQL injection fix в admin analytics',
    'GitHub Actions → v5 (Node 24)',
  ],
  en: [
    'New favicon — golden SH on blue',
    'WebSocket reconnect: return to game after disconnect',
    'AuthContext: single source of auth state',
    'Token revocation: admin can revoke all user tokens',
    'Split WS rate limits: chat spam no longer breaks gameplay',
    'APP_VERSION auto-injected from package.json',
    'SQL injection fix in admin analytics',
    'GitHub Actions → v5 (Node 24)',
  ],
}
