import ModifierBadge from './ModifierBadge'
import { isGpuReady } from '../engine/neuralnet'

/**
 * Блок desktop-настроек игры: селекты mode/difficulty, кнопки Best of 3/5,
 * ряд модификаторов (Fog, ×2 Transfer, Auto-pass).
 *
 * Рендерится только на web (!isNative), для mode ≠ online/spectate-online.
 * Вынесено из Game.jsx ради распила (~50 строк JSX).
 */
export default function GameDesktopControls({
  mode, difficulty, modifiers, tournament,
  humanPlayer, en, t,
  setTransfersLeft,
  onModeChange, onDifficultyChange,
  onStartTournament,
  toggleFog,
  setModifiers, modifiersRef,
}) {
  return (
    <>
      <div className="game-settings">
        <label>{t('game.modeLabel')}
          <select value={mode} onChange={e => onModeChange(e.target.value)}>
            <option value="ai">{t('game.vsAI')}</option>
            <option value="pvp">{t('game.pvp')}</option>
            <option value="spectate">AI vs AI</option>
          </select>
        </label>
        {mode === 'ai' && (
          <label>{t('game.diffLabel')}
            <select value={difficulty} onChange={e => onDifficultyChange(+e.target.value)}>
              <option value={50}>{t('game.easy')}</option>
              <option value={150}>{t('game.medium')}</option>
              <option value={400}>{t('game.hard')}</option>
              <option value={800}>{t('game.extreme')}</option>
              <option value={1500}>{en ? 'Hardcore' : 'Хардкор'}</option>
            </select>
            {isGpuReady() && <span style={{ fontSize: 8, color: 'var(--green)', marginLeft: 4 }}>GPU</span>}
          </label>
        )}
        {mode === 'ai' && !tournament && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => onStartTournament(3)} style={{ fontSize: 10, padding: '4px 8px' }}>{en ? 'Best of 3' : 'Серия 3'}</button>
            <button className="btn" onClick={() => onStartTournament(5)} style={{ fontSize: 10, padding: '4px 8px' }}>{en ? 'Best of 5' : 'Серия 5'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--ink3)', marginRight: 2 }}>{en ? 'Mods:' : 'Моды:'}</span>
        <ModifierBadge
          label={en ? '🌫 Fog' : '🌫 Туман'}
          active={modifiers.fog}
          onToggle={toggleFog}
          color="#4a9eff"
        />
        <ModifierBadge
          label={en ? '⇄ ×2 Transfer' : '⇄ ×2 перенос'}
          active={modifiers.doubleTransfer}
          onToggle={() => {
            setModifiers(m => { const nm = { ...m, doubleTransfer: !m.doubleTransfer }; modifiersRef.current = nm; return nm })
            setTransfersLeft(!modifiers.doubleTransfer ? 2 : 1)
          }}
          color="#9b59b6"
        />
        <ModifierBadge
          label={en ? '⚡ Auto-pass' : '⚡ Авто-пас'}
          active={modifiers.blitz}
          onToggle={() => setModifiers(m => { const nm = { ...m, blitz: !m.blitz }; modifiersRef.current = nm; return nm })}
          color="#ff9800"
        />
      </div>
    </>
  )
}
