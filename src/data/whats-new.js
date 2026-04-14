/**
 * Список изменений для модалки «Что нового».
 * Синхронизирован с package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    'Арена: исправлены 4 race condition — двойное начисление рейтинга, XP, генерация раундов',
    'Dual-report лечится атомарным UPDATE — второй игрок получает 409 без изменений',
    'Первый раунд Арены: Fisher-Yates shuffle вместо arr.sort(random) для честного распределения',
    'XP top-3 больше не может начислиться дважды в финальном раунде',
  ],
  en: [
    'Arena: 4 race conditions fixed — double rating/XP credit, duplicate round generation',
    'Dual-report healed by atomic UPDATE — second player gets 409 with no side effects',
    'First round of Arena: Fisher-Yates shuffle instead of arr.sort(random) for fair pairings',
    'Top-3 XP can no longer be credited twice in the final round',
  ],
}
