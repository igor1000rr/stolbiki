import { WHATS_NEW } from '../data/whats-new'

/**
 * Модалка "Что нового" — показывается при первом заходе после обновления версии.
 * Родитель управляет видимостью через showWhatsNew state и localStorage stolbiki_seen_version.
 */
export default function WhatsNewModal({ lang, version, onClose }) {
  const en = lang === 'en'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '24px 28px', maxWidth: 340, width: '90%',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ animation: 'float 1.5s ease-in-out infinite', display: 'inline-block' }}>
            <img src="/mascot/celebrate.webp" alt="" width={64} height={64} style={{ objectFit: 'contain' }} />
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', marginBottom: 4 }}>
          {en ? "What's New" : 'Что нового'} <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 400 }}>v{version}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginBottom: 16 }}>
          {en ? 'Latest updates' : 'Последние обновления'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(WHATS_NEW[en ? 'en' : 'ru']).map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--ink2)', paddingLeft: 16, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>•</span>
              {item}
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={onClose}
          style={{ width: '100%', marginTop: 20, justifyContent: 'center', fontSize: 14 }}>
          {en ? 'Got it!' : 'Понятно!'}
        </button>
      </div>
    </div>
  )
}
