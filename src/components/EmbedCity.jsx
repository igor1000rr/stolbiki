/**
 * EmbedCity — встраиваемая страница города.
 * URL: /embed/city/:userId
 *
 * Рендерится через App.jsx early-return: без шапки, футера, cookie-баннера,
 * popup-ов. Только город + имя игрока + watermark + ссылка на сайт.
 * Используется для шаринга в Telegram, форумах, блогах через iframe.
 *
 * Внутри использует полноценный VictoryCity (3D / WebGL / автоматический
 * 2D fallback). Пользователю доступны Snapshot, MP4, фильтры, time-lapse.
 */
import { useEffect, useState, lazy, Suspense } from 'react'

const VictoryCity = lazy(() => import('./VictoryCity'))

export default function EmbedCity({ userId }) {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!userId) { setLoading(false); setNotFound(true); return }
    Promise.all([
      fetch(`/api/buildings/city/${userId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/buildings/stats/${userId}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([city, s]) => {
      if (!city) { setNotFound(true); setLoading(false); return }
      setUser(city.user || null)
      setStats({
        wins: s?.total || 0,
        bricks: city.total_bricks || 0,
        towers: (city.towers || []).filter(t => t.is_closed).length,
        crowned: (city.towers || []).filter(t => t.golden_top).length,
      })
      setLoading(false)
    })
  }, [userId])

  const playerName = user?.name || `Player #${userId}`

  // Установка заголовка вкладки для шаринга
  useEffect(() => {
    if (user?.name) {
      document.title = `${user.name} — Victory City · Highrise Heist`
    }
  }, [user])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #06060f 0%, #0a0a1a 100%)',
      color: '#e8e8f0',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      padding: '14px 16px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        :root {
          --bg: #06060f; --surface: #14142a; --surface2: #1c1c36; --surface3: #2a2a4a;
          --ink: #e8e8f0; --ink2: #b8b8c8; --ink3: #888;
          --accent: #4a9eff; --gold: #ffd86e; --green: #3dd68c; --p2: #ff6066;
        }
        body { margin: 0; background: #06060f; }
        a { color: inherit; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 12, paddingBottom: 10,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: '#ffd86e',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            🏢 {playerName}
          </div>
          {stats && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>{stats.wins} побед</span>
              <span style={{ color: '#4a9eff' }}>🧱 {stats.bricks}</span>
              <span>🏢 {stats.towers}</span>
              {stats.crowned > 0 && <span style={{ color: '#ffd86e' }}>★ {stats.crowned}</span>}
            </div>
          )}
        </div>
        <a
          href={`https://highriseheist.com/profile?u=${encodeURIComponent(playerName)}`}
          target="_top" rel="noopener"
          style={{
            fontSize: 11, fontWeight: 600, color: '#4a9eff', textDecoration: 'none',
            padding: '7px 12px', border: '1px solid #4a9eff', borderRadius: 6,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
          highriseheist.com →
        </a>
      </div>

      {/* City */}
      {notFound ? (
        <div style={{
          padding: 60, textAlign: 'center', color: '#888', fontSize: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏚</div>
          <div>Город не найден</div>
          <a href="https://highriseheist.com" target="_top" rel="noopener"
            style={{ color: '#4a9eff', fontSize: 12, marginTop: 14, display: 'inline-block' }}>
            Открыть Highrise Heist
          </a>
        </div>
      ) : loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 12 }}>
          Загружаю город...
        </div>
      ) : (
        <Suspense fallback={
          <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 12 }}>...</div>
        }>
          <VictoryCity userId={userId} />
        </Suspense>
      )}

      {/* Footer watermark */}
      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8, fontSize: 11, color: '#888', textAlign: 'center',
        lineHeight: 1.5,
      }}>
        <strong style={{ color: '#ffd86e' }}>Highrise Heist</strong>{' · '}
        стратегическая настолка где побеждай и строй свой город.{' '}
        <a href="https://highriseheist.com" target="_top" rel="noopener"
          style={{ color: '#4a9eff', textDecoration: 'none', fontWeight: 600 }}>
          Играть бесплатно →
        </a>
      </div>
    </div>
  )
}
