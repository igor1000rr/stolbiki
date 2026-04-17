/**
 * GoldenRushLeaderboard — топы по Golden Rush + моя статистика.
 *
 * Источники: GET /api/gr/leaderboard?metric=wins|games|centers
 *          GET /api/gr/my (auth)
 *          GET /api/gr/recent?limit=20
 */

import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'

function getToken() {
  try {
    const raw = localStorage.getItem('stolbiki_profile')
    if (!raw) return null
    const p = JSON.parse(raw)
    return p?.token || null
  } catch { return null }
}

async function fetchJson(url, opts = {}) {
  const token = getToken()
  const headers = { ...(opts.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--ink4)'}`,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--ink)',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function MyStatsCard({ stats, lang }) {
  const en = lang === 'en'
  if (!stats) return null
  const { games, wins, centers, winRate } = stats
  return (
    <div style={{
      padding: 14,
      background: 'linear-gradient(135deg, #ffc14520, #ffc14540)',
      border: '1px solid #ffc145',
      borderRadius: 10,
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {en ? 'Your Golden Rush stats' : 'Твоя статистика Golden Rush'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <StatCell value={games} label={en ? 'Games' : 'Игр'} />
        <StatCell value={wins} label={en ? 'Wins' : 'Побед'} />
        <StatCell value={`${winRate}%`} label={en ? 'Win rate' : '% побед'} />
        <StatCell value={centers} label={en ? 'Centers' : 'Центров'} />
      </div>
    </div>
  )
}

function StatCell({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#ffc145' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function LeaderboardRow({ rank, player, metricKey }) {
  const value = player[metricKey === 'wins' ? 'gr_wins'
                     : metricKey === 'games' ? 'gr_games'
                     : 'gr_center_captures']
  const games = player.gr_games || 0
  const wins = player.gr_wins || 0
  const winRate = games > 0 ? Math.round(wins / games * 100) : 0

  let medal = null
  if (rank === 1) medal = '🥇'
  else if (rank === 2) medal = '🥈'
  else if (rank === 3) medal = '🥉'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px 1fr 60px 60px',
      gap: 8,
      padding: '8px 12px',
      alignItems: 'center',
      borderBottom: '1px solid var(--ink4)',
      background: rank <= 3 ? '#ffc14508' : 'transparent',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
        {medal || `#${rank}`}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player.username}
        <span style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 6 }}>{player.rating}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#ffc145', textAlign: 'right' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'right' }}>{winRate}%</div>
    </div>
  )
}

function MatchRow({ match, myUserId, lang }) {
  const en = lang === 'en'
  const date = new Date(match.createdAt)
  const timeStr = date.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const isMine = myUserId != null
  const won = match.won

  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--ink4)',
      background: won === true ? '#3dd68c14' : won === false ? '#ff6b6b10' : 'transparent',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {match.mode === '2v2' ? '2v2' : '4-FFA'}
          <span style={{ color: 'var(--ink3)', marginLeft: 8, fontWeight: 400 }}>{timeStr}</span>
        </div>
        {isMine && (
          <div style={{ fontSize: 11, fontWeight: 700, color: won ? '#3dd68c' : '#ff6b6b' }}>
            {won ? (en ? 'WIN' : 'ПОБЕДА') : (en ? 'LOSS' : 'ПОРАЖЕНИЕ')}
            {match.resignedBy != null && match.resignedBy === match.mySlot && ` · ${en ? 'resigned' : 'сдался'}`}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 4 }}>
        {match.players.map((p, i) => (
          <span key={p.slot}>
            {i > 0 && ' · '}
            {p.name}: <b>{match.scores[p.slot]}</b>
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>
        {match.turns} {en ? 'turns' : 'ходов'} · {Math.round(match.durationSec / 60)}m {match.durationSec % 60}s
      </div>
    </div>
  )
}

export default function GoldenRushLeaderboard() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [metric, setMetric] = useState('wins')
  const [leaderboard, setLeaderboard] = useState(null)
  const [my, setMy] = useState(null)
  const [recent, setRecent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('top')

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchJson(`/api/gr/leaderboard?metric=${metric}&limit=30`)
      .then(d => { if (alive) { setLeaderboard(d.players || []); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [metric])

  useEffect(() => {
    let alive = true
    if (getToken()) {
      fetchJson('/api/gr/my')
        .then(d => { if (alive) setMy(d) })
        .catch(() => {})
    }
    fetchJson('/api/gr/recent?limit=20')
      .then(d => { if (alive) setRecent(d.matches || []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const myUserId = null // для MatchRow в публичном фиде не нужно — ничего не подсвечивается

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 12 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Golden Rush — {en ? 'Leaderboard' : 'Топ игроков'}
      </h2>

      {my && <MyStatsCard stats={my.stats} lang={lang} />}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Tab active={tab === 'top'} onClick={() => setTab('top')}>
          {en ? 'Top Players' : 'Топ'}
        </Tab>
        <Tab active={tab === 'my'} onClick={() => setTab('my')}>
          {en ? 'My Matches' : 'Мои матчи'}
        </Tab>
        <Tab active={tab === 'recent'} onClick={() => setTab('recent')}>
          {en ? 'Recent' : 'Недавние'}
        </Tab>
      </div>

      {tab === 'top' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <Tab active={metric === 'wins'} onClick={() => setMetric('wins')}>
              {en ? 'Wins' : 'Побед'}
            </Tab>
            <Tab active={metric === 'games'} onClick={() => setMetric('games')}>
              {en ? 'Games' : 'Игр'}
            </Tab>
            <Tab active={metric === 'centers'} onClick={() => setMetric('centers')}>
              {en ? 'Centers' : 'Центров'}
            </Tab>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--ink4)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 60px 60px',
              gap: 8,
              padding: '6px 12px',
              fontSize: 10,
              color: 'var(--ink3)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              background: 'var(--bg)',
              borderBottom: '1px solid var(--ink4)',
            }}>
              <div>#</div>
              <div>{en ? 'Player' : 'Игрок'}</div>
              <div style={{ textAlign: 'right' }}>
                {metric === 'wins' ? (en ? 'Wins' : 'Поб') : metric === 'games' ? (en ? 'Games' : 'Игр') : (en ? 'Ctr' : 'Цен')}
              </div>
              <div style={{ textAlign: 'right' }}>WR</div>
            </div>
            {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)' }}>…</div>}
            {!loading && leaderboard && leaderboard.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
                {en ? 'No games played yet — be the first!' : 'Ещё ни одной игры — будь первым!'}
              </div>
            )}
            {!loading && leaderboard && leaderboard.map((p, i) => (
              <LeaderboardRow key={p.id} rank={i + 1} player={p} metricKey={metric} />
            ))}
          </div>
        </div>
      )}

      {tab === 'my' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--ink4)', borderRadius: 8, overflow: 'hidden' }}>
          {!getToken() && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'Sign in to see your match history.' : 'Войди в аккаунт чтобы увидеть свои матчи.'}
            </div>
          )}
          {getToken() && my && my.matches.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'No matches yet. Play your first!' : 'Пока нет матчей. Сыграй первый!'}
            </div>
          )}
          {getToken() && my && my.matches.map(m => (
            <MatchRow key={m.id} match={m} myUserId={1} lang={lang} />
          ))}
        </div>
      )}

      {tab === 'recent' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--ink4)', borderRadius: 8, overflow: 'hidden' }}>
          {!recent && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)' }}>…</div>}
          {recent && recent.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'No recent matches.' : 'Нет недавних матчей.'}
            </div>
          )}
          {recent && recent.map(m => {
            const won = m.winner != null && m.winner >= 0
              ? (m.mode === 'ffa' ? null : null)
              : null
            const adapted = {
              ...m,
              won: null,
              mySlot: null,
            }
            return <MatchRow key={m.id} match={adapted} myUserId={null} lang={lang} />
          })}
        </div>
      )}
    </div>
  )
}
