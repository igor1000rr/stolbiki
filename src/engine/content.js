/**
 * CMS контент — загрузка из API с кешем и fallback
 * Использование: const { c } = useContent()
 * c('site.name') → 'Перехват высотки' (RU) или 'Highrise Heist' (EN) в зависимости от языка
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

const CACHE_KEY = 'stolbiki_content'
const CACHE_TTL = 5 * 60 * 1000 // 5 минут

let _content = null
let _loading = false
let _listeners = []

function notify() { _listeners.forEach(fn => fn({ ..._content })) }

export async function loadContent() {
  if (_loading) return _content
  _loading = true

  // Пробуем кеш
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    if (cached.data && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
      _content = cached.data
      _loading = false
      return _content
    }
  } catch {}

  // Загружаем с сервера
  try {
    const res = await fetch('/api/content')
    if (res.ok) {
      _content = await res.json()
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: _content, ts: Date.now() }))
    }
  } catch {}

  _loading = false
  notify()
  return _content
}

// Инвалидация кеша (после сохранения в админке)
export function invalidateContent() {
  localStorage.removeItem(CACHE_KEY)
  _content = null
  loadContent()
}

/**
 * React хук для доступа к контенту
 * @param {string} lang - 'ru' или 'en'
 * @returns {{ c: (key: string, fallback?: string) => string, content: object, loaded: boolean }}
 */
export function useContent(lang = 'ru') {
  const [content, setContent] = useState(_content)

  useEffect(() => {
    const handler = (data) => setContent(data)
    _listeners.push(handler)
    if (!_content) loadContent().then(d => d && setContent(d))
    else setContent(_content)
    return () => { _listeners = _listeners.filter(fn => fn !== handler) }
  }, [])

  const c = useCallback((key, fallback = '') => {
    if (!content || !content[key]) return fallback
    return lang === 'en' ? (content[key].en || content[key].ru || fallback) : (content[key].ru || fallback)
  }, [content, lang])

  return { c, content, loaded: !!content }
}
