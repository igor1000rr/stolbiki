import { useState, useEffect } from 'react'
import * as API from '../engine/api'
import Icon from './Icon'

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
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffc145', diamond: '#b9f2ff', ruby: '#e0115f', emerald: '#50c878',
}
const ALL_ACHIEVEMENTS = [
  // Победы
  { id: 'first_win', color: ACH_COLORS.bronze, name: 'Первая победа', nameEn: 'First win', desc: 'Победите в первой партии', check: p => p.wins >= 1 },
  { id: 'perfect', color: ACH_COLORS.gold, name: 'Доминирование', nameEn: 'Domination', desc: 'Победите 6:0', check: p => p.perfectWins >= 1 },
  { id: 'perfect_3', color: ACH_COLORS.diamond, name: 'Абсолют', nameEn: 'Absolute', desc: '3 победы 6:0', check: p => p.perfectWins >= 3 },
  { id: 'fast_win', color: ACH_COLORS.silver, name: 'Блиц', nameEn: 'Blitz', desc: 'Победа за 10 ходов', check: p => (p.fastWins || 0) >= 1 },
  { id: 'fast_win_5', color: ACH_COLORS.gold, name: 'Молния', nameEn: 'Lightning', desc: '5 быстрых побед', check: p => (p.fastWins || 0) >= 5 },
  // Серии
  { id: 'streak_3', color: ACH_COLORS.bronze, name: 'В ударе', nameEn: 'On fire', desc: '3 победы подряд', check: p => p.bestStreak >= 3 },
  { id: 'streak_5', color: ACH_COLORS.silver, name: 'Неудержимый', nameEn: 'Unstoppable', desc: '5 побед подряд', check: p => p.bestStreak >= 5 },
  { id: 'streak_10', color: ACH_COLORS.gold, name: 'Легенда', nameEn: 'Legend', desc: '10 побед подряд', check: p => p.bestStreak >= 10 },
  { id: 'streak_20', color: ACH_COLORS.diamond, name: 'Бессмертный', nameEn: 'Immortal', desc: '20 побед подряд', check: p => p.bestStreak >= 20 },
  // Золотая стойка
  { id: 'golden_1', color: ACH_COLORS.bronze, name: 'Золотой', nameEn: 'Golden', desc: 'Закройте золотую стойку', check: p => p.goldenClosed >= 1 },
  { id: 'golden_10', color: ACH_COLORS.silver, name: 'Золотая лихорадка', nameEn: 'Gold rush', desc: 'Закройте золотую 10 раз', check: p => p.goldenClosed >= 10 },
  { id: 'golden_50', color: ACH_COLORS.gold, name: 'Золотой магнат', nameEn: 'Gold magnate', desc: 'Закройте золотую 50 раз', check: p => p.goldenClosed >= 50 },
  // Камбэки
  { id: 'comeback', color: ACH_COLORS.silver, name: 'Камбэк', nameEn: 'Comeback', desc: 'Победа при отставании 3+', check: p => p.comebacks >= 1 },
  { id: 'comeback_5', color: ACH_COLORS.gold, name: 'Феникс', nameEn: 'Phoenix', desc: '5 камбэков', check: p => p.comebacks >= 5 },
  // Партии
  { id: 'games_10', color: ACH_COLORS.bronze, name: 'Новичок', nameEn: 'Newcomer', desc: '10 партий', check: p => p.gamesPlayed >= 10 },
  { id: 'games_50', color: ACH_COLORS.silver, name: 'Опытный', nameEn: 'Experienced', desc: '50 партий', check: p => p.gamesPlayed >= 50 },
  { id: 'games_100', color: ACH_COLORS.gold, name: 'Ветеран', nameEn: 'Veteran', desc: '100 партий', check: p => p.gamesPlayed >= 100 },
  { id: 'games_500', color: ACH_COLORS.diamond, name: 'Адепт', nameEn: 'Adept', desc: '500 партий', check: p => p.gamesPlayed >= 500 },
  // Рейтинг
  { id: 'rating_1200', color: ACH_COLORS.bronze, name: 'Рост', nameEn: 'Rising', desc: 'Рейтинг 1200', check: p => p.rating >= 1200 },
  { id: 'rating_1500', color: ACH_COLORS.silver, name: 'Мастер', nameEn: 'Master', desc: 'Рейтинг 1500', check: p => p.rating >= 1500 },
  { id: 'rating_1800', color: ACH_COLORS.gold, name: 'Гроссмейстер', nameEn: 'Grandmaster', desc: 'Рейтинг 1800', check: p => p.rating >= 1800 },
  { id: 'rating_2000', color: ACH_COLORS.diamond, name: 'Чемпион', nameEn: 'Champion', desc: 'Рейтинг 2000', check: p => p.rating >= 2000 },
  // Специальные
  { id: 'beat_hard', color: ACH_COLORS.gold, name: 'Стратег', nameEn: 'Strategist', desc: 'Победите AI на сложной', check: p => p.beatHardAi },
  { id: 'online_win', color: ACH_COLORS.bronze, name: 'Онлайн', nameEn: 'Online', desc: 'Победа в онлайн-матче', check: p => (p.onlineWins || 0) >= 1 },
  { id: 'online_10', color: ACH_COLORS.silver, name: 'Боец', nameEn: 'Fighter', desc: '10 онлайн-побед', check: p => (p.onlineWins || 0) >= 10 },
  { id: 'puzzle_10', color: ACH_COLORS.silver, name: 'Решатель', nameEn: 'Solver', desc: 'Решите 10 головоломок', check: p => (p.puzzlesSolved || 0) >= 10 },
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

function RatingBadge({ rating }) {
  let color, label
  if (rating >= 1500) { color = '#ffc145'; label = 'Мастер' }
  else if (rating >= 1200) { color = '#9b59b6'; label = 'Опытный' }
  else if (rating >= 1000) { color = '#3498db'; label = 'Новичок' }
  else { color = '#95a5a6'; label = 'Начинающий' }
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
  }
  return map[id] || [0, 1]
}

function AchievementCard({ ach, unlocked, profile }) {
  const [cur, target] = profile ? achProgress(ach.id, profile) : [0, 1]
  const pct = Math.min(cur / target, 1)
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: unlocked ? 'rgba(61,214,140,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${unlocked ? 'rgba(61,214,140,0.2)' : '#2a2a38'}`,
      opacity: unlocked ? 1 : 0.6,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: unlocked ? `${ach.color}20` : '#1a1a2a', border: `2px solid ${unlocked ? ach.color : '#333'}`,
        fontSize: 12, fontWeight: 800, color: unlocked ? ach.color : '#444' }}>
        {ach.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? '#e8e6f0' : '#6b6880' }}>{ach.name}</div>
        <div style={{ fontSize: 10, color: '#6b6880' }}>{ach.desc}</div>
        {!unlocked && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#2a2a38', overflow: 'hidden' }}>
              <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 2,
                background: pct > 0.7 ? 'linear-gradient(90deg, #3dd68c, #2ecc71)' : 'linear-gradient(90deg, #6db4ff, #4a9eff)',
                transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 9, color: '#555', minWidth: 30 }}>{Math.min(cur, target)}/{target}</span>
          </div>
        )}
      </div>
      {unlocked && <div style={{ marginLeft: 'auto', color: '#3dd68c', fontSize: 14 }}>✓</div>}
    </div>
  )
}

// SVG график рейтинга
function RatingChart({ data }) {
  if (!data || data.length < 2) return null
  const pts = [...data].reverse().slice(-50) // последние 50, хронологически
  const ratings = pts.map(p => p.rating)
  const min = Math.min(...ratings) - 20
  const max = Math.max(...ratings) + 20
  const w = 100, h = 40
  const points = ratings.map((r, i) => {
    const x = (i / (ratings.length - 1)) * w
    const y = h - ((r - min) / (max - min)) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastR = ratings[ratings.length - 1]
  const firstR = ratings[0]
  const color = lastR >= firstR ? 'var(--green)' : 'var(--p2)'

  return (
    <div>
      <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#rg)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)' }}>
        <span>{min + 20}</span>
        <span>{pts.length} {pts.length === 1 ? 'game' : 'games'}</span>
        <span>{max - 20}</span>
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
                <td style={{ fontWeight: 600, color: i < 3 ? '#ffc145' : 'var(--ink3)' }}>{i + 1}</td>
                <td style={{ fontWeight: p.username === myName ? 700 : 400, color: p.username === myName ? 'var(--p1)' : 'var(--ink)' }}>
                  {p.username} {p.username === myName && <span style={{ fontSize: 9, color: 'var(--ink3)' }}>(you)</span>}
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
  const [profile, setProfile] = useState(loadLocal)
  const [publicProfile, setPublicProfile] = useState(null)
  const [publicLoading, setPublicLoading] = useState(false)
  const [tab, setTab] = useState('profile')
  const [regName, setRegName] = useState('')
  const [regPass, setRegPass] = useState('')
  const [loginMode, setLoginMode] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [error, setError] = useState('')
  const [serverOnline, setServerOnline] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [friendsList, setFriendsList] = useState([])
  const [pendingFriends, setPendingFriends] = useState([])
  const [serverLeaderboard, setServerLeaderboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ratingHistory, setRatingHistory] = useState([])
  const [seasonData, setSeasonData] = useState(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [openingStats, setOpeningStats] = useState(null)

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
  }, [serverOnline]) // eslint-disable-line

  async function loadFriends() {
    if (!serverOnline || !API.isLoggedIn()) return
    try {
      const data = await API.getFriends()
      setFriendsList(data.friends || [])
      setPendingFriends(data.pending || [])
    } catch {}
  }

  async function doSearchFriends() {
    if (!friendSearch.trim() || friendSearch.length < 2) return
    if (!serverOnline) return
    try {
      setSearchResults(await API.searchUsers(friendSearch))
    } catch { setSearchResults([]) }
  }

  async function doAddFriend(username) {
    if (!serverOnline) return
    try {
      await API.sendFriendRequest(username)
      setSearchResults(prev => prev.filter(u => u.username !== username))
    } catch (e) { setError(e.message) }
  }

  async function doAcceptFriend(userId) {
    if (!serverOnline) return
    try {
      await API.acceptFriend(userId)
      loadFriends()
    } catch {}
  }

  useEffect(() => {
    if (profile) saveProfile(profile)
    if (typeof window.stolbikiCheckAdmin === 'function') window.stolbikiCheckAdmin()
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

  // Записать результат партии (вызывать из Game)
  // Экспортируется через window для связи с Game
  useEffect(() => {
    window.stolbikiRecordGame = (won, score, vsHardAi, closedGolden, isComeback, isOnline) => {
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
        if (brandNew.length > 0 && typeof window.stolbikiOnAchievement === 'function') {
          const ach = ALL_ACHIEVEMENTS.find(a => a.id === brandNew[0])
          if (ach) setTimeout(() => window.stolbikiOnAchievement(ach), 1500)
        }
        return p
      })
      // Отправляем на сервер
      if (serverOnline && API.isLoggedIn()) {
        API.recordGame({ won, score, difficulty: vsHardAi ? 400 : 150, closedGolden, isComeback, isOnline: !!isOnline }).catch(() => {})
      }
    }
    return () => { delete window.stolbikiRecordGame }
  }, [serverOnline])

  // ─── Публичный профиль (просмотр чужого) ───
  if (viewUsername) {
    if (publicLoading) return (
      <div className="dash-card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 14, color: 'var(--ink3)' }}>Загрузка...</div>
      </div>
    )
    if (!publicProfile) return (
      <div className="dash-card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 14, color: '#ff6066' }}>Пользователь не найден</div>
        {onClose && <button className="btn" onClick={onClose} style={{ marginTop: 12 }}>← Назад</button>}
      </div>
    )
    const pp = publicProfile
    const ppWinRate = pp.gamesPlayed > 0 ? Math.round(pp.wins / pp.gamesPlayed * 100) : 0
    const ppAchievements = (pp.achievements || []).map(id => ALL_ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 500, margin: '20px auto' }}>
          {onClose && (
            <button className="btn" onClick={onClose} style={{ fontSize: 11, marginBottom: 12 }}>← Назад</button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <AvatarCircle avatar={pp.avatar || 'default'} name={pp.username} size={56} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e6f0' }}>{pp.username}</div>
              <RatingBadge rating={pp.rating} />
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ffc145' }}>{pp.rating}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>ELO</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e6f0' }}>{pp.gamesPlayed}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Партий</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3dd68c' }}>{ppWinRate}%</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Винрейт</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f0654a' }}>{pp.bestStreak}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Серия</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#ffc145' }}>{pp.goldenClosed}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Золотых</div>
            </div>
          </div>
          {ppAchievements.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>Ачивки ({ppAchievements.length})</div>
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
      background: '#1e1e28', color: '#e8e6f0', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 400, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}></div>
          <h3>{loginMode ? 'Вход' : 'Регистрация'}</h3>
          {serverOnline && (
            <div style={{ fontSize: 10, color: '#3dd68c', marginBottom: 10 }}>● Сервер онлайн</div>
          )}
          {error && <div style={{ fontSize: 12, color: '#ff6066', marginBottom: 10 }}>{error}</div>}
          <input type="text" placeholder="Никнейм" value={regName}
            onChange={e => setRegName(e.target.value)} style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && (loginMode ? doLogin() : register())} />
          {serverOnline && (
            <input type="password" placeholder="Пароль (мин 4 символа)" value={regPass}
              onChange={e => setRegPass(e.target.value)} style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && (loginMode ? doLogin() : register())} />
          )}
          <button className="btn primary" onClick={loginMode ? doLogin : register} style={{ width: '100%' }}>
            {loginMode ? 'Войти' : 'Создать профиль'}
          </button>
          {serverOnline && (
            <button className="btn" onClick={() => { setLoginMode(!loginMode); setError('') }}
              style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
              {loginMode ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
            </button>
          )}
          {!serverOnline && (
            <p style={{ color: '#6b6880', fontSize: 10, marginTop: 12 }}>
              Оффлайн-режим: данные сохраняются локально
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
    { id: 'profile', label: 'Профиль' },
    { id: 'history', label: `История (${(profile.history || []).length})` },
    { id: 'achievements', label: `Ачивки (${unlockedAch.length}/${ALL_ACHIEVEMENTS.length})` },
    { id: 'leaderboard', label: 'Рейтинг' },
    { id: 'friends', label: 'Друзья' },
  ]

  return (
    <div>
      {/* Мини-навигация */}
      <div className="profile-tabs" style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? 'primary' : ''}`}
            onClick={() => setTab(t.id)} style={{ fontSize: 12, padding: '6px 12px' }}>{t.label}</button>
        ))}
      </div>

      {/* ─── Профиль ─── */}
      {tab === 'profile' && (
        <>
          <div className="dash-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, position: 'relative', cursor: 'pointer' }}
                onClick={() => setShowAvatarPicker(v => !v)}>
                <AvatarCircle avatar={profile.avatar || 'default'} name={profile.name} size={56} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--surface)', border: '2px solid var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="theme" size={10} color="var(--ink3)" />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e6f0' }}>{profile.name}</div>
                <RatingBadge rating={profile.rating} />
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#ffc145' }}>{profile.rating}</div>
                <div style={{ fontSize: 10, color: '#6b6880' }}>ELO рейтинг</div>
              </div>
            </div>
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e6f0' }}>{profile.gamesPlayed}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Партий</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3dd68c' }}>{winRate}%</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Винрейт</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f0654a' }}>{profile.bestStreak}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Лучшая серия</div>
            </div>
            <div className="dash-card" style={{ textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#ffc145' }}>{profile.goldenClosed}</div>
              <div style={{ fontSize: 10, color: '#6b6880' }}>Золотых</div>
            </div>
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
                        background: wr > 0.6 ? '#3dd68c' : wr > 0.4 ? '#ffc145' : count > 0 ? '#ff6066' : 'var(--surface2)',
                        transition: 'height 0.3s' }} />
                      <span style={{ fontSize: 8, color: 'var(--ink3)' }}>{i === 0 ? '★' : i}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: 'var(--ink3)' }}>
                <span>{openingStats.total} games</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: '#3dd68c', marginRight: 3 }} />&gt;60% WR</span>
                  <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: '#ffc145', marginRight: 3 }} />40-60%</span>
                  <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: '#ff6066', marginRight: 3 }} />&lt;40%</span>
                </span>
              </div>
            </div>
          )}

          {unlockedAch.length > 0 && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <h3>Последние ачивки</h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {unlockedAch.slice(-5).map(a => (
                  <span key={a.id} title={a.name} style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', background: `${a.color}20`, border: `2px solid ${a.color}`,
                    fontSize: 12, fontWeight: 800, color: a.color }}>{a.name[0]}</span>
                ))}
              </div>
            </div>
          )}

          <button className="btn" onClick={logout} style={{ fontSize: 11, color: '#6b6880', borderColor: '#36364a' }}>
            Выйти из профиля
          </button>
        </>
      )}

      {/* ─── История ─── */}
      {tab === 'history' && (
        <div>
          {(profile.history || []).length === 0 ? (
            <div className="dash-card" style={{ textAlign: 'center', padding: 32 }}>
              
              <div style={{ fontSize: 14, color: '#6b6880' }}>Пока нет партий. Сыграйте свою первую!</div>
            </div>
          ) : (
            <div className="dash-card">
              <h3>Последние партии</h3>
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: h.won ? '#3dd68c' : '#ff6066' }}>
                          {h.won ? 'Победа' : 'Поражение'} · {h.score}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b6880', marginTop: 2 }}>
                          {timeStr}
                          {h.vsHardAi && ' · Сложная'}
                          {h.closedGolden && ' · Золотая'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: h.ratingDelta > 0 ? '#3dd68c' : '#ff6066' }}>
                          {h.ratingDelta > 0 ? '+' : ''}{h.ratingDelta}
                        </div>
                        <div style={{ fontSize: 9, color: '#555' }}>{h.ratingAfter}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Мини-график рейтинга */}
              {(profile.history || []).length >= 3 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: '#a09cb0', marginBottom: 6, fontWeight: 600 }}>Динамика рейтинга</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 50 }}>
                    {[...(profile.history || [])].reverse().slice(-30).map((h, i) => {
                      const min = 900, max = 1500
                      const pct = Math.max(0, Math.min(1, (h.ratingAfter - min) / (max - min)))
                      return (
                        <div key={i} style={{
                          flex: 1, height: `${pct * 48 + 2}px`,
                          background: h.won ? '#3dd68c' : '#ff6066',
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
            <div style={{ fontSize: 36, fontWeight: 700, color: '#ffc145' }}>{unlockedAch.length}</div>
            <div style={{ fontSize: 12, color: '#6b6880' }}>из {ALL_ACHIEVEMENTS.length} ачивок</div>
            <div style={{ width: '100%', height: 6, background: '#2a2a38', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${unlockedAch.length / ALL_ACHIEVEMENTS.length * 100}%`, height: '100%',
                background: 'linear-gradient(90deg, #ffc145, #f0654a)', borderRadius: 3 }} />
            </div>
          </div>

          {unlockedAch.length > 0 && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#3dd68c' }}>Разблокированные</h3>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {unlockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked profile={profile} />)}
              </div>
            </div>
          )}

          <div className="dash-card">
            <h3>Заблокированные</h3>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {lockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked={false} profile={profile} />)}
            </div>
          </div>
        </div>
      )}

      {/* ─── Лидерборд ─── */}
      {tab === 'leaderboard' && (
        <div className="dash-card">
          <h3>Рейтинг игроков</h3>
          <table className="dash-table" style={{ marginTop: 8, fontSize: 12 }}>
            <thead>
              <tr><th>#</th><th>Игрок</th><th>Рейтинг</th><th>Побед</th><th>Партий</th><th>WR</th></tr>
            </thead>
            <tbody>
              {leaderboard.map((p, i) => (
                <tr key={i} style={p.isMe ? { background: 'rgba(74,158,255,0.08)' } : {}}>
                  <td style={{ fontWeight: 600, color: i < 3 ? '#ffc145' : '#6b6880' }}>
                    {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1}
                  </td>
                  <td style={{ fontWeight: p.isMe ? 700 : 400, color: p.isMe ? '#6db4ff' : '#e8e6f0' }}>
                    {!p.isMe && serverOnline ? (
                      <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.15)' }}
                        onClick={() => window.dispatchEvent(new CustomEvent('stolbiki-view-profile', { detail: { username: p.name || p.username } }))}>
                        {p.name || p.username}
                      </span>
                    ) : (
                      <>{p.name || p.username} {p.isMe && <span style={{ fontSize: 9, color: '#6b6880' }}>(вы)</span>}</>
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
          <p style={{ fontSize: 10, color: '#6b6880', marginTop: 8, textAlign: 'center' }}>
            {serverOnline ? `${leaderboard.length} игроков` : 'Оффлайн — демо-данные'}
          </p>
        </div>
      )}

      {/* ─── Друзья ─── */}
      {tab === 'friends' && (
        <div>
          <div className="dash-card" style={{ marginBottom: 16 }}>
            <h3>Найти друзей</h3>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="text" placeholder="Введите никнейм..." value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearchFriends()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #36364a',
                  background: '#1e1e28', color: '#e8e6f0', fontSize: 13 }} />
              <button className="btn primary" style={{ padding: '8px 16px' }} onClick={doSearchFriends}>Найти</button>
            </div>
            {!serverOnline && <p style={{ fontSize: 10, color: '#6b6880', marginTop: 8 }}>Поиск доступен при подключённом сервере</p>}
            {searchResults.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {searchResults.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6db4ff, #9b59b6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e8e6f0', fontWeight: 500 }}>{u.username}</div>
                      <div style={{ fontSize: 10, color: '#6b6880' }}>Рейтинг: {u.rating}</div>
                    </div>
                    <button className="btn" style={{ fontSize: 11, padding: '4px 12px', minHeight: 28 }}
                      onClick={() => doAddFriend(u.username)}>+ Добавить</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Входящие запросы */}
          {pendingFriends.length > 0 && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <h3>Запросы в друзья ({pendingFriends.length})</h3>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {pendingFriends.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: 'rgba(61,214,140,0.04)', borderRadius: 8, border: '1px solid rgba(61,214,140,0.1)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2a2a38',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: '#e8e6f0' }}>{u.username}</span>
                    <button className="btn primary" style={{ fontSize: 11, padding: '4px 12px', minHeight: 28 }}
                      onClick={() => doAcceptFriend(u.id)}>Принять</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dash-card">
            <h3>Мои друзья ({friendsList.length})</h3>
            {friendsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#6b6880' }}>
                
                <div style={{ fontSize: 13 }}>Пока нет друзей. Найдите игроков по нику!</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {friendsList.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6db4ff, #9b59b6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {f.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#e8e6f0' }}>{f.username}</div>
                      <div style={{ fontSize: 10, color: '#6b6880' }}>⭐ {f.rating}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
