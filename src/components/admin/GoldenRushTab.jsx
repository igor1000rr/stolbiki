import { useEffect, useState } from 'react'
import { S, api, ago } from './_utils'

/**
 * Таб Golden Rush в админке:
 *  - Текущая стата (комнаты, очередь)
 *  - Лайв-комнаты с игроками, счётом, ping'ом
 *  - Очередь матчмейкинга (кто сколько ждёт)
 *  - Последние сыгранные матчи (из /api/gr/recent)
 *  - Топ игроков по победам
 *
 * Автообновление каждые 10с — этого достаточно для мониторинга плейтеста.
 */

const PLAYER_COLORS = ['#4a9eff', '#ff6066', '#3dd68c', '#e040fb']

function CrossMini({ state, players }) {
  if (!state) return <span style={{ color: 'var(--ink3)', fontSize: 10 }}>—</span>
  const size = 44
  const c = size / 2
  const r = size * 0.38
  const positions = [
    { x: c, y: c },
    { x: c - r * 0.9, y: c - r * 0.9 }, { x: c - r, y: c },
    { x: c + r * 0.9, y: c - r * 0.9 }, { x: c + r, y: c },
    { x: c + r * 0.9, y: c + r * 0.9 }, { x: c, y: c + r },
    { x: c - r * 0.9, y: c + r * 0.9 }, { x: c, y: c - r },
  ]
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {positions.map((p, i) => {
        const closedBy = state.closed?.[i]
        const isClosed = closedBy !== undefined && closedBy !== null
        const fill = isClosed ? PLAYER_COLORS[closedBy] : '#1a1a2e'
        const stroke = i === 0 ? '#ffc145' : 'rgba(255,255,255,0.1)'
        return <circle key={i} cx={p.x} cy={p.y} r={3} fill={fill} stroke={stroke} strokeWidth={0.8} />
      })}
    </svg>
  )
}

export function GoldenRushTab() {
  const [admin, setAdmin] = useState(null)
  const [recent, setRecent] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [auto, setAuto] = useState(true)
  const [err, setErr] = useState(null)

  function load() {
    Promise.all([
      api('/admin/golden-rush').catch(e => ({ error: e.message })),
      api('/gr/recent?limit=20').catch(() => ({ matches: [] })),
      api('/gr/leaderboard?metric=wins&limit=10').catch(() => ({ players: [] })),
    ]).then(([a, r, l]) => {
      if (a.error) setErr(a.error)
      else { setAdmin(a); setErr(null) }
      setRecent(r.matches || [])
      setLeaderboard(l.players || [])
    })
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!auto) return
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [auto])

  const stats = admin?.stats || { rooms: 0, queue: 0, activeGames: 0 }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={S.btn()} onClick={load}>Обновить</button>
        <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          Автообновление (10с)
        </label>
        {err && <span style={{ fontSize: 12, color: '#ff5050' }}>Ошибка: {err}</span>}
      </div>

      {/* Сводные метрики */}
      <div style={S.grid(4)}>
        <div style={S.metric('#ffc145')}>
          <div style={S.metricVal('#ffc145')}>{stats.rooms}</div>
          <div style={S.metricLabel}>комнат всего</div>
        </div>
        <div style={S.metric('#3dd68c')}>
          <div style={S.metricVal('#3dd68c')}>{stats.activeGames}</div>
          <div style={S.metricLabel}>активных игр</div>
        </div>
        <div style={S.metric('#4a9eff')}>
          <div style={S.metricVal('#4a9eff')}>{stats.queue}</div>
          <div style={S.metricLabel}>в очереди</div>
        </div>
        <div style={S.metric('#e040fb')}>
          <div style={S.metricVal('#e040fb')}>{recent?.length || 0}</div>
          <div style={S.metricLabel}>сыграно недавно</div>
        </div>
      </div>

      {/* Очередь */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.cardTitle}>Матчмейкинг — очередь ({admin?.queue?.length || 0})</div>
        {!admin?.queue?.length ? (
          <div style={S.emptyState}>Очередь пуста</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                <th style={S.th}>Игрок</th>
                <th style={S.th}>Режим</th>
                <th style={S.th}>Рейтинг</th>
                <th style={S.th}>Ожидает</th>
              </tr>
            </thead>
            <tbody>
              {admin.queue.map(q => (
                <tr key={q.position}>
                  <td style={S.td}>{q.position}</td>
                  <td style={{ ...S.td, color: 'var(--ink)', fontWeight: 600 }}>{q.name}</td>
                  <td style={S.td}><span style={S.badge(q.mode === '2v2' ? '#4a9eff' : '#ff6066')}>{q.mode}</span></td>
                  <td style={S.td}>{q.rating}</td>
                  <td style={S.td}>{q.waitMin}м</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Лайв-комнаты */}
      <div style={S.card}>
        <div style={S.cardTitle}>Активные комнаты ({admin?.rooms?.length || 0})</div>
        {!admin?.rooms?.length ? (
          <div style={S.emptyState}>Нет активных комнат</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Поле</th>
                <th style={S.th}>Режим</th>
                <th style={S.th}>Игроки (slot · online)</th>
                <th style={S.th}>Ход</th>
                <th style={S.th}>Счёт</th>
                <th style={S.th}>Статус</th>
                <th style={S.th}>Простой</th>
              </tr>
            </thead>
            <tbody>
              {admin.rooms.map(r => (
                <tr key={r.id}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600 }}>{r.id}</td>
                  <td style={S.td}><CrossMini state={{ closed: Array.isArray(r.scores) ? null : null }} players={r.players} /></td>
                  <td style={S.td}><span style={S.badge(r.mode === '2v2' ? '#4a9eff' : '#ff6066')}>{r.mode}</span></td>
                  <td style={{ ...S.td, color: 'var(--ink)' }}>
                    {r.players.map(p => (
                      <div key={p.slot} style={{ fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: PLAYER_COLORS[p.slot], fontWeight: 700 }}>#{p.slot}</span>{' '}
                        {p.name}{' '}
                        <span style={{ color: p.online ? '#3dd68c' : '#ff5050', fontSize: 9 }}>
                          {p.online ? '●' : '○'}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td style={S.td}>{r.turn}</td>
                  <td style={{ ...S.td, fontSize: 11 }}>{r.scores?.join(' · ') || '—'}</td>
                  <td style={S.td}>
                    {r.gameOver
                      ? <span style={S.badge('#ff6066')}>завершена</span>
                      : <span style={S.badge('#3dd68c')}>идёт</span>}
                  </td>
                  <td style={S.td}>{r.lastActivityMin}м</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Топ игроков */}
      <div style={S.card}>
        <div style={S.cardTitle}>Топ-10 по победам</div>
        {!leaderboard?.length ? (
          <div style={S.emptyState}>Нет данных</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                <th style={S.th}>Игрок</th>
                <th style={S.th}>Рейтинг</th>
                <th style={S.th}>Матчей</th>
                <th style={S.th}>Побед</th>
                <th style={S.th}>WR</th>
                <th style={S.th}>Центров</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((p, i) => {
                const wr = p.gr_games > 0 ? Math.round((p.gr_wins || 0) / p.gr_games * 100) : 0
                return (
                  <tr key={p.id}>
                    <td style={S.td}>{i + 1}</td>
                    <td style={{ ...S.td, color: 'var(--ink)', fontWeight: 600 }}>{p.username}</td>
                    <td style={S.td}>{p.rating}</td>
                    <td style={S.td}>{p.gr_games}</td>
                    <td style={{ ...S.td, color: '#ffc145', fontWeight: 700 }}>{p.gr_wins}</td>
                    <td style={S.td}>{wr}%</td>
                    <td style={S.td}>{p.gr_center_captures}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Последние матчи */}
      <div style={S.card}>
        <div style={S.cardTitle}>Последние матчи ({recent?.length || 0})</div>
        {!recent?.length ? (
          <div style={S.emptyState}>Нет данных — никто ещё не сыграл</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Режим</th>
                <th style={S.th}>Игроки</th>
                <th style={S.th}>Счёт</th>
                <th style={S.th}>Победитель</th>
                <th style={S.th}>Ходов</th>
                <th style={S.th}>Лдсть</th>
                <th style={S.th}>Resign</th>
                <th style={S.th}>Когда</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(m => {
                const winnerName = m.winner != null && m.winner >= 0
                  ? (m.mode === 'ffa'
                      ? m.players.find(p => p.slot === m.winner)?.name || `slot ${m.winner}`
                      : `Команда ${m.winner + 1}`)
                  : 'Ничья'
                return (
                  <tr key={m.id}>
                    <td style={S.td}>
                      <span style={S.badge(m.mode === '2v2' ? '#4a9eff' : '#ff6066')}>{m.mode}</span>
                    </td>
                    <td style={{ ...S.td, fontSize: 11 }}>
                      {m.players.map(p => (
                        <span key={p.slot} style={{ color: PLAYER_COLORS[p.slot], marginRight: 6 }}>
                          {p.name}
                        </span>
                      ))}
                    </td>
                    <td style={{ ...S.td, fontSize: 11 }}>{m.scores.join(':')}</td>
                    <td style={{ ...S.td, color: 'var(--ink)', fontWeight: 600 }}>{winnerName}</td>
                    <td style={S.td}>{m.turns}</td>
                    <td style={S.td}>{Math.round(m.durationSec / 60)}м {m.durationSec % 60}с</td>
                    <td style={S.td}>
                      {m.resignedBy != null
                        ? <span style={S.badge('#ff5050')}>slot {m.resignedBy}</span>
                        : '—'}
                    </td>
                    <td style={{ ...S.td, fontSize: 11, color: 'var(--ink3)' }}>{ago(m.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.6 }}>
        Сводка для анализа плейтеста:
        {recent && recent.length > 0 && (() => {
          const n = recent.length
          const resigns = recent.filter(m => m.resignedBy != null).length
          const draws = recent.filter(m => m.winner === -1).length
          const centerCaptures = recent.filter(m => {
            const centerOwner = m.scores && m.scores.findIndex(s => s >= 15) >= 0
            return centerOwner
          }).length
          const avgTurns = Math.round(recent.reduce((s, m) => s + (m.turns || 0), 0) / n)
          const avgDur = Math.round(recent.reduce((s, m) => s + (m.durationSec || 0), 0) / n)
          return (
            <div style={{ marginTop: 6 }}>
              resign-rate: <b>{Math.round(resigns / n * 100)}%</b> · 
              draws: <b>{Math.round(draws / n * 100)}%</b> · 
              center captures: <b>{centerCaptures}/{n}</b> · 
              avg turns: <b>{avgTurns}</b> · 
              avg duration: <b>{Math.round(avgDur / 60)}м {avgDur % 60}с</b>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
