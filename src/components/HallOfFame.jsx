/**
 * HallOfFame — Хол оф фейм Городов побед.
 *
 * Загружает /api/buildings/leaderboard (кэширован на 5 мин), показывает 4 топа
 * с переключением табов: размер города / кирпичи / закрытые высотки / с короной.
 * Каждая строка — мини-силуэт города (CityMiniPreview без WebGL) + имя + цифры.
 *
 * Открывается модалкой поверх любого экрана. Закрывается ESC или клик по
 * фону. Внутри клик по строке — focus на профиле игрока (event 'open-profile').
 */
import { useState, useEffect } from 'react'
import CityMiniPreview from './CityMiniPreview'

const TABS = [
  { id: 'by_score',   label_ru: 'Размер',  label_en: 'Size',    metric: 'score',          metricLabel_ru: 'очков',     metricLabel_en: 'points' },
  { id: 'by_bricks',  label_ru: 'Кирпичи', label_en: 'Bricks',  metric: 'total_bricks',   metricLabel_ru: 'кирпичей',  metricLabel_en: 'bricks' },
  { id: 'by_towers',  label_ru: 'Высотки', label_en: 'Towers',  metric: 'closed_towers',  metricLabel_ru: 'закрытых',  metricLabel_en: 'closed' },
  { id: 'by_crowned', label_ru: '★ Корон', label_en: '★ Crowns', metric: 'crowned_towers', metricLabel_ru: 'с короной', metricLabel_en: 'crowned' },
]

export default function HallOfFame({ onClose, en = false, currentUserId = null }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('by_score')

  useEffect(() => {
    let aborted = false
    fetch('/api/buildings/leaderboard')
      .then(r => {
        if (!r.ok) throw new Error('Network error')
        return r.json()
      })
      .then(d => {
        if (aborted) return
        if (d?.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => { if (!aborted) setError(e.message || 'Ошибка') })
      .finally(() => { if (!aborted) setLoading(false) })
    return () => { aborted = true }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tab = TABS.find(t => t.id === activeTab)
  const list = data?.[activeTab] || []

  const handleProfileClick = (userId) => {
    // Глобальный event — App.jsx может его слушать для перехода
    window.dispatchEvent(new CustomEvent('open-profile', { detail: { userId } }))
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6, 6, 14, 0.85)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px 16px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        overflowY: 'auto',
      }}>
      <div style={{
        background: 'var(--surface, #14142a)',
        borderRadius: 16, maxWidth: 560, width: '100%',
        border: '1px solid rgba(255,193,69,0.25)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(255,193,69,0.08) 0%, transparent 100%)',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold, #ffc145)' }}>
              🏆 {en ? 'Hall of Fame' : 'Хол оф фейм'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
              {en ? 'Top Victory Cities in Highrise Heist' : 'Топ Городов побед в Highrise Heist'}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--ink3)',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
            }} aria-label="close">✕</button>
        </div>

        {/* Global stats */}
        {data && (
          <div style={{
            display: 'flex', gap: 8, padding: '12px 22px',
            background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.04)',
            justifyContent: 'space-around', flexWrap: 'wrap',
          }}>
            {[
              [data.total_players, en ? 'players' : 'игроков', 'var(--green, #3dd68c)'],
              [data.total_bricks_global, en ? 'bricks' : 'кирпичей', 'var(--accent, #4a9eff)'],
              [data.total_towers_global, en ? 'towers' : 'высоток', 'var(--gold, #ffc145)'],
            ].map(([v, l, c]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v.toLocaleString(en ? 'en-US' : 'ru')}</div>
                <div style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 2, padding: '10px 14px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto',
        }}>
          {TABS.map(t => {
            const active = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  fontSize: 12, padding: '8px 14px', borderRadius: '8px 8px 0 0',
                  background: active ? 'rgba(255,193,69,0.12)' : 'transparent',
                  color: active ? 'var(--gold, #ffc145)' : 'var(--ink2)',
                  border: 'none',
                  borderBottom: `2px solid ${active ? 'var(--gold, #ffc145)' : 'transparent'}`,
                  cursor: 'pointer', fontWeight: active ? 700 : 500,
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}>{en ? t.label_en : t.label_ru}</button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ padding: '12px 14px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)', fontSize: 13 }}>
              {en ? 'Loading hall of fame...' : 'Загружаю топ...'}
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--red, #ff6b6b)', fontSize: 12 }}>
              {en ? 'Could not load leaderboard' : 'Не удалось загрузить топ'}
            </div>
          )}
          {!loading && !error && list.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'No data yet' : 'Пока пусто'}
            </div>
          )}
          {!loading && !error && list.map((entry, idx) => {
            const isMe = currentUserId && entry.user_id === currentUserId
            const metricVal = entry[tab.metric]
            return (
              <div key={entry.user_id}
                onClick={() => handleProfileClick(entry.user_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', marginBottom: 6, borderRadius: 10,
                  background: isMe
                    ? 'linear-gradient(90deg, rgba(255,193,69,0.15) 0%, rgba(255,193,69,0.04) 100%)'
                    : 'var(--surface2, #1c1c30)',
                  border: `1px solid ${isMe ? 'rgba(255,193,69,0.4)' : 'rgba(255,255,255,0.04)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}>
                {/* Rank */}
                <div style={{
                  fontSize: 18, fontWeight: 700, minWidth: 36, textAlign: 'center',
                  color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--ink3)',
                }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </div>

                {/* Avatar или плейсхолдер */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--surface, #14142a)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 14, color: 'var(--ink2)', fontWeight: 600,
                }}>
                  {entry.avatar_url
                    ? <img src={entry.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (entry.name || '?')[0].toUpperCase()}
                </div>

                {/* Name + secondary */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: isMe ? 'var(--gold, #ffc145)' : 'var(--ink, #e8e6f2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.name}
                    {isMe && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--gold)', fontWeight: 400 }}>{en ? '(you)' : '(вы)'}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>
                    {entry.total_wins} {en ? 'wins' : 'побед'} · {entry.total_bricks} {en ? 'br' : 'кир'} · {entry.closed_towers} {en ? 'tw' : 'выс'}
                    {entry.crowned_towers > 0 && <> · <span style={{ color: 'var(--gold)' }}>★{entry.crowned_towers}</span></>}
                  </div>
                </div>

                {/* Mini-preview */}
                <div style={{
                  width: 110, height: 50, flexShrink: 0,
                  borderRadius: 6, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <CityMiniPreview entry={entry} width={110} height={50} />
                </div>

                {/* Metric */}
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold, #ffc145)' }}>
                    {metricVal.toLocaleString(en ? 'en-US' : 'ru')}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {en ? tab.metricLabel_en : tab.metricLabel_ru}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {data?.cached_age_sec != null && (
          <div style={{
            padding: '8px 22px', fontSize: 9, color: 'var(--ink3)', opacity: 0.5,
            textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            {en ? `Updated ${data.cached_age_sec}s ago · refreshes every 5 min` : `Обновлено ${data.cached_age_sec} сек назад · обновляется раз в 5 мин`}
          </div>
        )}
      </div>
    </div>
  )
}
