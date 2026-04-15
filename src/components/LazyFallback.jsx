/**
 * Общий fallback для Suspense lazy-компонентов.
 * Анимированный маскот. Используется в App.jsx и AppRoutes.jsx.
 */
export default function LazyFallback() {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ animation: 'float 1.5s ease-in-out infinite' }}>
        <img src="/mascot/think.webp" alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
      </div>
    </div>
  )
}
