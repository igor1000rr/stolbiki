export default {
  version: '5.7.0',
  date: '2026-04-14',
  title_ru: 'Achievement Rarity — живой процент держателей',
  title_en: 'Achievement Rarity — live percentage of holders',
  changes_ru: [
    { type: 'new', text: 'GET /api/achievements/rarity — публичный endpoint с процентом и tier (legendary < 1%, epic < 5%, rare < 20%, common ≥ 20%)' },
    { type: 'new', text: 'GET /api/achievements/me — список ачивок юзера с rarity merged' },
    { type: 'new', text: 'Во вкладке «Ачивки» каждая карточка показывает живой процент держателей' },
    { type: 'new', text: 'Hook useAchievementRarity — sessionStorage кэш 5 мин и дедупликация parallel-фетчей' },
    { type: 'fix', text: 'chat-limits: LRU для lastSent Map — защита от memory leak' },
    { type: 'fix', text: 'Notification API теперь под брендом Highrise Heist (было 4 места)' },
  ],
  changes_en: [
    { type: 'new', text: 'GET /api/achievements/rarity — public endpoint with percentage and tier (legendary < 1%, epic < 5%, rare < 20%, common >= 20%)' },
    { type: 'new', text: 'GET /api/achievements/me — user achievements with rarity merged' },
    { type: 'new', text: 'In Achievements tab each card shows live percentage of holders' },
    { type: 'new', text: 'Hook useAchievementRarity — sessionStorage cache 5 min and parallel-fetch deduplication' },
    { type: 'fix', text: 'chat-limits: LRU for lastSent Map — memory leak protection' },
    { type: 'fix', text: 'Notification API now uses Highrise Heist brand (was 4 places)' },
  ],
}
