/**
 * CompareCities — два города бок-о-бок.
 * URL: /compare/:userId1/:userId2
 *
 * Рендерится через App.jsx early-return. Использует VictoryCity2D (SVG)
 * вместо полноценного VictoryCity — два WebGL-контекста на одной странице
 * слишком тяжело и упирается в лимиты браузера. SVG-рендер легкий.
 *
 * Над каждым городом — имя + статистика. Между ними — счёт и победитель.
 * Очки = closed×100 + crowned×50 + bricks (та же формула что в leaderboard).
 *
 * Кнопка шаринга копирует /embed/compare/:id1/:id2 — это SSR-роут с
 * полноценным og:image превью, который при шаринге в Telegram/Discord
 * покажет красивую PNG-картинку обоих городов со счётом.
 */
import { useEffect, useState, lazy, Suspense } from 'react'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))

function useCity(userId) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!userId) { setError(true); return }
    fetch(`/api/buildings/city/${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))
  }, [userId])
  return { data, error }
}

function cityScore(city) {
  if (!city?.towers) return 0
  const closed = city.towers.filter(t => t.is_closed).length
  const crowned = city.towers.filter(t => t.golden_top).length
  return closed * 100 + crowned * 50 + (city.total_bricks || 0)
}

function CityPanel({ userId, city, error, isWinner }) {
  if (error) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: '#888',
        background: 'rgba(255,255,255,0.02)', borderRadius: 10,
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🏚</div>
        <div style={{ fontSize: 12 }}>Игрок не найден</div>
      </div>
    )
  }
  if (!city) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 12 }}>
        Загружаю...
      </div>
    )
  }
  const closed = (city.towers || []).filter(t => t.is_closed).length
  const crowned = (city.towers || []).filter(t => t.golden_top).length
  const name = city.user?.name || `Player #${userId}`
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        marginBottom: 10, padding: '12px 14px',
        background: isWinner ? 'rgba(255,216,110,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isWinner ? 'rgba(255,216,110,0.3)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: isWinner ? '#ffd86e' : '#e8e8f0',
          marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isWinner && '👑 '}{name}
        </div>
        <div style={{
          display: 'flex', gap: 10, fontSize: 11, color: '#bbb', flexWrap: 'wrap',
        }}>
          <span>🏆 {city.total_wins || 0}</span>
          <span style={{ color: '#4a9eff' }}>🧱 {city.total_bricks || 0}</span>
          <span>🏢 {closed}</span>
          {crowned > 0 && <span style={{ color: '#ffd86e' }}>★ {crowned}</span>}
        </div>
      </div>
      <Suspense fallback={
        <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 11 }}>...</div>
      }>
        <VictoryCity2D towers={city.towers || []} stats={null} en={false} />
      </Suspense>
    </div>
  )
}

function copyToClipboard(text, onDone) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => onDone(true)).catch(() => onDone(false))
  } else {
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      onDone(true)
    } catch { onDone(false) }
  }
}

function ShareButton({ userId1, userId2, name1, name2, score1, score2 }) {
  const [copied, setCopied] = useState(false)
  // Шарим embed-роут — он отдаёт SSR HTML с og:image для preview в мессенджерах.
  // Если просто шарить /compare/:id1/:id2 (SPA) — боты не получат preview.
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://highriseheist.com'
  const shareUrl = `${origin}/embed/compare/${userId1}/${userId2}`
  const shareText = name1 && name2
    ? `${name1} vs ${name2} (${score1}:${score2}) — Highrise Heist`
    : 'Сравнение городов в Highrise Heist'

  function doShare() {
    if (navigator.share) {
      navigator.share({ title: shareText, text: shareText, url: shareUrl })
        .catch(() => copyToClipboard(`${shareText}\n${shareUrl}`, ok => {
          if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
        }))
    } else {
      copyToClipboard(`${shareText}\n${shareUrl}`, ok => {
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
      })
    }
  }

  return (
    <button onClick={doShare} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 8,
      background: copied ? 'rgba(61,214,140,0.15)' : 'rgba(255,216,110,0.1)',
      color: copied ? '#3dd68c' : '#ffd86e',
      border: `1px solid ${copied ? '#3dd68c' : '#ffd86e'}`,
      fontSize: 12, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      {copied ? '✓ Скопировано' : '🔗 Поделиться сравнением'}
    </button>
  )
}

export default function CompareCities({ userId1, userId2 }) {
  const c1 = useCity(userId1)
  const c2 = useCity(userId2)

  const s1 = cityScore(c1.data)
  const s2 = cityScore(c2.data)
  const leader = (c1.data && c2.data) ? (s1 > s2 ? 1 : s2 > s1 ? 2 : 0) : 0

  // Заголовок вкладки
  useEffect(() => {
    const n1 = c1.data?.user?.name
    const n2 = c2.data?.user?.name
    if (n1 && n2) document.title = `${n1} vs ${n2} — Highrise Heist`
  }, [c1.data, c2.data])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #06060f 0%, #0a0a1a 100%)',
      color: '#e8e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '16px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        :root {
          --bg: #06060f; --surface: #14142a; --surface2: #1c1c36; --surface3: #2a2a4a;
          --ink: #e8e8f0; --ink2: #b8b8c8; --ink3: #888;
          --accent: #4a9eff; --gold: #ffd86e; --green: #3dd68c; --p2: #ff6066;
        }
        body { margin: 0; background: #06060f; }
        @media (max-width: 720px) {
          .compare-grid { grid-template-columns: 1fr !important; }
          .compare-vs { flex-direction: row !important; padding: 14px 8px !important; min-width: 0 !important; }
          .compare-vs > div:nth-child(2) { margin: 0 14px !important; }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#ffd86e' }}>
          ⚔ Сравнение городов
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
          Очки: высоток × 100 + корон × 50 + кирпичей
        </div>
      </div>

      <div className="compare-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        gap: 16, alignItems: 'start', maxWidth: 1100, margin: '0 auto',
      }}>
        <CityPanel userId={userId1} city={c1.data} error={c1.error} isWinner={leader === 1} />

        <div className="compare-vs" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '24px 12px', minWidth: 80,
        }}>
          <div style={{
            fontSize: 26, fontWeight: 800,
            color: leader === 1 ? '#3dd68c' : leader === 2 ? '#888' : '#bbb',
          }}>{s1}</div>
          <div style={{
            fontSize: 12, color: '#888', margin: '10px 0', fontWeight: 700, letterSpacing: 1,
          }}>VS</div>
          <div style={{
            fontSize: 26, fontWeight: 800,
            color: leader === 2 ? '#3dd68c' : leader === 1 ? '#888' : '#bbb',
          }}>{s2}</div>
        </div>

        <CityPanel userId={userId2} city={c2.data} error={c2.error} isWinner={leader === 2} />
      </div>

      {leader > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 16,
            background: 'rgba(61,214,140,0.12)', color: '#3dd68c',
            fontSize: 12, fontWeight: 700,
          }}>
            👑 Лидер: {(leader === 1 ? c1.data : c2.data)?.user?.name || `Player #${leader === 1 ? userId1 : userId2}`}
          </span>
        </div>
      )}

      {/* Кнопка шаринга — рендерим только когда оба города загружены */}
      {c1.data && c2.data && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <ShareButton
            userId1={userId1}
            userId2={userId2}
            name1={c1.data.user?.name}
            name2={c2.data.user?.name}
            score1={s1}
            score2={s2}
          />
        </div>
      )}

      <div style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: '#888' }}>
        <a href="https://highriseheist.com" target="_top" rel="noopener"
          style={{ color: '#ffd86e', textDecoration: 'none', fontWeight: 600 }}>
          highriseheist.com
        </a>
        {' · '}играй и строй свой город побед
      </div>
    </div>
  )
}
