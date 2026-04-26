export default {
  version: '5.9.22',
  date: '2026-04-26',
  title_ru: 'Customization Rework Часть 1 + Edge Swipe + Victory City',
  title_en: 'Customization Rework Part 1 + Edge Swipe + Victory City',
  changes_ru: [
    // ─── Customization (по ТЗ Александра, апр 2026) ───
    { type: 'improve', text: 'Темы и Фоны объединены в одну сущность: выбираешь тему — фон применяется автоматически. Каждая тема знает свой linkedBgId. В превью теперь видно тему вместе с фоном.' },
    { type: 'new', text: 'Темы расширены: "Парк днём" (Light + дневной фон) и "Город ночью" (Dark + ночной) — обе бесплатные. Остальные за кирпичи.' },
    { type: 'improve', text: 'Вкладка Backgrounds удалена из SkinShop — теперь это часть Themes.' },
    { type: 'improve', text: 'Вкладка Stands удалена из SkinShop — нет игровой логики у стендов. Купленные ранее стенды продолжают применяться через legacy settings.standStyle.' },

    // ─── Header Reorg ───
    { type: 'improve', text: 'Шапка игры переехала: режим (Online/AI/2P) — по центру, кнопки Settings и City Style — справа от New Game.' },
    { type: 'new', text: 'GameModeBar — отдельный компонент для переключения режима игры с понятными иконками.' },
    { type: 'new', text: 'GameActionsTop — Settings (⚙) и City Style (🎨) в одной строке справа от New Game.' },

    // ─── Victory City ───
    { type: 'improve', text: 'Город Побед: цвет земли меняется в зависимости от времени суток (зелёная утром, оранжевая на закате, тёмно-синяя ночью).' },
    { type: 'new', text: 'Снаппи появляется в Городе Побед — комментит достижения.' },
    { type: 'improve', text: 'Snappy variant \'anchored\' — маскот закреплён в углу при показе на Victory City, не закрывает башни.' },

    // ─── Edge Swipe Back ───
    { type: 'new', text: 'Свайп от левого края экрана возвращает в предыдущий раздел (Game → Profile → Online → Lobby и т.д.). Работает и в браузере, и в нативном приложении.' },
    { type: 'fix', text: 'App.jsx: typo removEventListener → removeEventListener (вызывало висящий слушатель при unmount).' },

    // ─── Analytics i18n ───
    { type: 'fix', text: 'ProfileAnalytics: метки часов/минут и побед/поражений локализованы на русском (ч/м, П/П вместо h/m, W/L).' },

    // ─── Cleanup ───
    { type: 'improve', text: 'MobileGameBar превращён в null-стаб (deadcode cleanup) — функционал давно перенесён в GameActionsTop/Bottom.' },
  ],
  changes_en: [
    // ─── Customization (Alexander\'s feedback, Apr 2026) ───
    { type: 'improve', text: 'Themes and Backgrounds merged into a single entity: pick a theme — the background applies automatically. Every theme has a linkedBgId. Preview now shows the theme together with the background.' },
    { type: 'new', text: 'Themes expanded: "Sunny Day in Park" (Light + day background) and "Night City" (Dark + night) — both free. Others cost bricks.' },
    { type: 'improve', text: 'Backgrounds tab removed from SkinShop — it\'s now part of Themes.' },
    { type: 'improve', text: 'Stands tab removed from SkinShop — stands had no gameplay logic. Previously purchased stands keep applying via legacy settings.standStyle.' },

    // ─── Header Reorg ───
    { type: 'improve', text: 'Game header reshuffled: mode toggle (Online/AI/2P) is now centered, Settings and City Style sit to the right of New Game.' },
    { type: 'new', text: 'GameModeBar — dedicated component for switching game modes with clear icons.' },
    { type: 'new', text: 'GameActionsTop — Settings (⚙) and City Style (🎨) on a single row, to the right of New Game.' },

    // ─── Victory City ───
    { type: 'improve', text: 'Victory City: ground colour shifts with time of day (green in the morning, orange at sunset, deep blue at night).' },
    { type: 'new', text: 'Snappy now shows up in Victory City — comments on achievements.' },
    { type: 'improve', text: 'Snappy variant \'anchored\' — mascot pinned to a corner when shown on Victory City so it doesn\'t cover towers.' },

    // ─── Edge Swipe Back ───
    { type: 'new', text: 'Swipe from the left edge of the screen returns to the previous section (Game → Profile → Online → Lobby etc). Works both in browser and in the native app.' },
    { type: 'fix', text: 'App.jsx: typo removEventListener → removeEventListener (was causing a dangling listener on unmount).' },

    // ─── Analytics i18n ───
    { type: 'fix', text: 'ProfileAnalytics: hour/minute and win/loss labels localised in Russian (ч/м, П/П instead of h/m, W/L).' },

    // ─── Cleanup ───
    { type: 'improve', text: 'MobileGameBar turned into a null stub (deadcode cleanup) — functionality long since moved to GameActionsTop/Bottom.' },
  ],
}
