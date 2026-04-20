export default {
  version: '5.9.10',
  date: '2026-04-20',
  title_ru: 'Landing: дороги в превью-городе тоже починены',
  title_en: 'Landing: roads in the preview city also fixed',
  changes_ru: [
    { type: 'fix', text: 'В 3D-превью Города побед на главной странице (highriseheist.com) дороги также были жёлто-золотыми — у компонента LandingCity3D была собственная копия текстур с ярко-жёлтой разметкой #ffe14a и emissive-подсветкой. Теперь компонент использует те же shared-текстуры из victoryCityTextures.js, что и основной город в профиле.' },
    { type: 'refactor', text: 'Удалены 3 локальные дубликата текстурных функций (makeRoadTexture / makeStarTexture / makeSoftDotTexture) из LandingCity3D.jsx. Импортируются из shared victoryCityTextures.js. Минус 82 строки (701 → 618).' },
    { type: 'fix', text: 'Материал дорог — MeshStandardMaterial с жёлтым emissive 0xffe14a заменён на MeshBasicMaterial. Текстура повернута на 90° через rotation+center, разметка теперь идёт вдоль дороги а не поперёк (в этом компоненте plane ориентирован длиной по Y/V, в отличие от VictoryCity).' },
  ],
  changes_en: [
    { type: 'fix', text: 'The Victory City 3D preview on the landing page (highriseheist.com) also had the yellow-gold roads issue — LandingCity3D had its own copy of texture factories with bright yellow #ffe14a markings and emissive glow. The component now uses the same shared textures from victoryCityTextures.js as the real profile city.' },
    { type: 'refactor', text: 'Removed 3 local duplicated texture functions (makeRoadTexture / makeStarTexture / makeSoftDotTexture) from LandingCity3D.jsx. They are now imported from shared victoryCityTextures.js. Minus 82 lines (701 → 618).' },
    { type: 'fix', text: 'Road material — MeshStandardMaterial with yellow emissive 0xffe14a replaced by MeshBasicMaterial. Texture rotated 90° via rotation+center, markings now run ALONG the road instead of across (this component orients its plane lengthwise along Y/V, unlike VictoryCity).' },
  ],
}
