export default {
  version: '5.9.5',
  date: '2026-04-17',
  title_ru: 'Golden Rush: лидерборд + награды в UI',
  title_en: 'Golden Rush: leaderboard + rewards in UI',
  changes_ru: [
    { type: 'new', text: 'Новая вкладка «GR Top» (/goldenrush-top) — топы по победам / играм / захватам центра, моя статистика (игры, победы, win-rate, центры) и фид последних матчей' },
    { type: 'new', text: 'Gameover экран в GR Online теперь показывает начисление бриксов с breakdown'ом: участие (+2), победа (+10), взятие центра (+3)' },
    { type: 'new', text: 'Использует уже внедрённые серверные endpoints: GET /api/gr/leaderboard, /api/gr/my, /api/gr/recent' },
    { type: 'fix', text: 'AppRoutes.jsx: MoreTabPage получал undefined вместо onShowSkinShop (опечатка onSkinShop) — native-вкладка «Ещё» не могла открывать магазин скинов' },
    { type: 'improve', text: 'useGoldenRushWS теперь отдаёт resignedBy и myReward в payloadе gameover — компоненты могут показать сдавшегося и разбивку награды' },
  ],
  changes_en: [
    { type: 'new', text: 'New “GR Top” tab (/goldenrush-top) — leaderboards by wins / games / center captures, your personal stats (games, wins, win-rate, centers) and a feed of recent matches' },
    { type: 'new', text: 'GR Online gameover screen now shows the earned bricks with a breakdown: participation (+2), win (+10), center capture (+3)' },
    { type: 'new', text: 'Uses the already-shipped server endpoints: GET /api/gr/leaderboard, /api/gr/my, /api/gr/recent' },
    { type: 'fix', text: 'AppRoutes.jsx: MoreTabPage received undefined instead of onShowSkinShop (typo onSkinShop) — the native “More” tab could not open the skin shop' },
    { type: 'improve', text: 'useGoldenRushWS now exposes resignedBy and myReward from the gameover payload so components can show the resigner and the reward breakdown' },
  ],
}
