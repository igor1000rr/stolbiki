import { APP_VERSION } from '../version'
import { shareApp } from '../engine/appstore'

/**
 * Полностраничное меню для Capacitor-сборки (вкладка «Ещё»).
 * Раньше было ~110 строк inline в App.jsx — вынесено для читаемости.
 *
 * Все хендлеры приходят пропсами (single source of truth — App.jsx).
 *
 * 28.04.2026 — Lessons убраны из mobile-меню по ТЗ Александра:
 *   "Lessons в Web уже нет, а в приложении есть и оно инициирует перезагрузку,
 *   давай тоже уберем". Пропс onLessons оставлен для обратной совместимости
 *   с App.jsx, просто перестал использоваться.
 */
export default function MoreTabPage({
  authUser, lang, setLang, go,
  onLessons, onSkinShop, onLogout,
}) {
  // eslint-disable-next-line no-unused-vars
  void onLessons
  const en = lang === 'en'
  return (
    <div className="m-more-page">
      {authUser && (
        <div className="m-more-user">
          <div className="m-more-avatar">{authUser.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{authUser.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
              {en ? 'Rating' : 'Рейтинг'}: {authUser.rating || 1000}
              {(authUser.bricks || 0) > 0 && <span style={{ color: 'var(--gold)', marginLeft: 8 }}>🧱 {authUser.bricks}</span>}
            </div>
          </div>
        </div>
      )}
      {!authUser && (
        <button className="m-more-item" onClick={() => go('profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.6-7 7-7s7 3 7 7"/></svg>
          <span>{en ? 'Login / Register' : 'Вход / Регистрация'}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      )}

      <div className="m-more-section">{en ? 'Game' : 'Игра'}</div>
      <button className="m-more-item" onClick={() => go('rules')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h6M8 16h4"/></svg>
        <span>{en ? 'Rules' : 'Правила'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
      </button>
      <button className="m-more-item" onClick={onSkinShop}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        <span>{en ? 'Customize' : 'Оформление'}</span>
        {authUser && (authUser.bricks || 0) > 0 && <span className="m-more-value" style={{ color: 'var(--gold)' }}>🧱 {authUser.bricks}</span>}
      </button>
      <button className="m-more-item" onClick={() => go('openings')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M3 20l4-8 4 4 4-12 6 16"/></svg>
        <span>{en ? 'Analytics' : 'Аналитика'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
      </button>
      <button className="m-more-item" onClick={() => go('blog')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M4 4h16v16H4z"/><path d="M8 2v4M16 2v4M4 10h16"/></svg>
        <span>{en ? 'Blog' : 'Блог'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
      </button>

      <div className="m-more-section">{en ? 'Settings' : 'Настройки'}</div>
      <button className="m-more-item" onClick={() => go('settings')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/></svg>
        <span>{en ? 'Customization' : 'Кастомизация'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
      </button>
      <div className="m-more-item" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12h18"/></svg>
        <span>{en ? 'Language' : 'Язык'}</span>
        <span className="m-more-value">{lang === 'ru' ? 'RU' : 'EN'}</span>
      </div>
      <button className="m-more-item" onClick={() => go('changelog')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
        <span>Changelog</span>
        <span className="m-more-value">v{APP_VERSION}</span>
      </button>

      <div className="m-more-section">{en ? 'About' : 'О приложении'}</div>
      <button className="m-more-item" onClick={() => shareApp(lang)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
        <span>{en ? 'Share app' : 'Поделиться'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
      </button>
      <button className="m-more-item" onClick={() => go('privacy')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>{en ? 'Privacy Policy' : 'Конфиденциальность'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="m-more-chevron"><path d="M9 5l7 7-7 7"/></svg>
      </button>

      {authUser && (
        <>
          <div className="m-more-section" />
          <button className="m-more-item m-more-danger" onClick={onLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            <span>{en ? 'Logout' : 'Выйти'}</span>
          </button>
        </>
      )}
    </div>
  )
}
