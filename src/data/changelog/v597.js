export default {
  version: '5.9.7',
  date: '2026-04-20',
  title_ru: 'Чистка линтера: 0 errors, 0 unused-vars',
  title_en: 'Lint cleanup: 0 errors, 0 unused-vars',
  changes_ru: [
    { type: 'refactor', text: 'Убраны все 17 предупреждений no-unused-vars по проекту (9 файлов: Game, GameHighlightReel, GoldenRushLeaderboard, Online, Changelog, SeasonPass, Profile, server/server.js, server/routes/games.js). Мёртвые функции и переменные удалены, неиспользуемые деструктуризации заменены на [ , setter], dormant-функция startDaily переименована в _startDaily.' },
    { type: 'refactor', text: 'Из Profile.jsx убран избыточный комментарий // eslint-disable-line — правило больше не срабатывает после чистки зависимостей useEffect.' },
    { type: 'improve', text: 'Lint gate в CI теперь проходит с 0 errors и 0 no-unused-vars warnings. Остаются только 55 warnings из react-hooks/react-refresh — они требуют отдельного архитектурного рефакторинга и не блокируют сборку.' },
  ],
  changes_en: [
    { type: 'refactor', text: 'Cleared all 17 no-unused-vars warnings across the project (9 files: Game, GameHighlightReel, GoldenRushLeaderboard, Online, Changelog, SeasonPass, Profile, server/server.js, server/routes/games.js). Dead functions and vars removed, unused destructuring replaced with [ , setter], dormant startDaily renamed to _startDaily.' },
    { type: 'refactor', text: 'Removed the obsolete // eslint-disable-line comment from Profile.jsx — the rule no longer triggers after the useEffect deps cleanup.' },
    { type: 'improve', text: 'CI lint gate now passes with 0 errors and 0 no-unused-vars warnings. The remaining 55 warnings are all react-hooks / react-refresh and need a separate architectural refactor — they do not block the build.' },
  ],
}
