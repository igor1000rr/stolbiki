/**
 * Список изменений для модалки "Что нового".
 * Синхронизирован с версией в package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    '🏆 Achievement Rarity доведен до 100%: rarity-бейджи с tier-рамкой теперь и в публичных профилях',
    '📝 Фикс критичного бага в блоге: pin на последний релиз больше не перезаписывается на старый при рестарте',
    '🔒 Admin: при удалении юзера но чистятся все таблицы (GDPR) — раньше оставались orphan-записи',
    '🛡 Puzzle Rush: ачивки rush_5/rush_15 разблокируются сразу, без задержки + защита от XP-фарма',
    '✏️ Admin API: редактирование блог-постов по PUT /api/blog/:slug теперь работает (был SQLite syntax error)',
  ],
  en: [
    '🏆 Achievement Rarity 100% done: rarity badges with tier border now also on public profiles',
    '📝 Blog critical fix: pin on latest release no longer gets overwritten to old post on restart',
    '🔒 Admin: user deletion now cleans ALL tables (GDPR) — previously left orphan records',
    '🛡 Puzzle Rush: rush_5/rush_15 achievements unlock instantly, no delay + XP-farm protection',
    '✏️ Admin API: editing blog posts via PUT /api/blog/:slug now works (was SQLite syntax error)',
  ],
}
