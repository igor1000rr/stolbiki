/**
 * Issue #6 — React hook для доступа к rarity данным ачивок.
 *
 * Фетчит GET /api/achievements/rarity один раз на компонент, кэширует в sessionStorage
 * на 5 минут — не бьет по серверу из каждого места где нужен бейдж.
 *
 * Использование:
 *   const { getRarity, loading } = useAchievementRarity()
 *   const r = getRarity('first_win')  // { holders, percentage, tier } | null
 */

import { useState, useEffect, useCallback } from 'react'

const CACHE_KEY = 'stolbiki_achievement_rarity'
const CACHE_TTL_MS = 5 * 60 * 1000

let inFlight = null // дедуплицируем parallel-фетчи одного таба

async function fetchRarity() {
  // sessionStorage кэш
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (raw) {
      const { at, data } = JSON.parse(raw)
      if (Date.now() - at < CACHE_TTL_MS && data) return data
    }
  } catch {}

  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const res = await fetch('/api/achievements/rarity')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
      } catch {}
      return data
    } catch {
      return { total: 0, rarity: {}, computedAt: Date.now() }
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export function useAchievementRarity() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchRarity().then(d => {
      if (alive) { setData(d); setLoading(false) }
    })
    return () => { alive = false }
  }, [])

  const getRarity = useCallback((achievementId) => {
    if (!data?.rarity) return null
    return data.rarity[achievementId] || null
  }, [data])

  return { data, getRarity, loading }
}
