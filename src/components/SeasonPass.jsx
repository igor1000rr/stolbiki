/**
 * SeasonPass — Battle Pass UI
 * Лента 30 квестов: прогресс-бар, кнопка «Забрать», рарность по дню
 * Issue #4
 */
import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'

const TYPE_ICON = {
  win_n:        '🏆',
  win_ai_hard:  '🤖',
  win_online:   '🌐',
  close_golden: '⭐',
  play_n:       '🎮',
}

const TYPE_LABEL = {
  win_n:        { ru: 'Победы',          en: 'Wins' },
  win_ai_hard:  { ru: 'Победы vs AI',    en: 'Wins vs AI' },
  win_online:   { ru: 'Онлайн-победы',   en: 'Online wins' },
  close_golden: { ru: 'Золотая стойка',  en: 'Golden stand' },
  play_n:       { ru: 'Партии',          en: 'Games' },
}

// Цвет по дню (недели)
function questColor(dayIndex) {
  if (dayIndex >= 29) return '#ffd700' // финальный — золотой
  if (dayIndex >= 22) return '#9b59b6' // неделя 4 — фиолет
  if (dayIndex >= 15) return '#4a9eff' // неделя 3 — синий
  if (dayIndex >= 8)  return '#3dd68c' // неделя 2 — зелёный
  return 'var(--ink3)'                 // неделя 1 — базовый
}

function formatTimeLeft(endsAt) {
  const diff = endsAt - Math.floor(Date.now() / 1000)
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  if (d > 0) return `${d}д ${h}ч`
  const m = Math.floor((diff % 3600) / 60)
  return `${h}ч ${m}м`
}

export default function SeasonPass() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(null)

  async function load() {
    try {
      const r = await fetch('/api/bp/current', {
        headers: { Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
      })
      const d = await r.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function claim(questId) {
    setClaiming(questId)
    try {
      const r = await fetch(`/api/bp/quests/${questId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
      })
      const d = await r.json()
      if (r.ok) {
        // Обновляем локально
        setData(prev => {
          if (!prev) return prev
          const quests = prev.quests.map(q =>
            q.id === questId ? { ...q, reward_claimed: 1 } : q
          )
          const claimedCount = quests.filter(q => q.reward_claimed).length
          const totalEarned = quests.filter(q => q.reward_claimed).reduce((s, q) => s + q.reward_bricks, 0)
          return {
            ...prev, quests,
            stats: { ...prev.stats, claimedCount, totalEarned },
          }
        })
      }
    } catch {}
    setClaiming(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>
      {en ? 'Loading...' : 'Загрузка...'}
    </div>
  )

  if (!data?.season) return (
    <div className="dash-card" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
      <div style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 8 }}>
        {en ? 'Battle Pass is not available yet' : 'Battle Pass пока недоступен'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
        {en ? 'Check back later' : 'Загляните позже'}
      </div>
    </div>
  )

  const { season, quests, stats } = data
  const timeLeft = formatTimeLeft(season.ends_at)
  const progressPct = Math.round((stats.completedCount / stats.totalQuests) * 100)

  return (
    <div>
      {/* Шапка сезона */}
      <div className="dash-card" style={{ marginBottom: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>🎯</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
              {en ? 'Battle Pass' : 'Battle Pass'} — {en ? season.name_en : season.name_ru}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>
              {stats.completedCount}/{stats.totalQuests} {en ? 'quests' : 'квестов'} · 🧱 {stats.totalEarned}/{stats.totalEarnable}
              {timeLeft && <span style={{ marginLeft: 10, color: 'var(--gold)' }}>⏱ {timeLeft}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{progressPct}%</div>
            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{en ? 'done' : 'готово'}</div>
          </div>
        </div>

        {/* Общий прогресс-бар */}
        <div style={{ marginTop: 12, height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPct}%`, height: '100%', borderRadius: 4,
            background: 'linear-gradient(90deg, var(--accent), var(--gold))',
            transition: 'width 0.5s',
          }} />
        </div>

        {/* Сколько можно ещё получить */}
        {stats.claimedCount < stats.completedCount && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M12 2v20M2 12h20"/></svg>
            {en
              ? `${stats.completedCount - stats.claimedCount} quest(s) ready to claim!`
              : `${stats.completedCount - stats.claimedCount} квест${stats.completedCount - stats.claimedCount === 1 ? '' : 'а'} можно забрать!`
            }
          </div>
        )}
      </div>

      {/* Лента квестов */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quests.map((q) => {
          const pct = Math.min(q.progress / q.target, 1)
          const completed = !!q.completed_at
          const claimed = !!q.reward_claimed
          const color = questColor(q.day_index)
          const canClaim = completed && !claimed
          const desc = en ? q.description_en : q.description_ru
          const typeLabel = TYPE_LABEL[q.type]?.[lang] || q.type

          return (
            <div key={q.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 12,
              background: claimed
                ? 'rgba(61,214,140,0.04)'
                : canClaim
                  ? `rgba(255,193,69,0.08)`
                  : 'var(--surface)',
              border: `1px solid ${claimed ? 'rgba(61,214,140,0.15)' : canClaim ? 'rgba(255,193,69,0.3)' : `${color}20`}`,
              opacity: claimed ? 0.75 : 1,
              transition: 'all 0.2s',
            }}>
              {/* Номер дня */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: claimed ? 'rgba(61,214,140,0.12)' : `${color}15`,
                border: `1px solid ${claimed ? 'rgba(61,214,140,0.2)' : `${color}30`}`,
                fontSize: 11, fontWeight: 700, color: claimed ? 'var(--green)' : color,
              }}>
                {claimed ? '✓' : q.day_index}
              </div>

              {/* Контент */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14 }}>{TYPE_ICON[q.type] || '📋'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{desc}</span>
                  <span style={{ fontSize: 9, color, background: `${color}15`, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                    {typeLabel}
                  </span>
                </div>

                {/* Прогресс */}
                {!claimed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct * 100}%`, height: '100%', borderRadius: 2,
                        background: completed ? 'var(--green)' : `linear-gradient(90deg, ${color}, ${color}aa)`,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--ink3)', minWidth: 40, textAlign: 'right' }}>
                      {q.progress}/{q.target}
                    </span>
                  </div>
                )}
              </div>

              {/* Награда + кнопка */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: claimed ? 'var(--ink3)' : 'var(--gold)',
                  textDecoration: claimed ? 'line-through' : 'none',
                }}>
                  🧱 {q.reward_bricks}
                </div>
                {canClaim && (
                  <button
                    onClick={() => claim(q.id)}
                    disabled={claiming === q.id}
                    style={{
                      marginTop: 4, padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: 'var(--gold)', color: '#000',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      opacity: claiming === q.id ? 0.6 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    {claiming === q.id ? '…' : en ? 'Claim' : 'Забрать'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--ink3)', textAlign: 'center' }}>
        🧱 {en ? 'Earn bricks by playing games. Bricks unlock skins in the shop.' : 'Кирпичи зарабатываются в игре. На них открываются скины в магазине.'}
      </div>
    </div>
  )
}
