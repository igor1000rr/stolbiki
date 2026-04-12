/**
 * GameResultPanel — экран результата после партии
 * Извлечён из Game.jsx
 * v5.1: TikTok highlight reel кнопка
 */

import { useState, lazy, Suspense } from 'react'
import Mascot from './Mascot'
import Confetti from './Confetti'
import * as MP from '../engine/multiplayer'
import * as API from '../engine/api'
import { generateShareImage } from './gameUtils'

const GameHighlightReel = lazy(() => import('./GameHighlightReel'))

export default function GameResultPanel({
  result, mode, humanPlayer, gs, elapsed, ratingDelta,
  sessionStats, tournament, isNative, lang, t, difficulty,
  newGame, tournamentNextGame, gameCtx, moveHistoryRef,
  rematchPending, setRematchPending, setInfo, setShowReplay, setShowReview,
}) {
  const [sharePreview, setSharePreview] = useState(null)
  const [showHighlightReel, setShowHighlightReel] = useState(false)

  if (result === null) return null

  const en = lang === 'en'
  const isDraw = result === -1
  const won = isDraw ? false : (mode === 'pvp') ? true : result === humanPlayer
  const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
  const goldenOwned = (0 in gs.closed)
  const shareText = `Snatch Highrise${mode === 'online' ? ' Online' : ''}: ${isDraw ? 'Draw' : won ? 'W' : 'L'} ${s0}:${s1} ${goldenOwned ? '⭐' : ''} — snatch-highrise.com`
  const accentColor = isDraw ? 'var(--purple)' : won ? 'var(--green)' : 'var(--p2)'

  async function doShare() {
    try {
      const profile = JSON.parse(localStorage.getItem('stolbiki_profile') || '{}')
      const canvas = generateShareImage(gs, won, isDraw, s0, s1, {
        playerName: profile?.name, rating: profile?.rating, ratingDelta,
        difficulty, moves: gs.turn, elapsed, mode, lang,
      })
      API.track('share_card', 'game', { won, isDraw })
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const file = new File([blob], 'snatch-result.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text: shareText, files: [file] }).catch(() => {})
      } else if (navigator.share) {
        await navigator.share({ text: shareText }).catch(() => {})
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'snatch-result.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { navigator.clipboard?.writeText(shareText) }
  }

  function showPreview() {
    try {
      const profile = JSON.parse(localStorage.getItem('stolbiki_profile') || '{}')
      const canvas = generateShareImage(gs, won, isDraw, s0, s1, {
        playerName: profile?.name, rating: profile?.rating, ratingDelta,
        difficulty, moves: gs.turn, elapsed, mode, lang,
      })
      setSharePreview(canvas.toDataURL('image/png'))
    } catch {}
  }

  // Активный скин для рил
  function getActiveSkinId() {
    try {
      const s = JSON.parse(localStorage.getItem('stolbiki_settings') || '{}')
      const cs = s.chipStyle || 'classic'
      const m = { classic: 'blocks_classic', flat: 'blocks_flat', rounded: 'blocks_round', glass: 'blocks_glass', metal: 'blocks_metal', candy: 'blocks_candy', pixel: 'blocks_pixel', neon: 'blocks_neon', glow: 'blocks_glow' }
      return cs.startsWith('blocks_') ? cs : (m[cs] || 'blocks_classic')
    } catch { return 'blocks_classic' }
  }

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
        {goldenOwned && <span style={{ color: 'var(--gold)' }}>★ {en ? 'Golden' : 'Золотая'}</span>}
      </div>
      {ratingDelta && (
        <div style={{ marginTop: isNative ? 12 : 8, fontSize: isNative ? 20 : 16, fontWeight: 700, color: ratingDelta > 0 ? 'var(--green)' : 'var(--p2)', animation: 'fadeIn 0.5s ease' }}>
          {ratingDelta > 0 ? '+' : ''}{ratingDelta} ELO
        </div>
      )}
      {sessionStats?.streak >= 3 && won && (
        <div style={{ fontSize: isNative ? 16 : 13, color: 'var(--gold)', marginTop: 8, fontWeight: 600, animation: 'fadeIn 0.5s' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--gold)" style={{verticalAlign:'middle',marginRight:4}}><path d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.17-6.44 4-8 0 3 2 5 3 6 .47-2.2 2.05-4.86 4-7 1.07 1.5 2.37 3.61 3 6 1-1 2-3 3-6 1.83 1.56 4 4.93 4 8 0 4.42-4.03 8-9 9h-3z"/></svg>
          {sessionStats.streak} {t('game.winStreak')}
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

        {/* ─── Share ─── */}
        <button className="btn" onClick={showPreview}
          style={{ fontSize: isNative ? 14 : 12, padding: isNative ? '12px 16px' : '8px 12px', justifyContent: 'center',
            borderColor: accentColor, color: accentColor }}>
          {en ? '📸 Share Image' : '📸 Поделиться'}
        </button>

        {/* ─── TikTok видео ─── */}
        {moveHistoryRef.current.length >= 4 && (
          <button className="btn" onClick={() => setShowHighlightReel(true)}
            style={{ fontSize: isNative ? 14 : 12, padding: isNative ? '12px 16px' : '8px 12px', justifyContent: 'center',
              borderColor: '#ff0050', color: '#ff0050' }}>
            🎬 TikTok
          </button>
        )}

        {moveHistoryRef.current.length > 0 && (
          <button className="btn" onClick={() => setShowReplay(true)} style={{ fontSize: 12, padding: '8px 12px' }}>
            {t('game.replay')}
          </button>
        )}
        {moveHistoryRef.current.length > 2 && (
          <button className="btn" onClick={() => { setShowReview(true); API.track('ai_review', 'game') }} style={{
            fontSize: isNative ? 14 : 12, padding: isNative ? '12px 16px' : '8px 12px',
            borderColor: 'var(--purple)', color: 'var(--purple)', justifyContent: 'center',
          }}>
            {en ? 'AI Analysis' : 'AI Анализ'}
          </button>
        )}
      </div>
      {sessionStats.streak > 1 && won && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)' }}>
          {en ? 'Win streak' : 'Серия побед'}: {sessionStats.streak}
        </div>
      )}

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
              {en ? 'Tournament' : 'Турнир'}: {tWins} : {tLosses} · {en ? 'Game' : 'Партия'} {tournament.games.length} {en ? 'of' : 'из'} {tournament.total}
            </div>
            <button className="btn primary" onClick={tournamentNextGame} style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '10px 0' }}>
              ▶ {en ? 'Next game' : 'Следующая партия'}
            </button>
          </div>
        )
      })()}

      {/* ─── Превью share ─── */}
      {sharePreview && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setSharePreview(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 340, width: '100%' }}>
            <img src={sharePreview} alt="Share preview"
              style={{ width: '100%', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" onClick={doShare}
                style={{ flex: 1, justifyContent: 'center', fontSize: 14, padding: '12px 0' }}>
                {en ? '↑ Share' : '↑ Поделиться'}
              </button>
              <button className="btn" onClick={() => setSharePreview(null)}
                style={{ flex: 1, justifyContent: 'center', fontSize: 14, padding: '12px 0' }}>
                {en ? 'Close' : 'Закрыть'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TikTok Highlight Reel ─── */}
      {showHighlightReel && (
        <Suspense fallback={null}>
          <GameHighlightReel
            moveHistory={moveHistoryRef.current}
            result={result}
            humanPlayer={humanPlayer}
            skinId={getActiveSkinId()}
            onClose={() => setShowHighlightReel(false)}
          />
        </Suspense>
      )}
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
