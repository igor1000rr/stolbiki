import Icon from './Icon'
import * as API from '../engine/api'

/**
 * Выпадайка под кнопкой авторизации в десктопном хедере.
 * Два состояния: авторизован (профиль/настройки/logout) или гость (login/register form).
 *
 * Trigger-кнопка остаётся в App.jsx (нужна для authRef click-outside detection).
 * Сюда выносится только содержимое выпадайки (~70 строк inline).
 */
export default function AuthDropdown({
  authUser, lang,
  authMode, authName, setAuthName, authPass, setAuthPass,
  authError, authLoading,
  onAuth, onLogout, onClose, onGo, onSwitchMode,
}) {
  const en = lang === 'en'

  if (authUser) {
    return (
      <>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface2)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{authUser.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
            {en ? 'Rating' : 'Рейтинг'}: {authUser.rating || 1000} · {en ? 'Games' : 'Партий'}: {authUser.gamesPlayed || 0}
            {(authUser.bricks || 0) > 0 && ` · 🧱 ${authUser.bricks}`}
          </div>
        </div>
        <button onClick={() => { onGo('profile'); onClose() }} className="header-auth-item">
          <Icon name="profile" size={14} style={{ opacity: 0.5 }} />{en ? 'Profile' : 'Профиль'}
        </button>
        <button onClick={() => { onGo('settings'); onClose() }} className="header-auth-item">
          <Icon name="theme" size={14} style={{ opacity: 0.5 }} />{en ? 'Settings' : 'Настройки'}
        </button>
        <div className="nav-more-divider" />
        <button onClick={onLogout} className="header-auth-item" style={{ color: 'var(--p2)' }}>
          {en ? 'Logout' : 'Выйти'}
        </button>
      </>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
        {authMode === 'login' ? (en ? 'Login' : 'Вход') : (en ? 'Register' : 'Регистрация')}
      </div>
      {authError && <div style={{ fontSize: 11, color: 'var(--p2)', marginBottom: 8 }}>{authError}</div>}
      <input type="text" placeholder={en ? 'Username' : 'Никнейм'} value={authName}
        onChange={e => setAuthName(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAuth()}
        className="header-auth-input" autoFocus />
      <input type="password" placeholder={en ? 'Password' : 'Пароль'} value={authPass}
        onChange={e => setAuthPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAuth()}
        className="header-auth-input" />
      {authMode === 'register' && (
        <input type="text" placeholder={en ? 'Referral code (optional)' : 'Код друга (необязательно)'}
          defaultValue={API.getSavedReferralCode() || ''}
          onChange={e => { if (e.target.value) localStorage.setItem('stolbiki_ref', e.target.value.trim().toUpperCase()); else localStorage.removeItem('stolbiki_ref') }}
          className="header-auth-input" style={{ fontSize: 11 }} />
      )}
      <button className="btn primary" onClick={onAuth} disabled={authLoading} style={{ width: '100%', fontSize: 12, padding: '8px 0' }}>
        {authLoading ? '...' : authMode === 'login' ? (en ? 'Login' : 'Войти') : (en ? 'Register' : 'Создать')}
      </button>
      <button onClick={onSwitchMode}
        style={{ width: '100%', background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 11, padding: '8px 0', cursor: 'pointer' }}>
        {authMode === 'login' ? (en ? 'No account? Register' : 'Нет аккаунта? Регистрация') : (en ? 'Have account? Login' : 'Есть аккаунт? Войти')}
      </button>
    </div>
  )
}
