/**
 * Админ-панель Highrise Heist — контейнер.
 * Каждый таб — отдельный файл в components/admin/, lazy-loaded.
 * До рефакторинга: 1348 строк в одном файле. После: ~100 строк + 13 табов по 40-140 строк.
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { S } from './admin/_utils'

// Lazy-loaded табы — каждый в отдельном чанке, грузится только при клике
const OverviewTab = lazy(() => import('./admin/OverviewTab').then(m => ({ default: m.OverviewTab })))
const ContentTab = lazy(() => import('./admin/ContentTab').then(m => ({ default: m.ContentTab })))
const UsersTab = lazy(() => import('./admin/UsersTab').then(m => ({ default: m.UsersTab })))
const GamesTab = lazy(() => import('./admin/GamesTab').then(m => ({ default: m.GamesTab })))
const BlogTab = lazy(() => import('./admin/BlogTab').then(m => ({ default: m.BlogTab })))
const RoomsTab = lazy(() => import('./admin/RoomsTab').then(m => ({ default: m.RoomsTab })))
const AchievementsTab = lazy(() => import('./admin/AchievementsTab').then(m => ({ default: m.AchievementsTab })))
const SeasonsTab = lazy(() => import('./admin/SeasonsTab').then(m => ({ default: m.SeasonsTab })))
const TrainingTab = lazy(() => import('./admin/TrainingTab').then(m => ({ default: m.TrainingTab })))
const ReferralsTab = lazy(() => import('./admin/ReferralsTab').then(m => ({ default: m.ReferralsTab })))
const ChallengesTab = lazy(() => import('./admin/ChallengesTab').then(m => ({ default: m.ChallengesTab })))
const AnalyticsTab = lazy(() => import('./admin/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })))
const ServerTab = lazy(() => import('./admin/ServerTab').then(m => ({ default: m.ServerTab })))

const TABS = [
  { id: 'overview', label: 'Обзор', icon: '◉', Component: OverviewTab },
  { id: 'content', label: 'Контент', icon: '✏', Component: ContentTab },
  { id: 'users', label: 'Пользователи', icon: '◎', Component: UsersTab },
  { id: 'games', label: 'Партии', icon: '♟', Component: GamesTab },
  { id: 'blog', label: 'Блог', icon: '✎', Component: BlogTab },
  { id: 'rooms', label: 'Комнаты', icon: '⊞', Component: RoomsTab },
  { id: 'achievements', label: 'Ачивки', icon: '★', Component: AchievementsTab },
  { id: 'seasons', label: 'Сезоны', icon: '☾', Component: SeasonsTab },
  { id: 'training', label: 'Обуч. данные', icon: '⟁', Component: TrainingTab },
  { id: 'referrals', label: 'Рефералы', icon: '🎁', Component: ReferralsTab },
  { id: 'challenges', label: 'Вызовы', icon: '⚔', Component: ChallengesTab },
  { id: 'analytics', label: 'Аналитика', icon: '◈', Component: AnalyticsTab },
  { id: 'server', label: 'Сервер', icon: '⚙', Component: ServerTab },
]

const Fallback = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Загрузка...</div>
)

export default function Admin() {
  const [tab, setTab] = useState('overview')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const current = TABS.find(t => t.id === tab)
  const Current = current?.Component

  if (isMobile) {
    return (
      <div>
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 0 12px',
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'var(--accent)' : 'var(--surface2)',
              color: tab === t.id ? '#fff' : 'var(--ink3)',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--ink)' }}>
          {current?.label}
        </h2>
        <Suspense fallback={<Fallback />}>
          {Current && <Current />}
        </Suspense>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <aside style={S.sidebar}>
        <div style={S.sideTitle}>Админ-панель</div>
        {TABS.map(t => (
          <button key={t.id} style={S.sideBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </aside>
      <main style={S.main}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--ink)' }}>
          {current?.label}
        </h2>
        <Suspense fallback={<Fallback />}>
          {Current && <Current />}
        </Suspense>
      </main>
    </div>
  )
}
