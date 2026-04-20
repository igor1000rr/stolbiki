export default {
  version: '5.9.15',
  date: '2026-04-20',
  title_ru: 'Дороги → одна площадь-плита',
  title_en: 'Roads → single plaza slab',
  changes_ru: [
    { type: 'fix', text: 'Раньше дороги рендерились как 8 отдельных stripe-прямоугольников (rows+1 горизонтальных + cols+1 вертикальных), пересекающихся в кресты. Это и создавало визуальный «плиточный бордюр» вокруг города. Теперь это одна большая plane-плита под всем городом (как реальная городская площадь или парковка).' },
    { type: 'improve', text: 'Плита из MeshStandardMaterial (раньше был MeshBasicMaterial) — реальный свет от фонарей/неонов теперь падает на асфальт круглыми бликами. Интенсивность фонарей 2.5 → 3.0 чтобы блики были чёткими.' },
    { type: 'improve', text: 'Дальняя земля вокруг плиты стала ещё темнее (#070710 → #040408) и матовой — чтобы визуально растворяться в fog и не отвлекать от города.' },
    { type: 'improve', text: 'Машины сохранились — ездят по виртуальным полосам между рядами зданий (без визуальных дорожных планов). Движущиеся жёлтые/красные точки выглядят как фары на общей парковочной площади.' },
  ],
  changes_en: [
    { type: 'fix', text: 'Previously roads were rendered as 8 separate stripe rectangles (rows+1 horizontal + cols+1 vertical) crossing into intersections. That created the “tile border” effect around the city. Now it is one large plane slab under the whole city (like a real urban plaza or parking lot).' },
    { type: 'improve', text: 'The slab uses MeshStandardMaterial (was MeshBasicMaterial) — real light from lamps/neons now falls on the asphalt as round bright spots. Lamp intensity 2.5 → 3.0 for crisp light pools.' },
    { type: 'improve', text: 'Far ground around the slab is darker (#070710 → #040408) and matte — dissolves into fog and stops competing with the city.' },
    { type: 'improve', text: 'Cars are kept — they drive along virtual lanes between rows of buildings (no visual road planes). The yellow/red moving dots read as headlights/tail lights on a shared parking plaza.' },
  ],
}
