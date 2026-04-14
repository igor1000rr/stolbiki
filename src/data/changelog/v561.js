export default {
  version: '5.6.1',
  date: '2026-04-14',
  title_ru: 'Багфиксы по архитектурному аудиту',
  title_en: 'Audit bug fixes',
  changes_ru: [
    { type: 'fix', text: 'Push-уведомления вели на старый домен — исправлено' },
    { type: 'fix', text: '/api/auth/refresh принимал JWT без exp — добавлена проверка' },
    { type: 'fix', text: 'sendPushTo молча глушил не-404/410 ошибки — теперь логируются' },
    { type: 'fix', text: 'Victory City 3D: TDZ при раннем клике до окончания intro' },
    { type: 'fix', text: 'Matchmaking: комнаты из findMatch теперь имеют room.created' },
    { type: 'fix', text: 'Middleware: LRU-чистка lastSeenCache' },
    { type: 'perf', text: 'Bricks: удалены дублирующие ALTER TABLE' },
  ],
  changes_en: [
    { type: 'fix', text: 'Push notifications pointed to old domain — fixed' },
    { type: 'fix', text: '/api/auth/refresh accepted JWTs without exp — added check' },
    { type: 'fix', text: 'sendPushTo silenced non-404/410 errors — now logged' },
    { type: 'fix', text: 'Victory City 3D: TDZ on early click before intro finished' },
    { type: 'fix', text: 'Matchmaking: findMatch rooms now have room.created' },
    { type: 'fix', text: 'Middleware: LRU cleanup for lastSeenCache' },
    { type: 'perf', text: 'Bricks: removed duplicate ALTER TABLE' },
  ],
}
