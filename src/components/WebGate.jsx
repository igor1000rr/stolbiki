/**
 * Плашка для web-гостей при попытке открыть игровую часть.
 *
 * Решение Александра (апр 2026): десктоп-сайт — полигон для тестов,
 * игра публично ливёт в мобильном приложении. Админы на сайте видят
 * всё как раньше, остальные — эту заглушку с приглашением установить APK.
 *
 * Пока APK не в Play Store — CTA ведёт обратно на лендинг.
 * Когда опубликуем — заменить блок «Скоро в Google Play» на прямую ссылку.
 */
export default function WebGate({ tab, lang, onGoLanding }) {
  const en = lang === 'en'

  const titles = {
    game:                en ? 'Play' : 'Игра',
    online:              en ? 'Online' : 'Онлайн',
    puzzles:             en ? 'Puzzles' : 'Головоломки',
    openings:            en ? 'Analytics' : 'Аналитика',
    goldenrush:          'Golden Rush',
    'goldenrush-online': 'Golden Rush Online',
    'goldenrush-top':    'Golden Rush Top',
    sim:                 'Simulator',
    dash:                'Dashboard',
    replay:              'Replays',
    admin:               en ? 'Admin' : 'Админ',
  }
  const title = titles[tab] || (en ? 'Game' : 'Игра')

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 560,
        textAlign: 'center',
        padding: '48px 32px',
        background: 'color-mix(in srgb, var(--surface, #1a1a2a) 75%, transparent)',
        backdropFilter: 'blur(14px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
        borderRadius: 24,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      }}>
        <div style={{
          fontSize: 52,
          marginBottom: 16,
          lineHeight: 1,
        }}>📱</div>

        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          margin: '0 0 12px',
          color: 'var(--ink, #eae8f2)',
        }}>
          {en ? 'Mobile first' : 'Только на мобильном'}
        </h1>

        <p style={{
          fontSize: 15,
          lineHeight: 1.5,
          color: 'var(--ink2, #a8a4b8)',
          margin: '0 0 28px',
        }}>
          {en
            ? <>«{title}» is designed for phones and tablets. We’re polishing the desktop experience — for now, use the Android app.</>
            : <>«{title}» создан для телефонов. Десктоп-версию ещё доводим — пока играйте в мобильном приложении.</>}
        </p>

        <button
          onClick={onGoLanding}
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            background: 'var(--accent, #3bb8a8)',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 14px rgba(59, 184, 168, 0.35)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {en ? '← Back to home' : '← На главную'}
        </button>

        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 13,
          color: 'var(--ink3, #6e6a82)',
        }}>
          {en ? (
            <>Soon on <strong style={{color:'var(--ink2)'}}>Google Play</strong>. Follow updates in the blog.</>
          ) : (
            <>Скоро в <strong style={{color:'var(--ink2)'}}>Google Play</strong>. Новости — в блоге.</>
          )}
        </div>
      </div>
    </div>
  )
}
