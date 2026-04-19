export default {
  version: '5.9.6',
  date: '2026-04-19',
  title_ru: 'Golden Rush: админка, туториал, rate limit',
  title_en: 'Golden Rush: admin panel, tutorial, rate limit',
  changes_ru: [
    { type: 'new', text: 'В админку /admin добавлен таб Golden Rush: live-комнаты с индикаторами online, очередь матчмейкинга, топ-10 игроков, последние 20 матчей и playtest-сводка (resign-rate, draws, center captures, avg turns, avg duration). Автообновление 10с.' },
    { type: 'new', text: '4-шаговый туториал-overlay при первом визите /goldenrush-online: крест из 9 стоек, order-gate (сначала 1, потом 2), FIFO-очередь на центр, очки и награды. Сохраняется флаг stolbiki_gr_tutorial_seen, из лобби можно вызвать повторно кнопкой «Как играть».' },
    { type: 'security', text: 'Rate limit на gr.findMatch: не чаще чем раз в 2с на пользователя. Защита от спама очереди при баге клиента или намеренной атаке. На клиенте показывается сообщение «слишком часто, подожди секунду».' },
    { type: 'improve', text: 'findMatchLastAt чистится в cleanupGoldenRush каждые 2 минуты — не даёт Map разрастаться.' },
  ],
  changes_en: [
    { type: 'new', text: 'New Golden Rush tab in /admin: live rooms with online indicators, matchmaking queue, top-10 players, last 20 matches, plus a playtest summary (resign-rate, draws, center captures, avg turns, avg duration). Auto-refreshes every 10s.' },
    { type: 'new', text: '4-step tutorial overlay on first visit to /goldenrush-online: the 9-stand cross, order-gate (close 1 before 2), FIFO queue for the center, scoring and rewards. Saves a flag stolbiki_gr_tutorial_seen. Can be replayed from the lobby via the «How to play» button.' },
    { type: 'security', text: 'Per-user rate limit on gr.findMatch: at most once every 2s. Protects the queue from client bugs or intentional spam. The client shows «too many requests, wait a moment».' },
    { type: 'improve', text: 'findMatchLastAt is cleaned up in cleanupGoldenRush every 2 minutes to prevent the Map from growing indefinitely.' },
  ],
}
