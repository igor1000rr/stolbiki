/**
 * Список изменений для модалки «Что нового».
 * Синхронизирован с package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    'Большая уборка безопасности: закрыты все известные дыры через которые можно было накрутить лидерборд',
    'Таймер в онлайн-матчах теперь тикает в реальном времени: если оппонент ушёл — автопобеда по времени',
    'Фильтр мата в чате второго поколения: ловит латинские подмены, zero-width символы и склонения',
    'Бриксы за рекламу теперь через AdMob SSV — Google сам подписывает callback, фармить curlом больше нельзя',
    'Админские действия логируются в audit-таблицу — видно кто что менял, когда и с какого IP',
  ],
  en: [
    'Big security sweep: all known leaderboard-inflation exploits are closed',
    'The online match timer now ticks in real time: if the opponent leaves — auto-win on timeout',
    'Chat profanity filter v2: catches Latin look-alikes, zero-width characters and word forms',
    'Rewarded-ad bricks now go through AdMob SSV — Google signs the callback itself, curl farming is blocked',
    'Admin actions are logged to an audit table — you can see who changed what, when, and from which IP',
  ],
}
