export default {
  version: '5.9.18',
  date: '2026-04-21',
  title_ru: 'Фикс крыш и разметки на перекрёстках',
  title_en: 'Fix building caps and intersection markings',
  changes_ru: [
    { type: 'fix', text: 'Убраны «кирпичики» на крышах промежуточных этажей. Раньше у каждого BoxGeometry этажа top/bottom грани использовали цветной capMat, и на изометрии верх промежуточных этажей был виден как цветной кирпичик. Теперь цветная крышка рисуется только у самого верхнего этажа здания, остальные этажи имеют тёмный internalCapMat на top/bottom.' },
    { type: 'fix', text: 'Разметка больше не идёт сквозь перекрёстки. Жёлтая двойная и белые пунктиры теперь сегментированы — отдельные куски длиной segmentLength = SPACING − (ROAD_WIDTH + 2·SIDEWALK_WIDTH) между соседними перекрёстками. На самих перекрёстках разметка отсутствует, как на настоящих улицах.' },
    { type: 'improve', text: 'Белые пунктиры реже (dashLen 0.5→0.6, gap 0.4→0.8) — меньше «забор»-эффекта. Жёлтая двойная чуть шире (offset 0.06→0.07).' },
  ],
  changes_en: [
    { type: 'fix', text: 'Removed the "brick" artifacts on tops of intermediate floors. Previously every floor\'s BoxGeometry top/bottom used the coloured capMat, so the top of each middle floor was visible at isometric angle as a coloured brick. Now the coloured top cap is drawn only on the very top floor; the rest use a dark internalCapMat for top/bottom.' },
    { type: 'fix', text: 'Road markings no longer cross through intersections. Yellow double line and white dashes are now segmented — separate strips of length SPACING − (ROAD_WIDTH + 2·SIDEWALK_WIDTH) between adjacent intersections, with no markings over the crossings themselves, matching real-world streets.' },
    { type: 'improve', text: 'White dashes rarer (dashLen 0.5→0.6, gap 0.4→0.8) — less "fence" effect. Yellow double slightly wider (offset 0.06→0.07).' },
  ],
}
