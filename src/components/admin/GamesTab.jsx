import { useEffect, useState } from 'react'
import { S, ago, api } from './_utils'
import { Pagination } from './_shared'

export function GamesTab() {
  const [games, setGames] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [mode, setMode] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ page, ...(mode && { mode }) })
    api(`/admin/games?${params}`).then(d => {
      setGames(d.games); setTotal(d.total); setPages(d.pages)
    })
  }, [page, mode])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {['', 'ai', 'pvp', 'online'].map(m => (
          <button key={m} style={{ ...S.btn(mode === m ? 'primary' : 'default'), fontSize: 11 }} onClick={() => { setMode(m); setPage(1) }}>
            {m === '' ? 'Все' : m === 'ai' ? 'vs AI' : m.toUpperCase()}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink3)', marginLeft: 8 }}>{total} партий</span>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Игрок</th>
              <th style={S.th}>Результат</th>
              <th style={S.th}>Счёт</th>
              <th style={S.th}>Δ</th>
              <th style={S.th}>Режим</th>
              <th style={S.th}>Ходов</th>
              <th style={S.th}>Длит.</th>
              <th style={S.th}>Дата</th>
            </tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.id}>
                <td style={{ ...S.td, fontSize: 11, color: 'var(--ink3)' }}>{g.id}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--ink)' }}>{g.username}</td>
                <td style={S.td}>
                  <span style={S.badge(g.won ? 'var(--green)' : 'var(--p2)')}>{g.won ? 'WIN' : 'LOSS'}</span>
                </td>
                <td style={S.td}>{g.score}</td>
                <td style={{ ...S.td, color: g.rating_delta > 0 ? 'var(--green)' : 'var(--p2)', fontWeight: 600 }}>
                  {g.rating_delta > 0 ? '+' : ''}{g.rating_delta}
                </td>
                <td style={S.td}>
                  <span style={S.badge(g.is_online ? 'var(--p1)' : 'var(--ink3)')}>{g.mode || 'ai'}</span>
                </td>
                <td style={S.td}>{g.turns || '—'}</td>
                <td style={S.td}>{g.duration ? `${Math.floor(g.duration / 60)}:${String(g.duration % 60).padStart(2, '0')}` : '—'}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(g.played_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!games.length && <div style={S.emptyState}>Нет партий</div>}
        <Pagination page={page} pages={pages} onChange={setPage} />
      </div>
    </div>
  )
}
