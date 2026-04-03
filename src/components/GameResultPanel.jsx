/**
 * GameResultPanel — экран результата после партии
 * Извлечён из Game.jsx (~200 строк JSX → отдельный компонент)
 */

import Mascot from './Mascot'
import Confetti from './Confetti'
import * as MP from '../engine/multiplayer'
import * as API from '../engine/api'
import { generateShareImage } from './gameUtils'

export default function GameResultPanel({
  result, mode, humanPlayer, gs, elapsed, ratingDelta,
  sessionStats, tournament, isNative, lang, t, difficulty,
  newGame, tournamentNextGame, gameCtx, moveHistoryRef,
  rematchPending, setRematchPending, setInfo, setShowReplay, setShowReview,
}) {
  if (result === null) return null

  const isDraw = result === -1
  const won = isDraw ? false : (mode === 'pvp') ? true : result === humanPlayer
  const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
  const goldenOwned = (0 in gs.closed)
  const shareText = `Snatch Highrise${mode === 'online' ? ' Online' : ''}: ${isDraw ? 'Draw' : won ? 'W' : 'L'} ${s0}:${s1} ${goldenOwned ? '⭐' : ''} — snatch-highrise.com`
  const accentColor = isDraw ? 'var(--purple)' : won ? 'var(--green)' : 'var(--p2)'

  const inner = (
    <div className="game-result" style={{ ...(isNative ? {} : { borderLeft: `3px solid ${accentColor}` }), textAlign: 'center' }}>
      {won && <Confetti />}
      {isNative && <div style={{ width: 60, height: 3, borderRadius: 2, background: accentColor, margin: '0 auto 16px', opacity: 0.8 }} />}
      <div style={{ marginBottom: isNative ? 8 : 4, display: 'flex', justifyContent: 'center' }}>
        <Mascot pose={isDraw ? 'shock' : won ? 'celebrate' : 'sad'} size={isNative ? 100 : 72} className="mascot-enter" />
      </div>
      <span style={{ fontSize: isNative ? 24 : 20, fontWeight: isNative ? 700 : 400 }}>{isDraw
        ? (t('game.draw'))
        : mode === 'pvp'
        ? `${result === 0 ? t('game.blueWin') : t('game.redWin')}`
        : mode === 'online'
        ? (won ? t('game.victory') : t('game.defeat'))
        : (won ? t('game.victory') : t('game.aiWins'))
      }</span>
      <div style={{ fontSize: isNative ? 44 : 32, fontWeight: 700, margin: isNative ? '12px 0' : '6px 0', color: 'var(--ink)' }}>{s0} : {s1}</div>
      <div style={{ fontSize: isNative ? 12 : 11, color: 'var(--ink3)', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
        <span>{t('game.moves')}: {gs.turn}</span>
        <span>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
        {goldenOwned && <span style={{ color: 'var(--gold)' }}>★ {lang === 'en' ? 'Golden' : 'Золотая'}</span>}
      </div>
      {ratingDelta && (
        <div style={{ marginTop: isNative ? 12 : 8, fontSize: isNative ? 20 : 16, fontWeight: 700, color: ratingDelta > 0 ? 'var(--green)' : 'var(--p2)', animation: 'fadeIn 0.5s ease' }}>
          {ratingDelta > 0 ? '+' : ''}{ratingDelta} ELO
        </div>
      )}
      {sessionStats?.streak >= 3 && won && (
        <div style={{ fontSize: isNative ? 16 : 13, color: 'var(--gold)', marginTop: 8, fontWeight: 600, animation: 'fadeIn 0.5s' }}>
          🔥 {sessionStats.streak} {t('game.winStreak')}
        </div>
      )}
      <div style={{ marginTop: isNative ? 24 : 10, display: 'flex', gap: isNative ? 10 : 8, justifyContent: 'center', flexWrap: 'wrap', ...(isNative ? { flexDirection: 'column', alignItems: 'stretch', width: '100%', maxWidth: 320, margin: '24px auto 0' } : {}) }}>
        {!tournament && (
          <button className="btn primary" onClick={() => {
            if (mode === 'online' || mode === 'spectate-online') gameCtx?.emit('backToLobby')
            else newGame()
          }} style={{ fontSize: isNative ? 16 : 12, padding: isNative ? '14px 24px' : '8px 16px', justifyContent: 'center' }}>
            {(mode === 'online' || mode === 'spectate-online')
              ? (t('game.backToLobby'))
              : (mode === 'ai' && !won && !isDraw)
                ? t('game.rematch')
                : (t('game.anotherGame'))}
          </button>
        )}
        {mode === 'online' && !tournament && !rematchPending && (
          <button className="btn" onClick={() => {
            MP.sendRematchOffer()
            setRematchPending(true)
            setInfo(t('game.rematchWaiting'))
          }} style={{ fontSize: isNative ? 15 : 12, padding: isNative ? '12px 20px' : '8px 16px', borderColor: 'var(--green)', color: 'var(--green)', justifyContent: 'center' }}>
            {t('game.rematch')}
          </button>
        )}
        {mode === 'online' && rematchPending && (
          <span style={{ fontSize: 11, color: 'var(--ink3)', padding: '8px 12px' }}>{t('game.rematchWaiting')}</span>
        )}
        {mode === 'ai' && !tournament && (
          <button className="btn" onClick={() => newGame(humanPlayer === 0 ? 1 : 0, difficulty, mode)} style={{ fontSize: isNative ? 14 : 12, padding: isNative ? '12px 20px' : '8px 14px', justifyContent: 'center' }}>
            {t('game.switchSide')}
          </button>
        )}
        {mode === 'ai' && !won && !isDraw && sessionStats.loseStreak >= 3 && difficulty > 50 && (
          <button className="btn" onClick={() => {
            const easier = difficulty >= 400 ? 200 : difficulty >= 200 ? 100 : 50
            newGame(humanPlayer, easier, mode)
          }} style={{ fontSize: isNative ? 14 : 12, padding: isNative ? '12px 20px' : '8px 14px', justifyContent: 'center', borderColor: 'var(--gold)', color: 'var(--gold)', animation: 'fadeIn 0.5s ease' }}>
            {t('game.tryEasier')}
          </button>
        )}
        <button className="btn" onClick={async () => {
          try {
            const profile = JSON.parse(localStorage.getItem('stolbiki_profile') || '{}')
            const c = generateShareImage(gs, won, isDraw, s0, s1, {
              playerName: profile?.name, rating: profile?.rating, ratingDelta,
              difficulty, moves: gs.turn, elapsed, mode,
            })
            const blob = await new Promise(r => c.toBlob(r, 'image/png'))
            const file = new File([blob], 'stolbiki-result.png', { type: 'image/png' })
            API.track('share_card', 'game', { won, isDraw })
            if (navigator.canShare?.({ files: [file] })) navigator.share({ text: shareText, files: [file] }).catch(() => {})
            else if (navigator.share) navigator.share({ text: shareText }).catch(() => {})
            else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'stolbiki-result.png'; a.click(); URL.revokeObjectURL(url) }
          } catch { navigator.clipboard?.writeText(shareText) }
        }} style={{ fontSize: isNative ? 14 : 12, padding: isNative ? '12px 16px' : '8px 12px', justifyContent: 'center' }}>
          {t('game.share')}
        </button>
        {moveHistoryRef.current.length > 0 && (
          <button className="btn" onClick={() => setShowReplay(true)} style={{ fontSize: 12, padding: '8px 12px' }}>
            {t('game.replay')}
          </button>
        )}
        {moveHistoryRef.current.length > 0 && API.isLoggedIn() && (
          <button className="btn" onClick={async () => {
            try {
              const resp = await fetch('/api/replays', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API.getToken()}` },
                body: JSON.stringify({ moves: moveHistoryRef.current, result, score: `${s0}:${s1}`, mode, turns: gs.turn })
              })
              const data = await resp.json()
              if (data.id) {
                const url = `${location.origin}/#replay/${data.id}`
                if (navigator.share) navigator.share({ text: `${shareText}\n${url}` }).catch(() => {})
                else { navigator.clipboard?.writeText(url); setInfo(lang === 'en' ? 'Link copied!' : 'Ссылка скопирована!') }
              }
            } catch { setInfo(lang === 'en' ? 'Error saving replay' : 'Ошибка сохранения') }
          }} style={{ fontSize: 12, padding: '8px 12px', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            {lang === 'en' ? '🔗 Share replay' : '🔗 Поделиться'}
          </button>
        )}
        {moveHistoryRef.current.length > 2 && (
          <button className="btn" onClick={() => { setShowReview(true); API.track('ai_review', 'game') }} style={{
            fontSize: isNative ? 14 : 12, padding: isNative ? '12px 16px' : '8px 12px',
            borderColor: 'var(--purple)', color: 'var(--purple)', justifyContent: 'center',
          }}>
            {lang === 'en' ? 'AI Analysis' : 'AI Анализ'}
          </button>
        )}
      </div>
      {sessionStats.streak > 1 && won && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)' }}>
          {lang === 'en' ? 'Win streak' : 'Серия побед'}: {sessionStats.streak}
        </div>
      )}
      {/* Турнир */}
      {tournament && (() => {
        const tWins = tournament.games.filter(g => g.won).length
        const tLosses = tournament.games.filter(g => !g.won).length
        const isFinished = tournament.games.length >= tournament.total
        const majorityNeeded = Math.ceil(tournament.total / 2)
        const earlyWin = tWins >= majorityNeeded || tLosses >= majorityNeeded
        const tournamentDone = isFinished || earlyWin
        const tournamentWon = tWins > tLosses
        const tournamentDraw = tWins === tLosses

        if (tournamentDone) {
          return (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,193,69,0.06)', borderRadius: 12, border: '1px solid rgba(255,193,69,0.12)' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{tournamentDraw ? '=' : tournamentWon ? '+' : '-'}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                {tournamentDraw ? t('tournament.draw') : tournamentWon ? t('tournament.won') : t('tournament.lost')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{tWins} : {tLosses}</div>
              <button className="btn primary" onClick={() => newGame()} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
                {t('game.anotherGame')}
              </button>
            </div>
          )
        }
        return (
          <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(74,158,255,0.06)', borderRadius: 12, border: '1px solid rgba(74,158,255,0.1)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6 }}>
              {lang === 'en' ? 'Tournament' : 'Турнир'}: {tWins} : {tLosses} · {lang === 'en' ? 'Game' : 'Партия'} {tournament.games.length} {lang === 'en' ? 'of' : 'из'} {tournament.total}
            </div>
            <button className="btn primary" onClick={tournamentNextGame} style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px 0' }}>
              ▶ {lang === 'en' ? 'Next game' : 'Следующая партия'}
            </button>
          </div>
        )
      })()}
    </div>
  )

  return isNative ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>{inner}</div>
    </div>
  ) : inner
}
