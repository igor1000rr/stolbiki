export default {
  version: '5.9.9',
  date: '2026-04-20',
  title_ru: 'VictoryCity: дороги не желтеют на закате',
  title_en: 'VictoryCity: roads stop going gold at sunset',
  changes_ru: [
    { type: 'fix', text: 'Дороги больше не становятся желто-золотыми под тёплым directional light. Материал переведён MeshStandardMaterial → MeshBasicMaterial — текстура рендерится «как есть», без перекраски от сун-лайта 0xfff0c8 + ACES tone mapping. Тени от зданий всё равно видны на ground plane.' },
    { type: 'improve', text: 'Разметка смягчена: цвет #b8b8c8 → #8a8a96, длина dash 32px → 22px, gap 22 → 30, толщина 2 → 1.5 px. Edge lines у бордюров стали тусклее. Разметка не доминирует при изометрической перспективе.' },
  ],
  changes_en: [
    { type: 'fix', text: 'Roads stop turning yellow-gold under the warm directional light. Material switched from MeshStandardMaterial to MeshBasicMaterial — the texture now renders as-is, without being tinted by sun 0xfff0c8 + ACES tone mapping. Building shadows are still visible on the ground plane underneath.' },
    { type: 'improve', text: 'Lane markings softened: color #b8b8c8 → #8a8a96, dash length 32px → 22px, gap 22 → 30, thickness 2 → 1.5 px. Curb edge lines dimmed further. The markings no longer dominate the frame under isometric perspective.' },
  ],
}
