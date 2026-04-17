export default {
  version: '5.9.1',
  date: '2026-04-17',
  title_ru: 'Анонс Golden Rush — новый режим для 4 игроков',
  title_en: 'Announcing Golden Rush — new 4-player mode',
  changes_ru: [
    { type: 'new', text: 'Golden Rush: новый режим для 4 игроков. 9 стоек образуют крест, по 2 стойки на каждой руке + 1 центральная золотая. Слоган: Race to the center. Control the gold' },
    { type: 'new', text: 'Механика ходов та же, что в базовой игре (swap, transfer, placement). Меняется только топология поля и порядок блокировки: свои 2 стойки блокируются по порядку 1→2, центральная — только после обеих своих' },
    { type: 'new', text: 'Два варианта игры: 4-FFA (каждый за себя) и 2v2 (команды по диагонали). Командный бонус +10 если оба игрока замкнули свои линии. Центральная башня = king-maker момент с +15 очков' },
    { type: 'new', text: 'Физическая версия: существующая коробка + копеечные флажки 4 цветов + сменная картонка-поле. Помещается в текущий инсерт' },
    { type: 'improve', text: 'Roadmap цифровой адаптации: Фаза 1 hot-seat (2-3 недели) → Фаза 2 online 2v2 (3-4 недели) → Фаза 3 AI partner через transfer learning от v7 AlphaZero (2-3 месяца compute) → Фаза 4 4-FFA с MaxN (опционально)' },
    { type: 'improve', text: 'Живой дизайн-документ: docs/modes/golden-rush.md в репозитории. Правки и вопросы принимаются через PR' },
  ],
  changes_en: [
    { type: 'new', text: 'Golden Rush: new 4-player mode. 9 stands form a cross, 2 stands on each arm + 1 central golden stand. Slogan: Race to the center. Control the gold' },
    { type: 'new', text: 'Same move mechanics as the base game (swap, transfer, placement). Only the board topology and lock order change: your 2 stands lock in order 1→2, the central one — only after both of yours are locked' },
    { type: 'new', text: 'Two variants: 4-FFA (free-for-all) and 2v2 (teams across the diagonal). Team bonus +10 if both teammates closed their lines. Central tower = king-maker moment worth +15 points' },
    { type: 'new', text: 'Physical version: existing box + cheap colored flags (4 per set) + replaceable cardboard cross-field. Fits the current insert' },
    { type: 'improve', text: 'Digital roadmap: Phase 1 hot-seat (2-3 weeks) → Phase 2 online 2v2 (3-4 weeks) → Phase 3 AI partner via transfer learning from v7 AlphaZero (2-3 months compute) → Phase 4 4-FFA with MaxN (optional)' },
    { type: 'improve', text: 'Living design document: docs/modes/golden-rush.md in the repo. Edits and questions via PR' },
  ],
}
