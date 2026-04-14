/**
 * Список изменений для модалки "Что нового".
 * Синхронизирован с версией в package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    '🚨 КРИТИЧНО: исправлена верификация для игроков за красный цвет — все ваши победы теперь засчитываются',
    '🛡 Сервер: удалён dead-code дубль POST /api/training без anti-cheat и rate limit',
  ],
  en: [
    '🚨 CRITICAL: fixed winner verification for red-side players — all your wins now count',
    '🛡 Server: removed dead-code POST /api/training duplicate without anti-cheat and rate limit',
  ],
}
