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
 *
 * Query-параметры (ранее работали только в SSR /embed.js, теперь и в SPA):
 *  - ?theme=day|night    — фон страницы (day = светлый, default = night)
 *  - ?nocontrols=1       — скрыть header с именем и footer с watermark (чистый iframe)
 */
import { useEffect, useState, lazy, Suspense } from 'react'

const VictoryCity = lazy(() => import('./VictoryCity'))

function parseQueryParams() {
  if (typeof window === 'undefined') return { theme: 'night', nocontrols: false }
  const sp = new URLSearchParams(window.location.search)
  return {
    theme: sp.get('theme') === 'day' ? 'day' : 'night',
    nocontrols: sp.get('nocontrols') === '1',
  }
}

export default function EmbedCity({ userId }) {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [{ theme, nocontrols }] = useState(parseQueryParams)

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

  // Заголовок вкладки для шаринга
  useEffect(() => {
    if (user?.name) {
      document.title = `${user.name} — City of Victories · Highrise Heist`
    }
  }, [user])

  // Цветовая схема по теме
  const palette = theme === 'day'
    ? { bg: 'linear-gradient(180deg, #f0f4f8 0%, #d8e3eb 100%)', ink: '#1a1a2e', ink2: '#3a3a4e', ink3: '#666', headerBorder: 'rgba(0,0,0,0.08)', accent: '#2a7edf', gold: '#c89020', surfaceBg: 'rgba(0,0,0,0.04)', body: '#f0f4f8' }
    : { bg: 'linear-gradient(180deg, #06060f 0%, #0a0a1a 100%)', ink: '#e8e8f0', ink2: '#b8b8c8', ink3: '#888', headerBorder: 'rgba(255,255,255,0.06)', accent: '#4a9eff', gold: '#ffd86e', surfaceBg: 'rgba(255,255,255,0.03)', body: '#06060f' }

  return (
    <div style={{
      minHeight: '100vh',
      background: palette.bg,
      color: palette.ink,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      padding: nocontrols ? '0' : '14px 16px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        :root {
          --bg: ${palette.body}; --surface: ${theme === 'day' ? '#ffffff' : '#14142a'};
          --surface2: ${theme === 'day' ? '#f0f0f5' : '#1c1c36'};
          --surface3: ${theme === 'day' ? '#d8d8e0' : '#2a2a4a'};
          --ink: ${palette.ink}; --ink2: ${palette.ink2}; --ink3: ${palette.ink3};
          --accent: ${palette.accent}; --gold: ${palette.gold}; --green: #3dd68c; --p2: #ff6066;
        }
        body { margin: 0; background: ${palette.body}; }
        a { color: inherit; }
      `}</style>

      {/* Header — скрыт при ?nocontrols=1 */}
      {!nocontrols && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, marginBottom: 12, paddingBottom: 10,
          borderBottom: `1px solid ${palette.headerBorder}`,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: palette.gold,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              🏢 {playerName}
            </div>
            {stats && (
              <div style={{ fontSize: 11, color: palette.ink3, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span>{stats.wins} побед</span>
                <span style={{ color: palette.accent }}>🧱 {stats.bricks}</span>
                <span>🏢 {stats.towers}</span>
                {stats.crowned > 0 && <span style={{ color: palette.gold }}>★ {stats.crowned}</span>}
              </div>
            )}
          </div>
          <a
            href={`https://highriseheist.com/profile?u=${encodeURIComponent(playerName)}`}
            target="_top" rel="noopener"
            style={{
              fontSize: 11, fontWeight: 600, color: palette.accent, textDecoration: 'none',
              padding: '7px 12px', border: `1px solid ${palette.accent}`, borderRadius: 6,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
            highriseheist.com →
          </a>
        </div>
      )}

      {/* City */}
      {notFound ? (
        <div style={{
          padding: 60, textAlign: 'center', color: palette.ink3, fontSize: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏚</div>
          <div>Город не найден</div>
          <a href="https://highriseheist.com" target="_top" rel="noopener"
            style={{ color: palette.accent, fontSize: 12, marginTop: 14, display: 'inline-block' }}>
            Открыть Highrise Heist
          </a>
        </div>
      ) : loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: palette.ink3, fontSize: 12 }}>
          Загружаю город...
        </div>
      ) : (
        <Suspense fallback={
          <div style={{ padding: 60, textAlign: 'center', color: palette.ink3, fontSize: 12 }}>...</div>
        }>
          <VictoryCity userId={userId} />
        </Suspense>
      )}

      {/* Footer watermark — скрыт при ?nocontrols=1 */}
      {!nocontrols && (
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: palette.surfaceBg,
          border: `1px solid ${palette.headerBorder}`,
          borderRadius: 8, fontSize: 11, color: palette.ink3, textAlign: 'center',
          lineHeight: 1.5,
        }}>
          <strong style={{ color: palette.gold }}>Highrise Heist</strong>{' · '}
          стратегическая настолка где побеждай и строй свой город.{' '}
          <a href="https://highriseheist.com" target="_top" rel="noopener"
            style={{ color: palette.accent, textDecoration: 'none', fontWeight: 600 }}>
            Играть бесплатно →
          </a>
        </div>
      )}
    </div>
  )
}
