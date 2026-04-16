import ModifierBadge from './ModifierBadge'

/**
 * Bottom-sheet настроек игры для mobile: режим, сложность, модификаторы,
 * серии. Открывается по клику шестерни в MobileGameBar.
 */
export default function MobileSettingsSheet({
  show, isNative, mode, difficulty, modifiers, tournament, lang, en, humanPlayer,
  onClose, onModeChange, onDifficultyChange,
  toggleFog, setModifiers, modifiersRef,
  onStartTournament,
}) {
  if (!show || !isNative) return null
  return (
    <div className="m-sheet-overlay" onClick={onClose}>
      <div className="m-sheet" onClick={e => e.stopPropagation()}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-title">{lang === 'en' ? 'Game Settings' : 'Настройки игры'}</div>

        <div className="m-setting-row">
          <span className="m-setting-label">{lang === 'en' ? 'Mode' : 'Режим'}</span>
          <select value={mode} onChange={e => { onModeChange(e.target.value); onClose() }}>
            <option value="ai">{lang === 'en' ? 'vs AI' : 'Против AI'}</option>
            <option value="pvp">PvP</option>
            <option value="spectate">AI vs AI</option>
          </select>
        </div>

        {mode === 'ai' && (
          <div className="m-setting-row">
            <span className="m-setting-label">{lang === 'en' ? 'Difficulty' : 'Сложность'}</span>
            <div className="m-difficulty-grid">
              {[
                { v: 50,   l: lang === 'en' ? 'Easy'     : 'Лёгкая' },
                { v: 150,  l: lang === 'en' ? 'Medium'   : 'Средняя' },
                { v: 400,  l: lang === 'en' ? 'Hard'     : 'Сложная' },
                { v: 800,  l: lang === 'en' ? 'Extreme'  : 'Экстрим' },
                { v: 1500, l: lang === 'en' ? 'Hardcore' : 'Хардкор' },
              ].map(d => (
                <button key={d.v} className={`m-diff-opt ${difficulty === d.v ? 'active' : ''}`}
                  onClick={() => { onDifficultyChange(d.v); onClose() }}>
                  {d.l}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="m-setting-row" style={{ flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <span className="m-setting-label">{en ? 'Modifiers' : 'Модификаторы'}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ModifierBadge label={en ? '🌫 Fog' : '🌫 Туман'} active={modifiers.fog}
              onToggle={toggleFog} color="#4a9eff" />
            <ModifierBadge label={en ? '⇄ ×2 Transfer' : '⇄ ×2 перенос'} active={modifiers.doubleTransfer}
              onToggle={() => setModifiers(m => { const nm = { ...m, doubleTransfer: !m.doubleTransfer }; modifiersRef.current = nm; return nm })}
              color="#9b59b6" />
            <ModifierBadge label={en ? '⚡ Auto-pass' : '⚡ Авто-пас'} active={modifiers.blitz}
              onToggle={() => setModifiers(m => { const nm = { ...m, blitz: !m.blitz }; modifiersRef.current = nm; return nm })}
              color="#ff9800" />
          </div>
        </div>

        {mode === 'ai' && !tournament && (
          <div className="m-setting-row">
            <span className="m-setting-label">{lang === 'en' ? 'Series' : 'Серия'}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="m-diff-opt" style={{ flex: 1 }}
                onClick={() => { onStartTournament(3); onClose() }}>
                3 {lang === 'en' ? 'games' : 'партии'}
              </button>
              <button className="m-diff-opt" style={{ flex: 1 }}
                onClick={() => { onStartTournament(5); onClose() }}>
                5 {lang === 'en' ? 'games' : 'партий'}
              </button>
            </div>
          </div>
        )}

        <button className="m-sheet-close" onClick={onClose}>
          {lang === 'en' ? 'Done' : 'Готово'}
        </button>
      </div>
    </div>
  )
}
