import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { I18nContext, useI18nProvider, LANGS } from './engine/i18n'
import { GameProvider, useGameContext } from './engine/GameContext'
import { useAuth } from './engine/AuthContext'
import * as API from './engine/api'
import Icon from './components/Icon'
import BrickBalance from './components/BrickBalance'
import ErrorBoundary from './components/ErrorBoundary'
import WhatsNewModal from './components/WhatsNewModal'
import RatePopup from './components/RatePopup'
import StreakPopup from './components/StreakPopup'
import CookieBanner from './components/CookieBanner'
import MoreTabPage from './components/MoreTabPage'
import NotificationBell from './components/NotificationBell'
import AuthDropdown from './components/AuthDropdown'
import NativeTabs from './components/NativeTabs'
import { getSettings, applySettings } from './engine/settings'
import { useNetworkStatus } from './engine/network'
import { shouldAskRating } from './engine/appstore'
import { initPush } from './engine/push'
import { APP_VERSION } from './version'
import './app.css'
import './css/themes.css'
import './css/native.css'
import './css/mobile-ui.css'

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
// Сценарная обучающая партия (заменила старый 4-слайдовый Onboarding).
// Показывается при первом заходе на 'game' для всех платформ.
const OnboardingGame = lazy(() => import('./components/OnboardingGame'))
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

// РЕФАКТОР: embed/compare роуты вынесены в src/components/EmbedRoot.jsx,
// рендерятся в main.jsx ДО App. Раньше здесь был early-return блок до
// useI18nProvider() — нарушение rules of hooks.

export default function App() {
  const i18n = useI18nProvider()
  const { t, lang, setLang } = i18n
  const gameCtx = useGameContext()
  const { authUser, setAuthUser, isAdmin, login, register, loginLocal, logout } = useAuth()

  const isNative = !!window.Capacitor?.isNativePlatform?.()

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
  // Открыть Profile сразу на нужной вкладке (используется онбордингом → 'city')
  const [profileInitialTab, setProfileInitialTab] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [cookieOk, setCookieOk] = useState(() => !!localStorage.getItem('stolbiki_cookies'))

  // Сценарная обучающая партия. Показывается всем (не только native) при
  // первом заходе на 'game'. На native — сразу после splash, чтобы новый
  // пользователь начал не с пустой доски, а с управляемой победы.
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

  // ФИКС race condition: _bricksUpdatedAt timestamp предотвращает перезапись через background refresh
  function updateBricks(newBricks) {
    if (!authUser) return
    const updated = { ...authUser, bricks: newBricks, _bricksUpdatedAt: Date.now() }
    localStorage.setItem('stolbiki_profile', JSON.stringify(updated))
    setAuthUser(updated)
  }

  // Завершение онбординга: localStorage флаг + награды через API + переход.
  async function handleOnboardingComplete({ goToCity }) {
    localStorage.setItem('stolbiki_onboarding_done', '1')
    if (authUser) {
      try {
        const r = await API.completeOnboarding()
        if (r?.bricks != null) updateBricks(r.bricks)
      } catch {
        /* 409 alreadyDone — игнорим, флаг уже стоит */
      }
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
    const titles = { landing: '', game: en ? 'Play' : 'Играть', rules: en ? 'Rules' : 'Правила', online: en ? 'Online' : 'Онлайн', puzzles: en ? 'Puzzles' : 'Задачи', profile: en ? 'Profile' : 'Профиль', settings: en ? 'Settings' : 'Настройки', blog: en ? 'Blog' : 'Блог', changelog: 'Changelog', openings: en ? 'Analytics' : 'Аналитика' }
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

  // ─── HallOfFame модалка диспатчит CustomEvent('open-profile', { detail: { userId } })
  // когда юзер кликает по строке топа. Без этого слушателя клик ничего не делал —
  // событие летело в пустоту. Теперь переключаемся на вкладку profile с нужным id.
  // Profile.jsx принимает viewUsername — передаём через setViewProfile.
  // Для подгрузки имени по userId фетчим /api/profile/by-id/:id (добавлен в коммите 941504a).
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
      // Fallback: для своего id — на свой профиль; для чужого без имени — мягкий no-op
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
    // При первом заходе на игру для всех платформ — показываем сценарную
    // обучающую партию вместо пустой доски. На native триггер уже
    // отработал через initial state showOnboardingGame.
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
    { id: 'settings',  icon: 'theme',     label: en ? 'Settings'  : 'Настройки' },
    { id: 'profile',   icon: 'profile',   label: en ? 'Profile'   : 'Профиль' },
    { id: 'openings',  icon: 'chart',     label: en ? 'Analytics' : 'Аналитика' },
    { id: 'blog',      icon: 'blog',      label: en ? 'Blog'      : 'Блог' },
    { id: 'changelog', icon: 'star',      label: 'Changelog' },
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

      {!isNative && <header className="site-header" role="banner">
        <div className="site-header-inner">
          <div className="site-logo" onClick={() => go('landing')}>
            <img src="/logo-text.webp" alt="Highrise Heist" style={{ height: 28, width: 'auto' }} />
            <span className="beta-badge">beta</span>
          </div>

          <nav className="site-nav-desktop" aria-label="Main navigation">
            {primaryNav.map(n => (
              <button key={n.id} className={tab === n.id ? 'active' : ''} onClick={() => go(n.id)}>
                {n.label}
              </button>
            ))}
            <div className="nav-more">
              <button className={isSecondaryActive ? 'active' : ''}>
                {en ? 'More' : 'Ещё'}
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:6, flexShrink:0}}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
                      <span style={{whiteSpace:'nowrap'}}>{en ? 'Customize' : 'Оформление'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <div className="site-actions">
            {authUser && (
              <BrickBalance
                bricks={authUser.bricks || 0}
                onClick={() => setShowSkinShop(true)}
                style={{ marginRight: 4 }}
              />
            )}

            {authUser && (
              <NotificationBell
                count={notifCount}
                data={notifData}
                open={notifOpen}
                onToggle={() => { setNotifOpen(v => !v); setAuthOpen(false) }}
                onClose={() => setNotifOpen(false)}
                onGo={go}
                lang={lang}
              />
            )}

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
                  <AuthDropdown
                    authUser={authUser}
                    lang={lang}
                    authMode={authMode}
                    authName={authName} setAuthName={setAuthName}
                    authPass={authPass} setAuthPass={setAuthPass}
                    authError={authError}
                    authLoading={authLoading}
                    onAuth={doAuth}
                    onLogout={doLogout}
                    onClose={() => setAuthOpen(false)}
                    onGo={go}
                    onSwitchMode={() => { setAuthMode(m => m === 'login' ? 'register' : 'login'); setAuthError('') }}
                  />
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:6, flexShrink:0}}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
                <span style={{whiteSpace:'nowrap'}}>{en ? 'Customize' : 'Оформление'}</span>
              </button>
            </div>
          </nav>
        )}
      </header>}

      <main className="site-content" id="main-content" role="main">
        <Suspense fallback={<LazyFallback />}>
          {tab === 'landing' && !isNative && <Landing onPlay={() => go('game')} onTutorial={() => setShowLessons(true)} publicStats={publicStats} installPrompt={installPrompt} />}
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          <div style={{ display: tab === 'game' ? (isNative ? 'flex' : 'block') : 'none', ...(isNative ? { flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}><Game /></div>
          <div style={{ display: tab === 'online' ? (isNative ? 'flex' : 'block') : 'none', ...(isNative ? { padding: '0 8px', flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}><Online /></div>
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          {tab === 'puzzles'   && <div style={isNative ? { padding: '0 8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}><Puzzles /></div>}
          {tab === 'openings'  && <div style={isNative ? { padding: '0 8px' } : undefined}><Openings /></div>}
          {tab === 'blog'      && <div style={isNative ? { padding: '0 8px' } : undefined}><Blog /></div>}
          {tab === 'settings'  && <div style={isNative ? { padding: '0 8px' } : undefined}><Settings /></div>}
          {tab === 'profile'   && <div style={isNative ? { padding: '0 8px' } : undefined}><Profile viewUsername={viewProfile} initialTab={profileInitialTab} onClose={viewProfile ? () => setViewProfile(null) : null} /></div>}
          {tab === 'sim'       && isAdmin && <Simulator />}
          {tab === 'dash'      && isAdmin && <Dashboard />}
          {tab === 'replay'    && isAdmin && <Replay />}
          {tab === 'admin'     && isAdmin && <Admin />}
          {tab === 'changelog' && <div style={isNative ? { padding: '0 8px' } : undefined}><Changelog /></div>}
          {tab === 'rules'     && <div style={isNative ? { padding: '0 8px' } : undefined}><Rules /></div>}
          {tab === 'terms'     && <Suspense fallback={<LazyFallback />}><Terms /></Suspense>}
          {tab === 'privacy'   && <div style={isNative ? { padding: '0 8px' } : undefined}><Privacy /></div>}
          {tab === 'more' && isNative && (
            <MoreTabPage
              authUser={authUser}
              lang={lang}
              setLang={setLang}
              go={go}
              onLessons={() => setShowLessons(true)}
              onSkinShop={() => setShowSkinShop(true)}
              onLogout={doLogout}
            />
          )}
        </Suspense>
      </main>

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

      {!isNative && <footer className="site-footer" role="contentinfo">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <span style={{ opacity: 0.6 }}>Highrise Heist</span>
            <span className="beta-badge">beta</span>
            <span className="site-footer-divider" />
            <span style={{ opacity: 0.4, fontSize: 10 }}>
              {en ? 'Board games meet AI research' : 'Настольные игры и AI-исследования'}
            </span>
          </div>
          <div className="site-footer-links">
            <span className="status-dot" style={{ background: publicStats ? 'var(--green)' : 'var(--p2)' }} />
            <span>{publicStats ? t('common.online') : t('common.offline')}</span>
            <span className="site-footer-divider" />
            <a href="/changelog" onClick={(e) => { e.preventDefault(); go('changelog') }} style={{ cursor: 'pointer' }}>Changelog</a>
            <span className="site-footer-divider" />
            <a href="/rules" onClick={(e) => { e.preventDefault(); go('rules') }} style={{ cursor: 'pointer' }}>{en ? 'Rules' : 'Правила'}</a>
            <span className="site-footer-divider" />
            <a href="/print-and-play.pdf" target="_blank" rel="noopener">Print &amp; Play</a>
            <span className="site-footer-divider" />
            <a href="/privacy" onClick={(e) => { e.preventDefault(); go('privacy') }} style={{ cursor: 'pointer' }}>{en ? 'Privacy' : 'Конфиденциальность'}</a>
            <span style={{ color: 'var(--surface3)' }}>|</span>
            <a href="/terms" onClick={(e) => { e.preventDefault(); go('terms') }} style={{ cursor: 'pointer' }}>{en ? 'Terms' : 'Условия'}</a>
            <span className="site-footer-divider" />
            <span style={{ opacity: 0.3 }}>v{APP_VERSION}</span>
          </div>
        </div>
      </footer>}

      {isNative && <NativeTabs tab={tab} lang={lang} onGo={go} />}

      {!isNative && !cookieOk && (
        <CookieBanner lang={lang} onAccept={() => setCookieOk(true)} />
      )}

    </div>
    </I18nContext.Provider>
    </ErrorBoundary>
  )
}
