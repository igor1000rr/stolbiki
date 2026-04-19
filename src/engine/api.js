/**
 * API клиент для Highrise Heist
 * Автоматически переключается между сервером и localStorage fallback
 */

const API_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'stolbiki_token'

let _token = localStorage.getItem(TOKEN_KEY)

function setToken(t) { _token = t; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) }
export function getToken() { return _token }

let _refreshing = null // Промис текущего refresh (dedup)

async function api(path, options = {}, _retried = false) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  if (res.status === 401 && _token && !_retried) {
    // Попробуем обновить токен перед тем как сдаться
    try {
      if (!_refreshing) _refreshing = refreshToken()
      await _refreshing
      _refreshing = null
      return api(path, options, true) // Retry с новым токеном
    } catch {
      _refreshing = null
      setToken(null)
      localStorage.removeItem('stolbiki_profile')
      window.dispatchEvent(new CustomEvent('stolbiki-auth-expired'))
    }
  }
  if (res.status === 401 && _retried) {
    setToken(null)
    localStorage.removeItem('stolbiki_profile')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ═══ Auth ═══
export async function register(username, password) {
  const referralCode = getSavedReferralCode()
  const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, referralCode }) })
  setToken(data.token)
  if (referralCode) localStorage.removeItem('stolbiki_ref') // Код использован
  return data.user
}

export async function login(username, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  setToken(data.token)
  return data.user
}

export function logout() {
  setToken(null)
}

export function isLoggedIn() {
  return !!_token
}

/** Обновляет токен если текущий ещё валиден. Вызывается раз в сутки. */
export async function refreshToken() {
  if (!_token) return false
  try {
    const data = await api('/auth/refresh', { method: 'POST' })
    if (data.token) { setToken(data.token); return true }
  } catch { /* Token expired — пользователь переавторизуется */ }
  return false
}

/** Проверяет, истекает ли токен в ближайшие N секунд */
export function tokenExpiresWithin(seconds = 86400) {
  if (!_token) return true
  try {
    const payload = JSON.parse(atob(_token.split('.')[1]))
    const exp = payload.exp * 1000 // ms
    return Date.now() > exp - seconds * 1000
  } catch { return true }
}

export function getUserId() {
  if (!_token) return null
  try {
    const payload = JSON.parse(atob(_token.split('.')[1]))
    return payload.id || null
  } catch { return null }
}

// ═══ Profile ═══
export async function getProfile() {
  return await api('/profile')
}

export async function getPublicProfile(username) {
  return await api(`/profile/${username}`)
}

// ═══ Games ═══
export async function recordGame(data) {
  return await api('/games', { method: 'POST', body: JSON.stringify(data) })
}

export async function getGameHistory(limit = 20, offset = 0) {
  return await api(`/games?limit=${limit}&offset=${offset}`)
}

export async function getGameStats() {
  return await api('/games/stats')
}

// ═══ Leaderboard ═══
export async function getLeaderboard(limit = 20) {
  return await api(`/leaderboard?limit=${limit}`)
}

// ═══ Friends ═══
export async function sendFriendRequest(username) {
  return await api('/friends/request', { method: 'POST', body: JSON.stringify({ username }) })
}

export async function acceptFriend(userId) {
  return await api('/friends/accept', { method: 'POST', body: JSON.stringify({ userId }) })
}

export async function declineFriend(userId) {
  return await api('/friends/decline', { method: 'POST', body: JSON.stringify({ userId }) })
}

export async function removeFriend(userId) {
  return await api('/friends/remove', { method: 'POST', body: JSON.stringify({ userId }) })
}

export async function getFriends() {
  return await api('/friends')
}

export async function searchUsers(q) {
  return await api(`/users/search?q=${encodeURIComponent(q)}`)
}

// ═══ Training ═══
export async function sendTrainingData(gameData, winner, totalMoves, mode, difficulty) {
  return await api('/training', { method: 'POST', body: JSON.stringify({ gameData, winner, totalMoves, mode, difficulty }) })
}

// ═══ Stats ═══
export async function getPublicStats() {
  return await api('/stats')
}

// ═══ Rating & Seasons ═══
export async function getRatingHistory() {
  return await api('/profile/rating-history')
}

export async function getCurrentSeason() {
  return await api('/seasons/current')
}

export async function getOpeningStats() {
  return await api('/profile/opening-stats')
}

export async function updateAvatar(avatar) {
  return await api('/profile/avatar', { method: 'PUT', body: JSON.stringify({ avatar }) })
}

export async function changePassword(currentPassword, newPassword) {
  return await api('/profile/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) })
}

export async function exportData() {
  return await api('/profile/export')
}

export async function deleteAccount(password) {
  return await api('/profile/account', { method: 'DELETE', body: JSON.stringify({ password }) })
}

// ═══ Login streak ═══
export async function streakCheckin() {
  return await api('/streak/checkin', { method: 'POST' })
}

export async function getStreak() {
  return await api('/streak')
}

// ═══ Daily missions ═══
export async function getMissions() {
  return await api('/missions')
}

export async function missionProgress(mission_id, increment = 1) {
  return await api('/missions/progress', { method: 'POST', body: JSON.stringify({ mission_id, increment }) })
}

// ═══ Health check ═══
export async function checkServer() {
  try {
    const data = await api('/health')
    return data.status === 'ok'
  } catch {
    return false
  }
}

// ═══ Рефералы ═══
export async function getReferrals() {
  return await api('/profile/referrals')
}

// ═══ Friend Challenge ═══
export async function challengeFriend(friendId) {
  return await api('/friends/challenge', { method: 'POST', body: JSON.stringify({ friendId }) })
}

export async function getChallenges() {
  return await api('/friends/challenges')
}

export async function respondChallenge(challengeId, accept) {
  return await api('/friends/challenge/respond', { method: 'POST', body: JSON.stringify({ challengeId, accept }) })
}

// ═══ Onboarding ═══
/** Завершает обучающую партию: даёт +20 кирпичей и ачивку first_win. Идемпотентно. */
export async function completeOnboarding() {
  return await api('/onboarding/complete', { method: 'POST' })
}

/** Сохраняет реферальный код из URL (?ref=XXX) в localStorage */
export function captureReferralCode() {
  try {
    const params = new URLSearchParams(location.search)
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem('stolbiki_ref', ref.trim().toUpperCase())
      // Убираем ?ref= из URL
      const url = new URL(location.href)
      url.searchParams.delete('ref')
      history.replaceState(null, '', url.pathname + url.search)
    }
  } catch {}
}

/** Возвращает сохранённый реферальный код (для передачи при регистрации) */
export function getSavedReferralCode() {
  return localStorage.getItem('stolbiki_ref') || null
}

// ═══ Аналитика ═══
let _sessionId = null
function getSessionId() {
  if (!_sessionId) {
    _sessionId = sessionStorage.getItem('stolbiki_sid') || crypto.randomUUID?.() || Math.random().toString(36).slice(2)
    sessionStorage.setItem('stolbiki_sid', _sessionId)
  }
  return _sessionId
}

export function track(event, page, meta) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    const t = getToken()
    if (t) headers['Authorization'] = `Bearer ${t}`
    navigator.sendBeacon?.('/api/track', new Blob([JSON.stringify({
      event, page, sessionId: getSessionId(), meta
    })], { type: 'application/json' })) ||
    fetch('/api/track', { method: 'POST', headers, body: JSON.stringify({ event, page, sessionId: getSessionId(), meta }), keepalive: true }).catch(() => {})
  } catch {}
}
