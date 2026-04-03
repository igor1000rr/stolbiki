/**
 * DailyChallenge — ежедневный челлендж с лидербордом
 * Извлечён из Online.jsx
 */

import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import { useGameContext } from '../engine/GameContext'

export default function DailyChallenge() {
  const isNative = !!window.Capacitor?.isNativePlatform?.()
  const { lang } = useI18n()
  const gameCtx = useGameContext()
  const en = lang === 'en'
  const [daily, setDaily] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/daily').then(r => r.json()).catch(() => null),
      fetch('/api/daily/leaderboard').then(r => r.json()).catch(() => ({ results: [] })),
    ]).then(([d, lb]) => {
      setDaily(d)
      setLeaderboard(lb?.results || [])
      setLoading(false)
    })
  }, [])

  function startDaily() {
    if (gameCtx) gameCtx.emit('onDailyStart', daily)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}><div style={{ animation: 'float 1.5s ease-in-out infinite', display: 'inline-block' }}><img src="/mascot/wave.webp" alt="" width={40} height={40} style={{ objectFit: 'contain' }} /></div></div>
  if (!daily) return null

  const dateStr = daily.date || daily.seed
  return (
    <div className="dash-card" style={{ maxWidth: 560, margin: isNative ? '8px auto' : '16px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24, opacity: 0.5 }}>Daily</span>
        <div>
          <h3 style={{ fontSize: 16, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0, margin: 0 }}>
            {en ? 'Daily Challenge' : 'Ежедневный челлендж'}
          </h3>
          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>#{dateStr} · {en ? 'Same for everyone' : 'Одинаковый для всех'}</span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 12, lineHeight: 1.6 }}>
        {en ? 'Same starting position for all. Beat AI in minimum moves!' : 'У всех одинаковая начальная позиция. Победите AI за минимум ходов!'}
      </p>

      <button className="btn primary" onClick={startDaily}
        style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 0', marginBottom: 12 }}>
        {en ? 'Play' : 'Играть'}
      </button>

      {leaderboard.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            {en ? 'Leaderboard' : 'Таблица лидеров'}
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {leaderboard.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                borderRadius: 6, background: i === 0 ? 'rgba(255,193,69,0.06)' : 'transparent',
                fontSize: 12,
              }}>
                <span style={{ width: 20, fontWeight: 700, color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--ink3)' }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, color: 'var(--ink)' }}>{r.username}</span>
                <span style={{ color: 'var(--ink2)', fontSize: 11 }}>{r.turns} {en ? 'moves' : 'ходов'}</span>
                <span style={{ color: 'var(--ink3)', fontSize: 10 }}>
                  {r.duration ? `${Math.floor(r.duration/60)}:${String(r.duration%60).padStart(2,'0')}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {leaderboard.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--ink3)', fontSize: 11, padding: '8px 0' }}>
          {en ? 'Nobody played today yet — be the first!' : 'Пока никто не играл сегодня — будьте первым!'}
        </div>
      )}
    </div>
  )
}
