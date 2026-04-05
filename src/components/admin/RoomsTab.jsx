import { useEffect, useState } from 'react'
import { S, api } from './_shared'

export function RoomsTab() {
  const [data, setData] = useState(null)
  const [auto, setAuto] = useState(true)

  function load() { api('/admin/rooms').then(setData) }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!auto) return
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [auto])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <button style={S.btn()} onClick={load}>Обновить</button>
        <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          Автообновление (5с)
        </label>
        {data && <span style={{ fontSize: 12, color: 'var(--ink3)' }}>В очереди: {data.queueLength}</span>}
      </div>

      <div style={S.card}>
        {!data?.rooms?.length ? (
          <div style={S.emptyState}>Нет активных комнат</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Режим</th>
                <th style={S.th}>Игроки</th>
                <th style={S.th}>Состояние</th>
                <th style={S.th}>Счёт</th>
                <th style={S.th}>Партия</th>
                <th style={S.th}>Возраст</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map(r => (
                <tr key={r.id}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{r.id}</td>
                  <td style={S.td}><span style={S.badge('var(--p1)')}>{r.mode}</span></td>
                  <td style={{ ...S.td, color: 'var(--ink)' }}>{r.players.join(' vs ') || 'ожидание'}</td>
                  <td style={S.td}><span style={S.badge(r.state === 'playing' ? 'var(--green)' : 'var(--gold)')}>{r.state}</span></td>
                  <td style={S.td}>{r.scores.join(' : ')}</td>
                  <td style={S.td}>{r.currentGame}/{r.totalGames}</td>
                  <td style={S.td}>{r.ageMin}м</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
