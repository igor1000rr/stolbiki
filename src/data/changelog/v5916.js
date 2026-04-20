export default {
  version: '5.9.16',
  date: '2026-04-21',
  title_ru: 'Cyber-улицы: тонкие неоновые линии',
  title_en: 'Cyber streets: thin neon lines',
  changes_ru: [
    { type: 'fix', text: 'В v5.9.15 убрали 8 road-stripe прямоугольников чтобы избавиться от «плиточного» эффекта, но дороги стали вообще не видны. Город казался стоящим на пустой чёрной плите.' },
    { type: 'feat', text: 'Добавлены cyber-улицы — тонкие cyan-линии (#00d4ff) шириной 0.3 м с AdditiveBlending. Положены между рядами зданий и вдоль колонок — выглядят как hi-tech дорожки в стиле Tron/Cyberpunk.' },
    { type: 'improve', text: 'Ширина линии всего 0.3 единицы вместо 2.4 у старых stripe-в — слишком тонкие чтобы создавать «плиточный» эффект или mipmap aliasing.' },
    { type: 'improve', text: 'Линии медленно пульсируют (opacity 0.4 ± 0.1) для «живого» эффекта. Совместимы с PointLight-системой — фонари и неоны освещают плиту как раньше.' },
  ],
  changes_en: [
    { type: 'fix', text: 'In v5.9.15 we removed the 8 road-stripe rectangles to kill the “tile” effect, but roads then became invisible. The city looked like it was standing on an empty black slab.' },
    { type: 'feat', text: 'Added cyber-streets: thin cyan lines (#00d4ff) 0.3m wide with AdditiveBlending. Placed between rows of buildings and along columns — read like hi-tech tracks in Tron/Cyberpunk style.' },
    { type: 'improve', text: 'Line width is only 0.3 units vs 2.4 of the old stripes — too thin to create a “tile” feel or mipmap aliasing.' },
    { type: 'improve', text: 'Lines slowly pulse (opacity 0.4 ± 0.1) for a living effect. Compatible with the PointLight system — lamps and neons still light the slab as before.' },
  ],
}
