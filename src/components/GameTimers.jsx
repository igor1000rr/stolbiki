/**
 * Отображение таймеров двух игроков + режим (3+0/10+0/30+0).
 * Пульсация когда осталось <30с на ходу.
 */
export default function GameTimers({
  timerLimit, playerTime, currentPlayer,
  timerSetting, blitz, isNative, gameOver,
}) {
  if (!(timerLimit > 0) || gameOver) return null

  const format = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  const timerLabel = timerSetting === 'blitz' ? '3+0' : timerSetting === 'rapid' ? '10+0' : '30+0'

  const opacity = (idx) => (
    playerTime[idx] < 30 && currentPlayer === idx
      ? (playerTime[idx] % 2 ? 1 : 0.5)
      : 1
  )

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      margin: isNative ? '2px 12px 4px' : '4px 16px 8px',
      fontSize: isNative ? 12 : 13, fontFamily: 'monospace',
    }}>
      <div style={{
        color: currentPlayer === 0 ? 'var(--p1)' : 'var(--ink3)',
        fontWeight: currentPlayer === 0 ? 700 : 400,
        opacity: opacity(0),
      }}>
        {format(playerTime[0])}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink3)', alignSelf: 'center' }}>
        {timerLabel}
        {blitz && <span style={{ color: '#ff9800', marginLeft: 4 }}>⚡пас</span>}
      </div>
      <div style={{
        color: currentPlayer === 1 ? 'var(--p2)' : 'var(--ink3)',
        fontWeight: currentPlayer === 1 ? 700 : 400,
        opacity: opacity(1),
      }}>
        {format(playerTime[1])}
      </div>
    </div>
  )
}
