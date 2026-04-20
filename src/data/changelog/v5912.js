export default {
  version: '5.9.12',
  date: '2026-04-20',
  title_ru: 'Дороги снова тёмные',
  title_en: 'Roads are dark again',
  changes_ru: [
    { type: 'fix', text: 'После v5.9.11 асфальт на скринах выглядел как светло-серые бетонные плиты. Причина — слишком много тонких деталей в текстуре (плитка тротуара 0.5px, трещины 0.8px, edge lines 1px): на дистанции mipmap их усреднял в светлый tone вместе с белой разметкой и светлыми бордюрами. Итог: дороги казались серыми, а не тёмно-синим асфальтом.' },
    { type: 'improve', text: 'Размер canvas дороги 256×256 → 512×512. Mipmap начинается с детальнее базы — меньше размывания на расстоянии.' },
    { type: 'improve', text: 'Асфальт стал плоско-тёмным #12121c (был vertical gradient с краями 0x0c→0x1c). Раньше эти краевые тёмные полосы превращались в светлые полосы при downsampling (contrast flip).' },
    { type: 'improve', text: 'Бордюры-тротуары расширены 5px → 16px. Толщина достаточная чтобы не исчезать при mipmap, цвет #252532 (тёмно-серый, не бетон). Добавлена чёрная разделительная полоса #08080f между бордюром и асфальтом — чёткий contour.' },
    { type: 'improve', text: 'Разметка стала жирнее: толщина 2 → 4px, длина dash 24 → 48px, gap 28 → 40px. Большие участки = каждый dash остаётся чёрно-белым а не смешивается в серое.' },
    { type: 'improve', text: 'Anisotropy 8 → 4. Убраны: плитка тротуара, трещины, edge lines, вертикальный градиент асфальта. Зернистость сделана крупнее (1.2–3.7px вместо 0.3–1.7px) и вынесена из зоны бордюров.' },
  ],
  changes_en: [
    { type: 'fix', text: 'After v5.9.11 the asphalt looked like light-grey concrete slabs in screenshots. Root cause: too many thin details in the texture (sidewalk tile 0.5px, cracks 0.8px, edge lines 1px) — at distance mipmap averaged them into a light tone together with white markings and light curbs. Result: roads appeared grey instead of dark-blue asphalt.' },
    { type: 'improve', text: 'Road canvas size 256×256 → 512×512. Mipmap starts from a more detailed base — less blurring at distance.' },
    { type: 'improve', text: 'Asphalt is now flat-dark #12121c (was vertical gradient with edges 0x0c→0x1c). Previously those dark edge bands turned into LIGHT bands during downsampling (contrast flip).' },
    { type: 'improve', text: 'Curb-sidewalks widened 5px → 16px. Thick enough not to disappear under mipmap, color #252532 (dark grey, not concrete). Added a black separator line #08080f between curb and road surface — crisp contour.' },
    { type: 'improve', text: 'Markings beefed up: thickness 2 → 4px, dash length 24 → 48px, gap 28 → 40px. Larger segments = each dash stays black-and-white instead of blending into grey.' },
    { type: 'improve', text: 'Anisotropy 8 → 4. Removed: sidewalk tile, cracks, edge lines, vertical asphalt gradient. Grain made chunkier (1.2–3.7px instead of 0.3–1.7px) and moved outside curb zones.' },
  ],
}
