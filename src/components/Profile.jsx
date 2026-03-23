import { useState, useEffect, useCallback } from 'react'
import * as API from '../engine/api'

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
const ALL_ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', name: 'Первая победа', desc: 'Победите в первой партии', check: p => p.wins >= 1 },
  { id: 'streak_3', icon: '🔥', name: 'В ударе', desc: '3 победы подряд', check: p => p.bestStreak >= 3 },
  { id: 'streak_5', icon: '🔥🔥', name: 'Неудержимый', desc: '5 побед подряд', check: p => p.bestStreak >= 5 },
  { id: 'streak_10', icon: '💎', name: 'Легенда', desc: '10 побед подряд', check: p => p.bestStreak >= 10 },
  { id: 'golden_1', icon: '⭐', name: 'Золотой', desc: 'Закройте золотую стойку', check: p => p.goldenClosed >= 1 },
  { id: 'golden_10', icon: '🌟', name: 'Золотая лихорадка', desc: 'Закройте золотую 10 раз', check: p => p.goldenClosed >= 10 },
  { id: 'comeback', icon: '💪', name: 'Камбэк', desc: 'Победите при отставании в 3+ стойки', check: p => p.comebacks >= 1 },
  { id: 'games_10', icon: '🎮', name: 'Новичок', desc: 'Сыграйте 10 партий', check: p => p.gamesPlayed >= 10 },
  { id: 'games_50', icon: '🎯', name: 'Опытный', desc: 'Сыграйте 50 партий', check: p => p.gamesPlayed >= 50 },
  { id: 'games_100', icon: '🏅', name: 'Ветеран', desc: 'Сыграйте 100 партий', check: p => p.gamesPlayed >= 100 },
  { id: 'rating_1200', icon: '📈', name: 'Рост', desc: 'Достигните рейтинга 1200', check: p => p.rating >= 1200 },
  { id: 'rating_1500', icon: '🚀', name: 'Мастер', desc: 'Достигните рейтинга 1500', check: p => p.rating >= 1500 },
  { id: 'beat_hard', icon: '🧠', name: 'Стратег', desc: 'Победите AI на сложной', check: p => p.beatHardAi },
  { id: 'perfect', icon: '💯', name: 'Доминирование', desc: 'Победите 6:0', check: p => p.perfectWins >= 1 },
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

function AchievementCard({ ach, unlocked }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: unlocked ? 'rgba(61,214,140,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${unlocked ? 'rgba(61,214,140,0.2)' : '#2a2a38'}`,
      opacity: unlocked ? 1 : 0.5,
    }}>
      <div style={{ fontSize: 24, filter: unlocked ? 'none' : 'grayscale(1)' }}>{ach.icon}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? '#e8e6f0' : '#6b6880' }}>{ach.name}</div>
        <div style={{ fontSize: 10, color: '#6b6880' }}>{ach.desc}</div>
      </div>
      {unlocked && <div style={{ marginLeft: 'auto', color: '#3dd68c', fontSize: 14 }}>✓</div>}
    </div>
  )
}

const loadProfile = loadLocal
const saveProfile = saveLocal

export default function Profile() {
  const [profile, setProfile] = useState(loadLocal)
  const [tab, setTab] = useState('profile')
  const [regName, setRegName] = useState('')
  const [regPass, setRegPass] = useState('')
  const [loginMode, setLoginMode] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [error, setError] = useState('')
  const [serverOnline, setServerOnline] = useState(false)
  const [searchResults, setSearchResults] = useState([])

  // Проверяем сервер при старте
  useEffect(() => { API.checkServer().then(setServerOnline).catch(() => {}) }, [])

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
    window.stolbikiRecordGame = (won, score, vsHardAi, closedGolden, isComeback) => {
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
      // Отправляем на сервер (fire and forget)
      if (serverOnline && API.isLoggedIn()) {
        API.recordGame({ won, score, difficulty: vsHardAi ? 100 : 50, closedGolden, isComeback }).catch(() => {})
      }
    }
    return () => { delete window.stolbikiRecordGame }
  }, [serverOnline])

  // Не залогинен
  if (!profile) {
    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #36364a',
      background: '#1e1e28', color: '#e8e6f0', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }
    return (
      <div>
        <div className="dash-card" style={{ maxWidth: 400, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
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
  const leaderboard = [...FAKE_LEADERBOARD, { name: profile.name, rating: profile.rating, wins: profile.wins, games: profile.gamesPlayed, isMe: true }]
    .sort((a, b) => b.rating - a.rating)

  const tabs = [
    { id: 'profile', label: '👤 Профиль' },
    { id: 'history', label: `📜 История (${(profile.history || []).length})` },
    { id: 'achievements', label: `🏆 Ачивки (${unlockedAch.length}/${ALL_ACHIEVEMENTS.length})` },
    { id: 'leaderboard', label: '📊 Рейтинг' },
    { id: 'friends', label: '👥 Друзья' },
  ]

  return (
    <div>
      {/* Мини-навигация */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
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
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6db4ff, #9b59b6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff' }}>
                {profile.name.charAt(0).toUpperCase()}
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

          {unlockedAch.length > 0 && (
            <div className="dash-card" style={{ marginBottom: 16 }}>
              <h3>Последние ачивки</h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {unlockedAch.slice(-5).map(a => (
                  <span key={a.id} title={a.name} style={{ fontSize: 28 }}>{a.icon}</span>
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
              <div style={{ fontSize: 36, marginBottom: 8 }}>📜</div>
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
                      <div style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                        {h.won ? '✅' : '❌'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: h.won ? '#3dd68c' : '#ff6066' }}>
                          {h.won ? 'Победа' : 'Поражение'} · {h.score}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b6880', marginTop: 2 }}>
                          {timeStr}
                          {h.vsHardAi && ' · Сложная'}
                          {h.closedGolden && ' · ⭐ Золотая'}
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
                {unlockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked />)}
              </div>
            </div>
          )}

          <div className="dash-card">
            <h3>Заблокированные</h3>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {lockedAch.map(a => <AchievementCard key={a.id} ach={a} unlocked={false} />)}
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
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td style={{ fontWeight: p.isMe ? 700 : 400, color: p.isMe ? '#6db4ff' : '#e8e6f0' }}>
                    {p.name} {p.isMe && <span style={{ fontSize: 9, color: '#6b6880' }}>(вы)</span>}
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
            Серверный лидерборд — скоро. Пока демо-данные.
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
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #36364a',
                  background: '#1e1e28', color: '#e8e6f0', fontSize: 13 }} />
              <button className="btn primary" style={{ padding: '8px 16px' }}>Найти</button>
            </div>
            <p style={{ fontSize: 10, color: '#6b6880', marginTop: 8 }}>
              Поиск друзей будет доступен после подключения сервера.
            </p>
          </div>

          <div className="dash-card">
            <h3>Мои друзья ({profile.friends.length})</h3>
            {profile.friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#6b6880' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
                <div style={{ fontSize: 13 }}>Пока нет друзей. Найдите игроков по нику!</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {profile.friends.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2a2a38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                      {f.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, color: '#e8e6f0' }}>{f}</span>
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
