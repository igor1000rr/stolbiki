/**
 * Статус-бар над/под доской: статистика сессии, индикатор хода, таймеры,
 * счётчик хода/времени. Вынесено из Game.jsx ради распила.
 *
 * - sessionStats показывается, если есть хотя бы 1 победа/поражение
 * - turnIndicator — только для pvp/spectate/online режимов
 * - timerRow — только если установлен timerLimit
 * - turnCounter — всегда, пока идёт игра
 */
export default function GameStatusBar({
  // общее
  gs, mode, isNative, _lang, t, en,
  // сессия
  sessionStats,
  // статус хода (баннер над доской)
  humanPlayer,
  // таймеры
  timerLimit, playerTime, userSettings, modifiers,
  // счетчик
  elapsed, phase, isMyTurn, totalPlaced, maxTotal, transfer, transfersLeft,
}) {
  const showTurnIndicator = (mode === 'pvp' || mode === 'spectate' || mode === 'online' || mode === 'spectate-online') && !gs.gameOver

  return (
    <>
      {(sessionStats.wins > 0 || sessionStats.losses > 0) && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: isNative ? 2 : 8, fontSize: 11, color: 'var(--ink3)' }}>
          <span>{en ? 'Wins' : 'Побед'}: <b style={{ color: 'var(--green)' }}>{sessionStats.wins}</b></span>
          <span>{en ? 'Losses' : 'Поражений'}: <b style={{ color: 'var(--p2)' }}>{sessionStats.losses}</b></span>
          {sessionStats.streak > 1 && <span>{en ? 'Streak' : 'Серия'}: <b style={{ color: 'var(--gold)' }}>{sessionStats.streak}</b></span>}
        </div>
      )}

      {showTurnIndicator && (
        <div style={{
          textAlign: 'center', padding: isNative ? '3px 10px' : '6px 12px',
          margin: isNative ? '0 auto 2px' : '0 auto 8px',
          fontSize: isNative ? 12 : 13, fontWeight: 600,
          color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--p2)',
          background: gs.currentPlayer === 0 ? 'rgba(74,158,255,0.1)' : 'rgba(255,107,107,0.1)',
          borderRadius: 8, display: 'inline-block',
        }}>
          {mode === 'spectate' || mode === 'spectate-online'
            ? `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}`
            : mode === 'online'
              ? (gs.currentPlayer === humanPlayer ? (en ? 'Your turn' : 'Ваш ход') : (en ? "Opponent's turn" : 'Ходит противник'))
              : `${gs.currentPlayer === 0 ? t('game.blue') : t('game.red')}`}
        </div>
      )}

      {timerLimit > 0 && !gs.gameOver && (
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: isNative ? '2px 12px 4px' : '4px 16px 8px', fontSize: isNative ? 12 : 13, fontFamily: 'monospace' }}>
          <div style={{
            color: gs.currentPlayer === 0 ? 'var(--p1)' : 'var(--ink3)',
            fontWeight: gs.currentPlayer === 0 ? 700 : 400,
            opacity: playerTime[0] < 30 && gs.currentPlayer === 0 ? (playerTime[0] % 2 ? 1 : 0.5) : 1,
          }}>
            {Math.floor(playerTime[0] / 60)}:{String(playerTime[0] % 60).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', alignSelf: 'center' }}>
            {userSettings.timer === 'blitz' ? '3+0' : userSettings.timer === 'rapid' ? '10+0' : '30+0'}
            {modifiers.blitz && <span style={{ color: '#ff9800', marginLeft: 4 }}>⚡пас</span>}
          </div>
          <div style={{
            color: gs.currentPlayer === 1 ? 'var(--p2)' : 'var(--ink3)',
            fontWeight: gs.currentPlayer === 1 ? 700 : 400,
            opacity: playerTime[1] < 30 && gs.currentPlayer === 1 ? (playerTime[1] % 2 ? 1 : 0.5) : 1,
          }}>
            {Math.floor(playerTime[1] / 60)}:{String(playerTime[1] % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      <div style={{
        textAlign: 'center', fontSize: isNative ? 10 : 11,
        color: 'var(--ink3)', padding: isNative ? '3px 8px' : '4px 8px',
        minHeight: isNative ? 16 : 18,
      }}>
        {t('game.turn')} {gs.turn} · {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}
        {phase === 'place' && !gs.isFirstTurn() && isMyTurn && (
          <>
            {' · '}{totalPlaced}/{maxTotal}{transfer ? ' · ✓' : ''}
            {modifiers.doubleTransfer && transfersLeft === 2 && !gs.isFirstTurn() && (
              <span style={{ color: '#9b59b6', marginLeft: 4 }}>⇄×2</span>
            )}
            {modifiers.doubleTransfer && transfersLeft === 1 && transfer && (
              <span style={{ color: '#9b59b6', marginLeft: 4 }}>⇄×1</span>
            )}
          </>
        )}
      </div>
    </>
  )
}
