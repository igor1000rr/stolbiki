/**
 * Profile — контейнер с табами профиля.
 * Рефакторинг: 60KB god-component → тонкий контейнер + lazy-loaded вкладки.
 *
 * Структура:
 *   profile/_constants.js    — AVATARS, ALL_ACHIEVEMENTS, FAKE_LEADERBOARD, etc.
 *   profile/_helpers.jsx     — AvatarCircle, RatingBadge, AchievementCard, RatingChart, SeasonSection
 *   profile/ProfileAchievements.jsx  — вкладка ачивок
 *   profile/ProfileHistory.jsx       — вкладка истории
 *   profile/ProfileLeaderboard.jsx   — вкладка рейтинга
 *   profile/ProfileReferrals.jsx     — вкладка рефералов
 *   profile/PublicAchievementsList.jsx — ачивки в публичном профиле (с rarity)
 *
 * Остальные вкладки импортируются как были (SeasonPass, Clubs, VictoryCity, и т.д.)
 */

import { useState, useEffect, lazy, Suspense } from 'react'
import * as API from '../engine/api'
import { useI18n } from '../engine/i18n'
import { useGameContext } from '../engine/GameContext'
import Icon from './Icon'
import Mascot from './Mascot'
import ProfileAccount from './ProfileAccount'
import ProfileFriends from './ProfileFriends'
import ProfileAnalytics from './ProfileAnalytics'
import VictoryCity from './VictoryCity'
import BrickBalance from './BrickBalance'
import SeasonPass from './SeasonPass'
import Clubs from './Clubs'
import {
  AVATARS, ALL_ACHIEVEMENTS, STORAGE_KEY,
  loadLocal, saveLocal, defaultProfile,
} from './profile/_constants'
import { AvatarCircle, RatingBadge, RatingChart, SeasonSection } from './profile/_helpers'
import PublicAchievementsList from './profile/PublicAchievementsList'

// Lazy-loaded tabs
const ProfileAchievements = lazy(() => import('./profile/ProfileAchievements'))
const ProfileHistory = lazy(() => import('./profile/ProfileHistory'))
const ProfileLeaderboard = lazy(() => import('./profile/ProfileLeaderboard'))
const ProfileReferrals = lazy(() => import('./profile/ProfileReferrals'))

const TabFallback = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>...</div>
)

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
  const [ratingHistory, setRatingHistory] = useState([])
  const [seasonData, setSeasonData] = useState(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [streakData, setStreakData] = useState(null)
  const [missionsData, setMissionsData] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [referralData, setReferralData] = useState(null)

  useEffect(() => { API.checkServer().then(setServerOnline).catch(() => {}) }, [])

  useEffect(() => {
    if (!viewUsername) { setPublicProfile(null); return }
    setPublicLoading(true)
    API.getPublicProfile(viewUsername).then(setPublicProfile).catch(() => setPublicProfile(null)).finally(() => setPublicLoading(false))
  }, [viewUsername])

  useEffect(() => {
    if (!serverOnline || !API.isLoggedIn()) return
    API.getProfile().then(p => {
      const merged = { ...profile, ...p, name: p.username || profile?.name }
      setProfile(merged); saveLocal(merged)
    }).catch(() => {})
    loadFriends()
    API.getLeaderboard(30).then(setServerLeaderboard).catch(() => {})
    API.getRatingHistory().then(setRatingHistory).catch(() => {})
    API.getCurrentSeason().then(setSeasonData).catch(() => {})
    API.getStreak().then(setStreakData).catch(() => {})
    API.getMissions().then(setMissionsData).catch(() => {})
    API.getReferrals().then(setReferralData).catch(() => {})
  }, [serverOnline]) // eslint-disable-line

  useEffect(() => {
    if (tab !== 'analytics' || !serverOnline || !API.isLoggedIn() || analyticsData) return
    fetch('/api/profile/analytics', { headers: { Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` } })
      .then(r => r.json()).then(setAnalyticsData).catch(() => {})
  }, [tab, serverOnline]) // eslint-disable-line

  async function loadFriends() {
    if (!serverOnline || !API.isLoggedIn()) return
    try {
      const data = await API.getFriends()
      setFriendsList(data.friends || []); setPendingFriends(data.pending || [])
    } catch {}
  }

  useEffect(() => {
    if (profile) saveLocal(profile)
    if (gameCtx) gameCtx.emit('checkAdmin')
  }, [profile]) // eslint-disable-line

  async function register() {
    if (!regName.trim()) return
    setError('')
    const name = regName.trim()
    if (serverOnline && regPass.length >= 4) {
      try {
        const user = await API.register(name, regPass)
        const p = { ...defaultProfile(name), ...user, name: user.username || name, isAdmin: user.isAdmin }
        setProfile(p); setRegPass(''); return
      } catch (e) { setError(e.message); return }
    }
    const p = defaultProfile(name)
    if (['admin'].includes(name)) p.isAdmin = true
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
    API.logout(); localStorage.removeItem(STORAGE_KEY); setProfile(null)
  }

  useEffect(() => {
    if (!gameCtx) return
    return gameCtx.register('recordGame', (won, score, vsHardAi, closedGolden, isComeback, isOnline, moves) => {
      setProfile(prev => {
        if (!prev) return prev
        const p = { ...prev, history: [...(prev.history || [])] }
        const oldRating = p.rating
        p.gamesPlayed++
        if (won) { p.wins++; p.winStreak++; p.bestStreak = Math.max(p.bestStreak, p.winStreak); p.rating = Math.min(2500, p.rating + 25) }
        else { p.losses++; p.winStreak = 0; p.rating = Math.max(100, p.rating - 15) }
        if (closedGolden) p.goldenClosed++
        if (isComeback) p.comebacks++
        if (vsHardAi && won) p.beatHardAi = true
        if (score === '6:0') p.perfectWins = (p.perfectWins || 0) + 1
        p.history.unshift({ won, score, date: Date.now(), ratingDelta: p.rating - oldRating, ratingAfter: p.rating, vsHardAi, closedGolden })
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
      const movesData = Array.isArray(moves) && moves.length >= 5 ? moves : undefined
      if (serverOnline && API.isLoggedIn()) {
        API.recordGame({ won, score, difficulty: vsHardAi ? 400 : 150, closedGolden, isComeback, isOnline: !!isOnline, moves: movesData })
          .then(res => { if (res?.ratingDelta && gameCtx) gameCtx.emit('onRatingDelta', res.ratingDelta) }).catch(() => {})
      } else if (serverOnline && movesData) {
        fetch('/api/training', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moves: movesData, winner: won ? 0 : 1, mode: isOnline ? 'online' : 'ai', difficulty: vsHardAi ? 400 : 150, score }),
        }).catch(() => {})
      }
    })
  }, [serverOnline, gameCtx]) // eslint-disable-line

  // ─── Публичный профиль другого игрока ───
  if (viewUsername) {
    if (publicLoading) {
      return (
        <div className="dash-card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center', padding: 40 }}>
          <div style={{ animation: 'float 1.5s ease-in-out infinite', display: 'inline-block' }}>
            <img src="/mascot/wave.webp" alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
          </div>
        </div>
      )
    }
    if (!publicProfile) {
      return (
        <div className="dash-card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, color: 'var(--p2)' }}>{en ? 'User not found' : 'Пользователь не найден'}</div>
          {onClose && <button className="btn" onClick={onClose} style={{ marginTop: 12 }}>{en ? '← Back' : '← Назад'}</button>}
        </div>
      )
    }
    const pp = publicProfile
    const ppWinRate = pp.gamesPlayed > 0 ? Math.round(pp.wins / pp.gamesPlayed * 100) : 0
    const ppAchievements = (pp.achievements || []).map(id => ALL_ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 500, margin: '20px auto' }}>
          {onClose && <button className="btn" onClick={onClose} style={{ fontSize: 11, marginBottom: 12 }}>{en ? '← Back' : '← Назад'}</button>}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              [pp.gamesPlayed, en ? 'Games' : 'Партий', 'var(--ink)'],
              [ppWinRate + '%', en ? 'Win rate' : 'Винрейт', 'var(--green)'],
              [pp.bestStreak, en ? 'Streak' : 'Серия', 'var(--gold)'],
              [pp.goldenClosed, en ? 'Golden' : 'Золотых', 'var(--gold)'],
            ].map(([v, l, c]) => (
              <div key={l} className="dash-card" style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{l}</div>
              </div>
            ))}
          </div>
          <PublicAchievementsList achievements={ppAchievements} en={en} />
        </div>
      </div>
    )
  }

  // ─── Регистрация/логин ───
  if (!profile) {
    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #36364a',
      background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }
    return (
      <div style={isNative ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 130px)' } : undefined}>
        <div className="dash-card" style={{ maxWidth: 400, margin: isNative ? '0 auto' : '40px auto', textAlign: 'center', width: '100%' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Mascot pose="wave" size={64} />
          </div>
          <h3>{loginMode ? (en ? 'Login' : 'Вход') : (en ? 'Register' : 'Регистрация')}</h3>
          {serverOnline && <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 10 }}>● {en ? 'Server online' : 'Сервер онлайн'}</div>}
          {error && <div style={{ fontSize: 12, color: 'var(--p2)', marginBottom: 10 }}>{error}</div>}
          <input type="text" placeholder={en ? 'Username' : 'Никнейм'} value={regName}
            onChange={e => setRegName(e.target.value)} style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && (loginMode ? doLogin() : register())} />
          {serverOnline && (
            <input type="password" placeholder={en ? 'Password (min 6 chars)' : 'Пароль (мин 6 символов)'}
              value={regPass} onChange={e => setRegPass(e.target.value)} style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && (loginMode ? doLogin() : register())} />
          )}
          <button className="btn primary" onClick={loginMode ? doLogin : register} style={{ width: '100%' }}>
            {loginMode ? (en ? 'Login' : 'Войти') : (en ? 'Create profile' : 'Создать профиль')}
          </button>
          {serverOnline && (
            <button className="btn" onClick={() => { setLoginMode(!loginMode); setError('') }}
              style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
              {loginMode
                ? (en ? 'No account? Register' : 'Нет аккаунта? Регистрация')
                : (en ? 'Have account? Login' : 'Уже есть аккаунт? Войти')}
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

  // ─── Основная панель профиля ───
  const winRate = profile.gamesPlayed > 0 ? (profile.wins / profile.gamesPlayed * 100).toFixed(1) : '—'
  const unlockedAch = ALL_ACHIEVEMENTS.filter(a => profile.achievements.includes(a.id))

  const tabs = [
    { id: 'profile', label: en ? 'Profile' : 'Профиль' },
    { id: 'battlepass', label: en ? 'Battle Pass' : 'Battle Pass 🎯' },
    { id: 'analytics', label: en ? 'Analytics' : 'Аналитика' },
    { id: 'history', label: `${en ? 'History' : 'История'} (${(profile.history || []).length})` },
    { id: 'achievements', label: `${en ? 'Achievements' : 'Ачивки'} (${unlockedAch.length}/${ALL_ACHIEVEMENTS.length})` },
    { id: 'leaderboard', label: en ? 'Ranking' : 'Рейтинг' },
    { id: 'friends', label: en ? 'Friends' : 'Друзья' },
    { id: 'city', label: en ? 'Victory City' : 'Город' },
    { id: 'clubs', label: en ? 'Clubs 🦝' : 'Клубы 🦝' },
    ...(serverOnline && API.isLoggedIn() ? [
      { id: 'referrals', label: en ? 'Invite' : 'Пригласить' },
      { id: 'account', label: en ? 'Account' : 'Аккаунт' },
    ] : []),
  ]

  return (
    <div>
      <div className="profile-tabs" style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flexWrap: 'nowrap', padding: '0 2px' }}>
        {tabs.map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? 'primary' : ''}`} onClick={() => setTab(t.id)}
            style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          <div className="dash-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowAvatarPicker(v => !v)}>
                <AvatarCircle avatar={profile.avatar || 'default'} name={profile.name} size={60} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--surface)', border: '2px solid var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="theme" size={10} color="var(--ink3)" />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{profile.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <RatingBadge rating={profile.rating} en={en} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    padding: '2px 8px', borderRadius: 4 }}>
                    Lv.{profile.level || missionsData?.level || 1}
                  </span>
                  {streakData?.streak > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)',
                      background: 'rgba(255,193,69,0.1)', padding: '2px 8px', borderRadius: 4,
                      display: 'flex', alignItems: 'center', gap: 3 }}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="var(--gold)">
                        <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.17-6.44 4-8 0 3 2 5 3 6 .47-2.2 2.05-4.86 4-7 1.07 1.5 2.37 3.61 3 6 1-1 2-3 3-6 1.83 1.56 4 4.93 4 8 0 4.42-4.03 8-9 9h-3z"/>
                      </svg>
                      {streakData.streak}
                    </span>
                  )}
                  <BrickBalance bricks={profile.bricks ?? 0} onClick={() => setTab('battlepass')} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mascot pose="wave" size={48} style={{ marginBottom: 4 }} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--gold)', lineHeight: 1, letterSpacing: -1 }}>{profile.rating}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>ELO</div>
              </div>
            </div>

            {missionsData && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>{en ? 'Level' : 'Ур.'} {missionsData.level}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (missionsData.xp / missionsData.xpForNext) * 100)}%`,
                    height: '100%', borderRadius: 3,
                    background: 'linear-gradient(90deg, var(--accent), var(--p1))', transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>{missionsData.xp}/{missionsData.xpForNext} XP</span>
              </div>
            )}

            {showAvatarPicker && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(AVATARS).map(([key]) => (
                    <div key={key} onClick={async () => {
                      try { await API.updateAvatar(key) } catch {}
                      setProfile(p => ({ ...p, avatar: key })); setShowAvatarPicker(false)
                    }} style={{ cursor: 'pointer', opacity: profile.avatar === key ? 1 : 0.4, transition: 'opacity 0.15s' }}>
                      <AvatarCircle avatar={key} name={profile.name} size={34} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16, alignItems: 'start' }}>
            <div>
              {missionsData?.missions && (
                <div className="dash-card" style={{ marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 10 }}>{en ? 'Daily missions' : 'Задания дня'}</h3>
                  {missionsData.missions.map(m => {
                    const pct = Math.min(m.progress / m.target, 1)
                    return (
                      <div key={m.mission_id} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                        background: m.completed ? 'rgba(61,214,140,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${m.completed ? 'rgba(61,214,140,0.15)' : 'var(--surface2)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: m.completed ? 'var(--green)' : 'var(--ink)',
                            display: 'flex', alignItems: 'center', gap: 4 }}>
                            {!!m.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                            {en ? m.name_en : m.name_ru}
                          </span>
                          <span style={{ fontSize: 10, color: m.completed ? 'var(--green)' : 'var(--gold)' }}>+{m.xp_reward} XP</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--surface2)' }}>
                          <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 2,
                            background: m.completed ? 'var(--green)' : 'var(--accent)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {unlockedAch.length > 0 && (
                <div className="dash-card">
                  <h3>{en ? 'Achievements' : 'Ачивки'} ({unlockedAch.length}/{ALL_ACHIEVEMENTS.length})</h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {unlockedAch.slice(-8).map(a => (
                      <span key={a.id} title={en && a.nameEn ? a.nameEn : a.name}
                        style={{ width: 30, height: 30, borderRadius: 8,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: `${a.color}20`, border: `1px solid ${a.color}`,
                          fontSize: 11, fontWeight: 800, color: a.color }}>
                        {(en && a.nameEn ? a.nameEn : a.name)[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="dash-card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 10 }}>{en ? 'Statistics' : 'Статистика'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    [profile.gamesPlayed, en ? 'Games' : 'Партий', 'var(--ink)', 'var(--accent)'],
                    [winRate + '%', en ? 'Win %' : 'Побед %', 'var(--green)', 'var(--green)'],
                    [profile.bestStreak, en ? 'Streak' : 'Серия', 'var(--gold)', 'var(--gold)'],
                    [profile.goldenClosed, en ? 'Golden' : 'Золотых', 'var(--gold)', 'var(--p2)'],
                  ].map(([val, label, color, glow], i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '14px 8px',
                      background: `linear-gradient(135deg, color-mix(in srgb, ${glow} 6%, transparent), color-mix(in srgb, ${glow} 3%, transparent))`,
                      borderRadius: 12, border: `1px solid color-mix(in srgb, ${glow} 10%, transparent)` }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              {seasonData?.season && <SeasonSection data={seasonData} myName={profile.name} en={en} />}
              {ratingHistory.length >= 2 && (
                <div className="dash-card" style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 8px' }}>{en ? 'Rating' : 'Рейтинг'}</h3>
                  <RatingChart data={ratingHistory} en={en} />
                </div>
              )}
            </div>
          </div>

          <button className="btn" onClick={logout} style={{ fontSize: 11, color: 'var(--ink3)', borderColor: 'var(--surface3)', marginTop: 8 }}>
            {en ? 'Logout' : 'Выйти из профиля'}
          </button>
        </>
      )}

      {tab === 'battlepass' && <SeasonPass />}
      {tab === 'analytics' && <ProfileAnalytics en={en} data={analyticsData} />}
      {tab === 'history' && <Suspense fallback={<TabFallback />}><ProfileHistory profile={profile} en={en} /></Suspense>}
      {tab === 'achievements' && <Suspense fallback={<TabFallback />}><ProfileAchievements profile={profile} en={en} /></Suspense>}
      {tab === 'leaderboard' && (
        <Suspense fallback={<TabFallback />}>
          <ProfileLeaderboard profile={profile} serverLeaderboard={serverLeaderboard}
            friendsList={friendsList} serverOnline={serverOnline} gameCtx={gameCtx} en={en} />
        </Suspense>
      )}
      {tab === 'friends' && (
        <ProfileFriends en={en} serverOnline={serverOnline}
          friendsList={friendsList} pendingFriends={pendingFriends}
          onRefresh={loadFriends} onError={setError} />
      )}
      {tab === 'city' && (
        <div className="dash-card">
          <h3 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            🏙️ {en ? 'Victory City' : 'Город побед'}
          </h3>
          <VictoryCity userId={profile?.id} />
        </div>
      )}
      {tab === 'clubs' && <Clubs />}
      {tab === 'referrals' && <Suspense fallback={<TabFallback />}><ProfileReferrals data={referralData} en={en} /></Suspense>}
      {tab === 'account' && <ProfileAccount en={en} profileName={profile?.name} />}
    </div>
  )
}
