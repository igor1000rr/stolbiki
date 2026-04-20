export default {
  version: '5.9.13',
  date: '2026-04-20',
  title_ru: 'Wow-пакет 2: фонари и неоны',
  title_en: 'Wow pack 2: lamps and neons',
  changes_ru: [
    { type: 'improve', text: 'Дорога переписана как спокойный тёмный фон: асфальт #0e0e16, лёгкая зернистость, одна едва видная центральная полоса. Без толстых бордюров, без двойной разметки. Дорога больше не доминирует, теперь в фокусе — фонари и здания.' },
    { type: 'fix', text: 'Зебры-переходы полностью удалены. На изометрическом ракурсе и таком масштабе они выглядели как яркие плиты, разрушая wow-эффект.' },
    { type: 'feat', text: 'Новое: 6 уличных фонарей. Каждый — это тонкий cylinder-столб высотой 3м, sphere-лампочка на верхушке, sprite тёплого halo (128×128 с lens-flare лучами, additive blending) и большое световое пятно на асфальте (plane 4×4 с radial gradient оранжевым цветом). Это и даёт реальный ночной вайб.' },
    { type: 'feat', text: 'Неоновые вывески на ~40% зданий (кроме золотых). 6 цветов (розовый, голубой, зелёный, оранжевый, фиолетовый, желтый), детерминированно размещены на случайной грани стены на высоте 35-70% здания. AdditiveBlending + синусоидальное мерцание + случайные glitch-моменты когда яркость падает.' },
    { type: 'improve', text: 'Земля стала ещё темнее (#0a0a16 вместо #16162a) для лучшего контраста со светящимися зданиями и световыми пятнами. Сцена fog тоже темнее #05050c.' },
    { type: 'improve', text: 'Звёзд на небе стало больше: 300 → 400. Sun intensity и ambient снижены чтобы emissive-элементы (фонари, окна, неоны) выражались сильнее.' },
  ],
  changes_en: [
    { type: 'improve', text: 'Road rewritten as a calm dark background: #0e0e16 asphalt, light grain, one barely visible centerline. No thick curbs, no double markings. The road no longer dominates — lamps and buildings are now the focus.' },
    { type: 'fix', text: 'Crosswalks fully removed. At this isometric angle and scale they looked like bright plates, destroying the wow effect.' },
    { type: 'feat', text: 'New: 6 street lamps. Each is a thin 3m cylinder pole, sphere bulb on top, warm halo sprite (128×128 with lens-flare rays, additive blending) and a large light puddle on the asphalt (4×4 plane with orange radial gradient). This is what delivers real night-city vibe.' },
    { type: 'feat', text: 'Neon signs on ~40% of buildings (except golden ones). 6 colours (pink, cyan, green, orange, purple, yellow), deterministically placed on a random wall face at 35-70% building height. Additive blending + sinusoidal flicker + random glitch drops.' },
    { type: 'improve', text: 'Ground darker (#0a0a16 instead of #16162a) for stronger contrast with glowing buildings and light puddles. Scene fog also darker #05050c.' },
    { type: 'improve', text: 'More stars on the sky: 300 → 400. Sun intensity and ambient lowered so emissive elements (lamps, windows, neons) come through stronger.' },
  ],
}
