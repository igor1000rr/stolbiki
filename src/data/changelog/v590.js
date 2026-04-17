export default {
  version: '5.9.0',
  date: '2026-04-17',
  title_ru: 'Большая уборка безопасности: антибайпас лидербордов, транзакции, AdMob SSV',
  title_en: 'Big security sweep: leaderboard antibypass, transactions, AdMob SSV',
  changes_ru: [
    // ─── Критичные закрытия дыр ───
    { type: 'security', text: 'POST /api/buildings теперь проверяет недавнюю верифицированную победу (games row за 120 сек) и берёт is_ai/ai_difficulty/result ИЗ СЕРВЕРА. Раньше любой curl мог создать здание максимального веса и за 10 минут выйти в Hall of Fame top-20' },
    { type: 'security', text: 'UNIQUE индекс на victory_buildings.game_id: одна победа = одно здание, дубль невозможен' },
    { type: 'security', text: 'POST /api/bricks/purchase обёрнут в db.transaction() с INSERT OR IGNORE первым — закрыт TOCTOU race, при котором два параллельных запроса списывали бриксы дважды за один скин' },
    { type: 'security', text: 'AdMob Server-Side Verification (SSV): реальная ECDSA P-256 SHA-256 проверка подписи Google в новом endpoint GET /api/bricks/admob-ssv. Больше нельзя curlать по 100 бриксов в день через /award-rewarded когда включен ADMOB_SSV_ENABLED=1' },
    { type: 'security', text: 'Transaction_id uniqueness + timestamp freshness (≤1ч) в SSV callback — replay protection' },
    { type: 'security', text: 'POST /api/bp/quests/:id/claim: UPDATE reward_claimed + начисление бриксов + INSERT brick_transactions — всё в одной транзакции. Раньше при краше сервера игрок мог потерять награду навсегда' },
    { type: 'security', text: 'awardBricks() обёрнут в db.transaction() — UPDATE баланса и INSERT brick_transactions больше не могут разъехаться' },
    { type: 'security', text: 'WS handleServerGameOver: UPDATE bricks + INSERT brick_transactions за online-победу в одной транзакции' },
    { type: 'security', text: 'Clubs create/join/leave/kick: все операции в db.transaction() + UNIQUE индекс на club_members.user_id. Игрок может быть только в одном клубе, member_count всегда совпадает с реальным COUNT(*)' },
    { type: 'security', text: 'Owner клуба больше не может разжаловать сам себя в member — закрыт баг с клубом без владельца' },
    { type: 'security', text: 'Фильтр чата v2: NFKC-нормализация + удаление zero-width + маппинг латинских confusables в кириллицу + stem-based matching. Раньше обходился за 5 сек (хyй с латинской y, х.у.й, zero-width между букв)' },

    // ─── Игровой флоу ───
    { type: 'improve', text: 'Global timer tick в WS-сервере (1 сек): таймер теперь тикает в реальном времени во всех комнатах. Раньше если оппонент уходил offline, его время не текло — теперь автопобеда при timeout' },
    { type: 'improve', text: 'Rematch и следующая турнирная партия: корректный сброс playerTime и lastMoveTime для новой игры' },
    { type: 'improve', text: 'Push-уведомления: ошибки отправки теперь логируются в console.warn (раньше .catch(() => {}) съедал всё)' },

    // ─── Наблюдаемость и админка ───
    { type: 'new', text: 'Таблица admin_audit + новый endpoint GET /api/admin/audit: все критичные админ-действия (изменение юзеров, мут, ресет пароля, удаление контента и тд) теперь пишутся в аудит-лог с metadata, IP, админом и timestamp' },
    { type: 'new', text: 'AdMob SSV-callback GET /api/bricks/admob-ssv: 7 слоёв проверки — подпись, timestamp, ad_unit, user exists, transaction_id unique, reward clamp, daily limit' },
    { type: 'new', text: 'workflow_dispatch в GitHub Actions deploy: ручной ре-деплой из UI с inputs (skip_tests, reason) — быстрый hotfix-редеплой без ждания тестов' },

    // ─── Производительность и валидация ───
    { type: 'perf', text: 'PUT /api/admin/users/:id теперь async: bcrypt.hash вместо hashSync при reset_password — не блокирует event loop на ~70ms' },
    { type: 'perf', text: 'GET /api/admin/training/export-gpu: лимит по байтам ответа (default 50MB, max 200MB) + флаг truncated. Раньше мог вернуть 500MB и убить память сервера' },
    { type: 'improve', text: 'GET /api/bricks/history: limit теперь clamp’ится через Math.max(1, ...) — закрыта SQLite спецсемантика LIMIT -1 (все строки)' },
    { type: 'improve', text: 'UTC-даты в getDailySeed() и ensureCurrentSeason() — клиенты в разных часовых поясах больше не видят разные daily-сиды в полночь UTC' },
    { type: 'improve', text: 'Battle Pass сезоны: старт/конец месяца теперь по UTC, не по локальной TZ сервера' },
  ],
  changes_en: [
    // ─── Critical closures ───
    { type: 'security', text: 'POST /api/buildings now cross-checks a recent verified win (games row within 120s) and takes is_ai/ai_difficulty/result FROM THE SERVER. Previously any curl could create a max-weight building and reach the Hall of Fame top-20 within 10 minutes' },
    { type: 'security', text: 'UNIQUE index on victory_buildings.game_id: one win = one building, duplicates impossible' },
    { type: 'security', text: 'POST /api/bricks/purchase wrapped in db.transaction() with INSERT OR IGNORE first — closed the TOCTOU race where two parallel requests charged bricks twice for one skin' },
    { type: 'security', text: 'AdMob Server-Side Verification (SSV): real ECDSA P-256 SHA-256 Google signature check in the new endpoint GET /api/bricks/admob-ssv. You can no longer curl 100 bricks a day through /award-rewarded when ADMOB_SSV_ENABLED=1' },
    { type: 'security', text: 'Transaction_id uniqueness + timestamp freshness (≤1h) in SSV callback — replay protection' },
    { type: 'security', text: 'POST /api/bp/quests/:id/claim: UPDATE reward_claimed + bricks award + INSERT brick_transactions — all in one transaction. Previously a server crash could lose the reward forever' },
    { type: 'security', text: 'awardBricks() wrapped in db.transaction() — balance UPDATE and brick_transactions INSERT can no longer diverge' },
    { type: 'security', text: 'WS handleServerGameOver: UPDATE bricks + INSERT brick_transactions for online wins in a single transaction' },
    { type: 'security', text: 'Clubs create/join/leave/kick: all operations in db.transaction() + UNIQUE index on club_members.user_id. A player can only be in one club, member_count always matches actual COUNT(*)' },
    { type: 'security', text: 'Club owner can no longer demote themselves to member — closed the bug with a club left ownerless' },
    { type: 'security', text: 'Chat filter v2: NFKC normalization + zero-width removal + Latin confusables mapping to Cyrillic + stem-based matching. Previously bypassed in 5 seconds (Latin y, dots, zero-width between letters)' },

    // ─── Game flow ───
    { type: 'improve', text: 'Global timer tick in WS server (1s): clock now decrements in real time across all rooms. Previously if the opponent went offline their time did not run — now auto-loss on timeout' },
    { type: 'improve', text: 'Rematch and next tournament game: correct reset of playerTime and lastMoveTime for the new game' },
    { type: 'improve', text: 'Push notifications: send errors are now logged to console.warn (previously .catch(() => {}) swallowed everything)' },

    // ─── Observability + admin ───
    { type: 'new', text: 'admin_audit table + new endpoint GET /api/admin/audit: all critical admin actions (user changes, mute, password reset, content delete, etc.) are now recorded with metadata, IP, admin and timestamp' },
    { type: 'new', text: 'AdMob SSV callback GET /api/bricks/admob-ssv: 7 layers of checks — signature, timestamp, ad_unit, user exists, transaction_id unique, reward clamp, daily limit' },
    { type: 'new', text: 'workflow_dispatch in GitHub Actions deploy: manual redeploy from the UI with inputs (skip_tests, reason) — fast hotfix redeploy without waiting for tests' },

    // ─── Performance and validation ───
    { type: 'perf', text: 'PUT /api/admin/users/:id is now async: bcrypt.hash instead of hashSync on reset_password — does not block the event loop for ~70ms' },
    { type: 'perf', text: 'GET /api/admin/training/export-gpu: response byte limit (default 50MB, max 200MB) + truncated flag. Previously could return 500MB and kill server memory' },
    { type: 'improve', text: 'GET /api/bricks/history: limit is now clamped via Math.max(1, ...) — closed the SQLite LIMIT -1 semantics (all rows)' },
    { type: 'improve', text: 'UTC dates in getDailySeed() and ensureCurrentSeason() — clients in different time zones no longer see different daily seeds around UTC midnight' },
    { type: 'improve', text: 'Battle Pass seasons: start and end of month are now in UTC, not in server local TZ' },
  ],
}
