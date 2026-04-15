import { lazy, Suspense } from 'react'
import { I18nContext, useI18nProvider } from '../engine/i18n'

const EmbedCity = lazy(() => import('./EmbedCity'))
const CompareCities = lazy(() => import('./CompareCities'))

function LazyFallback() {
  return <div style={{ textAlign: 'center', padding: '32px 16px' }}>
    <div style={{ animation: 'float 1.5s ease-in-out infinite' }}>
      <img src="/mascot/think.webp" alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    </div>
  </div>
}

/**
 * Минималистичный wrapper для embed/compare страниц.
 * Без header/footer/cookie-banner/popup-ов основного App.
 * I18n нужен — компоненты используют useI18n. ErrorBoundary не нужен —
 * он уже есть в main.jsx сверху.
 */
function EmbedRoot({ children }) {
  const i18n = useI18nProvider()
  return (
    <I18nContext.Provider value={i18n}>
      <Suspense fallback={<LazyFallback />}>{children}</Suspense>
    </I18nContext.Provider>
  )
}

/**
 * Возвращает embed/compare компонент если текущий URL — embed-страница.
 * Иначе null. Вызывается в main.jsx ДО рендера App.
 *
 * РЕФАКТОР: раньше это был early-return блок в App.jsx до useI18nProvider() —
 * нарушал rules of hooks (любой рефакторинг ниже мог сломать). Теперь embed
 * рендерится альтернативной веткой из main.jsx минуя App полностью.
 */
export function getEmbedComponent() {
  if (typeof window === 'undefined') return null
  const path = window.location.pathname

  if (path.startsWith('/embed/city/')) {
    const id = parseInt(path.split('/')[3], 10)
    if (id) return <EmbedRoot><EmbedCity userId={id} /></EmbedRoot>
  }

  if (path.startsWith('/compare/')) {
    const parts = path.split('/')
    const id1 = parseInt(parts[2], 10)
    const id2 = parseInt(parts[3], 10)
    if (id1 && id2) return <EmbedRoot><CompareCities userId1={id1} userId2={id2} /></EmbedRoot>
  }

  return null
}
