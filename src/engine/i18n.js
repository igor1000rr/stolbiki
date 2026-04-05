/**
 * Локализация — переключение RU/EN.
 * RU грузится синхронно (fallback). EN — динамически через import() при первом переключении.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import ru from './i18n-ru.js'

// Реестр локалей: ru загружена сразу, en грузится лениво
const loaded = { ru }
let _enPromise = null
async function ensureLang(lang) {
  if (loaded[lang]) return loaded[lang]
  if (lang === 'en') {
    if (!_enPromise) _enPromise = import('./i18n-en.js').then(m => { loaded.en = m.default; return m.default })
    return _enPromise
  }
  return loaded.ru
}

// Экспорт для обратной совместимости — сначала только ru, en добавляется после загрузки
export const translations = loaded

export const I18nContext = createContext({ lang: 'ru', setLang: () => {}, t: (k) => k })

export function useI18n() {
  const { lang, t } = useContext(I18nContext)
  return { t, lang }
}

// CMS-переопределения — загружаются из /api/content один раз
let _cmsOverrides = null
let _cmsLoading = false

async function loadCmsOverrides() {
  if (_cmsOverrides || _cmsLoading) return
  _cmsLoading = true
  try {
    const cached = JSON.parse(localStorage.getItem('stolbiki_content') || '{}')
    if (cached.data && cached.ts && Date.now() - cached.ts < 300000) {
      _cmsOverrides = cached.data
      _cmsLoading = false
      return
    }
    const res = await fetch('/api/content')
    if (res.ok) {
      _cmsOverrides = await res.json()
      localStorage.setItem('stolbiki_content', JSON.stringify({ data: _cmsOverrides, ts: Date.now() }))
    }
  } catch {}
  _cmsLoading = false
}

export function useI18nProvider() {
  const [lang, setLang] = useState(() => {
    if (location.pathname.startsWith('/en')) return 'en'
    return localStorage.getItem('stolbiki_lang') || 'ru'
  })
  const [, setTick] = useState(0)

  // Если стартовый язык en — догружаем его
  useEffect(() => {
    if (lang === 'en' && !loaded.en) {
      ensureLang('en').then(() => setTick(t => t + 1))
    }
  }, [lang])

  // Загружаем CMS-переопределения при первом рендере
  useEffect(() => {
    loadCmsOverrides().then(() => setTick(t => t + 1))
  }, [])

  const t = useCallback((key) => {
    // 1. CMS override (если есть)
    if (_cmsOverrides && _cmsOverrides[key]) {
      const val = lang === 'en' ? _cmsOverrides[key].en : _cmsOverrides[key].ru
      if (val) return val
    }
    // 2. Хардкод (en может быть ещё не загружен — fallback на ru)
    return loaded[lang]?.[key] || loaded.ru?.[key] || key
  }, [lang])

  const changeLang = useCallback(async (l) => {
    // Предзагружаем словарь перед переключением — чтобы UI не мигнул с ключами
    if (!loaded[l]) {
      try { await ensureLang(l) } catch {}
    }
    setLang(l)
    localStorage.setItem('stolbiki_lang', l)
    const currentPage = location.pathname.replace(/^\/en\/?/, '/').replace(/^\/+/, '')
    const newPath = l === 'en' ? '/en/' + currentPage : '/' + currentPage
    history.replaceState(null, '', newPath)
    document.documentElement.lang = l
    setTick(t => t + 1)
  }, [])

  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en' : 'ru' }, [lang])

  return { lang, setLang: changeLang, t }
}

export const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
]
