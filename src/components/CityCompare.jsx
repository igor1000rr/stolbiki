/**
 * CityCompare — сравнение двух Городов побед бок-о-бок.
 *
 * Использует свободный embed-роут в iframe — это изолирует два WebGL контекста
 * и не раздувает основной бандл. По бокам — блоки со статистикой и сравнением
 * по каждой метрике (победивший подсвечен золотым).
 *
 * Выбор соперника: из топа (leaderboard) или по прямому поиску по имени.
 */
import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'

function StatRow({ label, leftValue, rightValue, format = (v) => v, _en }) {
  const leftWins = leftValue > rightValue
  const rightWins = rightValue > leftValue
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      gap: 12, alignItems: 'center', padding: '8px 4px',
      borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13,
    }}>
      <div style={{
        textAlign: 'right',
        color: leftWins ? 'var(--gold, #ffc145)' : 'var(--ink, #e8e6f2)',
        fontWeight: leftWins ? 700 : 500,
      }}>
        {format(leftValue)}
        {leftWins && <span style={{ marginLeft: 4 }}>◀</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{
        textAlign: 'left',
        color: rightWins ? 'var(--gold, #ffc145)' : 'var(--ink, #e8e6f2)',
        fontWeight: rightWins ? 700 : 500,
      }}>
        {rightWins && <span style={{ marginRight: 4 }}>▶</span>}
        {format(rightValue)}
      </div>
    </div>
  )
}

function PlayerSlot({ slot, player, onPick, onClear, en, leaderboard }) {
  const [showPicker, setShowPicker] = useState(false)

  if (player) {
    return (
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--surface)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 14, fontWeight: 600, color: 'var(--ink2)',
        }}>
          {player.avatar_url
            ? <img src={player.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (player.name || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>
            {player.total_wins} {en ? 'wins' : 'побед'}
          </div>
        </div>
        <button onClick={onClear}
          style={{
            background: 'none', border: 'none', color: 'var(--ink3)',
            cursor: 'pointer', fontSize: 16, padding: 4,
          }} aria-label="clear">✕</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setShowPicker(s => !s)}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 10, padding: '14px 12px',
          color: 'var(--ink3)', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
        }}>
        + {en ? `Pick player ${slot}` : `Выберите игрока ${slot}`}
      </button>
      {showPicker && leaderboard && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 10,
        }}>
          {leaderboard.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'No players in top yet' : 'Пока никого в топе'}
            </div>
          )}
          {leaderboard.map(p => (
            <button key={p.user_id}
              onClick={() => { onPick(p); setShowPicker(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: 'var(--ink2)', cursor: 'pointer',
                textAlign: 'left', fontFamily: 'inherit',
              }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--surface2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, overflow: 'hidden', fontSize: 12,
                color: 'var(--ink2)', fontWeight: 600,
              }}>
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (p.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--ink3)' }}>
                  {p.total_wins} {en ? 'wins' : 'побед'} · {p.total_bricks} {en ? 'br' : 'кир'} · {p.closed_towers} {en ? 'tw' : 'выс'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CityCompare({ initialLeftId = null, initialRightId = null, onClose }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [leaderboard, setLeaderboard] = useState([])
  const [leftPlayer, setLeftPlayer] = useState(null)
  const [rightPlayer, setRightPlayer] = useState(null)
  const [loadingLb, setLoadingLb] = useState(true)

  useEffect(() => {
    fetch('/api/buildings/leaderboard')
      .then(r => r.json())
      .then(d => {
        const seen = new Map()
        for (const arr of [d.by_score || [], d.by_bricks || [], d.by_towers || [], d.by_crowned || []]) {
          for (const p of arr) {
            if (!seen.has(p.user_id)) seen.set(p.user_id, p)
          }
        }
        const all = [...seen.values()].sort((a, b) => (b.score || 0) - (a.score || 0))
        setLeaderboard(all)

        if (initialLeftId) {
          const p = all.find(x => x.user_id === initialLeftId)
          if (p) setLeftPlayer(p)
        }
        if (initialRightId) {
          const p = all.find(x => x.user_id === initialRightId)
          if (p) setRightPlayer(p)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLb(false))
  }, [initialLeftId, initialRightId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fmt = (v) => v.toLocaleString(en ? 'en-US' : 'ru')

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6, 6, 14, 0.9)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 12px',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        overflowY: 'auto',
      }}>
      <div style={{
        background: 'var(--surface, #14142a)',
        borderRadius: 16, maxWidth: 1100, width: '100%',
        border: '1px solid rgba(255,193,69,0.2)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(255,193,69,0.06) 0%, transparent 100%)',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold, #ffc145)' }}>
              ⚖️ {en ? 'Compare Cities' : 'Сравнение городов'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
              {en ? 'Pick two players to see who built bigger' : 'Выберите двух игроков и сравните их города'}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--ink3)',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
            }} aria-label="close">✕</button>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <PlayerSlot slot="A" player={leftPlayer}
            onPick={setLeftPlayer} onClear={() => setLeftPlayer(null)}
            en={en} leaderboard={leaderboard} />
          <PlayerSlot slot="B" player={rightPlayer}
            onPick={setRightPlayer} onClear={() => setRightPlayer(null)}
            en={en} leaderboard={leaderboard} />
        </div>

        {loadingLb && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
            {en ? 'Loading players...' : 'Загружаю игроков...'}
          </div>
        )}

        {!loadingLb && (!leftPlayer || !rightPlayer) && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
            {en ? 'Pick both players to start comparison' : 'Выберите обоих игроков для начала сравнения'}
          </div>
        )}

        {leftPlayer && rightPlayer && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              padding: '8px 12px', background: '#06060f',
            }}>
              <iframe
                src={`/embed/city/${leftPlayer.user_id}?nocontrols=1`}
                title={`City of ${leftPlayer.name}`}
                style={{
                  width: '100%', height: 360, border: 'none',
                  borderRadius: 10, background: '#0a0a18',
                }}
                allow="accelerometer; gyroscope"
              />
              <iframe
                src={`/embed/city/${rightPlayer.user_id}?nocontrols=1`}
                title={`City of ${rightPlayer.name}`}
                style={{
                  width: '100%', height: 360, border: 'none',
                  borderRadius: 10, background: '#0a0a18',
                }}
                allow="accelerometer; gyroscope"
              />
            </div>

            <div style={{ padding: '14px 22px' }}>
              <StatRow en={en} format={fmt}
                label={en ? 'Wins' : 'Побед'}
                leftValue={leftPlayer.total_wins}
                rightValue={rightPlayer.total_wins} />
              <StatRow en={en} format={fmt}
                label={en ? 'Bricks' : 'Кирпичей'}
                leftValue={leftPlayer.total_bricks}
                rightValue={rightPlayer.total_bricks} />
              <StatRow en={en} format={fmt}
                label={en ? 'Closed towers' : 'Небоскрёбов'}
                leftValue={leftPlayer.closed_towers}
                rightValue={rightPlayer.closed_towers} />
              <StatRow en={en} format={fmt}
                label={en ? '★ Crowned' : '★ С короной'}
                leftValue={leftPlayer.crowned_towers}
                rightValue={rightPlayer.crowned_towers} />
              <StatRow en={en} format={fmt}
                label={en ? 'City score' : 'Размер города'}
                leftValue={leftPlayer.score}
                rightValue={rightPlayer.score} />

              <div style={{
                marginTop: 14, padding: '12px 16px', borderRadius: 10,
                background: 'linear-gradient(90deg, rgba(255,193,69,0.08) 0%, rgba(255,193,69,0.04) 100%)',
                border: '1px solid rgba(255,193,69,0.2)',
                textAlign: 'center', fontSize: 13, color: 'var(--gold, #ffc145)',
              }}>
                {leftPlayer.score === rightPlayer.score
                  ? (en ? '⚖️ Equal might!' : '⚖️ Равная мощь!')
                  : leftPlayer.score > rightPlayer.score
                    ? (en ? `🏆 ${leftPlayer.name} leads by ${leftPlayer.score - rightPlayer.score} points` : `🏆 ${leftPlayer.name} впереди на ${leftPlayer.score - rightPlayer.score} очков`)
                    : (en ? `🏆 ${rightPlayer.name} leads by ${rightPlayer.score - leftPlayer.score} points` : `🏆 ${rightPlayer.name} впереди на ${rightPlayer.score - leftPlayer.score} очков`)}
              </div>
            </div>
          </>
        )}

        <div style={{
          padding: '8px 22px', fontSize: 9, color: 'var(--ink3)', opacity: 0.5,
          textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {en
            ? 'Tip: drag any city to rotate · share embed links from each profile'
            : 'Подсказка: тащите любой город чтобы вращать · встраивайте из любого профиля'}
        </div>
      </div>
    </div>
  )
}
