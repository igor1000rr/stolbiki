import { useEffect, useState } from 'react'
import { S, api } from './_utils'

export function SeasonsTab() {
  const [seasons, setSeasons] = useState([])
  function load() { api('/admin/seasons').then(setSeasons) }
  useEffect(() => { load() }, [])

  async function toggle(id, active) {
    await api(`/admin/seasons/${id}`, { method: 'PUT', body: JSON.stringify({ active: !active }) })
    load()
  }

  return (
    <div>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Название</th>
              <th style={S.th}>Начало</th>
              <th style={S.th}>Конец</th>
              <th style={S.th}>Статус</th>
              <th style={S.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map(s => (
              <tr key={s.id}>
                <td style={{ ...S.td, fontSize: 11, color: 'var(--ink3)' }}>{s.id}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</td>
                <td style={S.td}>{s.start_date}</td>
                <td style={S.td}>{s.end_date}</td>
                <td style={S.td}>
                  <span style={S.badge(s.active ? 'var(--green)' : 'var(--ink3)')}>{s.active ? 'Активен' : 'Завершён'}</span>
                </td>
                <td style={S.td}>
                  <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => toggle(s.id, s.active)}>
                    {s.active ? 'Завершить' : 'Активировать'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!seasons.length && <div style={S.emptyState}>Сезонов пока нет</div>}
      </div>
    </div>
  )
}
