/**
 * Список изменений для модалки «Что нового».
 * Синхронизирован с package.json через APP_VERSION.
 */
export const WHATS_NEW = {
  ru: [
    'Golden Rush Online теперь даёт кирпичи: +10 за победу, +3 за захват центра, +2 за участие',
    'История матчей сохраняется в БД — посмотреть свои 50 последних матчей с флагом победа/поражение можно через /api/gr/my',
    'Лидерборд игроков по 3 метрикам: победы, матчи, захваты центра (/api/gr/leaderboard)',
    'Блок Golden Rush на Landing: новые пользователи видят режим сразу на главной',
    'Счётчики gr_games/gr_wins/gr_center_captures в профиле для будущих ачивок',
  ],
  en: [
    'Golden Rush Online now pays bricks: +10 for a win, +3 for claiming the center, +2 for participation',
    'Match history is saved to the database — see your last 50 matches with win/loss flags via /api/gr/my',
    'Player leaderboard across 3 metrics: wins, games, center captures (/api/gr/leaderboard)',
    'Golden Rush block on Landing: new users see the mode right on the home page',
    'gr_games/gr_wins/gr_center_captures counters in profile for future achievements',
  ],
}
