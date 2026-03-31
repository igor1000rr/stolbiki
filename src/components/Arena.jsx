/**
 * Arena — Live турнирный режим (Swiss system)
 */
import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../engine/i18n'
import * as API from '../engine/api'

export default function Arena({ onClose, onJoinMatch }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)

  const load = useCallback(() => {
    fetch('/api/arena/current').then(r => r.json()).then(d => {
      setData(d)
      setJoined(d.participants?.some(p => p.user_id === API.getUserId()))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv) }, [load])

  async function join() {
    const token = localStorage.getItem('stolbiki_token')
    if (!token) return
    await fetch('/api/arena/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
    load()
  }

  async function leave() {
    const token = localStorage.getItem('stolbiki_token')
    await fetch('/api/arena/leave', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
    load()
  }

  async function startTournament() {
    const token = localStorage.getItem('stolbiki_token')
    await fetch('/api/arena/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
    load()
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#a09cb0' }}>{en ? 'Loading...' : 'Загрузка...'}</div>
    </div>
  )

  const t = data?.tournament
  const parts = data?.participants || []
  const matches = data?.matches || []
  const myMatch = matches.find(m => m.round === t?.current_round && !m.winner_id && !m.result &&
    (m.player1_id === API.getUserId() || m.player2_id === API.getUserId()))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #2a2a38', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ffc145' }}>Arena</span>
          {t && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8,
            background: t.status === 'waiting' ? 'rgba(74,158,255,0.1)' : t.status === 'playing' ? 'rgba(61,214,140,0.1)' : 'rgba(255,255,255,0.05)',
            color: t.status === 'waiting' ? '#4a9eff' : t.status === 'playing' ? '#3dd68c' : '#6b6880',
          }}>{t.status === 'waiting' ? (en ? 'Waiting' : 'Ожидание') : t.status === 'playing' ? `${en ? 'Round' : 'Раунд'} ${t.current_round}/${t.rounds}` : (en ? 'Finished' : 'Завершён')}</span>}
        </div>
        <button className="btn" onClick={onClose} style={{ fontSize: 11, padding: '6px 12px' }}>
          {en ? 'Exit' : 'Выход'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

        {/* Left: standings */}
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b6880', marginBottom: 10 }}>
            {en ? 'Standings' : 'Таблица'} ({parts.length}/{t?.max_players || 16})
          </div>

          {parts.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
              {en ? 'No participants yet. Be the first!' : 'Пока нет участников. Будь первым!'}
            </div>
          )}

          {parts.map((p, i) => (
            <div key={p.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: i < 3 ? 'rgba(255,193,69,0.04)' : 'transparent',
              borderBottom: '1px solid #1a1a2a',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? '#ffc145' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#555', minWidth: 24 }}>
                {i + 1}.
              </span>
              <span style={{ fontSize: 13, color: '#e8e6f0', flex: 1 }}>{p.username}</span>
              <span style={{ fontSize: 11, color: '#6b6880' }}>{p.rating}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#3dd68c', minWidth: 30, textAlign: 'right' }}>
                {p.score}
              </span>
              <span style={{ fontSize: 10, color: '#555' }}>
                {p.wins}W {p.losses}L {p.draws}D
              </span>
            </div>
          ))}

          {/* Actions */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
            {t?.status === 'waiting' && !joined && API.isLoggedIn() && (
              <button className="btn primary" onClick={join} style={{ fontSize: 14, padding: '12px 32px' }}>
                {en ? 'Join tournament' : 'Присоединиться'}
              </button>
            )}
            {t?.status === 'waiting' && joined && (
              <>
                <button className="btn" onClick={leave} style={{ fontSize: 12, color: '#ff6066', borderColor: '#ff606640' }}>
                  {en ? 'Leave' : 'Покинуть'}
                </button>
                {parts.length >= 2 && (
                  <button className="btn primary" onClick={startTournament} style={{ fontSize: 13, padding: '10px 24px' }}>
                    {en ? 'Start!' : 'Начать!'}
                  </button>
                )}
              </>
            )}
            {!API.isLoggedIn() && (
              <div style={{ fontSize: 12, color: '#6b6880' }}>
                {en ? 'Login to join' : 'Войдите чтобы участвовать'}
              </div>
            )}
          </div>

          {/* My current match */}
          {myMatch && (
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(74,158,255,0.06)', borderRadius: 12,
              border: '1px solid rgba(74,158,255,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#4a9eff', marginBottom: 8 }}>
                {en ? 'Your match is ready!' : 'Ваш матч готов!'}
              </div>
              <button className="btn primary" onClick={() => onJoinMatch?.(myMatch)}
                style={{ fontSize: 14, padding: '12px 32px' }}>
                {en ? 'Play!' : 'Играть!'}
              </button>
            </div>
          )}
        </div>

        {/* Right: rounds */}
        <div style={{ width: 280, borderLeft: '1px solid #2a2a38', padding: 16, overflow: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6b6880', marginBottom: 10 }}>
            {en ? 'Matches' : 'Матчи'}
          </div>
          {Array.from({ length: t?.current_round || 0 }, (_, r) => r + 1).reverse().map(round => {
            const rm = matches.filter(m => m.round === round)
            return (
              <div key={round} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4a9eff', marginBottom: 6 }}>
                  {en ? 'Round' : 'Раунд'} {round}
                </div>
                {rm.map(m => {
                  const p1 = parts.find(p => p.user_id === m.player1_id)
                  const p2 = parts.find(p => p.user_id === m.player2_id)
                  const done = !!m.winner_id || m.result === 'bye'
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                      fontSize: 11, color: done ? '#a09cb0' : '#e8e6f0',
                      background: done ? 'transparent' : 'rgba(74,158,255,0.04)',
                      borderRadius: 6, marginBottom: 3,
                    }}>
                      <span style={{ flex: 1, fontWeight: m.winner_id === m.player1_id ? 600 : 400,
                        color: m.winner_id === m.player1_id ? '#3dd68c' : undefined }}>
                        {p1?.username || '?'}
                      </span>
                      <span style={{ color: '#555', fontSize: 10 }}>vs</span>
                      <span style={{ flex: 1, textAlign: 'right', fontWeight: m.winner_id === m.player2_id ? 600 : 400,
                        color: m.winner_id === m.player2_id ? '#3dd68c' : m.result === 'bye' ? '#555' : undefined }}>
                        {m.result === 'bye' ? 'bye' : p2?.username || '?'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {(!t || t.current_round === 0) && (
            <div style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: 20 }}>
              {en ? 'Tournament not started yet' : 'Турнир ещё не начался'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
