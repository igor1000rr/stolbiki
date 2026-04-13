/**
 * AuthContext — единственный источник правды для auth state.
 *
 * ФИКС: background refresh больше не затирает bricks если они обновлялись < 60 сек назад.
 * Это решает race condition: пользователь купил скин → App.jsx обновил bricks →
 * через несколько секунд background refresh не откатывает старый баланс.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as API from './api'

const AuthContext = createContext(null)

function readProfile() {
  try {
    const raw = localStorage.getItem('stolbiki_profile')
    if (!raw) return null
    const p = JSON.parse(raw)
    return p?.name ? p : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(readProfile)

  const isAdmin = authUser?.isAdmin === true

  useEffect(() => {
    const check = () => setAuthUser(readProfile())
    const onStorage = (e) => {
      if (e.key === 'stolbiki_profile' || e.key === 'stolbiki_token') check()
    }
    const onVisible = () => { if (!document.hidden) check() }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Background refresh профиля каждые 2 мин когда вкладка видна
  useEffect(() => {
    if (!API.isLoggedIn()) return
    const refresh = () => {
      if (document.hidden) return
      API.getProfile().then(p => {
        const current = readProfile()
        // ФИКС race condition: если bricks обновлялись < 60с назад — сохраняем локальные
        const bricksAge = current?._bricksUpdatedAt
          ? Date.now() - current._bricksUpdatedAt
          : Infinity
        const bricks = bricksAge < 60000 ? (current?.bricks ?? p.bricks) : p.bricks
        const merged = {
          ...p,
          name: p.username,
          bricks,
          _bricksUpdatedAt: current?._bricksUpdatedAt,
        }
        localStorage.setItem('stolbiki_profile', JSON.stringify(merged))
        setAuthUser(merged)
      }).catch(() => {})
    }
    refresh()
    const iv = setInterval(refresh, 120000)
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    if (!API.isLoggedIn()) return
    if (API.tokenExpiresWithin(2 * 86400)) {
      API.refreshToken().catch(() => {})
    }
    const iv = setInterval(() => {
      if (API.isLoggedIn() && API.tokenExpiresWithin(2 * 86400)) {
        API.refreshToken().catch(() => {})
      }
    }, 12 * 3600000)
    return () => clearInterval(iv)
  }, [])

  const login = useCallback(async (name, password) => {
    await API.login(name, password)
    const profile = await API.getProfile()
    const merged = { ...profile, name: profile.username || name }
    localStorage.setItem('stolbiki_profile', JSON.stringify(merged))
    setAuthUser(merged)
    return merged
  }, [])

  const register = useCallback(async (name, password) => {
    await API.register(name, password)
    const profile = await API.getProfile()
    const merged = { ...profile, name: profile.username || name }
    localStorage.setItem('stolbiki_profile', JSON.stringify(merged))
    setAuthUser(merged)
    return merged
  }, [])

  const loginLocal = useCallback((name) => {
    const local = {
      name, rating: 1000, gamesPlayed: 0, wins: 0, losses: 0,
      winStreak: 0, bestStreak: 0, goldenClosed: 0, comebacks: 0,
      perfectWins: 0, achievements: [], history: [],
    }
    localStorage.setItem('stolbiki_profile', JSON.stringify(local))
    setAuthUser(local)
    return local
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('stolbiki_profile')
    localStorage.removeItem('stolbiki_token')
    setAuthUser(null)
  }, [])

  const value = {
    authUser,
    isAdmin,
    isLoggedIn: !!authUser,
    login,
    register,
    loginLocal,
    logout,
    setAuthUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
