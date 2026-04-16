/**
 * Счётчик побед (закрытых стоек) по игрокам с лейблами и кнопкой скин-шопа.
 * Вынесено из Game.jsx ради распила.
 */
export default function GameScoreboard({ gs, mode, humanPlayer, scoreBump, en, t, gameCtx, authUser }) {
  return (
    <div className="scoreboard">
      <div className="score-player">
        <div className="score-label">{mode === 'ai'
          ? (humanPlayer === 0 ? (authUser?.name || t('game.player')) : 'Snappy')
          : (en ? 'Blue' : 'Синие')}</div>
        <div className={`score-num p0 ${scoreBump === 0 ? 'score-bump' : ''}`}>{gs.countClosed(0)}</div>
      </div>
      <div className="score-sep">:</div>
      <div className="score-player">
        <div className="score-label">{mode === 'ai'
          ? (humanPlayer === 1 ? (authUser?.name || t('game.player')) : 'Snappy')
          : (en ? 'Red' : 'Красные')}</div>
        <div className={`score-num p1 ${scoreBump === 1 ? 'score-bump' : ''}`}>{gs.countClosed(1)}</div>
      </div>
      <button onClick={() => gameCtx?.emit('openSkinShop')}
        style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 6, opacity: 0.4,
          color: 'var(--ink3)', fontSize: 16, lineHeight: 1 }}
        title={en ? 'Skin Shop' : 'Скины'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
        </button>
    </div>
  )
}
