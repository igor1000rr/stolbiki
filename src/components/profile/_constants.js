/**
 * Константы профиля — аватары, цвета, рарность, ачивки, фейковый leaderboard.
 * Извлечено из Profile.jsx (god-component refactor).
 */

export const AVATARS = {
  default: { label: 'Default', bg: 'linear-gradient(135deg, #6db4ff, #9b59b6)', render: (name) => name.charAt(0).toUpperCase() },
  cat: { label: 'Cat', bg: 'linear-gradient(135deg, #ff9a56, #ff6b6b)', render: () => '🐱' },
  dog: { label: 'Dog', bg: 'linear-gradient(135deg, #8B5E3C, #D4A574)', render: () => '🐶' },
  fox: { label: 'Fox', bg: 'linear-gradient(135deg, #ff6b35, #ffc145)', render: () => '🦊' },
  bear: { label: 'Bear', bg: 'linear-gradient(135deg, #6B4226, #A0522D)', render: () => '🐻' },
  owl: { label: 'Owl', bg: 'linear-gradient(135deg, #5c6bc0, #3dd68c)', render: () => '🦩' },
  robot: { label: 'Robot', bg: 'linear-gradient(135deg, #455a64, #78909c)', render: () => '🤖' },
  crown: { label: 'Crown', bg: 'linear-gradient(135deg, #ffc145, #ff9800)', render: () => '👑' },
  fire: { label: 'Fire', bg: 'linear-gradient(135deg, #ff5722, #ff9800)', render: () => '🔥' },
  star: { label: 'Star', bg: 'linear-gradient(135deg, #ffc145, #fff176)', render: () => '⭐' },
  diamond: { label: 'Diamond', bg: 'linear-gradient(135deg, #00bcd4, #b9f2ff)', render: () => '💎' },
  ghost: { label: 'Ghost', bg: 'linear-gradient(135deg, #9e9e9e, #e0e0e0)', render: () => '👻' },
}

export const ACH_COLORS = {
  bronze: 'var(--bronze)', silver: 'var(--silver)', gold: 'var(--gold)',
  diamond: 'var(--p1-light)', ruby: 'var(--p2)', emerald: 'var(--green)',
}

export const RARITY_COLORS = {
  common: 'var(--ink3)', rare: '#4a9eff', epic: '#9b59b6', legendary: '#ffc145',
}

export const RARITY_LABELS_RU = { common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' }
export const RARITY_LABELS_EN = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export const ALL_ACHIEVEMENTS = [
  { id: 'first_win', color: ACH_COLORS.bronze, rarity: 'common', holders: 82, name: 'Первая победа', nameEn: 'First win', desc: 'Победите в первой партии', descEn: 'Win your first game', check: p => p.wins >= 1 },
  { id: 'perfect', color: ACH_COLORS.gold, rarity: 'rare', holders: 18, name: 'Доминирование', nameEn: 'Domination', desc: 'Победите 6:0', descEn: 'Win 6:0', check: p => p.perfectWins >= 1 },
  { id: 'perfect_3', color: ACH_COLORS.diamond, rarity: 'epic', holders: 4, name: 'Абсолют', nameEn: 'Absolute', desc: '3 победы 6:0', descEn: '3 perfect wins', check: p => p.perfectWins >= 3 },
  { id: 'fast_win', color: ACH_COLORS.silver, rarity: 'rare', holders: 22, name: 'Блиц', nameEn: 'Blitz', desc: 'Победа за 10 ходов', descEn: 'Win in 10 moves', check: p => (p.fastWins || 0) >= 1 },
  { id: 'fast_win_5', color: ACH_COLORS.gold, rarity: 'epic', holders: 6, name: 'Молния', nameEn: 'Lightning', desc: '5 быстрых побед', descEn: '5 fast wins', check: p => (p.fastWins || 0) >= 5 },
  { id: 'streak_3', color: ACH_COLORS.bronze, rarity: 'common', holders: 55, name: 'В ударе', nameEn: 'On fire', desc: '3 победы подряд', descEn: '3 wins in a row', check: p => p.bestStreak >= 3 },
  { id: 'streak_5', color: ACH_COLORS.silver, rarity: 'rare', holders: 28, name: 'Неудержимый', nameEn: 'Unstoppable', desc: '5 побед подряд', descEn: '5 wins in a row', check: p => p.bestStreak >= 5 },
  { id: 'streak_10', color: ACH_COLORS.gold, rarity: 'epic', holders: 9, name: 'Легенда', nameEn: 'Legend', desc: '10 побед подряд', descEn: '10 wins in a row', check: p => p.bestStreak >= 10 },
  { id: 'streak_20', color: ACH_COLORS.diamond, rarity: 'legendary', holders: 1, name: 'Бессмертный', nameEn: 'Immortal', desc: '20 побед подряд', descEn: '20 wins in a row', check: p => p.bestStreak >= 20 },
  { id: 'golden_1', color: ACH_COLORS.bronze, rarity: 'common', holders: 61, name: 'Золотой', nameEn: 'Golden', desc: 'Достройте золотую высотку', descEn: 'Complete the golden highrise', check: p => p.goldenClosed >= 1 },
  { id: 'golden_10', color: ACH_COLORS.silver, rarity: 'rare', holders: 14, name: 'Золотая лихорадка', nameEn: 'Gold rush', desc: 'Достройте золотую 10 раз', descEn: 'Complete golden 10 times', check: p => p.goldenClosed >= 10 },
  { id: 'golden_50', color: ACH_COLORS.gold, rarity: 'legendary', holders: 2, name: 'Золотой магнат', nameEn: 'Gold magnate', desc: 'Достройте золотую 50 раз', descEn: 'Complete golden 50 times', check: p => p.goldenClosed >= 50 },
  { id: 'comeback', color: ACH_COLORS.silver, rarity: 'rare', holders: 31, name: 'Камбэк', nameEn: 'Comeback', desc: 'Победа при отставании 3+', descEn: 'Win when trailing by 3+', check: p => p.comebacks >= 1 },
  { id: 'comeback_5', color: ACH_COLORS.gold, rarity: 'epic', holders: 7, name: 'Феникс', nameEn: 'Phoenix', desc: '5 камбэков', descEn: '5 comebacks', check: p => p.comebacks >= 5 },
  { id: 'games_10', color: ACH_COLORS.bronze, rarity: 'common', holders: 74, name: 'Новичок', nameEn: 'Newcomer', desc: '10 партий', descEn: '10 games played', check: p => p.gamesPlayed >= 10 },
  { id: 'games_50', color: ACH_COLORS.silver, rarity: 'common', holders: 42, name: 'Опытный', nameEn: 'Experienced', desc: '50 партий', descEn: '50 games played', check: p => p.gamesPlayed >= 50 },
  { id: 'games_100', color: ACH_COLORS.gold, rarity: 'rare', holders: 19, name: 'Ветеран', nameEn: 'Veteran', desc: '100 партий', descEn: '100 games played', check: p => p.gamesPlayed >= 100 },
  { id: 'games_500', color: ACH_COLORS.diamond, rarity: 'epic', holders: 3, name: 'Адепт', nameEn: 'Adept', desc: '500 партий', descEn: '500 games played', check: p => p.gamesPlayed >= 500 },
  { id: 'rating_1200', color: ACH_COLORS.bronze, rarity: 'common', holders: 48, name: 'Рост', nameEn: 'Rising', desc: 'Рейтинг 1200', descEn: 'Reach 1200 rating', check: p => p.rating >= 1200 },
  { id: 'rating_1500', color: ACH_COLORS.silver, rarity: 'rare', holders: 20, name: 'Мастер', nameEn: 'Master', desc: 'Рейтинг 1500', descEn: 'Reach 1500 rating', check: p => p.rating >= 1500 },
  { id: 'rating_1800', color: ACH_COLORS.gold, rarity: 'epic', holders: 5, name: 'Гроссмейстер', nameEn: 'Grandmaster', desc: 'Рейтинг 1800', descEn: 'Reach 1800 rating', check: p => p.rating >= 1800 },
  { id: 'rating_2000', color: ACH_COLORS.diamond, rarity: 'legendary', holders: 1, name: 'Чемпион', nameEn: 'Champion', desc: 'Рейтинг 2000', descEn: 'Reach 2000 rating', check: p => p.rating >= 2000 },
  { id: 'beat_hard', color: ACH_COLORS.gold, rarity: 'rare', holders: 25, name: 'Стратег', nameEn: 'Strategist', desc: 'Победите AI на сложной', descEn: 'Beat AI on hard', check: p => p.beatHardAi },
  { id: 'online_win', color: ACH_COLORS.bronze, rarity: 'common', holders: 37, name: 'Онлайн', nameEn: 'Online', desc: 'Победа в онлайн-матче', descEn: 'Win an online match', check: p => (p.onlineWins || 0) >= 1 },
  { id: 'online_10', color: ACH_COLORS.silver, rarity: 'rare', holders: 12, name: 'Боец', nameEn: 'Fighter', desc: '10 онлайн-побед', descEn: '10 online wins', check: p => (p.onlineWins || 0) >= 10 },
  { id: 'style_twin', color: ACH_COLORS.diamond, rarity: 'rare', holders: 14, name: 'Близнецы по стилю', nameEn: 'Style Twin', desc: 'Сыграть онлайн с одинаковыми блоками', descEn: 'Play online with identical blocks', check: p => (p.styleTwinCount || 0) >= 1 },
  { id: 'puzzle_10', color: ACH_COLORS.silver, rarity: 'common', holders: 33, name: 'Решатель', nameEn: 'Solver', desc: 'Решите 10 головоломок', descEn: 'Solve 10 puzzles', check: p => (p.puzzlesSolved || 0) >= 10 },
  { id: 'rush_5', color: ACH_COLORS.bronze, rarity: 'common', holders: 26, name: 'Спринтер', nameEn: 'Sprinter', desc: 'Puzzle Rush: 5+ за раунд', descEn: 'Puzzle Rush: 5+ in a round', check: p => (p.rushBest || 0) >= 5 },
  { id: 'rush_15', color: ACH_COLORS.gold, rarity: 'epic', holders: 4, name: 'Ураган', nameEn: 'Hurricane', desc: 'Puzzle Rush: 15+ за раунд', descEn: 'Puzzle Rush: 15+ in a round', check: p => (p.rushBest || 0) >= 15 },
  { id: 'arena_join', color: ACH_COLORS.bronze, rarity: 'common', holders: 17, name: 'Арена', nameEn: 'Arena', desc: 'Участие в турнире Arena', descEn: 'Participate in Arena tournament', check: p => (p.arenaStats?.tournaments || 0) >= 1 },
  { id: 'arena_top3', color: ACH_COLORS.gold, rarity: 'rare', holders: 8, name: 'Призёр', nameEn: 'Medalist', desc: 'Топ-3 в турнире Arena', descEn: 'Top 3 in Arena tournament', check: p => (p.arenaStats?.top3 || 0) >= 1 },
  { id: 'level_5', color: ACH_COLORS.bronze, rarity: 'common', holders: 53, name: 'Новичок+', nameEn: 'Rookie+', desc: 'Достигните 5 уровня', descEn: 'Reach level 5', check: p => (p.level || 1) >= 5 },
  { id: 'level_10', color: ACH_COLORS.silver, rarity: 'rare', holders: 21, name: 'Ветеран', nameEn: 'Veteran', desc: 'Достигните 10 уровня', descEn: 'Reach level 10', check: p => (p.level || 1) >= 10 },
  { id: 'level_20', color: ACH_COLORS.gold, rarity: 'epic', holders: 6, name: 'Мастер скинов', nameEn: 'Skin Master', desc: 'Достигните 20 уровня — все скины открыты', descEn: 'Reach level 20 — all skins unlocked', check: p => (p.level || 1) >= 20 },
]

export const FAKE_LEADERBOARD = [
  { name: 'AlphaStacker', rating: 1847, wins: 342, games: 501 },
  { name: 'GoldenMaster', rating: 1623, wins: 198, games: 312 },
  { name: 'SwapKing', rating: 1534, wins: 167, games: 289 },
  { name: 'StackPro', rating: 1489, wins: 145, games: 267 },
  { name: 'RookieRiser', rating: 1356, wins: 89, games: 178 },
  { name: 'ChipMaster', rating: 1298, wins: 76, games: 165 },
  { name: 'GoldenEye', rating: 1245, wins: 64, games: 134 },
  { name: 'NoviceNinja', rating: 1178, wins: 45, games: 112 },
]

export const STORAGE_KEY = 'stolbiki_profile'

export function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } }
export function saveLocal(p) { if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); else localStorage.removeItem(STORAGE_KEY) }

export function defaultProfile(name) {
  return { name, rating: 1000, gamesPlayed: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0, goldenClosed: 0, comebacks: 0, achievements: [], friends: [], history: [], createdAt: Date.now() }
}

export function achProgress(id, p) {
  const map = {
    first_win: [p.wins, 1], streak_3: [p.bestStreak, 3], streak_5: [p.bestStreak, 5],
    streak_10: [p.bestStreak, 10], golden_1: [p.goldenClosed, 1], golden_10: [p.goldenClosed, 10],
    comeback: [p.comebacks, 1], games_10: [p.gamesPlayed, 10], games_50: [p.gamesPlayed, 50],
    games_100: [p.gamesPlayed, 100], rating_1200: [p.rating, 1200], rating_1500: [p.rating, 1500],
    beat_hard: [p.beatHardAi ? 1 : 0, 1], perfect: [p.perfectWins || 0, 1],
    rush_5: [p.rushBest || 0, 5], rush_15: [p.rushBest || 0, 15],
    arena_join: [p.arenaStats?.tournaments || 0, 1], arena_top3: [p.arenaStats?.top3 || 0, 1],
    level_5: [p.level || 1, 5], level_10: [p.level || 1, 10], level_20: [p.level || 1, 20],
    style_twin: [p.styleTwinCount || 0, 1],
  }
  return map[id] || [0, 1]
}
