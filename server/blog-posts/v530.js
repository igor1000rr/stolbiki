export default {
  slug: 'v530-bugfixes',
  title_ru: 'v5.3.0 — Багфиксы CI/CD, /api/training, rewarded field',
  title_en: 'v5.3.0 — Bug fixes CI/CD, /api/training, rewarded field',
  body_ru: 'CI/CD: deploy.yml использовал actions/checkout@v5 и setup-node@v5 — этих версий не существует. Исправлено на @v4.\n\n/api/training: переменная safeDifficulty была undefined — все записи сохранялись с difficulty=0.\n\n/api/bricks/award-rewarded: ответ теперь содержит поле rewarded.\n\nDB migration 8+9: колонки bricks, active_skin, rush_best — через versioned migration вместо try/catch в routes.',
  body_en: 'CI/CD: deploy.yml used actions/checkout@v5 and setup-node@v5 — these versions do not exist. Fixed to @v4.\n\n/api/training: safeDifficulty was undefined — all training records saved with difficulty=0.\n\n/api/bricks/award-rewarded: response now includes the rewarded field.\n\nDB migration 8+9: bricks, active_skin, rush_best columns via versioned migration instead of try/catch in routes.',
  tag: 'release',
  created_at: '2026-04-14 12:00:00',
}
