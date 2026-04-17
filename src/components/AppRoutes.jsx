import { lazy, Suspense } from 'react'
import LazyFallback from './LazyFallback'
import MoreTabPage from './MoreTabPage'

const Game = lazy(() => import('./Game'))
const Online = lazy(() => import('./Online'))
const Dashboard = lazy(() => import('./Dashboard'))
const Replay = lazy(() => import('./Replay'))
const Simulator = lazy(() => import('./Simulator'))
const Rules = lazy(() => import('./Rules'))
const Profile = lazy(() => import('./Profile'))
const Puzzles = lazy(() => import('./Puzzles'))
const Openings = lazy(() => import('./Openings'))
const Landing = lazy(() => import('./Landing'))
const Blog = lazy(() => import('./Blog'))
const Settings = lazy(() => import('./Settings'))
const Admin = lazy(() => import('./Admin'))
const Changelog = lazy(() => import('./Changelog'))
const Privacy = lazy(() => import('./Privacy'))
const Terms = lazy(() => import('./Terms'))
const GoldenRushDemo = lazy(() => import('./GoldenRushDemo'))
const GoldenRushOnline = lazy(() => import('./GoldenRushOnline'))

/**
 * Свитч роутов внутри <main>. Игра и онлайн рендерятся всегда
 * (display:none когда не активны) — чтобы state не сбрасывался при переключении
 * вкладок. Остальные — условный рендер.
 */
export default function AppRoutes({
  tab, isNative, isAdmin,
  authUser,
  lang, setLang,
  viewProfile, profileInitialTab, setViewProfile,
  publicStats, installPrompt,
  go,
  onShowLessons, onShowSkinShop, onLogout,
}) {
  return (
    <main className="site-content" id="main-content" role="main">
      <Suspense fallback={<LazyFallback />}>
        {tab === 'landing' && !isNative && (
          <Landing
            onPlay={() => go('game')}
            onTutorial={onShowLessons}
            publicStats={publicStats}
            installPrompt={installPrompt}
          />
        )}
      </Suspense>
      <Suspense fallback={<LazyFallback />}>
        <div style={{ display: tab === 'game' ? (isNative ? 'flex' : 'block') : 'none', ...(isNative ? { flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}><Game /></div>
        <div style={{ display: tab === 'online' ? (isNative ? 'flex' : 'block') : 'none', ...(isNative ? { padding: '0 8px', flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}><Online /></div>
      </Suspense>
      <Suspense fallback={<LazyFallback />}>
        {tab === 'puzzles'          && <div style={isNative ? { padding: '0 8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : undefined}><Puzzles /></div>}
        {tab === 'openings'         && <div style={isNative ? { padding: '0 8px' } : undefined}><Openings /></div>}
        {tab === 'blog'             && <div style={isNative ? { padding: '0 8px' } : undefined}><Blog /></div>}
        {tab === 'settings'         && <div style={isNative ? { padding: '0 8px' } : undefined}><Settings /></div>}
        {tab === 'profile'          && <div style={isNative ? { padding: '0 8px' } : undefined}><Profile viewUsername={viewProfile} initialTab={profileInitialTab} onClose={viewProfile ? () => setViewProfile(null) : null} /></div>}
        {tab === 'sim'              && isAdmin && <Simulator />}
        {tab === 'dash'             && isAdmin && <Dashboard />}
        {tab === 'replay'           && isAdmin && <Replay />}
        {tab === 'admin'            && isAdmin && <Admin />}
        {tab === 'changelog'        && <div style={isNative ? { padding: '0 8px' } : undefined}><Changelog /></div>}
        {tab === 'rules'            && <div style={isNative ? { padding: '0 8px' } : undefined}><Rules /></div>}
        {tab === 'terms'            && <Suspense fallback={<LazyFallback />}><Terms /></Suspense>}
        {tab === 'privacy'          && <div style={isNative ? { padding: '0 8px' } : undefined}><Privacy /></div>}
        {tab === 'goldenrush'       && <div style={isNative ? { padding: '0 8px' } : undefined}><GoldenRushDemo /></div>}
        {tab === 'goldenrush-online'&& <div style={isNative ? { padding: '0 8px' } : undefined}><GoldenRushOnline /></div>}
        {tab === 'more' && isNative && (
          <MoreTabPage
            authUser={authUser}
            lang={lang}
            setLang={setLang}
            go={go}
            onLessons={onShowLessons}
            onSkinShop={onSkinShop}
            onLogout={onLogout}
          />
        )}
      </Suspense>
    </main>
  )
}
