import { useState, useEffect } from 'react'
import * as API from '../engine/api'
import { useI18n } from '../engine/i18n'
import { useGameContext } from '../engine/GameContext'
import Icon from './Icon'
import ProfileAccount from './ProfileAccount'
import ProfileFriends from './ProfileFriends'
import ProfileAnalytics from './ProfileAnalytics'
import Mascot from './Mascot'

// Аватары — SVG символы
const AVATARS = {
  default: { label: 'Default', bg: 'linear-gradient(135deg, #6db4ff, #9b59b6)', render: (name) => name.charAt(0).toUpperCase() },
  cat: { label: 'Cat', bg: 'linear-gradient(135deg, #ff9a56, #ff6b6b)', render: () => '🐱' },
  dog: { label: 'Dog', bg: 'linear-gradient(135deg, #8B5E3C, #D4A574)', render: () => '🐶' },
  fox: { label: 'Fox', bg: 'linear-gradient(135deg, #ff6b35, #ffc145)', render: () => '🦊' },
  bear: { label: 'Bear', bg: 'linear-gradient(135deg, #6B4226, #A0522D)', render: () => '🐻' },
  owl: { label: 'Owl', bg: 'linear-gradient(135deg, #5c6bc0, #3dd68c)', render: () => '🦉' },
  robot: { label: 'Robot', bg: 'linear-gradient(135deg, #455a64, #78909c)', render: () => '🤖' },
  crown: { label: 'Crown', bg: 'linear-gradient(135deg, #ffc145, #ff9800)', render: () => '👑' },
  fire: { label: 'Fire', bg: 'linear-gradient(135deg, #ff5722, #ff9800)', render: () => '🔥' },
  star: { label: 'Star', bg: 'linear-gradient(135deg, #ffc145, #fff176)', render: () => '⭐' },
  diamond: { label: 'Diamond', bg: 'linear-gradient(135deg, #00bcd4, #b9f2ff)', render: () => '💎' },
  ghost: { label: 'Ghost', bg: 'linear-gradient(135deg, #9e9e9e, #e0e0e0)', render: () => '👻' },
}

function AvatarCircle({ avatar, name, size = 56 }) {
  const a = AVATARS[avatar] || AVATARS.default
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: a.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {a.render(name || '?')}
    </div>
  )
}

// ─── localStorage fallback ───
const STORAGE_KEY = 'stolbiki_profile'
function loadLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } }
function saveLocal(p) { if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); else localStorage.removeItem(STORAGE_KEY) }

function defaultProfile(name) {
  return {
    name,
    rating: 1000,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestStreak: 0,
    goldenClosed: 0,
    comebacks: 0,
    achievements: [],
    friends: [],
    history: [],
    createdAt: Date.now(),
  }
}

// ─── Ачивки ───
const ACH_COLORS = {
  bronze: 'var(--bronze)', silver: 'var(--silver)', gold: 'var(--gold)', diamond: 'var(--p1-light)', ruby: 'var(--p2)', emerald: 'var(--green)',
}
const ALL_ACHIEVEMENTS = [
  // Победы
  { id: 'first_win', color: ACH_COLORS.bronze, name: 'Первая победа', nameEn: 'First win', desc: 'Победите в первой партии', descEn: 'Win your first game', check: p => p.wins >= 1 },
  { id: 'perfect', color: ACH_COLORS.gold, name: 'Доминирование', nameEn: 'Domination', desc: 'Победите 6:0', descEn: 'Win 6:0', check: p => p.perfectWins >= 1 },
  { id: 'perfect_3', color: ACH_COLORS.diamond, name: 'Абсолют', nameEn: 'Absolute', desc: '3 победы 6:0', descEn: '3 perfect wins', check: p => p.perfectWins >= 3 },
  { id: 'fast_win', color: ACH_COLORS.silver, name: 'Блиц', nameEn: 'Blitz', desc: 'Победа за 10 ходов', descEn: 'Win in 10 moves', check: p => (p.fastWins || 0) >= 1 },
  { id: 'fast_win_5', color: ACH_COLORS.gold, name: 'Молния', nameEn: 'Lightning', desc: '5 быстрых побед', descEn: '5 fast wins', check: p => (p.fastWins || 0) >= 5 },
  // Серии
  { id: 'streak_3', color: ACH_COLORS.bronze, name: 'В ударе', nameEn: 'On fire', desc: '3 победы подряд', descEn: '3 wins in a row', check: p => p.bestStreak >= 3 },
  { id: 'streak_5', color: ACH_COLORS.silver, name: 'Неудержимый', nameEn: 'Unstoppable', desc: '5 побед подряд', descEn: '5 wins in a row', check: p => p.bestStreak >= 5 },
  { id: 'streak_10', color: ACH_COLORS.gold, name: 'Легенда', nameEn: 'Legend', desc: '10 побед подряд', descEn: '10 wins in a row', check: p => p.bestStreak >= 10 },
  { id: 'streak_20', color: ACH_COLORS.diamond, name: 'Бессмертный', nameEn: 'Immortal', desc: '20 побед подряд', descEn: '20 wins in a row', check: p => p.bestStreak >= 20 },
  // Золотая стойка
  { id: 'golden_1', color: ACH_COLORS.bronze, name: 'Золотой', nameEn: 'Golden', desc: 'Достройте золотую высотку', descEn: 'Complete the golden highrise', check: p => p.goldenClosed >= 1 },
  { id: 'golden_10', color: ACH_COLORS.silver, name: 'Золотая лихорадка', nameEn: 'Gold rush', desc: 'Достройте золотую 10 раз', descEn: 'Complete golden 10 times', check: p => p.goldenClosed >= 10 },
  { id: 'golden_50', color: ACH_COLORS.gold, name: 'Золотой магнат', nameEn: 'Gold magnate', desc: 'Достройте золотую 50 раз', descEn: 'Complete golden 50 times', check: p => p.goldenClosed >= 50 },
  // Камбэки
  { id: 'comeback', color: ACH_COLORS.silver, name: 'Камбэк', nameEn: 'Comeback', desc: 'Победа при отставании 3+', descEn: 'Win when trailing by 3+', check: p => p.comebacks >= 1 },
  { id: 'comeback_5', color: ACH_COLORS.gold, name: 'Феникс', nameEn: 'Phoenix', desc: '5 камбэков', descEn: '5 comebacks', check: p => p.comebacks >= 5 },
  // Партии
  { id: 'games_10', color: ACH_COLORS.bronze, name: 'Новичок', nameEn: 'Newcomer', desc: '10 партий', descEn: '10 games played', check: p => p.gamesPlayed >= 10 },
  { id: 'games_50', color: ACH_COLORS.silver, name: 'Опытный', nameEn: 'Experienced', desc: '50 партий', descEn: '50 games played', check: p => p.gamesPlayed >= 50 },
  { id: 'games_100', color: ACH_COLORS.gold, name: 'Ветеран', nameEn: 'Veteran', desc: '100 партий', descEn: '100 games played', check: p => p.gamesPlayed >= 100 },
  { id: 'games_500', color: ACH_COLORS.diamond, name: 'Адепт', nameEn: 'Adept', desc: '500 партий', descEn: '500 games played', check: p => p.gamesPlayed >= 500 },
  // Рейтинг
  { id: 'rating_1200', color: ACH_COLORS.bronze, name: 'Рост', nameEn: 'Rising', desc: 'Рейтинг 1200', descEn: 'Reach 1200 rating', check: p => p.rating >= 1200 },
  { id: 'rating_1500', color: ACH_COLORS.silver, name: 'Мастер', nameEn: 'Master', desc: 'Рейтинг 1500', descEn: 'Reach 1500 rating', check: p => p.rating >= 1500 },
  { id: 'rating_1800', color: ACH_COLORS.gold, name: 'Гроссмейстер', nameEn: 'Grandmaster', desc: 'Рейтинг 1800', descEn: 'Reach 1800 rating', check: p => p.rating >= 1800 },
  { id: 'rating_2000', color: ACH_COLORS.diamond, name: 'Чемпион', nameEn: 'Champion', desc: 'Рейтинг 2000', descEn: 'Reach 2000 rating', check: p => p.rating >= 2000 },
  // Специальные
  { id: 'beat_hard', color: ACH_COLORS.gold, name: 'Стратег', nameEn: 'Strategist', desc: 'Победите AI на сложной', descEn: 'Beat AI on hard', check: p => p.beatHardAi },
  { id: 'online_win', color: ACH_COLORS.bronze, name: 'Онлайн', nameEn: 'Online', desc: 'Победа в онлайн-матче', descEn: 'Win an online match', check: p => (p.onlineWins || 0) >= 1 },
  { id: 'online_10', color: ACH_COLORS.silver, name: 'Боец', nameEn: 'Fighter', desc: '10 онлайн-побед', descEn: '10 online wins', check: p => (p.onlineWins || 0) >= 10 },
  { id: 'puzzle_10', color: ACH_COLORS.silver, name: 'Решатель', nameEn: 'Solver', desc: 'Решите 10 головоломок', descEn: 'Solve 10 puzzles', check: p => (p.puzzlesSolved || 0) >= 10 },
  // v4.0
  { id: 'rush_5', color: ACH_COLORS.bronze, name: 'Спринтер', nameEn: 'Sprinter', desc: 'Puzzle Rush: 5+ за раунд', descEn: 'Puzzle Rush: 5+ in a round', check: p => (p.rushBest || 0) >= 5 },
  { id: 'rush_15', color: ACH_COLORS.gold, name: 'Ураган', nameEn: 'Hurricane', desc: 'Puzzle Rush: 15+ за раунд', descEn: 'Puzzle Rush: 15+ in a round', check: p => (p.rushBest || 0) >= 15 },
  { id: 'arena_join', color: ACH_COLORS.bronze, name: 'Арена', nameEn: 'Arena', desc: 'Участие в турнире Arena', descEn: 'Participate in Arena tournament', check: p => (p.arenaStats?.tournaments || 0) >= 1 },
  { id: 'arena_top3', color: ACH_COLORS.gold, name: 'Призёр', nameEn: 'Medalist', desc: 'Топ-3 в турнире Arena', descEn: 'Top 3 in Arena tournament', check: p => (p.arenaStats?.top3 || 0) >= 1 },
  { id: 'level_5', color: ACH_COLORS.bronze, name: 'Новичок+', nameEn: 'Rookie+', desc: 'Достигните 5 уровня', descEn: 'Reach level 5', check: p => (p.level || 1) >= 5 },
  { id: 'level_10', color: ACH_COLORS.silver, name: 'Ветеран', nameEn: 'Veteran', desc: 'Достигните 10 уровня', descEn: 'Reach level 10', check: p => (p.level || 1) >= 10 },
  { id: 'level_20', color: ACH_COLORS.gold, name: 'Мастер скинов', nameEn: 'Skin Master', desc: 'Достигните 20 уровня — все скины открыты', descEn: 'Reach level 20 — all skins unlocked', check: p => (p.level || 1) >= 20 },
]

// ─── Фейковый лидерборд (заменится на серверный) ───
const FAKE_LEADERBOARD = [
  { name: 'AlphaStacker', rating: 1847, wins: 342, games: 501 },
  { name: 'GoldenMaster', rating: 1623, wins: 198, games: 312 },
  { name: 'SwapKing', rating: 1534, wins: 167, games: 289 },
  { name: 'StackPro', rating: 1489, wins: 145, games: 267 },
  { name: 'RookieRiser', rating: 1356, wins: 89, games: 178 },
  { name: 'ChipMaster', rating: 1298, wins: 76, games: 165 },
  { name: 'GoldenEye', rating: 1245, wins: 64, games: 134 },
  { name: 'NoviceNinja', rating: 1178, wins: 45, games: 112 },
]

function RatingBadge({ rating, en }) {
  let color, label
  if (rating >= 1500) { color = 'var(--gold)'; label = en ? 'Master' : 'Мастер' }
  else if (rating >= 1200) { color = 'var(--purple)'; label = en ? 'Expert' : 'Опытный' }
  else if (rating >= 1000) { color = 'var(--p1)'; label = en ? 'Novice' : 'Новичок' }
  else { color = 'var(--ink3)'; label = en ? 'Beginner' : 'Начинающий' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
      color, border: `1px solid ${color}33`, background: `${color}11` }}>{label}</span>
  )
}

function achProgress(id, p) {
  const map = {
    first_win: [p.wins, 1], streak_3: [p.bestStreak, 3], streak_5: [p.bestStreak, 5],
    streak_10: [p.bestStreak, 10], golden_1: [p.goldenClosed, 1], golden_10: [p.goldenClosed, 10],
    comeback: [p.comebacks, 1], games_10: [p.gamesPlayed, 10], games_50: [p.gamesPlayed, 50],
    games_100: [p.gamesPlayed, 100], rating_1200: [p.rating, 1200], rating_1500: [p.rating, 1500],
    beat_hard: [p.beatHardAi ? 1 : 0, 1], perfect: [p.perfectWins || 0, 1],
    rush_5: [p.rushBest || 0, 5], rush_15: [p.rushBest || 0, 15],
    arena_join: [p.arenaStats?.tournaments || 0, 1], arena_top3: [p.arenaStats?.top3 || 0, 1],
    level_5: [p.level || 1, 5], level_10: [p.level || 1, 10], level_20: [p.level || 1, 20],
  }
  return map[id] || [0, 1]
}

function AchievementCard({ ach, unlocked, profile, en }) {
  const [cur, target] = profile ? achProgress(ach.id, profile) : [0, 1]
  const pct = Math.min(cur / target, 1)
  const name = en && ach.nameEn ? ach.nameEn : ach.name
  const desc = en && ach.descEn ? ach.descEn : ach.desc
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: unlocked ? `linear-gradient(135deg, ${ach.color}08, ${ach.color}04)` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${unlocked ? ach.color + '35' : 'var(--surface2)'}`,
      opacity: unlocked ? 1 : 0.5,
      transition: 'all 0.2s',
      cursor: 'default',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: unlocked ? `linear-gradient(135deg, ${ach.color}30, ${ach.color}15)` : 'var(--surface)',
        border: `2px solid ${unlocked ? ach.color : 'var(--surface3)'}`,
        boxShadow: unlocked ? `0 0 10px ${ach.color}20` : 'none',
        fontSize: 12, fontWeight: 800, color: unlocked ? ach.color : 'var(--ink3)' }}>
        {name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? 'var(--ink)' : 'var(--ink3)' }}>{name}</div>
        <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{desc}</div>
        {!unlocked && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 2,
                background: pct > 0.7 ? 'linear-gradient(90deg, #3dd68c, #2ecc71)' : 'linear-gradient(90deg, #6db4ff, #4a9eff)',
                transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--ink3)', minWidth: 30 }}>{Math.min(cur, target)}/{target}</span>
          </div>
        )}
      </div>
      {unlocked && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ach.color} strokeWidth="2.5" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>}
    </div>
  )
}

// SVG график рейтинга
function RatingChart({ data }) {
  if (!data || data.length < 2) return null
  const pts = [...data].reverse().slice(-50) // последние 50, хронологически
  const ratings = pts.map(p => p.rating)
  const min = Math.min(...ratings, 950) - 30
  const max = Math.max(...ratings, 1050) + 30
  const w = 100, h = 50
  const points = ratings.map((r, i) => {
    const x = (i / (ratings.length - 1)) * w
    const y = h - ((r - min) / (max - min)) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastR = ratings[ratings.length - 1]
  const firstR = ratings[0]
  const color = lastR >= firstR ? 'var(--green)' : 'var(--p2)'

  // Линии рейтинг-тиров (только если попадают в диапазон)
  const tiers = [
    { r: 1200, label: '1200', color: 'var(--purple)' },
    { r: 1500, label: '1500', color: 'var(--gold)' },
    { r: 1800, label: '1800', color: 'var(--p2)' },
  ].filter(t => t.r > min && t.r < max)

  return (
    <div>
      <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ width: '100%', height: 90 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Линии тиров */}
        {tiers.map(t => {
          const y = h - ((t.r - min) / (max - min)) * h
          return <g key={t.r}>
            <line x1="0" y1={y} x2={w} y2={y} stroke={t.color} strokeWidth="0.3" strokeDasharray="2,2" opacity="0.5" />
            <text x={w + 1} y={y + 1} fontSize="3" fill={t.color} opacity="0.7">{t.label}</text>
          </g>
        })}
        <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#rg)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Точка на последнем значении */}
        {(() => {
          const lx = w
          const ly = h - ((lastR - min) / (max - min)) * h
          return <circle cx={lx} cy={ly} r="1.5" fill={color} />
        })()}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>
        <span>{firstR}</span>
        <span>{pts.length} {pts.length === 1 ? 'game' : 'games'}</span>
        <span style={{ fontWeight: 600, color }}>{lastR}</span>
      </div>
    </div>
  )
}

// Сезонный лидерборд
function SeasonSection({ data, myName }) {
  if (!data?.season) return null
  const { season, leaderboard } = data
  return (
    <div className="dash-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Season {season.name}</h3>
        <span style={{ fontSize: 10, color: 'var(--ink3)' }}>
          {season.start_date} — {season.end_date}
        </span>
      </div>
      {leaderboard && leaderboard.length > 0 ? (
        <table className="dash-table" style={{ fontSize: 12 }}>
          <thead>
            <tr><th>#</th><th>Player</th><th>Rating</th><th>Games</th><th>Wins</th></tr>
          </thead>
          <tbody>
            {leaderboard.map((p, i) => (
              <tr key={i} style={p.username === myName ? { background: 'rgba(74,158,255,0.08)' } : {}}>
                <td style={{ fontWeight: 600, color: i < 3 ? 'var(--gold)' : 'var(--ink3)' }}>{i + 1}</td>
                <td style={{ fontWeight: p.username === myName ? 700 : 400, color: p.username === myName ? 'var(--p1)' : 'var(--ink)' }}>
                  {p.username}
                  {p.level > 1 && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 4, opacity: 0.7 }}>Lv.{p.level}</span>}
                  {p.username === myName && <span style={{ fontSize: 9, color: 'var(--ink3)', marginLeft: 4 }}>(you)</span>}
                </td>
                <td style={{ fontWeight: 600 }}>{p.rating}</td>
                <td>{p.games}</td>
                <td>{p.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', padding: 16 }}>
          No games this season yet
        </div>
      )}
    </div>
  )
}

const loadProfile = loadLocal
const saveProfile = saveLocal

export default function Profile({ viewUsername, onClose }) {
  const isNative = !!window.Capacitor?.isNativePlatform?.()
  const { lang } = useI18n()
  const en = lang === 'en'
  const gameCtx = useGameContext()
  const [profile, setProfile] = useState(loadLocal)
  const [publicProfile, setPublicProfile] = useState(null)
  const [publicLoading, setPublicLoading] = useState(false)
  const [tab, setTab] = useState('profile')
  const [regName, setRegName] = useState('')
  const [regPass, setRegPass] = useState('')
  const [loginMode, setLoginMode] = useState(false)
  const [error, setError] = useState('')
  const [serverOnline, setServerOnline] = useState(false)
  const [friendsList, setFriendsList] = useState([])
  const [pendingFriends, setPendingFriends] = useState([])
  const [serverLeaderboard, setServerLeaderboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ratingHistory, setRatingHistory] = useState([])
  const [seasonData, setSeasonData] = useState(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [openingStats, setOpeningStats] = useState(null)
  const [streakData, setStreakData] = useState(null)
  const [missionsData, setMissionsData] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [referralData, setReferralData] = useState(null)

  // Проверяем сервер при старте
  useEffect(() => { API.checkServer().then(setServerOnline).catch(() => {}) }, [])

  // Загрузка публичного профиля
  useEffect(() => {
    if (!viewUsername) { setPublicProfile(null); return }
    setPublicLoading(true)
    API.getPublicProfile(viewUsername)
      .then(setPublicProfile)
      .catch(() => setPublicProfile(null))
      .finally(() => setPublicLoading(false))
  }, [viewUsername])
  // Загружаем данные с сервера
  useEffect(() => {
    if (!serverOnline || !API.isLoggedIn()) return
    API.getProfile().then(p => {
      const merged = { ...profile, ...p, name: p.username || profile?.name }
      setProfile(merged)
      saveLocal(merged)
    }).catch(() => {})
    loadFriends()
    API.getLeaderboard(30).then(setServerLeaderboard).catch(() => {})
    // Рейтинг история
    API.getRatingHistory()
      .then(setRatingHistory).catch(() => {})
    // Сезон
    API.getCurrentSeason().then(setSeasonData).catch(() => {})
    // Opening stats
    API.getOpeningStats()
      .then(setOpeningStats).catch(() => {})
    // Login streak
    API.getStreak().then(setStreakData).catch(() => {})
    // Daily missions
    API.getMissions().then(setMissionsData).catch(() => {})
    // Рефералы
    API.getReferrals().then(setReferralData).catch(() => {})
  }, [serverOnline]) // eslint-disable-line

  // Загрузка аналитики при переключении на вкладку
  useEffect(() => {
    if (tab !== 'analytics' || !serverOnline || !API.isLoggedIn() || analyticsData) return
    fetch('/api/profile/analytics', { headers: { Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` } })
      .then(r => r.json()).then(setAnalyticsData).catch(() => {})
  }, [tab, serverOnline])

  async function loadFriends() {
    if (!serverOnline || !API.isLoggedIn()) return
    try {
      const data = await API.getFriends()
      setFriendsList(data.friends || [])
      setPendingFriends(data.pending || [])
    } catch {}
  }

  // Друзья — логика в ProfileFriends.jsx

  useEffect(() => {
    if (profile) saveProfile(profile)
    if (gameCtx) gameCtx.emit('checkAdmin')
  }, [profile])

  async function register() {
    if (!regName.trim()) return
    setError('')
    const name = regName.trim()

    // Если сервер доступен и есть пароль — регистрируем на сервере
    if (serverOnline && regPass.length >= 4) {
      try {
        const user = await API.register(name, regPass)
        const p = { ...defaultProfile(name), ...user, name: user.username || name, isAdmin: user.isAdmin }
        setProfile(p); setRegPass(''); return
      } catch (e) { setError(e.message); return }
    }

    // Fallback — localStorage
    const p = defaultProfile(name)
    const adminNames = ['admin']
    if (adminNames.includes(name)) p.isAdmin = true
    setProfile(p)
  }

  async function doLogin() {
    if (!regName.trim() || !regPass) return
    setError('')
    try {
      const user = await API.login(regName.trim(), regPass)
      const p = { ...defaultProfile(user.username), ...user, name: user.username, isAdmin: user.isAdmin }
      setProfile(p); setRegPass('')
    } catch (e) { setError(e.message) }
  }

  function logout() {
    API.logout()
    localStorage.removeItem(STORAGE_KEY)
    setProfile(null)
  }

  // Записать результат партии (вызывается из Game через GameContext)
  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('recordGame', (won, score, vsHardAi, closedGolden, isComeback, isOnline) => {
      setProfile(prev => {
        if (!prev) return prev
        const p = { ...prev, history: [...(prev.history || [])] }
        const oldRating = p.rating
        p.gamesPlayed++
        if (won) {
          p.wins++
          p.winStreak++
          p.bestStreak = Math.max(p.bestStreak, p.winStreak)
          p.rating = Math.min(2500, p.rating + 25)
        } else {
          p.losses++
          p.winStreak = 0
          p.rating = Math.max(100, p.rating - 15)
        }
        if (closedGolden) p.goldenClosed++
        if (isComeback) p.comebacks++
        if (vsHardAi && won) p.beatHardAi = true
        if (score === '6:0') p.perfectWins = (p.perfectWins || 0) + 1

        // История
        p.history.unshift({
          won, score, date: Date.now(),
          ratingDelta: p.rating - oldRating,
          ratingAfter: p.rating,
          vsHardAi, closedGolden,
        })
        if (p.history.length > 50) p.history = p.history.slice(0, 50)

        const newAchIds = ALL_ACHIEVEMENTS.filter(a => a.check(p)).map(a => a.id)
        const brandNew = newAchIds.filter(id => !p.achievements.includes(id))
        p.achievements = newAchIds
        if (brandNew.length > 0 && gameCtx) {
          const ach = ALL_ACHIEVEMENTS.find(a => a.id === brandNew[0])
          if (ach) setTimeout(() => gameCtx.emit('onAchievement', ach), 1500)
        }
        return p
      })
      // Отправляем на сервер
      if (serverOnline && API.isLoggedIn()) {
        API.recordGame({ won, score, difficulty: vsHardAi ? 400 : 150, closedGolden, isComeback, isOnline: !!isOnline })
          .then(res => {
            if (res?.ratingDelta && gameCtx) {
              gameCtx.emit('onRatingDelta', res.ratingDelta)
            }
          })
          .catch(() => {})
      }
    })
  }, [serverOnline, gameCtx])

  // ─── Публичный профиль (просмотр чужого) ───
  if (viewUsername) {
    if (publicLoading) return (
      <div className="dash-card" style={{ maxWidth: 500, margin: isNative ? '12px auto' : '40px auto', textAlign: 'center', padding: isNative ? 24 : 40 }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ animation: 'float 1.5s ease-in-out infinite', display: 'inline-block' }}><img src="/mascot/wave.webp" alt="" width={48} height={48} style={{ objectFit: 'contain' }} /></div>
        </div>
      </div>
    )
    if (!publicProfile) return (
      <div className="dash-card" style={{ maxWidth: 500, margin: isNative ? '12px auto' : '40px auto', textAlign: 'center', padding: isNative ? 24 : 40 }}>
        <div style={{ fontSize: 14, color: 'var(--p2)' }}>{en ? 'User not found' : 'Пользователь не найден'}</div>
        {onClose && <button className="btn" onClick={onClose} style={{ marginTop: 12 }}>{en ? '← Back' : '← Назад'}</button>}
      </div>
    )
    const pp = publicProfile
    const ppWinRate = pp.gamesPlayed > 0 ? Math.round(pp.wins / pp.gamesPlayed * 100) : 0
    const ppAchievements = (pp.achievements || []).map(id => ALL_ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 500, margin: '20px auto' }}>
          {onClose && (
            <button className="btn" onClick={onClose} style={{ fontSize: 11, marginBottom: 12 }}>{en ? '← Back' : '← Назад'}</button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <AvatarCircle avatar={pp.avatar || 'default'} name={pp.username} size={56} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{pp.username}</div>
              <RatingBadge rating={pp.rating} en={en} />
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>{pp.rating}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>ELO</div>
            </div>
          </div>
          <div className="profile-stats-grid">
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{pp.gamesPlayed}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Games' : 'Партий'}</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{ppWinRate}%</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Win rate' : 'Винрейт'}</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{pp.bestStreak}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Streak' : 'Серия'}</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{pp.goldenClosed}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Golden' : 'Золотых'}</div>
            </div>
          </div>
          {ppAchievements.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>{en ? 'Achievements' : 'Ачивки'} ({ppAchievements.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ppAchievements.map(a => (
                  <span key={a.id} title={a.name_en || a.id} style={{
                    fontSize: 20, filter: 'none',
                  }}>{a.icon}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Не залогинен
  if (!profile) {
    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #36364a',
      background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }
    return (
      <div style={isNative ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 130px)' } : undefined}>
        <div className="dash-card" style={{ maxWidth: 400, margin: isNative ? '0 auto' : '40px auto', textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}></div>
          <h3>{loginMode ? (en ? 'Login' : 'Вход') : (en ? 'Register' : 'Регистрация')}</h3>
          {serverOnline && (
            <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 10 }}>● {en ? 'Server online' : 'Сервер онлайн'}</div>
          )}
          {error && <div style={{ fontSize: 12, color: 'var(--p2)', marginBottom: 10 }}>{error}</div>}
          <input type="text" placeholder={en ? "Username" : "Никнейм"} value={regName}
            onChange={e => setRegName(e.target.value)} style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && (loginMode ? doLogin() : register())} />
          {serverOnline && (
            <input type="password" placeholder={en ? "Password (min 6 chars)" : "Пароль (мин 6 символов)"} value={regPass}
              onChange={e => setRegPass(e.target.value)} style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && (loginMode ? doLogin() : register())} />
          )}
          <button className="btn primary" onClick={loginMode ? doLogin : register} style={{ width: '100%' }}>
            {loginMode ? (en ? 'Login' : 'Войти') : (en ? 'Create profile' : 'Создать профиль')}
          </button>
          {serverOnline && (
            <button className="btn" onClick={() => { setLoginMode(!loginMode); setError('') }}
              style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
              {loginMode ? (en ? 'No account? Register' : 'Нет аккаунта? Регистрация') : (en ? 'Have account? Login' : 'Уже есть аккаунт? Войти')}
            </button>
          )}
          {!serverOnline && (
            <p style={{ color: 'var(--ink3)', fontSize: 10, marginTop: 12 }}>
              {en ? 'Offline mode: data saved locally' : 'Оффлайн-режим: данные сохраняются локально'}
            </p>
          )}
        </div>
      </div>
    )
  }

  const winRate = profile.gamesPlayed > 0 ? (profile.wins / profile.gamesPlayed * 100).toFixed(1) : '—'
  const unlockedAch = ALL_ACHIEVEMENTS.filter(a => profile.achievements.includes(a.id))
  const lockedAch = ALL_ACHIEVEMENTS.filter(a => !profile.achievements.includes(a.id))
  const leaderboard = serverLeaderboard
    ? serverLeaderboard.map(u => ({ ...u, name: u.username, games: u.games, isMe: u.username === profile.name }))
    : [...FAKE_LEADERBOARD, { name: profile.name, rating: profile.rating, wins: profile.wins, games: profile.gamesPlayed, isMe: true }]
        .sort((a, b) => b.rating - a.rating)

  const tabs = [
    { id: 'profile', label: en ? 'Profile' : 'Профиль' },
    { id: 'analytics', label: en ? 'Analytics' : 'Аналитика' },
    { id: 'history', label: `${en ? 'History' : 'История'} (${(profile.history || []).length})` },
    { id: 'achievements', label: `${en ? 'Achievements' : 'Ачивки'} (${unlockedAch.length}/${ALL_ACHIEVEMENTS.length})` },
    { id: 'leaderboard', label: en ? 'Ranking' : 'Рейтинг' },
    { id: 'friends', label: en ? 'Friends' : 'Друзья' },
    ...(serverOnline && API.isLoggedIn() ? [
      { id: 'referrals', label: en ? 'Invite' : 'Пригласить' },
      { id: 'account', label: en ? 'Account' : 'Аккаунт' },
    ] : []),
  ]

  return (
    <div>
      {/* Мини-навигация */}
      <div className="profile-tabs" style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flexWrap: 'nowrap', padding: '0 2px' }}>
        {tabs.map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? 'primary' : ''}`}
            onClick={() => setTab(t.id)} style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.label}</button>
        ))}
      </div>

      {/* ─── Профиль ─── */}
      {tab === 'profile' && (
        <>
          <div className="dash-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            {/* Gradient header */}
            <div style={{ padding: '20px 20px 16px', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--p1) 8%, transparent))', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 6%, transparent), transparent 70%)', filter: 'blur(20px)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
                <div style={{ width: 56, height: 56, position: 'relative', cursor: 'pointer' }}
                  onClick={() => setShowAvatarPicker(v => !v)}>
                  <AvatarCircle avatar={profile.avatar || 'default'} name={profile.name} size={56} />
                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--surface)', border: '2px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="theme" size={10} color="var(--ink3)" />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{profile.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <RatingBadge rating={profile.rating} en={en} />
                    {(profile.level || missionsData?.level) > 1 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '1px 6px', borderRadius: 4 }}>
                        Lv.{profile.level || missionsData?.level || 1}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', textShadow: '0 0 20px color-mix(in srgb, var(--gold) 30%, transparent)' }}>{profile.rating}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{ en ? 'ELO rating' : 'ELO рейтинг'}</div>
                </div>
              </div>
            </div>
            {/* Streak + Calendar inside same card */}
            <div style={{ padding: '0 20px 16px' }}>
            {streakData && streakData.streak > 0 && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,193,69,0.06)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 2c.7 5.5-2.8 7-2.8 11a5.6 5.6 0 0011.2 0c0-4-3.5-5.5-2.8-11" stroke="#ffc145" strokeWidth="1.5" fill="rgba(255,193,69,0.15)"/></svg>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{streakData.streak}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink2)', marginLeft: 6 }}>{en ? 'day streak' : (streakData.streak >= 5 ? 'дней подряд' : streakData.streak >= 2 ? 'дня подряд' : 'день')}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Best' : 'Рекорд'}: {streakData.best}</div>
                {streakData.freeze > 0 && <div style={{ fontSize: 9, color: 'var(--p1)', padding: '2px 6px', background: 'rgba(74,158,255,0.1)', borderRadius: 4 }}>{en ? 'Freeze' : 'Защита'}: {streakData.freeze}</div>}
              </div>
            )}
            {streakData && streakData.calendar && streakData.calendar.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {Array.from({ length: 30 }).map((_, i) => {
                  const d = new Date(Date.now() - (29 - i) * 86400000)
                  const dateStr = d.toISOString().split('T')[0]
                  const active = streakData.calendar.includes(dateStr)
                  const isToday = dateStr === new Date().toISOString().split('T')[0]
                  return <div key={i} title={dateStr} style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: active ? 'var(--green)' : 'rgba(255,255,255,0.04)',
                    border: isToday ? '1.5px solid #ffc145' : '1px solid rgba(255,255,255,0.06)',
                    opacity: active ? 1 : 0.4,
                  }} />
                })}
              </div>
            )}
            </div>{/* end padding wrapper */}
          </div>

          {/* XP / Level */}
          {missionsData && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, transparent), color-mix(in srgb, var(--p1) 10%, transparent))',
                  border: '2px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                  fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
                  {missionsData.level}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink3)', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Level {missionsData.level}</span>
                    <span>{missionsData.xp} / {missionsData.xpForNext} XP</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${Math.min(100, (missionsData.xp / missionsData.xpForNext) * 100)}%`, height: '100%', borderRadius: 4,
                      background: 'linear-gradient(90deg, var(--accent), var(--p1))',
                      boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 40%, transparent)',
                      transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily missions */}
          {missionsData && missionsData.missions && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>{en ? 'Daily missions' : 'Задания дня'}</div>
                {missionsData.allDone && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>{en ? 'All done! +100 XP' : 'Все выполнены! +100 XP'}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {missionsData.missions.map(m => {
                  const pct = Math.min(m.progress / m.target, 1)
                  return (
                    <div key={m.mission_id} style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: m.completed ? 'rgba(61,214,140,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${m.completed ? 'rgba(61,214,140,0.15)' : 'var(--surface2)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: m.completed ? 'var(--green)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {m.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                          {en ? m.name_en : m.name_ru}
                        </span>
                        <span style={{ fontSize: 10, color: m.completed ? 'var(--green)' : 'var(--gold)' }}>+{m.xp_reward} XP</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3,
                            background: m.completed ? 'var(--green)' : 'linear-gradient(90deg, var(--accent), var(--p1))',
                            boxShadow: pct > 0.5 ? '0 0 6px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none',
                            transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--ink3)', minWidth: 28 }}>{m.progress}/{m.target}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Avatar picker */}
          {showAvatarPicker && (
            <div className="dash-card" style={{ marginBottom: 16, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 10 }}>Choose avatar</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(AVATARS).map(([key, av]) => (
                  <div key={key} onClick={async () => {
                    try { await API.updateAvatar(key) } catch {}
                    setProfile(p => { const np = { ...p, avatar: key }; saveLocal(np); return np })
                    setShowAvatarPicker(false)
                  }} style={{ cursor: 'pointer', opacity: profile.avatar === key ? 1 : 0.5, transition: 'all 0.15s',
                    transform: profile.avatar === key ? 'scale(1.1)' : 'scale(1)' }}>
                    <AvatarCircle avatar={key} name={profile.name} size={40} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="profile-stats-grid">
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{profile.gamesPlayed}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Games' : 'Партий'}</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{winRate}%</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Win rate' : 'Винрейт'}</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{profile.bestStreak}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Best streak' : 'Лучшая серия'}</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{profile.goldenClosed}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Golden' : 'Золотых'}</div>
            </div>
            {profile.rushBest > 0 && (
              <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{profile.rushBest}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>Puzzle Rush</div>
              </div>
            )}
            {profile.arenaStats?.tournaments > 0 && (
              <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--p1)' }}>{profile.arenaStats.top3}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'Arena top 3' : 'Arena топ-3'}</div>
              </div>
            )}
          </div>

          {/* График рейтинга */}
          {ratingHistory.length >= 2 && (
            <div className="dash-card" style={{ marginBottom: 16, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13 }}>Rating History</h3>
                <span style={{ fontSize: 11, color: ratingHistory[0]?.delta > 0 ? 'var(--green)' : 'var(--p2)', fontWeight: 600 }}>
                  {ratingHistory[0]?.delta > 0 ? '+' : ''}{ratingHistory[0]?.delta} last game
                </span>
              </div>
              <RatingChart data={ratingHistory} />
            </div>
          )}

          {/* Текущий сезон */}
          {seasonData?.season && <SeasonSection data={seasonData} myName={profile.name} />}

          {/* Opening stats — какой первый ход побеждает чаще */}
          {openingStats && openingStats.total > 5 && (
            <div className="dash-card" style={{ marginBottom: 16, padding: '14px 16px' }}>
              <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>First move stats</h3>
              <div style={{ display: 'flex', gap: 2, height: 40, alignItems: 'flex-end' }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const count = openingStats.standCounts?.[i] || 0
                  const wins = openingStats.standWins?.[i] || 0
                  const maxCount = Math.max(1, ...Object.values(openingStats.standCounts || {}))
                  const pct = count / maxCount
                  const wr = count > 0 ? wins / count : 0
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '80%', height: `${Math.max(4, pct * 32)}px`, borderRadius: 2,
                        background: wr > 0.6 ? 'var(--green)' : wr > 0.4 ? 'var(--gold)' : count > 0 ? 'var(--p2)' : 'var(--surface2)',
                        transition: 'height 0.3s' }} />
                      <span style={{ fontSize: 8, color: 'var(--ink3)' }}>{i === 0 ? '★' : i}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: 'var(--ink3)' }}>
                <span>{openingStats.total} games</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--green)', marginRight: 3 }} />&gt;60% WR</span>
                  <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--gold)', marginRight: 3 }} />40-60%</span>
                  <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--p2)', marginRight: 3 }} />&lt;40%</span>
                </span>
              </div>
            </div>
          )}

          {unlockedAch.length > 0 && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <h3>{ en ? 'Recent achievements' : 'Последние ачивки'}</h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {unlockedAch.slice(-5).map(a => (
                  <span key={a.id} title={en && a.nameEn ? a.nameEn : a.name} style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', background: `${a.color}20`, border: `2px solid ${a.color}`,
                    fontSize: 12, fontWeight: 800, color: a.color }}>{(en && a.nameEn ? a.nameEn : a.name)[0]}</span>
                ))}
              </div>
            </div>
          )}

          <button className="btn" onClick={logout} style={{ fontSize: 11, color: 'var(--ink3)', borderColor: 'var(--surface3)' }}>
            {en ? 'Logout' : 'Выйти из профиля'}
          </button>
        </>
      )}

      {/* ─── Аналитика ─── */}
      {tab === 'analytics' && <ProfileAnalytics en={en} data={analyticsData} />}

      {/* ─── История ─── */}
      {tab === 'history' && (
        <div>
          {(profile.history || []).length === 0 ? (
            <div className="dash-card" style={{ textAlign: 'center', padding: 32 }}>
              <Mascot pose="wave" size={80} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: 'var(--ink3)' }}>{en ? 'No games yet. Play your first!' : 'Пока нет партий. Сыграйте свою первую!'}</div>
            </div>
          ) : (
            <div className="dash-card">
              <h3>{ en ? 'Recent games' : 'Последние партии'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {(profile.history || []).map((h, i) => {
                  const dt = new Date(h.date)
                  const timeStr = dt.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: h.won ? 'rgba(61,214,140,0.04)' : 'rgba(255,96,102,0.04)',
                      borderRadius: 8, border: `1px solid ${h.won ? 'rgba(61,214,140,0.12)' : 'rgba(255,96,102,0.12)'}`,
                    }}>
                      <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {h.won
                          ? <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#3dd68c" strokeWidth="2.5"><path d="M4 10l4 4L16 6"/></svg>
                          : <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="#ff6066" strokeWidth="2.5"><path d="M5 5l10 10M15 5L5 15"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: h.won ? 'var(--green)' : 'var(--p2)' }}>
                          {h.won ? (en ? 'Win' : 'Победа') : (en ? 'Loss' : 'Поражение')} · {h.score}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>
                          {timeStr}
                          {h.vsHardAi && ' · Сложная'}
                          {h.closedGolden && ' · Золотая'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: h.ratingDelta > 0 ? 'var(--green)' : 'var(--p2)' }}>
                          {h.ratingDelta > 0 ? '+' : ''}{h.ratingDelta}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{h.ratingAfter}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Мини-график рейтинга */}
              {(profile.history || []).length >= 3 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 6, fontWeight: 600 }}>{en ? 'Rating history' : 'Динамика рейтинга'}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 50 }}>
                    {[...(profile.history || [])].reverse().slice(-30).map((h, i) => {
                      const min = 900, max = 1500
                      const pct = Math.max(0, Math.min(1, (h.ratingAfter - min) / (max - min)))
                      return (
                        <div key={i} style={{
                          flex: 1, height: `${pct * 48 + 2}px`,
                          background: h.won ? 'var(--green)' : 'var(--p2)',
                          borderRadius: '2px 2px 0 0', opacity: 0.7,
                        }} title={`${h.ratingAfter}`} />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Ачивки ─── */}
      {tab === 'achievements' && (
        <div>
          <div className="dash-card" style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--gold)' }}>{unlockedAch.length}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>из {ALL_ACHIEVEMENTS.length} ачивок</div>
            <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${unlockedAch.length / ALL_ACHIEVEMENTS.length * 100}%`, height: '100%',
                background: 'linear-gradient(90deg, #ffc145, #3bb8a8)', borderRadius: 3 }} />
            </div>
          </div>

          {unlockedAch.length > 0 && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <h3 style={{ color: 'var(--green)' }}>Разблокированные</h3>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {unlockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked profile={profile} en={en} />)}
              </div>
            </div>
          )}

          <div className="dash-card">
            <h3>Заблокированные</h3>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {lockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked={false} profile={profile} en={en} />)}
            </div>
          </div>
        </div>
      )}

      {/* ─── Лидерборд ─── */}
      {tab === 'leaderboard' && (
        <div className="dash-card">
          <h3>{en ? 'Leaderboard' : 'Рейтинг игроков'}</h3>
          <table className="dash-table" style={{ marginTop: 8, fontSize: 12 }}>
            <thead>
              <tr><th>#</th><th>{en ? 'Player' : 'Игрок'}</th><th>{en ? 'Rating' : 'Рейтинг'}</th><th>{en ? 'Wins' : 'Побед'}</th><th>{en ? 'Games' : 'Партий'}</th><th>WR</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((p, i) => (
                <tr key={i} style={p.isMe ? { background: 'rgba(74,158,255,0.08)' } : {}}>
                  <td style={{ fontWeight: 600, color: i < 3 ? 'var(--gold)' : 'var(--ink3)' }}>
                    {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1}
                  </td>
                  <td style={{ fontWeight: p.isMe ? 700 : 400, color: p.isMe ? 'var(--p1-light)' : 'var(--ink)' }}>
                    {!p.isMe && serverOnline ? (
                      <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.15)' }}
                        onClick={() => gameCtx?.emit('viewProfile', p.name || p.username)}>
                        {p.name || p.username}
                      </span>
                    ) : (
                      <>{p.name || p.username} {p.isMe && <span style={{ fontSize: 9, color: 'var(--ink3)' }}>(вы)</span>}</>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.rating}</td>
                  <td>{p.wins}</td>
                  <td>{p.games}</td>
                  <td>{p.games > 0 ? (p.wins / p.games * 100).toFixed(0) + '%' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 8, textAlign: 'center' }}>
            {serverOnline ? `${leaderboard.length} ${en ? 'players' : 'игроков'}` : (en ? 'Offline — demo data' : 'Оффлайн — демо-данные')}
          </p>
        </div>
      )}

      {/* ─── Друзья ─── */}
      {tab === 'friends' && <ProfileFriends en={en} serverOnline={serverOnline} friendsList={friendsList} pendingFriends={pendingFriends} onRefresh={loadFriends} onError={setError} />}

      {/* ─── Аккаунт ─── */}
      {/* ─── Рефералы ─── */}
      {tab === 'referrals' && referralData && (() => {
        const refLink = referralData.link || ''
        const refCode = referralData.code || ''
        return (
          <div className="dash-card" style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎁</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                {en ? 'Invite friends' : 'Пригласи друзей'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 4 }}>
                {en ? '+100 XP for each invited player' : '+100 XP за каждого приглашённого'}
              </div>
            </div>

            {/* Реферальная ссылка */}
            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {refLink}
              </div>
              <button className="btn primary" onClick={() => {
                navigator.clipboard?.writeText(refLink)
                  .then(() => setError(en ? 'Link copied!' : 'Ссылка скопирована!'))
                  .catch(() => {})
              }} style={{ fontSize: 12, padding: '6px 14px', flexShrink: 0 }}>
                {en ? 'Copy' : 'Скопировать'}
              </button>
            </div>

            {/* Кнопка поделиться */}
            {navigator.share && (
              <button className="btn" onClick={() => {
                navigator.share({
                  title: 'Snatch Highrise',
                  text: en
                    ? `Play Snatch Highrise — strategy board game with AI! Use my code: ${refCode}`
                    : `Играй в Snatch Highrise — стратегическая настолка с AI! Мой код: ${refCode}`,
                  url: refLink,
                }).catch(() => {})
              }} style={{ width: '100%', fontSize: 13, padding: '12px 0', justifyContent: 'center', marginBottom: 16, borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                {en ? '📤 Share invite' : '📤 Поделиться'}
              </button>
            )}

            {/* Код */}
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink3)', marginBottom: 16 }}>
              {en ? 'Your code' : 'Ваш код'}: <span style={{ fontWeight: 700, color: 'var(--gold)', letterSpacing: 1 }}>{refCode}</span>
            </div>

            {/* Статистика */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--bg2)', borderRadius: 10, flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{referralData.count}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{en ? 'Invited' : 'Приглашено'}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--bg2)', borderRadius: 10, flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>+{referralData.totalXP}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>XP</div>
              </div>
            </div>

            {/* Список приглашённых */}
            {referralData.referrals?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>{en ? 'Your referrals' : 'Приглашённые'}</div>
                {referralData.referrals.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--surface2)', fontSize: 13 }}>
                    <span style={{ color: 'var(--ink)' }}>{r.username}</span>
                    <span style={{ color: 'var(--green)', fontSize: 12 }}>+{r.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {tab === 'account' && <ProfileAccount en={en} profileName={profile?.name} />}
    </div>
  )
}
