import { useEffect, useState } from 'react'
import { S, ago, api } from './_utils'

export function AchievementsTab() {
  const [stats, setStats] = useState([])
  useEffect(() => { api('/admin/achievements').then(setStats) }, [])

  const ACHIEVEMENT_NAMES = {
    first_win: 'Первая победа', perfect: 'Идеальная', perfect_3: '3 идеальных', fast_win: 'Молния',
    fast_win_5: '5 молний', streak_3: 'Серия 3', streak_5: 'Серия 5', streak_10: 'Серия 10',
    streak_20: 'Бессмертный', golden_1: 'Золотая', golden_10: '10 золотых', golden_50: '50 золотых',
    comeback: 'Камбэк', comeback_5: '5 камбэков', games_10: '10 партий', games_50: '50 партий',
    games_100: '100 партий', games_500: '500 партий', rating_1200: 'Рейтинг 1200',
    rating_1500: 'Рейтинг 1500', rating_1800: 'Гроссмейстер', rating_2000: 'Легенда',
    beat_hard: 'Победил Hard AI', online_win: 'Онлайн победа', online_10: '10 онлайн', puzzle_10: '10 пазлов',
  }
  const TIERS = {
    first_win: 'var(--bronze)', streak_3: 'var(--bronze)', golden_1: 'var(--bronze)', comeback: 'var(--bronze)', games_10: 'var(--bronze)',
    perfect: 'var(--silver)', streak_5: 'var(--silver)', golden_10: 'var(--silver)', games_50: 'var(--silver)', fast_win: 'var(--silver)',
    rating_1200: 'var(--silver)', beat_hard: 'var(--silver)', online_win: 'var(--silver)',
    streak_10: 'var(--gold)', perfect_3: 'var(--gold)', golden_50: 'var(--gold)', comeback_5: 'var(--gold)', games_100: 'var(--gold)',
    rating_1500: 'var(--gold)', fast_win_5: 'var(--gold)', online_10: 'var(--gold)', puzzle_10: 'var(--gold)',
    streak_20: '#b9f2ff', games_500: '#b9f2ff', rating_1800: '#b9f2ff', rating_2000: '#b9f2ff',
  }

  return (
    <div>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Ачивка</th>
              <th style={S.th}>Тир</th>
              <th style={S.th}>Получили</th>
              <th style={S.th}>Первый</th>
              <th style={S.th}>Последний</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(a => (
              <tr key={a.achievement_id}>
                <td style={{ ...S.td, fontWeight: 500, color: 'var(--ink)' }}>{ACHIEVEMENT_NAMES[a.achievement_id] || a.achievement_id}</td>
                <td style={S.td}>{TIERS[a.achievement_id] || '—'}</td>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--green)' }}>{a.count}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(a.first_unlock)}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(a.last_unlock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stats.length && <div style={S.emptyState}>Ачивки ещё не выдавались</div>}
      </div>
    </div>
  )
}
