export default {
  version: '5.7.2',
  date: '2026-04-15',
  title_ru: 'Турниры: рейтинг больше не начисляется дважды',
  title_en: 'Tournaments: rating no longer counted twice',
  changes_ru: [
    { type: 'fix', text: 'Когда оба игрока одновременно жали «я выиграл» — рейтинг иногда считался в двойном размере. Теперь второе нажатие вежливо игнорируется' },
    { type: 'fix', text: 'Такая же проблема могла дублировать матчи следующего раунда — исправлено' },
    { type: 'fix', text: 'XP за топ-3 в финале тоже мог начислиться дважды — исправлено' },
    { type: 'fix', text: 'Жеребьёвка первого раунда стала по-настоящему случайной — раньше был небольшой перекос в расстановке пар' },
  ],
  changes_en: [
    { type: 'fix', text: 'When both players hit “I won” at the same time — rating sometimes counted at double size. The second click is now politely ignored' },
    { type: 'fix', text: 'Same problem could duplicate matches in the next round — fixed' },
    { type: 'fix', text: 'Top-3 XP in the final could also be credited twice — fixed' },
    { type: 'fix', text: 'First-round draw is now properly random — there used to be a slight bias in pairings' },
  ],
}
