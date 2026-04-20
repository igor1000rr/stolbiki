export default {
  version: '5.9.11',
  date: '2026-04-20',
  title_ru: 'Wow-апгрейд визуала Landing 3D',
  title_en: 'Wow-upgrade for Landing 3D visuals',
  changes_ru: [
    { type: 'improve', text: 'Фасады зданий на главной странице переведены на canvas-текстуры с окнами, нарисованными прямо на стенах. Раньше были плоские кубы с маленькими спрайт-окнами поверх через AdditiveBlending (InstancedMesh). Теперь каждое окно — это часть map+emissiveMap материала: сетка 3×3 на этаж, рандомные состояния off (15%) / dim (25%) / bright (60%), рамки, mullions, градиентные highlights, reflection на тёмном стекле. Сцена сразу выглядит как реальные ночные небоскрёбы, а не крашеные коробки.' },
    { type: 'feat', text: 'Добавлена луна в углу неба: sprite 10×10 с halo, 4 кратерами и фазей (terminator). AdditiveBlending — луна мягко светится сквозь fog.' },
    { type: 'feat', text: 'Добавлены зебры-переходы на 4 перекрёстках дорог. Текстура с transparent фоном, полосы 12px с промежутком 8px.' },
    { type: 'improve', text: 'Новые shared-текстуры в victoryCityTextures.js: makeFacadeTexture (фасады), makeCrosswalkTexture (зебры), makeMoonTexture (луна). Доступны для использования в VictoryCity.jsx в следующих итерациях.' },
    { type: 'improve', text: 'Дорога стала детальнее: 1400 зёрен вместо 900, добавлены 3 мелкие трещины, плитка тротуара (швы каждые 20px), anisotropy 4 → 8.' },
    { type: 'improve', text: 'Звезда над золотыми высотками теперь имеет 4 sparkle-луча (горизонтальный + вертикальный + две диагонали), эффект полноценного сияния.' },
  ],
  changes_en: [
    { type: 'improve', text: 'Landing page building facades now use canvas textures with windows drawn directly on walls. Previously they were flat cubes with small sprite-windows overlaid via InstancedMesh + AdditiveBlending. Now each window is part of the material map+emissiveMap: 3×3 grid per floor, random states off (15%) / dim (25%) / bright (60%), frames, mullions, gradient highlights, reflection on dark glass. The scene immediately looks like actual night skyscrapers instead of painted boxes.' },
    { type: 'feat', text: 'Added moon in the sky corner: 10×10 sprite with halo, 4 craters and terminator (phase). AdditiveBlending — moon softly glows through fog.' },
    { type: 'feat', text: 'Added zebra crosswalks at 4 road intersections. Texture with transparent background, 12px stripes with 8px gaps.' },
    { type: 'improve', text: 'New shared textures in victoryCityTextures.js: makeFacadeTexture, makeCrosswalkTexture, makeMoonTexture. Available for use in VictoryCity.jsx in future iterations.' },
    { type: 'improve', text: 'Road is more detailed: 1400 grain particles instead of 900, 3 small cracks added, sidewalk tile pattern (seams every 20px), anisotropy raised 4 → 8.' },
    { type: 'improve', text: 'Star above golden highrises now has 4 sparkle rays (horizontal + vertical + two diagonals), achieving proper lens-flare effect.' },
  ],
}
