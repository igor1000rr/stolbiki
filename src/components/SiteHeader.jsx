import { LANGS } from '../engine/i18n'
import Icon from './Icon'
import BrickBalance from './BrickBalance'
import NotificationBell from './NotificationBell'
import AuthDropdown from './AuthDropdown'

/**
 * Header сайта (только web/desktop — для native используется NativeTabs).
 * Содержит лого, primary/secondary nav, бриксы, уведомления, auth-dropdown,
 * переключатель языка, mobile burger + раскрывающееся mobile-меню.
 *
 * Вынесено из App.jsx ради распила монстра (~110 inline-строк, ~5KB).
 */
export default function SiteHeader({
  lang, setLang, tab, go,
  mobileMenu, setMobileMenu,
  primaryNav, secondaryNav, allNav, isSecondaryActive,
  authUser,
  notifCount, notifData, notifOpen, setNotifOpen,
  authOpen, setAuthOpen,
  authMode, setAuthMode,
  authName, setAuthName,
  authPass, setAuthPass,
  authError, setAuthError,
  authLoading,
  doAuth, doLogout,
  authRef,
  onSkinShop,
}) {
  const en = lang === 'en'

  return (
    <header className="site-header" role="banner">
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
                  <button onClick={() => { onSkinShop(); setMobileMenu(false) }}
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
              onClick={onSkinShop}
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
            <button onClick={() => { onSkinShop(); setMobileMenu(false) }}
              className="nav-more-theme active" style={{ width: '100%', padding: '10px 16px', fontSize: 13 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:6, flexShrink:0}}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
              <span style={{whiteSpace:'nowrap'}}>{en ? 'Customize' : 'Оформление'}</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
