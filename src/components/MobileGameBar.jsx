import { isGpuReady } from '../engine/neuralnet'

/**
 * Мобильный game-bar над доской: бейдж сложности, сторона игрока,
 * иконки активных модификаторов, кнопка шестерни. Только native, не в online.
 */
export default function MobileGameBar({ isNative, mode, difficulty, modifiers, humanPlayer, lang, t, onSettingsOpen }) {
  if (!isNative || mode === 'online' || mode === 'spectate-online') return null
  return (
    <div className="m-game-bar">
      <div className="m-game-bar-info">
        <span className="m-diff-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            {difficulty >= 1500 ? <><circle cx="12" cy="10" r="7"/><path d="M9 14v2M15 14v2M8 20h8"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/></> :
             difficulty >= 800 ? <path d="M12 2c-4 6-8 9-8 13a8 8 0 0016 0c0-4-4-7-8-13z"/> :
             difficulty >= 400 ? <><path d="M12 22V2"/><path d="M4 12l4-4 4 4 4-4 4 4"/></> :
             difficulty >= 150 ? <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></> :
             <circle cx="12" cy="12" r="9"/>}
          </svg>
          {difficulty >= 1500 ? (lang === 'en' ? 'Hardcore' : 'Хардкор') :
           difficulty >= 800 ? (lang === 'en' ? 'Extreme' : 'Экстрим') :
           difficulty >= 400 ? t('game.hard') :
           difficulty >= 150 ? t('game.medium') : t('game.easy')}
          {isGpuReady() && <span style={{ fontSize: 8, color: 'var(--green)', marginLeft: 3 }}>GPU</span>}
        </span>
        {mode === 'ai' && <span className="m-side-indicator" style={{ background: humanPlayer === 0 ? 'var(--p1)' : 'var(--p2)' }} />}
        {modifiers.fog && <span style={{ fontSize: 9, color: '#4a9eff' }}>🌫</span>}
        {modifiers.doubleTransfer && <span style={{ fontSize: 9, color: '#9b59b6' }}>⇄×2</span>}
        {modifiers.blitz && <span style={{ fontSize: 9, color: '#ff9800' }}>⚡</span>}
      </div>
      <button className="m-gear-btn" onClick={onSettingsOpen} aria-label="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/>
        </svg>
      </button>
    </div>
  )
}
