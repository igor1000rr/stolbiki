import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { I18nContext, useI18nProvider, LANGS } from './engine/i18n'
import { GameProvider, useGameContext } from './engine/GameContext'
import * as API from './engine/api'
import Icon from './components/Icon'
import ErrorBoundary from './components/ErrorBoundary'
import { getSettings, applySettings } from './engine/settings'
import { useNetworkStatus } from './engine/network'
import { shouldAskRating, markRatingAsked, shareApp } from './engine/appstore'
import { initPush } from './engine/push'
import './app.css'
import './css/game.css'
import './css/landing.css'
import './css/themes.css'
import './css/native.css'
import './css/confetti.css'
import './css/stand-skins.css'
import './css/board-animations.css'
import './css/mobile-ui.css'

// Lazy-loaded components (не нужны при первой загрузке)
const Game = lazy(() => import('./components/Game'))
const Online = lazy(() => import('./components/Online'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const Replay = lazy(() => import('./components/Replay'))
const Simulator = lazy(() => import('./components/Simulator'))
const Rules = lazy(() => import('./components/Rules'))
const Profile = lazy(() => import('./components/Profile'))
const Puzzles = lazy(() => import('./components/Puzzles'))
const Openings = lazy(() => import('./components/Openings'))
const Landing = lazy(() => import('./components/Landing'))
const Tutorial = lazy(() => import('./components/Tutorial'))
const Lessons = lazy(() => import('./components/Lessons'))
const Arena = lazy(() => import('./components/Arena'))
const SkinShop = lazy(() => import('./components/SkinShop'))
const Blog = lazy(() => import('./components/Blog'))
const Settings = lazy(() => import('./components/Settings'))
const Admin = lazy(() => import('./components/Admin'))
const Changelog = lazy(() => import('./components/Changelog'))
const Onboarding = lazy(() => import('./components/Onboarding'))
const Privacy = lazy(() => import('./components/Privacy'))
const Terms = lazy(() => import('./components/Terms'))
import SplashScreen from './components/SplashScreen'

function LazyFallback() {
  return <div style={{ textAlign: 'center', padding: '32px 16px' }}>
    <div style={{ animation: 'float 1.5s ease-in-out infinite' }}>
      <img src="/mascot/think.webp" alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    </div>
  </div>
}

const ADMIN_NAMES = ['admin']
const APP_VERSION = '4.7.0'
const WHATS_NEW = {
  ru: [
    'Удалён мёртвый код: –8.1MB из билда',
    'Объединены дублированные error handlers',
    'PM2 fork mode вместо cluster (SQLite)',
    'Удалён фейковый aggregateRating из JSON-LD',
    'Очистка middleware: убран дублирующий setInterval',
    'ELO-график в профиле',
    'Тосты при получении ачивок',
    'Vite: оптимизация чанков (recharts, engine отдельно)',
  ],
  en: [
    'Removed dead code: –8.1MB from build',
    'Merged duplicate error handlers',
    'PM2 fork mode instead of cluster (SQLite)',
    'Removed fake aggregateRating from JSON-LD',
    'Middleware cleanup: removed duplicate setInterval',
    'ELO graph in profile',
    'Achievement unlock toasts',
    'Vite: chunk optimization (recharts, engine split)',
  ],
}
const THEMES = [
  { id: 'default', label: 'Dark' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'forest', label: 'Forest' },
  { id: 'royal', label: 'Royal' },
  { id: 'sakura', label: 'Sakura' },
  { id: 'neon', label: 'Neon' },
  { id: 'wood', label: 'Wood' },
  { id: 'arctic', label: 'Arctic' },
  { id: 'retro', label: 'Retro' },
  { id: 'minimal', label: 'Light' },
]

function getIsAdmin() {
  try {
    const raw = localStorage.getItem('stolbiki_profile')
    if (!raw) return false
    const p = JSON.parse(raw)
    return p?.isAdmin === true || ADMIN_NAMES.includes(p?.name)
  } catch { return false }
}

export default function App() {
  const i18n = useI18nProvider()
  const { t, lang, setLang } = i18n
  const gameCtx = useGameContext()

  const isNative = !!window.Capacitor?.isNativePlatform?.()

  // Path routing: /game, /en/game, /rules, /en/rules...
  const VALID_TABS = ['game','online','puzzles','openings','profile','settings','rules','privacy','terms','sim','dash','replay','admin','changelog','blog']

  function getTabFromPath() {
    const path = location.pathname.replace(/^\/en\/?/, '/').replace(/^\/+/, '')
    if (!path || path === '/') return 'landing'
    const seg = path.split('/')[0]
    if (seg === 'blog') return 'blog'
    if (VALID_TABS.includes(seg)) return seg
    return 'landing'
  }

  const [tab, setTab] = useState(() => {
    if (isNative) return 'game'
    const params = new URLSearchParams(location.search)
    if (params.get('room')) return 'online'
    // Совместимость: если есть hash — конвертируем в path
    const hash = location.hash.replace('#', '')
    if (hash && VALID_TABS.includes(hash)) {
      const base = lang === 'en' ? '/en/' : '/'
      history.replaceState(null, '', base + hash)
      return hash
    }
    return getTabFromPath()
  })
  const [isAdmin, setIsAdmin] = useState(getIsAdmin)
  const [theme, setTheme] = useState(() => localStorage.getItem('stolbiki_theme') || 'default')
  const [showTutorial, setShowTutorial] = useState(false)
  const [showLessons, setShowLessons] = useState(false)
  const [showArena, setShowArena] = useState(false)
  const [showSkinShop, setShowSkinShop] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    const seen = localStorage.getItem('stolbiki_seen_version')
    return seen !== APP_VERSION
  })
  const [mobileMenu, setMobileMenu] = useState(false)
  const [viewProfile, setViewProfile] = useState(null) // username для публичного профиля
  const [installPrompt, setInstallPrompt] = useState(null)
  const [cookieOk, setCookieOk] = useState(() => !!localStorage.getItem('stolbiki_cookies'))

  // Native-only states
  const [showOnboarding, setShowOnboarding] = useState(() => isNative && !localStorage.getItem('stolbiki_onboarding_done'))
  const [showSplash, setShowSplash] = useState(() => isNative && !!localStorage.getItem('stolbiki_onboarding_done'))
  const [showRatePopup, setShowRatePopup] = useState(false)
  const online = useNetworkStatus()

  // Ленивый mount для Game/Online — грузятся только при первом посещении таба

  // Auth state — synced with localStorage
  const [authUser, setAuthUser] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('stolbiki_profile')); return p?.name ? p : null } catch { return null }
  })
  const [authOpen, setAuthOpen] = useState(false)
  const [authName, setAuthName] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const authRef = useRef(null)
  const [notifCount, setNotifCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifData, setNotifData] = useState({ friends: [], challenges: [] })

  useEffect(() => {
    const check = () => { try { const p = JSON.parse(localStorage.getItem('stolbiki_profile')); setAuthUser(p?.name ? p : null) } catch { setAuthUser(null) } }
    // StorageEvent: кросс-табовая синхронизация (мгновенно)
    const onStorage = (e) => { if (e.key === 'stolbiki_profile' || e.key === 'stolbiki_token') check() }
    window.addEventListener('storage', onStorage)
    // Проверка при возврате на вкладку
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    if (!authOpen) return
    const close = (e) => { if (authRef.current && !authRef.current.contains(e.target)) setAuthOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [authOpen])

  async function doAuth() {
    if (!authName.trim()) return
    setAuthLoading(true); setAuthError('')
    try {
      await (authMode === 'login' ? API.login : API.register)(authName.trim(), authPass)
      const profile = await API.getProfile()
      const merged = { ...profile, name: profile.username || authName.trim() }
      localStorage.setItem('stolbiki_profile', JSON.stringify(merged))
      setAuthUser(merged); setAuthOpen(false); setAuthName(''); setAuthPass('')
    } catch (e) {
      if (!authPass) {
        const local = { name: authName.trim(), rating: 1000, gamesPlayed: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0, goldenClosed: 0, comebacks: 0, perfectWins: 0, achievements: [], history: [] }
        localStorage.setItem('stolbiki_profile', JSON.stringify(local))
        setAuthUser(local); setAuthOpen(false)
      } else { setAuthError(e.message || 'Error') }
    }
    setAuthLoading(false)
  }

  function doLogout() {
    localStorage.removeItem('stolbiki_profile'); localStorage.removeItem('stolbiki_token')
    setAuthUser(null); setAuthOpen(false)
    setIsAdmin(false)
  }

  // Background profile refresh — keep level/xp/stats fresh (только когда вкладка видна)
  useEffect(() => {
    if (!API.isLoggedIn()) return
    const refresh = () => {
      if (document.hidden) return // Не тратим запросы на фоновую вкладку
      API.getProfile().then(p => {
        const merged = { ...p, name: p.username }
        localStorage.setItem('stolbiki_profile', JSON.stringify(merged))
        setAuthUser(merged)
      }).catch(() => {})
    }
    refresh() // once on mount
    const iv = setInterval(refresh, 120000) // every 2 min
    // Обновляем при возврате на вкладку
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVisible) }
  }, []) // eslint-disable-line

  // PWA Install Prompt — перехватываем событие для кнопки «Установить»
  useEffect(() => {
    if (isNative) return
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    // Скрываем кнопку после установки
    window.addEventListener('appinstalled', () => setInstallPrompt(null))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // JWT Token refresh — обновляем токен раз в сутки (срок жизни 7 дней)
  useEffect(() => {
    if (!API.isLoggedIn()) return
    // Проверяем при монтировании: если токен истекает в ближайшие 2 дня — обновляем
    if (API.tokenExpiresWithin(2 * 86400)) {
      API.refreshToken().catch(() => {})
    }
    // Проверяем каждые 12 часов
    const iv = setInterval(() => {
      if (API.isLoggedIn() && API.tokenExpiresWithin(2 * 86400)) {
        API.refreshToken().catch(() => {})
      }
    }, 12 * 3600000)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line

  // Sync URL with tab (path routing)
  useEffect(() => {
    const base = lang === 'en' ? '/en/' : '/'
    const target = tab === 'landing' ? base : base + tab
    if (location.pathname !== target) history.pushState(null, '', target)
    const titles = { landing: '', game: en ? 'Play' : 'Играть', rules: en ? 'Rules' : 'Правила', online: en ? 'Online' : 'Онлайн', puzzles: en ? 'Puzzles' : 'Задачи', profile: en ? 'Profile' : 'Профиль', settings: en ? 'Settings' : 'Настройки', blog: en ? 'Blog' : 'Блог', changelog: 'Changelog', openings: en ? 'Analytics' : 'Аналитика' }
    document.title = titles[tab] ? `${titles[tab]} — Snatch Highrise` : 'Snatch Highrise — Strategy Board Game'
  }, [tab, lang])

  // Listen for back/forward (popstate instead of hashchange)
  useEffect(() => {
    const onPop = () => {
      setTab(getTabFromPath())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (theme === 'default') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('stolbiki_theme', theme)
  }, [theme])

  // Применяем сохранённые настройки кастомизации при загрузке
  useEffect(() => { applySettings(getSettings()) }, [])
  useEffect(() => { if (isNative) initPush() }, [])

  // Login streak — auto-checkin
  const [streakPopup, setStreakPopup] = useState(null)
  useEffect(() => {
    if (API.isLoggedIn()) {
      API.streakCheckin().then(data => {
        if (data?.isNew && data.streak > 1) {
          setStreakPopup(data)
          setTimeout(() => setStreakPopup(null), 4000)
        }
      }).catch(() => {})
    }
  }, [])

  // Notification polling — входящие запросы в друзья + вызовы
  useEffect(() => {
    if (!API.isLoggedIn()) return
    const loadNotifs = () => {
      Promise.all([
        API.getFriends().catch(() => ({ pending: [] })),
        API.getChallenges().catch(() => []),
      ]).then(([friendsData, challenges]) => {
        const friends = friendsData.pending || []
        setNotifData({ friends, challenges })
        setNotifCount(friends.length + challenges.length)
      })
    }
    loadNotifs()
    const iv = setInterval(loadNotifs, 15000)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line

  useEffect(() => {
    const check = () => setIsAdmin(getIsAdmin())
    const onStorage = (e) => { if (e.key === 'stolbiki_profile') check() }
    window.addEventListener('storage', onStorage)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    if (!gameCtx) return
    const unsubs = []
    // Переключение на Game при старте онлайн/daily
    const goToGame = () => { setTab('game'); setMobileMenu(false) }
    unsubs.push(gameCtx.on('onOnlineStart', goToGame))
    unsubs.push(gameCtx.on('onDailyStart', goToGame))
    // Назад в лобби
    unsubs.push(gameCtx.on('backToLobby', () => { setTab('online'); setMobileMenu(false) }))
    // Просмотр профиля
    unsubs.push(gameCtx.on('viewProfile', (username) => { setViewProfile(username || null); setTab('profile'); setMobileMenu(false) }))
    // Открыть арену / магазин скинов
    unsubs.push(gameCtx.on('openArena', () => setShowArena(true)))
    unsubs.push(gameCtx.on('openSkinShop', () => setShowSkinShop(true)))
    return () => unsubs.forEach(u => u())
  }, [gameCtx])

  // Cross-component tab navigation (ProfileFriends → Online etc)
  useEffect(() => {
    const handler = (e) => { if (e.detail) go(e.detail) }
    window.addEventListener('stolbiki-go-tab', handler)
    return () => window.removeEventListener('stolbiki-go-tab', handler)
  }, [])

  useEffect(() => {
    // Не редиректим сразу — даём время залогиниться (1.5 сек)
    if (!isAdmin && ['sim', 'dash', 'replay', 'admin'].includes(tab)) {
      const timer = setTimeout(() => {
        if (!getIsAdmin()) setTab('game')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isAdmin, tab])

  function go(id) {
    // Native: никогда не показываем landing
    if (isNative && id === 'landing') id = 'game'
    // Auto-tutorial: первый раз на Game → показать уроки
    if (id === 'game' && !isNative && !localStorage.getItem('stolbiki_played')) {
      localStorage.setItem('stolbiki_played', '1')
      setShowLessons(true)
      return
    }
    setTab(id); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' })
    API.track('pageview', id)
  }

  // Track initial page view
  useEffect(() => { API.track('pageview', tab) }, []) // eslint-disable-line

  // Rate popup — проверяем при возврате на главный экран
  useEffect(() => {
    if (isNative && tab === 'game' && shouldAskRating()) {
      const timer = setTimeout(() => setShowRatePopup(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [tab])

  const [publicStats, setPublicStats] = useState(null)
  useEffect(() => { fetch('/api/stats').then(r => r.json()).then(setPublicStats).catch(() => {}) }, [])

  // Основные 4 пункта навигации
  const en = lang === 'en'
  const primaryNav = [
    { id: 'rules', icon: 'rules', label: en ? 'Rules' : 'Правила' },
    { id: 'game', icon: 'play', label: en ? 'Play' : 'Играть' },
    { id: 'online', icon: 'online', label: en ? 'Online' : 'Онлайн' },
    { id: 'puzzles', icon: 'puzzle', label: en ? 'Puzzles' : 'Задачи' },
  ]

  // Дополнительные — в выпадашке
  const secondaryNav = [
    { id: 'settings', icon: 'theme', label: en ? 'Settings' : 'Настройки' },
    { id: 'profile', icon: 'profile', label: en ? 'Profile' : 'Профиль' },
    { id: 'openings', icon: 'chart', label: en ? 'Analytics' : 'Аналитика' },
    { id: 'blog', icon: 'blog', label: en ? 'Blog' : 'Блог' },
    { id: 'changelog', icon: 'star', label: 'Changelog' },
  ]
  if (isAdmin) {
    secondaryNav.push(
      { id: 'admin', icon: 'shield', label: en ? 'Admin Panel' : 'Админка' },
      { id: 'sim', icon: 'sim', label: 'Simulator' },
      { id: 'dash', icon: 'analytics', label: 'Dashboard' },
      { id: 'replay', icon: 'replay', label: 'Replays' },
    )
  }

  const allNav = [...primaryNav, ...secondaryNav]
  const isSecondaryActive = secondaryNav.some(n => n.id === tab)

  return (
    <ErrorBoundary>
    <I18nContext.Provider value={i18n}>
    <div className={`app ${isNative ? 'native-app' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Animated splash — каждый запуск (если не onboarding) */}
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* What's New popup */}
      {showWhatsNew && !showSplash && tab !== 'landing' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowWhatsNew(false); localStorage.setItem('stolbiki_seen_version', APP_VERSION) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '24px 28px', maxWidth: 340, width: '90%',
            border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ animation: 'float 1.5s ease-in-out infinite', display: 'inline-block' }}>
                <img src="/mascot/celebrate.webp" alt="" width={64} height={64} style={{ objectFit: 'contain' }} />
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', marginBottom: 4 }}>
              {lang === 'en' ? "What's New" : 'Что нового'} <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 400 }}>v{APP_VERSION}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginBottom: 16 }}>
              {lang === 'en' ? 'Latest updates' : 'Последние обновления'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(WHATS_NEW[lang === 'en' ? 'en' : 'ru']).map((item, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--ink2)', paddingLeft: 16, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>•</span>
                  {item}
                </div>
              ))}
            </div>
            <button className="btn primary" onClick={() => { setShowWhatsNew(false); localStorage.setItem('stolbiki_seen_version', APP_VERSION) }}
              style={{ width: '100%', marginTop: 20, justifyContent: 'center', fontSize: 14 }}>
              {lang === 'en' ? 'Got it!' : 'Понятно!'}
            </button>
          </div>
        </div>
      )}

      {/* Native onboarding — первый запуск */}
      {showOnboarding && isNative && (
        <Suspense fallback={null}>
          <Onboarding lang={lang} onDone={() => setShowOnboarding(false)} />
        </Suspense>
      )}

      {/* Offline banner */}
      {isNative && !online && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
          background: 'var(--p2)', color: '#fff', textAlign: 'center',
          fontSize: 11, fontWeight: 600, padding: '4px 12px',
          paddingTop: 'calc(4px + env(safe-area-inset-top, 0px))',
        }}>
          {en ? 'Offline — AI & puzzles available' : 'Нет сети — AI и головоломки доступны'}
        </div>
      )}

      {/* Rate app popup */}
      {showRatePopup && isNative && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2500,
          background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => { markRatingAsked(); setShowRatePopup(false) }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: '28px 24px',
            maxWidth: 340, width: '100%', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.06)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--gold)"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              {en ? 'Enjoying Snatch Highrise?' : 'Нравится Snatch Highrise?'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 20, lineHeight: 1.5 }}>
              {en ? 'Rate us on Google Play! It helps a lot.' : 'Оцените нас в Google Play! Это очень помогает.'}
            </p>
            <button onClick={() => {
              markRatingAsked()
              setShowRatePopup(false)
              // TODO: открыть страницу в Google Play когда будет URL
            }} style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              border: 'none', background: 'var(--gold)', color: 'var(--bg)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
            }}>
              {en ? 'Rate now' : 'Оценить'}
            </button>
            <button onClick={() => { markRatingAsked(); setShowRatePopup(false) }} style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)', background: 'none',
              color: 'var(--ink3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {en ? 'Maybe later' : 'Позже'}
            </button>
          </div>
        </div>
      )}

      {/* Login streak popup */}
      {streakPopup && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, background: 'var(--surface)', borderRadius: 16,
          padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14,
          border: '1px solid rgba(255,193,69,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: 32 }}>
            <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
              <path d="M16 4c1 8-4 10-4 16a8 8 0 0016 0c0-6-5-8-4-16" stroke="var(--gold)" strokeWidth="2" fill="rgba(255,193,69,0.15)"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>
              {streakPopup.streak} {lang === 'en' ? 'day streak!' : (streakPopup.streak >= 5 ? 'дней подряд!' : streakPopup.streak >= 2 ? 'дня подряд!' : 'день подряд!')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink2)' }}>
              {lang === 'en' ? `Best: ${streakPopup.best}` : `Рекорд: ${streakPopup.best}`}
              {streakPopup.streakXP && <span style={{ color: 'var(--green)', marginLeft: 8 }}>+{streakPopup.streakXP} XP</span>}
              {streakPopup.freeze > 0 && ` · ${lang === 'en' ? 'Freeze: ' : 'Защита: '}${streakPopup.freeze}`}
            </div>
          </div>
        </div>
      )}

      {!isNative && <header className="site-header" role="banner">
        <div className="site-header-inner">
          {/* Лого */}
          <div className="site-logo" onClick={() => go('landing')}>
            <img src="/logo-text.webp" alt="Snatch Highrise" style={{ height: 28, width: 'auto' }} />
            <span className="beta-badge">beta</span>
          </div>

          {/* 4 основных пункта */}
          <nav className="site-nav-desktop" aria-label="Main navigation">
            {primaryNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                {n.label}
              </button>
            ))}
            {/* More dropdown — по hover */}
            <div className="nav-more">
              <button className={isSecondaryActive ? 'active' : ''}>
                {lang === 'en' ? 'More' : 'Ещё'}
                <Icon name="chevron" size={14} style={{ marginLeft: 3 }} />
              </button>
              <div className="nav-more-menu">
                <div>
                {secondaryNav.map(n => (
                  <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                    <Icon name={n.icon} size={15} style={{ marginRight: 8, opacity: 0.5 }} />
                    {n.label}
                  </button>
                ))}
                <div className="nav-more-divider" />
                <div className="nav-more-row">
                  <button onClick={() => { setShowSkinShop(true); setMobileMenu(false) }}
                    className="nav-more-theme active" style={{ flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:6, flexShrink:0}}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg><span style={{whiteSpace:"nowrap"}}>{en ? 'Customize' : 'Оформление'}</span>
                  </button>
                </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Auth + Lang + burger */}
          <div className="site-actions">
            {/* Notification bell */}
            {authUser && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => { setNotifOpen(v => !v); setAuthOpen(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', position: 'relative', color: 'var(--ink2)', fontSize: 18 }}
                  aria-label="Notifications" title="Notifications">
                  🔔
                  {notifCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--p2)', color: '#fff', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{notifCount}</span>
                  )}
                </button>
                {notifOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, width: 280, marginTop: 8,
                    background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden',
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                      {en ? 'Notifications' : 'Уведомления'} {notifCount > 0 && `(${notifCount})`}
                    </div>
                    {notifData.challenges.map(ch => (
                      <div key={ch.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>⚔️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink)' }}>{ch.from_username}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'challenges you!' : 'вызывает вас!'}</div>
                        </div>
                        <button className="btn primary" style={{ fontSize: 10, padding: '4px 10px' }}
                          onClick={() => { go('online'); window.dispatchEvent(new CustomEvent('stolbiki-deeplink-room', { detail: { room: ch.room_id } })); setNotifOpen(false) }}>
                          {en ? 'Accept' : 'Принять'}
                        </button>
                      </div>
                    ))}
                    {notifData.friends.map(f => (
                      <div key={f.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>👋</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'var(--ink)' }}>{f.username}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'friend request' : 'запрос в друзья'}</div>
                        </div>
                        <button className="btn primary" style={{ fontSize: 10, padding: '4px 10px' }}
                          onClick={() => { go('profile'); setNotifOpen(false) }}>
                          {en ? 'View' : 'Открыть'}
                        </button>
                      </div>
                    ))}
                    {notifCount === 0 && (
                      <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
                        {en ? 'No new notifications' : 'Нет новых уведомлений'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Auth indicator */}
            <div className="header-auth" ref={authRef}>
              {authUser ? (
                <button className="header-auth-user" onClick={(e) => { e.stopPropagation(); setAuthOpen(v => !v) }}>
                  <div className="header-avatar">{
                    authUser.avatar && authUser.avatar !== 'default'
                      ? { cat:'🐱',dog:'🐶',fox:'🦊',bear:'🐻',owl:'🦉',robot:'🤖',crown:'👑',fire:'🔥',star:'⭐',diamond:'💎',ghost:'👻' }[authUser.avatar] || authUser.name.charAt(0).toUpperCase()
                      : authUser.name.charAt(0).toUpperCase()
                  }</div>
                  <span className="header-username">{authUser.name}</span>
                  {authUser.rating > 0 && <span className="header-rating">{authUser.rating}</span>}
                </button>
              ) : (
                <button className="header-login-btn" onClick={(e) => { e.stopPropagation(); setAuthOpen(v => !v) }}>
                  <Icon name="profile" size={14} />
                  <span>{en ? 'Login' : 'Войти'}</span>
                </button>
              )}
              {authOpen && (
                <div className="header-auth-dropdown">
                  {authUser ? (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface2)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{authUser.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                          {en ? 'Rating' : 'Рейтинг'}: {authUser.rating || 1000} · {en ? 'Games' : 'Партий'}: {authUser.gamesPlayed || 0}
                        </div>
                      </div>
                      <button onClick={() => { go('profile'); setAuthOpen(false) }} className="header-auth-item">
                        <Icon name="profile" size={14} style={{ opacity: 0.5 }} />{en ? 'Profile' : 'Профиль'}
                      </button>
                      <button onClick={() => { go('settings'); setAuthOpen(false) }} className="header-auth-item">
                        <Icon name="theme" size={14} style={{ opacity: 0.5 }} />{en ? 'Settings' : 'Настройки'}
                      </button>
                      <div className="nav-more-divider" />
                      <button onClick={doLogout} className="header-auth-item" style={{ color: 'var(--p2)' }}>
                        {en ? 'Logout' : 'Выйти'}
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        {authMode === 'login' ? (en ? 'Login' : 'Вход') : (en ? 'Register' : 'Регистрация')}
                      </div>
                      {authError && <div style={{ fontSize: 11, color: 'var(--p2)', marginBottom: 8 }}>{authError}</div>}
                      <input type="text" placeholder={en ? 'Username' : 'Никнейм'} value={authName}
                        onChange={e => setAuthName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAuth()}
                        className="header-auth-input" autoFocus />
                      <input type="password" placeholder={en ? 'Password' : 'Пароль'} value={authPass}
                        onChange={e => setAuthPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAuth()}
                        className="header-auth-input" />
                      {authMode === 'register' && (
                        <input type="text" placeholder={en ? 'Referral code (optional)' : 'Код друга (необязательно)'}
                          defaultValue={API.getSavedReferralCode() || ''}
                          onChange={e => { if (e.target.value) localStorage.setItem('stolbiki_ref', e.target.value.trim().toUpperCase()); else localStorage.removeItem('stolbiki_ref') }}
                          className="header-auth-input" style={{ fontSize: 11 }} />
                      )}
                      <button className="btn primary" onClick={doAuth} disabled={authLoading}
                        style={{ width: '100%', fontSize: 12, padding: '8px 0' }}>
                        {authLoading ? '...' : authMode === 'login' ? (en ? 'Login' : 'Войти') : (en ? 'Register' : 'Создать')}
                      </button>
                      <button onClick={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthError('') }}
                        style={{ width: '100%', background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 11, padding: '8px 0', cursor: 'pointer' }}>
                        {authMode === 'login' ? (en ? 'No account? Register' : 'Нет аккаунта? Регистрация') : (en ? 'Have account? Login' : 'Есть аккаунт? Войти')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                aria-label={`Switch to ${l.code === 'ru' ? 'Russian' : 'English'}`} aria-pressed={lang === l.code}>
                {l.label}
              </button>
            ))}
            <button className="mobile-burger" onClick={() => setMobileMenu(m => !m)} aria-label={mobileMenu ? 'Close menu' : 'Open menu'}>
              <Icon name={mobileMenu ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileMenu && (
          <nav className="site-nav-mobile" aria-label="Mobile navigation">
            {allNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                <Icon name={n.icon} size={16} style={{ marginRight: 10, opacity: 0.5 }} />
                {n.label}
              </button>
            ))}
            <div className="nav-more-divider" />
            <div style={{ padding: '8px 16px' }}>
              <button onClick={() => { setShowSkinShop(true); setMobileMenu(false) }}
                className="nav-more-theme active" style={{ width: '100%', padding: '10px 16px', fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:6, flexShrink:0}}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg><span style={{whiteSpace:"nowrap"}}>{en ? 'Customize' : 'Оформление'}</span>
              </button>
            </div>
          </nav>
        )}
      </header>}

      {/* Native: no top bar — всё через tab bar и контекстные элементы */}

      <main className="site-content" id="main-content" role="main">
        <Suspense fallback={<LazyFallback />}>
          {tab === 'landing' && !isNative && <Landing onPlay={() => go('game')} onTutorial={() => setShowLessons(true)} publicStats={publicStats} installPrompt={installPrompt} />}
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          <div style={{ display: tab === 'game' ? (isNative ? 'flex' : 'block') : 'none', ...(isNative ? { flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}><Game /></div>
          <div style={{ display: tab === 'online' ? (isNative ? 'flex' : 'block') : 'none', ...(isNative ? { padding: '0 8px', flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}><Online /></div>
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          {tab === 'puzzles' && <div style={isNative ? { padding: '0 8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}><Puzzles /></div>}
          {tab === 'openings' && <div style={isNative ? { padding: '0 8px' } : undefined}><Openings /></div>}
          {tab === 'blog' && <div style={isNative ? { padding: '0 8px' } : undefined}><Blog /></div>}
          {tab === 'settings' && <div style={isNative ? { padding: '0 8px' } : undefined}><Settings /></div>}
          {tab === 'profile' && <div style={isNative ? { padding: '0 8px' } : undefined}><Profile viewUsername={viewProfile} onClose={viewProfile ? () => setViewProfile(null) : null} /></div>}
          {tab === 'sim' && isAdmin && <Simulator />}
          {tab === 'dash' && isAdmin && <Dashboard />}
          {tab === 'replay' && isAdmin && <Replay />}
          {tab === 'admin' && isAdmin && <Admin />}
          {tab === 'changelog' && <div style={isNative ? { padding: '0 8px' } : undefined}><Changelog /></div>}
          {tab === 'rules' && <div style={isNative ? { padding: '0 8px' } : undefined}><Rules /></div>}
          {tab === 'terms' && <Suspense fallback={<LazyFallback />}><Terms /></Suspense>}
          {tab === 'privacy' && <div style={isNative ? { padding: '0 8px' } : undefined}><Privacy /></div>}
          {tab === 'more' && isNative && (
            <div className="m-more-page">
              {authUser && (
                <div className="m-more-user">
                  <div className="m-more-avatar">{authUser.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{authUser.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{en ? 'Rating' : 'Рейтинг'}: {authUser.rating || 1000}</div>
                  </div>
                </div>
              )}
              {!authUser && (
                <button className="m-more-item" onClick={() => go('profile')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.6-7 7-7s7 3 7 7"/></svg>
                  <span>{en ? 'Login / Register' : 'Вход / Регистрация'}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
                </button>
              )}
              <div className="m-more-section">{en ? 'Game' : 'Игра'}</div>
              <button className="m-more-item" onClick={() => go('rules')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h6M8 16h4"/></svg>
                <span>{en ? 'Rules' : 'Правила'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <button className="m-more-item" onClick={() => { setShowLessons(true) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                <span>{en ? 'Lessons' : 'Уроки'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <button className="m-more-item" onClick={() => { setShowSkinShop(true) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                <span>{en ? 'Customize' : 'Оформление'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <button className="m-more-item" onClick={() => go('openings')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 20l4-8 4 4 4-12 6 16"/></svg>
                <span>{en ? 'Analytics' : 'Аналитика'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <button className="m-more-item" onClick={() => go('blog')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M4 4h16v16H4z"/><path d="M8 2v4M16 2v4M4 10h16"/></svg>
                <span>{en ? 'Blog' : 'Блог'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>

              <div className="m-more-section">{en ? 'Settings' : 'Настройки'}</div>
              <button className="m-more-item" onClick={() => go('settings')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/></svg>
                <span>{en ? 'Customization' : 'Кастомизация'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <div className="m-more-item" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12h18"/></svg>
                <span>{en ? 'Language' : 'Язык'}</span>
                <span className="m-more-value">{lang === 'ru' ? 'RU' : 'EN'}</span>
              </div>
              <button className="m-more-item" onClick={() => go('changelog')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
                <span>Changelog</span>
                <span className="m-more-value">v{APP_VERSION}</span>
              </button>

              <div className="m-more-section">{en ? 'About' : 'О приложении'}</div>
              <button className="m-more-item" onClick={() => shareApp(lang)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
                <span>{en ? 'Share app' : 'Поделиться'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <button className="m-more-item" onClick={() => go('privacy')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>{en ? 'Privacy Policy' : 'Конфиденциальность'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
              </button>

              {authUser && (
                <>
                  <div className="m-more-section" />
                  <button className="m-more-item m-more-danger" onClick={doLogout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    <span>{en ? 'Logout' : 'Выйти'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </Suspense>
      </main>

      {showTutorial && <Suspense fallback={<LazyFallback />}><Tutorial onClose={() => { setShowTutorial(false); go('game') }} /></Suspense>}
      {showLessons && <Suspense fallback={<LazyFallback />}><Lessons onClose={() => { setShowLessons(false); setTab('game') }} /></Suspense>}
      {showArena && <Suspense fallback={<LazyFallback />}><Arena onClose={() => setShowArena(false)} /></Suspense>}
      {showSkinShop && <Suspense fallback={<LazyFallback />}><SkinShop onClose={() => setShowSkinShop(false)} userLevel={authUser?.level || 1} currentTheme={theme} onThemeChange={setTheme} /></Suspense>}

      {!isNative && <footer className="site-footer" role="contentinfo">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <span style={{ opacity: 0.6 }}>Snatch Highrise</span>
            <span className="beta-badge">beta</span>
            <span className="site-footer-divider" />
            <span style={{ opacity: 0.4, fontSize: 10 }}>
              {lang === 'en' ? 'Board games meet AI research' : 'Настольные игры и AI-исследования'}
            </span>
          </div>
          <div className="site-footer-links">
            <span className="status-dot" style={{ background: publicStats ? 'var(--green)' : 'var(--p2)' }} />
            <span>{publicStats ? t('common.online') : t('common.offline')}</span>
            <span className="site-footer-divider" />
            <a href="/changelog" onClick={(e) => { e.preventDefault(); go('changelog') }} style={{ cursor: 'pointer' }}>Changelog</a>
            <span className="site-footer-divider" />
            <a href="/rules" onClick={(e) => { e.preventDefault(); go('rules') }} style={{ cursor: 'pointer' }}>{lang === 'en' ? 'Rules' : 'Правила'}</a>
            <span className="site-footer-divider" />
            <a href="/print-and-play.pdf" target="_blank" rel="noopener">Print & Play</a>
            <span className="site-footer-divider" />
            <a href="/privacy" onClick={(e) => { e.preventDefault(); go('privacy') }} style={{ cursor: 'pointer' }}>{lang === 'en' ? 'Privacy' : 'Конфиденциальность'}</a>
            <span style={{ color: 'var(--surface3)' }}>|</span>
            <a href="/terms" onClick={(e) => { e.preventDefault(); go('terms') }} style={{ cursor: 'pointer' }}>{lang === 'en' ? 'Terms' : 'Условия'}</a>
            <span className="site-footer-divider" />
            <span style={{ opacity: 0.3 }}>v{APP_VERSION}</span>
          </div>
        </div>
      </footer>}

      {/* Native bottom tab bar */}
      {isNative && (
        <nav className="native-tabs" role="tablist">
          {[
            { id: 'game', label: en ? 'Play' : 'Играть',
              svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg> },
            { id: 'online', label: en ? 'Online' : 'Онлайн',
              svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12h18"/></svg> },
            { id: 'puzzles', label: en ? 'Puzzles' : 'Задачи',
              svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg> },
            { id: 'profile', label: en ? 'Profile' : 'Профиль',
              svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.6-7 7-7s7 3 7 7"/></svg> },
            { id: 'more', label: en ? 'More' : 'Ещё',
              svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg> },
          ].map(n => (
            <button key={n.id} role="tab" aria-selected={tab === n.id || (n.id === 'more' && ['settings','rules','blog','changelog','privacy'].includes(tab))}
              className={`native-tab ${tab === n.id || (n.id === 'more' && ['settings','rules','blog','changelog','privacy'].includes(tab)) ? 'active' : ''}`}
              onClick={() => go(n.id)}>
              <span className="native-tab-icon">{n.svg}</span>
              <span className="native-tab-label">{n.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Cookie consent (GDPR) */}
      {!isNative && !cookieOk && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--surface3)',
          padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14,
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          fontSize: 13, color: 'var(--ink2)', maxWidth: 600, width: 'calc(100% - 32px)',
        }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--gold)" strokeWidth="1.5" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1" fill="var(--gold)"/><circle cx="14" cy="7" r="1" fill="var(--gold)"/><circle cx="16" cy="13" r="1" fill="var(--gold)"/><circle cx="10" cy="15" r="1" fill="var(--gold)"/><circle cx="6" cy="13" r="0.8" fill="var(--gold)"/></svg>
          <span style={{ flex: 1, lineHeight: 1.5 }}>
            {en
              ? 'We use cookies and Yandex Metrika for analytics. No personal data is sold.'
              : 'Cookies для авторизации + Яндекс Метрика для аналитики. Данные не продаём.'}
          </span>
          <button className="btn primary" style={{ fontSize: 12, padding: '8px 20px', flexShrink: 0, borderRadius: 8 }}
            onClick={() => { localStorage.setItem('stolbiki_cookies', '1'); setCookieOk(true) }}>
            OK
          </button>
          <button style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}
            onClick={() => { localStorage.setItem('stolbiki_cookies', '1'); setCookieOk(true) }}
            aria-label="Close">
            ✕
          </button>
        </div>
      )}

    </div>
    </I18nContext.Provider>
    </ErrorBoundary>
  )
}
