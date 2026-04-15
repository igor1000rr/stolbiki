import { APP_VERSION } from '../version'

/**
 * Footer сайта (только web — на native не показывается).
 * Статус online/offline, ссылки на changelog/rules/privacy/terms, версия.
 *
 * Вынесено из App.jsx ради распила.
 */
export default function SiteFooter({ lang, t, publicStats, go }) {
  const en = lang === 'en'

  return (
    <footer className="site-footer" role="contentinfo">
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
    </footer>
  )
}
