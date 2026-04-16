/**
 * Баннер турнира: прогресс по партиям, счёт, кнопка отмены.
 * Рендерится null если турнир не активен.
 */
export default function TournamentBanner({ tournament, isNative, lang, t, humanPlayer, onCancel }) {
  if (!tournament) return null
  return (
    <div style={{
      textAlign: 'center', padding: isNative ? '4px 12px' : '8px 16px', marginBottom: isNative ? 4 : 10,
      background: 'rgba(240,160,48,0.06)', borderRadius: isNative ? 8 : 12, border: '1px solid rgba(255,193,69,0.12)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 4 }}>
        {lang === 'en'
          ? `Tournament — game ${tournament.currentGame} of ${tournament.total}`
          : `Турнир — партия ${tournament.currentGame} из ${tournament.total}`}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
        {Array.from({ length: tournament.total }).map((_, i) => {
          const game = tournament.games[i]
          return (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: game ? (game.won ? 'rgba(61,214,140,0.15)' : 'rgba(255,96,102,0.15)') :
                (i + 1 === tournament.currentGame ? 'rgba(74,158,255,0.15)' : 'rgba(42,42,56,0.5)'),
              border: `1px solid ${game ? (game.won ? '#3dd68c33' : '#ff606633') :
                (i + 1 === tournament.currentGame ? '#4a9eff33' : '#2a2a3833')}`,
              color: game ? (game.won ? 'var(--green)' : 'var(--p2)') : (i + 1 === tournament.currentGame ? 'var(--p1)' : 'var(--ink3)'),
            }}>
              {game ? (game.won ? '✓' : '✕') : (i + 1)}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 4 }}>
        {tournament.games.filter(g => g.won).length} : {tournament.games.filter(g => !g.won).length}
        {tournament.currentGame > 1 && ` · ${humanPlayer === 0 ? t('game.blue') : t('game.red')}`}
      </div>
      <button className="btn" onClick={onCancel} style={{ fontSize: 9, padding: '2px 8px', marginTop: 4 }}>
        {lang === 'en' ? 'Cancel tournament' : 'Отменить турнир'}
      </button>
    </div>
  )
}
