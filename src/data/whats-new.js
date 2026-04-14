/**
 * Список изменений для модалки "Что нового".
 * Синхронизирован с версией в package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    '🏆 Рарность ачивок: живой % держателей + тир (legendary/epic/rare/common) из /api/achievements/rarity',
    '📊 Бейдж рядом с каждой ачивкой показывает сколько игроков её получили',
    '🔔 Уведомления: title и tag теперь под актуальным брендом (финал ребрендинга snatch→highrise)',
    '🧹 Chat rate-limit: LRU-защита от memory leak при всплеске уникальных userId',
    '⚙️ Кэш rarity 5 мин на сервере и клиенте — не бьёт по API из каждого бейджа',
  ],
  en: [
    '🏆 Achievement rarity: live % of holders + tier (legendary/epic/rare/common) via /api/achievements/rarity',
    '📊 Badge next to each achievement shows how many players unlocked it',
    '🔔 Notifications: title and tag now use current brand (final rebrand cleanup)',
    '🧹 Chat rate-limit: LRU protection against memory leak on unique userId spike',
    '⚙️ Rarity cache 5 min on server + client — one request per tab, not per badge',
  ],
}
