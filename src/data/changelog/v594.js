export default {
  version: '5.9.4',
  date: '2026-04-17',
  title_ru: 'Golden Rush Online: фиксы edge cases + мониторинг',
  title_en: 'Golden Rush Online: edge case fixes + monitoring',
  changes_ru: [
    { type: 'fix', text: 'GR Online: после gameover клиент больше не пытается reconnect’иться в удалённую комнату (раньше спустя 5+ минут показывал ложный error-баннер)' },
    { type: 'fix', text: 'GR Online: auto-reconnect теперь строго в статусах playing/queued. gr.error: no_room на мертвой комнате игнорируется' },
    { type: 'new', text: '20+ server-side unit-тестов на validateAction: structural checks, transfer cap, placement (too_many_stands, bad_idx/count, over_cap, over_max, closed stand), combined transfer+placement с post-transfer state check' },
    { type: 'new', text: 'Админ-endpoint GET /api/admin/golden-rush: live-комнаты с турн-счётчиками, online-статусами игроков, lastActivity; очередь матчмейкинга с waitTime' },
    { type: 'new', text: 'GR блок в /api/health и /api/stats: {rooms, queue, activeGames} для мониторинга нагрузки в реал-тайм' },
    { type: 'improve', text: '/api/admin/overview и /api/admin/server теперь показывают GR stats наряду с 2p-метриками' },
  ],
  changes_en: [
    { type: 'fix', text: 'GR Online: client no longer tries to reconnect to a deleted room after gameover (used to show a false error banner 5+ minutes later)' },
    { type: 'fix', text: 'GR Online: auto-reconnect is now strict to playing/queued statuses. gr.error: no_room on a dead room is ignored silently' },
    { type: 'new', text: '20+ server-side unit tests for validateAction: structural checks, transfer cap, placement (too_many_stands, bad_idx/count, over_cap, over_max, closed stand), combined transfer+placement with post-transfer state check' },
    { type: 'new', text: 'Admin endpoint GET /api/admin/golden-rush: live rooms with turn counters, player online status, lastActivity; matchmaking queue with waitTime' },
    { type: 'new', text: 'GR block in /api/health and /api/stats: {rooms, queue, activeGames} for real-time load monitoring' },
    { type: 'improve', text: '/api/admin/overview and /api/admin/server now expose GR stats alongside 2p metrics' },
  ],
}
