/**
 * Cookie-баннер: показывается до первого OK. После клика по любой кнопке —
 * localStorage stolbiki_cookies + dispatch event для других подписчиков
 * (Яндекс.Метрика init и т.п.). Родитель только следит за state cookieOk.
 */
export default function CookieBanner({ lang, onAccept }) {
  const en = lang === 'en'
  const accept = () => {
    localStorage.setItem('stolbiki_cookies', '1')
    onAccept()
    window.dispatchEvent(new Event('stolbiki-cookies-accepted'))
  }
  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--surface3)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontSize: 13, color: 'var(--ink2)', maxWidth: 600, width: 'calc(100% - 32px)' }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--gold)" strokeWidth="1.5" style={{flexShrink:0}}>
        <circle cx="12" cy="12" r="10"/>
        <circle cx="8" cy="9" r="1" fill="var(--gold)"/>
        <circle cx="14" cy="7" r="1" fill="var(--gold)"/>
        <circle cx="16" cy="13" r="1" fill="var(--gold)"/>
        <circle cx="10" cy="15" r="1" fill="var(--gold)"/>
      </svg>
      <span style={{ flex: 1, lineHeight: 1.5 }}>
        {en ? 'We use cookies and Yandex Metrika for analytics. No personal data is sold.' : 'Cookies для авторизации + Яндекс Метрика для аналитики. Данные не продаём.'}
      </span>
      <button className="btn primary" style={{ fontSize: 12, padding: '8px 20px', flexShrink: 0, borderRadius: 8 }} onClick={accept}>
        OK
      </button>
      <button style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}
        onClick={accept} aria-label="Close">
        ✕
      </button>
    </div>
  )
}
