export default {
  version: '5.9.19',
  date: '2026-04-21',
  title_ru: 'Усиленные дороги: контраст и видимость',
  title_en: 'Beefed roads: contrast and visibility',
  changes_ru: [
    { type: 'improve', text: 'Асфальт светлее: #1a1a22 → #30303a. Дороги чётко выделяются на фоне чёрной земли, а не сливаются.' },
    { type: 'improve', text: 'Тротуары светлее (#4a4540 → #7a7570) + выше (0.08 → 0.12м). Бордюры видны чётко как полосы вдоль каждой улицы.' },
    { type: 'improve', text: 'Жёлтая разметка ярче (#ffcc40 → #ffdd50) и толще (0.05 → 0.08). Белые пунктиры чисто белые (#e0e0e0 → #ffffff) и толще (0.04 → 0.06).' },
    { type: 'improve', text: 'Машины крупнее (front 0.5 → 0.9, back 0.4 → 0.75) и ярче (красный #ff2040 → #ff3050 opacity 0.9 → 1.0). Огни фар читаются издалека.' },
    { type: 'improve', text: 'Камера стоит ниже (dist * 0.55 → 0.42) и дальше (0.7 → 0.75). Дороги занимают больше кадра, здания не «выстреливают» сверху.' },
    { type: 'improve', text: 'Земля и фон чёрнее (#05050a → #02020a). Усиление контраста с осветлёнными дорогами.' },
  ],
  changes_en: [
    { type: 'improve', text: 'Asphalt lighter: #1a1a22 -> #30303a. Roads now clearly stand out against the black ground instead of blending in.' },
    { type: 'improve', text: 'Sidewalks lighter (#4a4540 -> #7a7570) and taller (0.08 -> 0.12m). Curbs read as clear stripes along each street.' },
    { type: 'improve', text: 'Yellow markings brighter (#ffcc40 -> #ffdd50) and thicker (0.05 -> 0.08). White dashes pure white (#e0e0e0 -> #ffffff) and thicker (0.04 -> 0.06).' },
    { type: 'improve', text: 'Cars larger (front 0.5 -> 0.9, back 0.4 -> 0.75) and brighter (red #ff2040 -> #ff3050 opacity 0.9 -> 1.0). Headlights read from far away.' },
    { type: 'improve', text: 'Camera is lower (dist * 0.55 -> 0.42) and further (0.7 -> 0.75). Roads occupy more of the frame, buildings don\'t dominate the top.' },
    { type: 'improve', text: 'Ground and background darker (#05050a -> #02020a). Reinforces contrast with the brightened roads.' },
  ],
}
