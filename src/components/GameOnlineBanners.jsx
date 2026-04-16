/**
 * Баннеры статуса для online и spectate-online режимов.
 * Показывает имена игроков и кол-во зрителей (только в online).
 * Вынесено из Game.jsx ради распила.
 */
export default function GameOnlineBanners({ mode, lang, isNative, onlinePlayers, spectatorCount }) {
  if (mode === 'online') {
    return (
      <div style={{ textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 12,
        background: 'rgba(61,214,140,0.08)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(61,214,140,0.15)' }}>
        <span style={{ fontSize: isNative ? 11 : 12, color: 'var(--green)', fontWeight: 600 }}>{lang === 'en' ? 'Online' : 'Онлайн'} — {onlinePlayers.join(' vs ')}</span>
        {spectatorCount > 0 && <span style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 8 }}>👁 {spectatorCount}</span>}
      </div>
    )
  }
  if (mode === 'spectate-online') {
    return (
      <div style={{ textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 12,
        background: 'rgba(155,89,182,0.08)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(155,89,182,0.15)' }}>
        <span style={{ fontSize: isNative ? 11 : 12, color: 'var(--purple)', fontWeight: 600 }}>
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="#c8a4e8" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}><circle cx="10" cy="10" r="3"/><path d="M1 10s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/></svg>
          {onlinePlayers.join(' vs ')}
        </span>
      </div>
    )
  }
  return null
}
