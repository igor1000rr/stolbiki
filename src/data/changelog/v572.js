export default {
  version: '5.7.2',
  date: '2026-04-15',
  title_ru: 'Arena: 4 race condition фикс — двойное начисление рейтинга и XP',
  title_en: 'Arena: 4 race condition fixes — double rating and XP credit',
  changes_ru: [
    { type: 'fix', text: 'Критично: dual-report в /api/arena/result — оба игрока одновременно жали «я выиграл» → рейтинг считался дважды. Атомарный UPDATE WHERE winner_id IS NULL + проверка .changes' },
    { type: 'fix', text: 'Double round advance: два параллельных /result могли дублировать генерацию следующего раунда. Guard через UPDATE current_round=? WHERE current_round=?' },
    { type: 'fix', text: 'Double XP для top-3: в финальном раунде XP мог начислиться дважды. Guard через status=playing в finish UPDATE' },
    { type: 'fix', text: 'Arena shuffle: Fisher-Yates вместо arr.sort(() => Math.random() - 0.5) — смещённые comparator’ы в V8 давали неравномерное распределение' },
  ],
  changes_en: [
    { type: 'fix', text: 'Critical: dual-report in /api/arena/result — both players simultaneously POSTing “I won” double-counted rating. Atomic UPDATE WHERE winner_id IS NULL + .changes check' },
    { type: 'fix', text: 'Double round advance: two parallel /result could duplicate next round generation. Guard via UPDATE current_round=? WHERE current_round=?' },
    { type: 'fix', text: 'Double XP for top-3: in the final round XP could be credited twice. Guard via status=playing in finish UPDATE' },
    { type: 'fix', text: 'Arena shuffle: Fisher-Yates instead of arr.sort(() => Math.random() - 0.5) — biased V8 comparators gave uneven distributions' },
  ],
}
