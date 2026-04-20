export default {
  version: '5.9.17',
  date: '2026-04-21',
  title_ru: 'NY-style: реальные дороги, тротуары, светофоры',
  title_en: 'NY-style: real roads, sidewalks, traffic lights',
  changes_ru: [
    { type: 'feat', text: 'Полный редизайн уличной инфраструктуры под реалистичный ночной Нью-Йорк. Дороги теперь выглядят как настоящие улицы, а не как плиты или cyber-линии.' },
    { type: 'feat', text: 'Дороги: тёмно-серый асфальт #1a1a22 без текстур (никакого mipmap aliasing). Разметка отдельными mesh-ами поверх: жёлтая двойная #ffcc40 по центру + белые пунктиры по краям полос (dash 0.5 / gap 0.4). Всё как в настоящем Нью-Йорке.' },
    { type: 'feat', text: 'Тротуары — приподнятые BoxGeometry бордюры высотой 0.08м с обеих сторон каждой дороги. Бежевый #4a4540 (тёплый бетон). Реальные геометрические бордюры — видны отдельной высотой, не текстурой.' },
    { type: 'feat', text: 'Светофоры на каждом внутреннем перекрёстке (4 штуки на 5×4 сетке). Столб + коробочка + 3 сферы (разные фазы: green 3с → yellow 1с → red 3с = 7с цикл). Каждый работает независимо со своей seeded-фазой.' },
    { type: 'feat', text: 'Блоки-кварталы: каждое здание стоит на своём «квартальном» plane между дорогами. Чёткая геометрическая структура как в реальных городах.' },
    { type: 'improve', text: 'Неоны уменьшены: 55% → 30% зданий, вертикальные вывески убраны (это был азиатский стиль, а не NY). Цветная подсветка стен всё ещё работает через PointLight.' },
    { type: 'fix', text: 'Убраны: cyber-линии (не в стиле), дым над золотыми зданиями (отвлекал), beacons на крышах (лишнее), плита-площадь (заменена структурой из блоков+дорог+тротуаров).' },
  ],
  changes_en: [
    { type: 'feat', text: 'Full street infrastructure redesign for realistic NYC night city. Roads now look like real streets, not slabs or cyber-lines.' },
    { type: 'feat', text: 'Roads: dark-grey asphalt #1a1a22 without textures (no mipmap aliasing). Markings as separate meshes on top: yellow double centerline #ffcc40 + white dashed lane edges (dash 0.5 / gap 0.4). Like real NYC streets.' },
    { type: 'feat', text: 'Sidewalks: raised BoxGeometry curbs 0.08m height on both sides of each road. Beige #4a4540 (warm concrete). Real geometric curbs visible by separate height, not texture.' },
    { type: 'feat', text: 'Traffic lights at every internal intersection (4 on 5x4 grid). Pole + box + 3 spheres (different phases: green 3s -> yellow 1s -> red 3s = 7s cycle). Each works independently with seeded phase.' },
    { type: 'feat', text: 'Block-quartals: each building stands on its own "block" plane between roads. Clear geometric structure like real cities.' },
    { type: 'improve', text: 'Neons reduced: 55% -> 30% buildings, vertical signs removed (that was Asian style, not NY). Coloured wall lighting still works via PointLight.' },
    { type: 'fix', text: 'Removed: cyber-lines (off-style), smoke over golden buildings (distracting), roof beacons (excess), plaza-slab (replaced with structure of blocks+roads+sidewalks).' },
  ],
}
