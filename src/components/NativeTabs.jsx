/**
 * Bottom-nav для Capacitor-сборки. 5 вкладок с SVG-иконками.
 * Раньше был inline в App.jsx (~30 строк с JSX каждой кнопки).
 *
 * «More»-вкладка считается активной не только при tab='more', но и когда
 * пользователь зашёл в settings/rules/blog/changelog/privacy через MoreTabPage.
 */
const MORE_ACTIVE_TABS = ['settings', 'rules', 'blog', 'changelog', 'privacy']

const TAB_ICONS = {
  game: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg>,
  online: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12h18"/></svg>,
  puzzles: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.6-7 7-7s7 3 7 7"/></svg>,
  more: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>,
}

export default function NativeTabs({ tab, lang, onGo }) {
  const en = lang === 'en'
  const labels = {
    game: en ? 'Play' : 'Играть',
    online: en ? 'Online' : 'Онлайн',
    puzzles: en ? 'Puzzles' : 'Задачи',
    profile: en ? 'Profile' : 'Профиль',
    more: en ? 'More' : 'Ещё',
  }
  return (
    <nav className="native-tabs" role="tablist">
      {['game', 'online', 'puzzles', 'profile', 'more'].map(id => {
        const active = tab === id || (id === 'more' && MORE_ACTIVE_TABS.includes(tab))
        return (
          <button key={id} role="tab"
            aria-selected={active}
            className={`native-tab ${active ? 'active' : ''}`}
            onClick={() => onGo(id)}>
            <span className="native-tab-icon">{TAB_ICONS[id]}</span>
            <span className="native-tab-label">{labels[id]}</span>
          </button>
        )
      })}
    </nav>
  )
}
