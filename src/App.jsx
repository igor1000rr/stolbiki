import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { I18nContext, useI18nProvider } from './engine/i18n'
import { GameProvider, useGameContext } from './engine/GameContext'
import { useAuth } from './engine/AuthContext'
import * as API from './engine/api'
import ErrorBoundary from './components/ErrorBoundary'
import WhatsNewModal from './components/WhatsNewModal'
import RatePopup from './components/RatePopup'
import StreakPopup from './components/StreakPopup'
import CookieBanner from './components/CookieBanner'
import NativeTabs from './components/NativeTabs'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import AppRoutes from './components/AppRoutes'
import LazyFallback from './components/LazyFallback'
import { getSettings, applySettings } from './engine/settings'
import { useNetworkStatus } from './engine/network'
import { shouldAskRating } from './engine/appstore'
import { initPush } from './engine/push'
import { APP_VERSION } from './version'
import './app.css'
import './css/themes.css'
import './css/native.css'
import './css/mobile-ui.css'

const Tutorial = lazy(() => import('./components/Tutorial'))
const Lessons = lazy(() => import('./components/Lessons'))
const Arena = lazy(() => import('./components/Arena'))
const SkinShop = lazy(() => import('./components/SkinShop'))
const OnboardingGame = lazy(() => import('./components/OnboardingGame'))
import SplashScreen from './components/SplashScreen'

export default function App() {
  const i18n = useI18nProvider()
  const { t, lang, setLang } = i18n
  const gameCtx = useGameContext()
  const { authUser, setAuthUser, isAdmin, login, register, loginLocal, logout } = useAuth()

  const isNative = !!window.Capacitor?.isNativePlatform?.()

  const VALID_TABS = ['game','online','puzzles','openings','profile','settings','rules','privacy','terms','sim','dash','replay','admin','changelog','blog','goldenrush','goldenrush-online']

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
    const hash = location.hash.replace('#', '')
    if (hash && VALID_TABS.includes(hash)) {
      const base = lang === 'en' ? '/en/' : '/'
      history.replaceState(null, '', base + hash)
      return hash
    }
    return getTabFromPath()
  })
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
  const [viewProfile, setViewProfile] = useState(null)
  const [profileInitialTab, setProfileInitialTab] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [cookieOk, setCookieOk] = useState(() => !!localStorage.getItem('stolbiki_cookies'))

  const [showOnboardingGame, setShowOnboardingGame] = useState(() => isNative && !localStorage.getItem('stolbiki_onboarding_done'))
  const [showSplash, setShowSplash] = useState(() => isNative && !!localStorage.getItem('stolbiki_onboarding_done'))
  const [showRatePopup, setShowRatePopup] = useState(false)
  const online = useNetworkStatus()

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
    if (!authOpen) return
    const close = (e) => { if (authRef.current && !authRef.current.contains(e.target)) setAuthOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [authOpen])

  async function doAuth() {
    if (!authName.trim()) return
    setAuthLoading(true); setAuthError('')
    try {
      await (authMode === 'login' ? login : register)(authName.trim(), authPass)
      setAuthOpen(false); setAuthName(''); setAuthPass('')
    } catch (e) {
      if (!authPass) { loginLocal(authName.trim()); setAuthOpen(false) }
      else { setAuthError(e.message || 'Error') }
    }
    setAuthLoading(false)
  }

  function doLogout() { logout(); setAuthOpen(false) }

  function updateBricks(newBricks) {
    if (!authUser) return
    const updated = { ...authUser, bricks: newBricks, _bricksUpdatedAt: Date.now() }
    localStorage.setItem('stolbiki_profile', JSON.stringify(updated))
    setAuthUser(updated)
  }

  async function handleOnboardingComplete({ goToCity }) {
    localStorage.setItem('stolbiki_onboarding_done', '1')
    if (authUser) {
      try {
        const r = await API.completeOnboarding()
        if (r?.bricks != null) updateBricks(r.bricks)
      } catch {}
    }
    setShowOnboardingGame(false)
    if (goToCity) {
      setProfileInitialTab('city')
      setViewProfile(null)
      setTab('profile')
    } else {
      setTab('game')
    }
  }

  function handleOnboardingSkip() {
    localStorage.setItem('stolbiki_onboarding_done', '1')
    setShowOnboardingGame(false)
    setTab('game')
  }

  useEffect(() => {
    if (isNative) return
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstallPrompt(null))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const en = lang === 'en'
    const base = lang === 'en' ? '/en/' : '/'
    const target = tab === 'landing' ? base : base + tab
    if (location.pathname !== target) history.pushState(null, '', target)
    const titles = { landing: '', game: en ? 'Play' : 'Играть', rules: en ? 'Rules' : 'Правила', online: en ? 'Online' : 'Онлайн', puzzles: en ? 'Puzzles' : 'Задачи', profile: en ? 'Profile' : 'Профиль', settings: en ? 'Settings' : 'Настройки', blog: en ? 'Blog' : 'Блог', changelog: 'Changelog', openings: en ? 'Analytics' : 'Аналитика', goldenrush: 'Golden Rush', 'goldenrush-online': 'Golden Rush Online' }
    document.title = titles[tab] ? `${titles[tab]} — Highrise Heist` : 'Highrise Heist — Strategy Board Game'
  }, [tab, lang])

  useEffect(() => {
    const onPop = () => setTab(getTabFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (theme === 'default') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('stolbiki_theme', theme)
  }, [theme])

  useEffect(() => { applySettings(getSettings()) }, [])
  useEffect(() => { if (isNative) initPush() }, [])

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
  }, [])

  useEffect(() => {
    if (!gameCtx) return
    const unsubs = []
    const goToGame = () => { setTab('game'); setMobileMenu(false) }
    unsubs.push(gameCtx.on('onOnlineStart', goToGame))
    unsubs.push(gameCtx.on('onDailyStart', goToGame))
    unsubs.push(gameCtx.on('backToLobby', () => { setTab('online'); setMobileMenu(false) }))
    unsubs.push(gameCtx.on('viewProfile', (username) => { setViewProfile(username || null); setTab('profile'); setMobileMenu(false) }))
    unsubs.push(gameCtx.on('openArena', () => setShowArena(true)))
    unsubs.push(gameCtx.on('openSkinShop', () => setShowSkinShop(true)))
    return () => unsubs.forEach(u => u())
  }, [gameCtx])

  useEffect(() => {
    const handler = (e) => { if (e.detail) go(e.detail) }
    window.addEventListener('stolbiki-go-tab', handler)
    return () => window.removeEventListener('stolbiki-go-tab', handler)
  }, [])

  useEffect(() => {
    const handler = async (e) => {
      const userId = e?.detail?.userId
      if (!userId) return
      try {
        const res = await fetch(`/api/profile/by-id/${userId}`)
        if (res.ok) {
          const data = await res.json()
          if (data?.name) {
            setViewProfile(data.name)
            setProfileInitialTab('city')
            setTab('profile')
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
        }
      } catch {}
      if (authUser && authUser.id === userId) {
        setViewProfile(null)
        setProfileInitialTab('city')
        setTab('profile')
      }
    }
    window.addEventListener('open-profile', handler)
    return () => window.removeEventListener('open-profile', handler)
  }, [authUser])

  useEffect(() => {
    if (!isAdmin && ['sim', 'dash', 'replay', 'admin'].includes(tab)) {
      const timer = setTimeout(() => { if (!isAdmin) setTab('game') }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isAdmin, tab])

  function go(id) {
    if (isNative && id === 'landing') id = 'game'
    if (id === 'game' && !isNative && !localStorage.getItem('stolbiki_onboarding_done')) {
      setShowOnboardingGame(true)
      return
    }
    setTab(id); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' })
    API.track('pageview', id)
  }

  useEffect(() => { API.track('pageview', tab) }, []) // eslint-disable-line

  useEffect(() => {
    if (isNative && tab === 'game' && shouldAskRating()) {
      const timer = setTimeout(() => setShowRatePopup(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [tab])

  const [publicStats, setPublicStats] = useState(null)
  useEffect(() => { fetch('/api/stats').then(r => r.json()).then(setPublicStats).catch(() => {}) }, [])

  const en = lang === 'en'
  const primaryNav = [
    { id: 'rules',   icon: 'rules',   label: en ? 'Rules'   : 'Правила' },
    { id: 'game',    icon: 'play',    label: en ? 'Play'    : 'Играть' },
    { id: 'online',  icon: 'online',  label: en ? 'Online'  : 'Онлайн' },
    { id: 'puzzles', icon: 'puzzle',  label: en ? 'Puzzles' : 'Задачи' },
  ]

  const secondaryNav = [
    { id: 'goldenrush',        icon: 'star',  label: 'Golden Rush', badge: 'NEW' },
    { id: 'goldenrush-online', icon: 'online',label: 'GR Online',   badge: 'NEW' },
    { id: 'settings',   icon: 'theme',     label: en ? 'Settings'  : 'Настройки' },
    { id: 'profile',    icon: 'profile',   label: en ? 'Profile'   : 'Профиль' },
    { id: 'openings',   icon: 'chart',     label: en ? 'Analytics' : 'Аналитика' },
    { id: 'blog',       icon: 'blog',      label: en ? 'Blog'      : 'Блог' },
    { id: 'changelog',  icon: 'star',      label: 'Changelog' },
  ]
  if (isAdmin) {
    secondaryNav.push(
      { id: 'admin',  icon: 'shield',    label: en ? 'Admin Panel' : 'Админка' },
      { id: 'sim',    icon: 'sim',       label: 'Simulator' },
      { id: 'dash',   icon: 'analytics', label: 'Dashboard' },
      { id: 'replay', icon: 'replay',    label: 'Replays' },
    )
  }

  const allNav = [...primaryNav, ...secondaryNav]
  const isSecondaryActive = secondaryNav.some(n => n.id === tab)

  return (
    <ErrorBoundary>
    <I18nContext.Provider value={i18n}>
    <div className={`app ${isNative ? 'native-app' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to content</a>

      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {showWhatsNew && !showSplash && tab !== 'landing' && !showOnboardingGame && (
        <WhatsNewModal
          lang={lang}
          version={APP_VERSION}
          onClose={() => { setShowWhatsNew(false); localStorage.setItem('stolbiki_seen_version', APP_VERSION) }}
        />
      )}

      {showOnboardingGame && (
        <Suspense fallback={null}>
          <OnboardingGame
            lang={lang}
            isLoggedIn={!!authUser}
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        </Suspense>
      )}

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

      {showRatePopup && isNative && (
        <RatePopup lang={lang} onClose={() => setShowRatePopup(false)} />
      )}

      {streakPopup && (
        <StreakPopup
          lang={lang}
          streak={streakPopup.streak}
          best={streakPopup.best}
          streakXP={streakPopup.streakXP}
        />
      )}

      {!isNative && (
        <SiteHeader
          lang={lang} setLang={setLang}
          tab={tab} go={go}
          mobileMenu={mobileMenu} setMobileMenu={setMobileMenu}
          primaryNav={primaryNav} secondaryNav={secondaryNav}
          allNav={allNav} isSecondaryActive={isSecondaryActive}
          authUser={authUser}
          notifCount={notifCount} notifData={notifData}
          notifOpen={notifOpen} setNotifOpen={setNotifOpen}
          authOpen={authOpen} setAuthOpen={setAuthOpen}
          authMode={authMode} setAuthMode={setAuthMode}
          authName={authName} setAuthName={setAuthName}
          authPass={authPass} setAuthPass={setAuthPass}
          authError={authError} setAuthError={setAuthError}
          authLoading={authLoading}
          doAuth={doAuth} doLogout={doLogout}
          authRef={authRef}
          onSkinShop={() => setShowSkinShop(true)}
        />
      )}

      <AppRoutes
        tab={tab} isNative={isNative} isAdmin={isAdmin}
        authUser={authUser}
        lang={lang} setLang={setLang}
        viewProfile={viewProfile}
        profileInitialTab={profileInitialTab}
        setViewProfile={setViewProfile}
        publicStats={publicStats}
        installPrompt={installPrompt}
        go={go}
        onShowLessons={() => setShowLessons(true)}
        onShowSkinShop={() => setShowSkinShop(true)}
        onLogout={doLogout}
      />

      {showTutorial && <Suspense fallback={<LazyFallback />}><Tutorial onClose={() => { setShowTutorial(false); go('game') }} /></Suspense>}
      {showLessons && <Suspense fallback={<LazyFallback />}><Lessons onClose={() => { setShowLessons(false); setTab('game') }} /></Suspense>}
      {showArena && <Suspense fallback={<LazyFallback />}><Arena onClose={() => setShowArena(false)} />  </Suspense>}
      {showSkinShop && (
        <Suspense fallback={<LazyFallback />}>
          <SkinShop
            onClose={() => setShowSkinShop(false)}
            userLevel={authUser?.level || 1}
            currentTheme={theme}
            onThemeChange={setTheme}
            bricks={authUser?.bricks || 0}
            onBricksChange={updateBricks}
          />
        </Suspense>
      )}

      {!isNative && (
        <SiteFooter lang={lang} t={t} publicStats={publicStats} go={go} />
      )}

      {isNative && <NativeTabs tab={tab} lang={lang} onGo={go} />}

      {!isNative && !cookieOk && (
        <CookieBanner lang={lang} onAccept={() => setCookieOk(true)} />
      )}

    </div>
    </I18nContext.Provider>
    </ErrorBoundary>
  )
}
