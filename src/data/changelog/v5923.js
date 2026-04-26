export default {
  version: '5.9.23',
  date: '2026-04-26',
  title_ru: 'Customization Rework Часть 2 + Snappy Block + Style Twin + Premium Blocks',
  title_en: 'Customization Rework Part 2 + Snappy Block + Style Twin + Premium Blocks',
  changes_ru: [
    // ─── Snappy Block (full-stack) ───
    { type: 'new', text: 'Snappy Block: если у вас с соперником одинаковые блоки в онлайне, маскот через 1.5 секунды после старта пошутит "Меняй блоки!". 5 RU/EN фраз для skin_collision события.' },
    { type: 'improve', text: 'detectSkinCollision сравнивает blocks (новый ключ) и chipStyle (legacy) — игнорирует stands и background. Backward compat между старым и новым клиентом.' },
    { type: 'improve', text: 'Триггер в обеих точках старта партии: findMatch (рейтинговый matchmaking) и join (приватная комната).' },

    // ─── Style Twin ачивка ───
    { type: 'new', text: 'Ачивка "Близнецы по стилю" / "Style Twin" — за первый онлайн матч с одинаковыми блоками. Rare, цвет diamond. Прогресс отображается в профиле.' },
    { type: 'improve', text: 'Колонка users.style_twin_count добавлена миграцией 15. Инкремент происходит для обоих игроков при detectSkinCollision (если игроки залогинены).' },
    { type: 'improve', text: 'styleTwinCount теперь возвращается формате profile API через formatUser/formatPublicUser.' },

    // ─── Премиум-блоки ───
    { type: 'new', text: 'Premium Blocks legendary tier: 4 новых скина блоков — Gold (800 кирпичей), Diamond (1200), Holographic (1500), Galaxy (2000). Долгосрочные grind-таргеты.' },
    { type: 'improve', text: 'CSS-градиенты на 5 стопов с inset highlight + outer glow — premium-ощущение от материала. Каталог на сервере обновлён через INSERT OR IGNORE, миграция БД не требуется.' },

    // ─── Stands refund ───
    { type: 'improve', text: 'Миграция БД 14: рефанд кирпичей всем кто покупал платные стенды (после удаления вкладки Stands из UI). Транзакции записаны в brick_transactions с reason="refund_skin:stands_*".' },

    // ─── Tests ───
    { type: 'new', text: 'Unit тесты для detectSkinCollision: 20+ кейсов (positive, negative, edge cases с null/undefined/empty, реалистичные сценарии classic-vs-classic). Защита от регрессии Snappy Block.' },
    { type: 'improve', text: 'detectSkinCollision вынесен в server/skin-helpers.js — единый источник истины, без дубля внутри ws.js (DRY).' },

    // ─── Whats New ───
    { type: 'improve', text: 'Список "Что нового" обновлён до v5.9.23 — описывает все 6 ключевых изменений из этой и предыдущей сессии.' },
  ],
  changes_en: [
    // ─── Snappy Block (full-stack) ───
    { type: 'new', text: 'Snappy Block: if you and your opponent have identical blocks in an online match, the mascot quips "Change your blocks!" 1.5 seconds after the start. 5 RU/EN phrases for the skin_collision event.' },
    { type: 'improve', text: 'detectSkinCollision compares blocks (new key) and chipStyle (legacy) — ignores stands and background. Backward compat between old and new clients.' },
    { type: 'improve', text: 'Trigger at both match start points: findMatch (rated matchmaking) and join (private room).' },

    // ─── Style Twin achievement ───
    { type: 'new', text: 'Achievement "Style Twin" — for your first online match with identical blocks. Rare, diamond colour. Progress shown in the profile.' },
    { type: 'improve', text: 'users.style_twin_count column added by migration 15. Incremented for both players when detectSkinCollision fires (if players are logged in).' },
    { type: 'improve', text: 'styleTwinCount now returned in the profile API via formatUser/formatPublicUser.' },

    // ─── Premium blocks ───
    { type: 'new', text: 'Premium Blocks legendary tier: 4 new block skins — Gold (800 bricks), Diamond (1200), Holographic (1500), Galaxy (2000). Long-term grind targets.' },
    { type: 'improve', text: 'CSS gradients with 5 stops + inset highlight + outer glow — premium material feel. Server catalogue updated via INSERT OR IGNORE, no DB migration needed.' },

    // ─── Stands refund ───
    { type: 'improve', text: 'DB migration 14: refunds bricks to anyone who bought paid stand skins (after the Stands tab was removed from UI). Transactions recorded in brick_transactions with reason="refund_skin:stands_*".' },

    // ─── Tests ───
    { type: 'new', text: 'Unit tests for detectSkinCollision: 20+ cases (positive, negative, edge cases with null/undefined/empty, realistic classic-vs-classic scenarios). Regression guard for Snappy Block.' },
    { type: 'improve', text: 'detectSkinCollision extracted into server/skin-helpers.js — single source of truth, no duplicate inside ws.js (DRY).' },

    // ─── Whats New ───
    { type: 'improve', text: 'What\'s New list updated to v5.9.23 — describes all 6 key changes from this and the previous session.' },
  ],
}
