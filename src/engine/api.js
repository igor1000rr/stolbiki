/**
 * API клиент для Стойки
 * Автоматически переключается между сервером и localStorage fallback
 */

const API_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'stolbiki_token'

let _token = localStorage.getItem(TOKEN_KEY)

function setToken(t) { _token = t; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) }
function getToken() { return _token }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data
  } catch (err) {
    console.warn(`API error ${path}:`, err.message)
    throw err
  }
}

// ═══ Auth ═══
export async function register(username, password) {
  const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })
  setToken(data.token)
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

export async function getGameHistory(limit = 20) {
  return await api(`/games?limit=${limit}`)
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

// ═══ Health check ═══
export async function checkServer() {
  try {
    const data = await api('/health')
    return data.status === 'ok'
  } catch {
    return false
  }
}
