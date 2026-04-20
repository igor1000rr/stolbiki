export default {
  version: '5.9.8',
  date: '2026-04-20',
  title_ru: 'Victory City: аккуратные дороги и звёзды',
  title_en: 'Victory City: cleaner roads and stars',
  changes_ru: [
    { type: 'improve', text: 'Полностью переделана текстура дорог в 3D-городе побед. Была узкая полоса 16×256 с почти белыми штрихами — на ночной сцене превращалась в «матрас»: светло-сиреневые полотна с жёлтыми пятнами-пунктирами, которые казались ярче самих зданий. Теперь тайл 256×256 = 6 метров дороги: тёмный асфальт с лёгкой зернистостью, тонкие серые бордюры-тротуары по краям, двойная белая пунктирная разметка посередине, боковые lane edge lines. Дороги смотрят как дороги, а не как источник света.' },
    { type: 'improve', text: 'Переделана текстура звёзды-короны над золотыми высотками. Раньше это была крупная жёлтая клякса с оранжевой обводкой и мощным glow — доминировала в кадре, «съедала» силуэт здания. Теперь — компактная белая 5-конечная звёздочка на мягком тёплом ореоле, с центральным highlight. Акцент остался, но больше не спорит со шпилями.' },
    { type: 'fix', text: 'Материал дороги: color 0x222230 → 0xffffff. Раньше текстура умножалась на тёмно-серый и теряла контраст разметки. Теперь цвета текстуры отображаются корректно.' },
  ],
  changes_en: [
    { type: 'improve', text: 'Road texture in the 3D Victory City fully rebuilt. It used to be a narrow 16×256 strip with near-white dashes — on the night scene it turned into a washed-out light-purple "mattress" with yellow dash blobs brighter than the buildings themselves. Now it is a 256×256 tile = 6 m of road: dark asphalt with subtle grain, thin grey sidewalk curbs on the edges, double white dashed centerline, and lane edge lines. Roads now read as roads, not as a light source.' },
    { type: 'improve', text: 'Crown star texture above golden highrises redone. Used to be a large yellow blob with an orange outline and heavy glow that dominated the frame and hid the building silhouette. Now a compact white 5-pointed star on a soft warm halo with a center highlight. The accent stays, but stops fighting the spires.' },
    { type: 'fix', text: 'Road material: color 0x222230 → 0xffffff. Previously the texture was multiplied by dark grey and lost contrast; now texture colors render correctly.' },
  ],
}
