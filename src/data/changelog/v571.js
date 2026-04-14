export default {
  version: '5.7.1',
  date: '2026-04-15',
  title_ru: 'Hotfix: победы за красный цвет + dead-code cleanup',
  title_en: 'Hotfix: red-side wins + dead-code cleanup',
  changes_ru: [
    { type: 'fix', text: 'Критично: POST /api/games верифицировал winner как v.winner === 0 — все партии игроков за красный (цвет 1) отвергались с 400. Теперь принимаем humanColor в payload' },
    { type: 'fix', text: 'SECURITY: удалён dead-code дубль POST /api/training в social.js (не имел rateLimit и walkMoves)' },
    { type: 'perf', text: 'games.js: legacy fallback без humanColor сохраняет обратную совместимость' },
  ],
  changes_en: [
    { type: 'fix', text: 'CRITICAL: POST /api/games verified winner as v.winner === 0 — all red-side (color 1) player games were rejected with 400. Now accepting humanColor in payload' },
    { type: 'fix', text: 'SECURITY: removed dead-code POST /api/training duplicate in social.js (had no rateLimit or walkMoves)' },
    { type: 'perf', text: 'games.js: legacy fallback without humanColor keeps backward compatibility' },
  ],
}
