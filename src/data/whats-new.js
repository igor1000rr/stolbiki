/**
 * Список изменений для модалки «Что нового».
 * Синхронизирован с package.json через APP_VERSION.
 * Показывается один раз за версию (localStorage stolbiki_seen_version).
 */
export const WHATS_NEW = {
  ru: [
    'Golden Rush играбелен! Вкладка /goldenrush, hot-seat на одном устройстве для 4 игроков',
    'Два режима: 4-FFA или 2v2 (команды по диагонали 0+2 vs 1+3)',
    '9 стоек крестом: замкни линию (order 1 → 2), потом забери золотой центр за +15',
    'Transfer и placement — те же механики что в базовой игре, но с order-gate: stand 2 закроется только после stand 1',
    'Базовая 2-игровая игра с AlphaZero AI не затронута — новый режим живёт отдельно',
  ],
  en: [
    'Golden Rush is playable! Tab /goldenrush, hot-seat on a single device for 4 players',
    'Two modes: 4-FFA or 2v2 (teams across the diagonal 0+2 vs 1+3)',
    '9 stands in a cross: close your line (order 1 → 2), then claim the golden center for +15',
    'Transfer and placement — same mechanics as the base game, but with an order-gate: stand 2 closes only after stand 1',
    'The base 2-player game with AlphaZero AI is untouched — the new mode lives alongside it',
  ],
}
