export default {
  version: '5.9.20',
  date: '2026-04-21',
  title_ru: 'Асфальт заметно светлее + emissive подсветка',
  title_en: 'Asphalt noticeably lighter + emissive glow',
  changes_ru: [
    { type: 'improve', text: 'Асфальт ещё светлее: #30303a → #4a4a55. Плюс добавлен emissive 0x0a0a12 @0.6 — асфальт виден даже вдали от фонарей.' },
    { type: 'improve', text: 'Блоки кварталов светлее #1a1a22 → #28282f чтобы не сливались с новым более светлым асфальтом.' },
    { type: 'improve', text: 'Тротуары ещё светлее #7a7570 → #9a9590. Контраст тротуар (светло-серый) / асфальт (серый) / блоки (тёмно-серые) теперь 3 чётко различимых тона.' },
    { type: 'improve', text: 'Асфальт: roughness 0.9 → 0.75, metalness 0.1 → 0.15 — чуть больше отражает свет, получает более яркие блики от фонарей.' },
  ],
  changes_en: [
    { type: 'improve', text: 'Asphalt lighter still: #30303a -> #4a4a55. Added emissive 0x0a0a12 @0.6 - asphalt is visible even far from lamps.' },
    { type: 'improve', text: 'Block quartals lighter #1a1a22 -> #28282f to avoid blending with the new brighter asphalt.' },
    { type: 'improve', text: 'Sidewalks lighter still #7a7570 -> #9a9590. Contrast sidewalk (light-gray) / asphalt (gray) / blocks (dark-gray) now 3 clearly distinguishable tones.' },
    { type: 'improve', text: 'Asphalt: roughness 0.9 -> 0.75, metalness 0.1 -> 0.15 - reflects light a bit more, gets brighter highlights from lamps.' },
  ],
}
