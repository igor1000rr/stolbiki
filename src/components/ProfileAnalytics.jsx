/**
 * ProfileAnalytics — 15 метрик аналитики (графики, винрейт, тренд)
 * Извлечён из Profile.jsx (~200 строк)
 *
 * 26.04.2026 — мелкие i18n-фиксы:
 * - Суффиксы времени h/m → ч/м на русском
 * - W/L буквы → П/П на русском (Победы/Поражения, локализованы)
 * - Удалён мусорный двойной тернарник {en ? en ? ... } для Rush best
 */

export default function ProfileAnalytics({ en, data }) {
  if (!data) return <div className="dash-card" style={{ textAlign: 'center', padding: 32 }}><div style={{ animation: 'float 1.5s ease-in-out infinite', display: 'inline-block' }}><img src="/mascot/point.webp" alt="" width={48} height={48} style={{ objectFit: 'contain' }} /></div></div>
  if (data.empty) return <div className="dash-card" style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>{en ? 'Play some games first!' : 'Сначала сыграйте несколько партий!'}</div>

  const analyticsData = data
  // Локализованные сокращения. Английский: h/m/W/L. Русский: ч/м/П/П.
  // P (Победы) и P (Поражения) совпадают по первой букве — добавил
  // пробелы и color чтобы было читаемо в коде.
  const hSuffix = en ? 'h' : 'ч'
  const mSuffix = en ? 'm' : 'м'
  const winLetter = en ? 'W' : 'П'
  const lossLetter = en ? 'L' : 'П'

  return (
    <>
            {/* Основные числа */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { v: analyticsData.total, l: en ? 'Games' : 'Партий', c: 'var(--ink)' },
                { v: analyticsData.avgTurns, l: en ? 'Avg turns' : 'Ходов (ср)', c: 'var(--accent)' },
                { v: analyticsData.avgDuration ? `${Math.floor(analyticsData.avgDuration / 60)}:${String(analyticsData.avgDuration % 60).padStart(2, '0')}` : '—', l: en ? 'Avg time' : 'Время (ср)', c: 'var(--p1)' },
                { v: analyticsData.totalTime > 3600 ? `${Math.floor(analyticsData.totalTime / 3600)}${hSuffix}` : `${Math.floor(analyticsData.totalTime / 60)}${mSuffix}`, l: en ? 'Total time' : 'Всего', c: 'var(--gold)' },
              ].map((s, i) => (
                <div key={i} className="dash-card" style={{ textAlign: 'center', padding: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* W/L за 7 и 30 дней */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { period: en ? '7 days' : '7 дней', d: analyticsData.last7 },
                { period: en ? '30 days' : '30 дней', d: analyticsData.last30 },
              ].map((p, i) => {
                const total = p.d.w + p.d.l
                const wr = total ? Math.round(p.d.w / total * 100) : 0
                return (
                  <div key={i} className="dash-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>{p.period}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: wr >= 50 ? 'var(--green)' : 'var(--p2)' }}>{wr}%</span>
                      <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{p.d.w}{winLetter} {p.d.l}{lossLetter}</span>
                    </div>
                    {total > 0 && <div style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${wr}%`, borderRadius: 2, background: wr >= 50 ? 'var(--green)' : 'var(--p2)', transition: 'width 0.5s' }} />
                    </div>}
                  </div>
                )
              })}
            </div>

            {/* W/L по сложности */}
            {analyticsData.byDifficulty && Object.keys(analyticsData.byDifficulty).length > 0 && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 10 }}>{en ? 'Win rate by difficulty' : 'Винрейт по сложности'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['easy', 'medium', 'hard', 'extreme'].map(d => {
                    const data = analyticsData.byDifficulty[d]
                    if (!data) return null
                    const total = data.w + data.l
                    const wr = total ? Math.round(data.w / total * 100) : 0
                    const colors = { easy: '#3dd68c', medium: '#4a9eff', hard: '#ffc145', extreme: '#ff6066' }
                    return (
                      <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ height: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 4 }}>
                          <div style={{ width: '70%', height: `${Math.max(4, wr / 2)}px`, borderRadius: 3, background: colors[d], transition: 'height 0.5s' }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors[d] }}>{wr}%</div>
                        <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{d === 'easy' ? (en ? 'Easy' : 'Лёгк') : d === 'medium' ? (en ? 'Med' : 'Средн') : d === 'hard' ? (en ? 'Hard' : 'Сложн') : (en ? 'Max' : 'Макс')}</div>
                        <div style={{ fontSize: 8, color: 'var(--ink3)', marginTop: 2 }}>{total} {en ? 'games' : 'игр'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Win rate тренд */}
            {analyticsData.wrTrend && analyticsData.wrTrend.length > 5 && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 10 }}>{en ? 'Win rate trend (rolling avg)' : 'Тренд винрейта (скользящее среднее)'}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 50 }}>
                  {analyticsData.wrTrend.map((wr, i) => (
                    <div key={i} style={{ flex: 1, height: `${wr}%`, borderRadius: 1, background: wr >= 50 ? 'var(--green)' : 'var(--p2)', opacity: 0.7, minHeight: 2 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--ink3)', marginTop: 4 }}>
                  <span>{en ? 'Oldest' : 'Старые'}</span><span>50%</span><span>{en ? 'Recent' : 'Новые'}</span>
                </div>
              </div>
            )}

            {/* Распределение счёта */}
            {analyticsData.scores && Object.keys(analyticsData.scores).length > 0 && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 10 }}>{en ? 'Score distribution' : 'Распределение счёта'}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Object.entries(analyticsData.scores).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([score, count]) => (
                    <div key={score} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--surface2)', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{score}</span>
                      <span style={{ color: 'var(--ink3)', marginLeft: 4 }}>×{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Специальные метрики */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { v: `${analyticsData.goldenRate}%`, l: en ? 'Golden rate' : 'Золотая ★', c: '#ffc145' },
                { v: `${analyticsData.comebackRate}%`, l: en ? 'Comebacks' : 'Камбэки', c: 'var(--green)' },
                { v: analyticsData.longestGame, l: en ? 'Longest game' : 'Макс ходов', c: 'var(--p1)' },
              ].map((s, i) => (
                <div key={i} className="dash-card" style={{ textAlign: 'center', padding: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Серия побед (последние 30 игр) */}
            {analyticsData.streakLine && analyticsData.streakLine.length > 0 && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>{en ? 'Last 30 games' : 'Последние 30 игр'}</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {analyticsData.streakLine.map((w, i) => (
                    <div key={i} style={{ flex: 1, height: 20, borderRadius: 2, background: w ? 'var(--green)' : 'var(--p2)', opacity: 0.7 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--ink3)', marginTop: 4 }}>
                  <span>{en ? 'Oldest' : '← старые'}</span><span style={{ color: 'var(--green)' }}>■ {en ? 'win' : 'побед'}</span><span style={{ color: 'var(--p2)' }}>■ {en ? 'loss' : 'пораж'}</span><span>{en ? 'Recent' : 'новые →'}</span>
                </div>
              </div>
            )}

            {/* Активность по часам */}
            {analyticsData.byHour && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>{en ? 'Activity by hour' : 'Активность по часам'}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 40 }}>
                  {analyticsData.byHour.map((count, h) => {
                    const max = Math.max(1, ...analyticsData.byHour)
                    return <div key={h} title={`${h}:00 — ${count} ${en ? 'games' : 'игр'}`} style={{ flex: 1, height: `${Math.max(2, count / max * 100)}%`, borderRadius: 1, background: count > max * 0.7 ? 'var(--accent)' : count > 0 ? 'var(--p1)' : 'var(--surface2)', opacity: count > 0 ? 0.8 : 0.3 }} />
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--ink3)', marginTop: 2 }}>
                  <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                </div>
              </div>
            )}

            {/* Активность по дням недели */}
            {analyticsData.byDay && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>{en ? 'Activity by day' : 'По дням недели'}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(en ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']).map((d, i) => {
                    const max = Math.max(1, ...analyticsData.byDay)
                    const count = analyticsData.byDay[i]
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ height: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 2 }}>
                          <div style={{ width: '80%', height: `${Math.max(3, count / max * 100)}%`, borderRadius: 2, background: count > max * 0.7 ? 'var(--accent)' : 'var(--p1)', opacity: count > 0 ? 0.7 : 0.2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{d}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* W/L по режиму */}
            {analyticsData.byMode && Object.keys(analyticsData.byMode).length > 1 && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 10 }}>{en ? 'By game mode' : 'По режиму'}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {Object.entries(analyticsData.byMode).map(([mode, d]) => {
                    const total = d.w + d.l
                    const wr = total ? Math.round(d.w / total * 100) : 0
                    return (
                      <div key={mode} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>{mode === 'ai' ? 'vs AI' : mode === 'online' ? 'Online' : mode}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: wr >= 50 ? 'var(--green)' : 'var(--p2)' }}>{wr}%</div>
                        <div style={{ fontSize: 9, color: 'var(--ink3)' }}>{d.w}{winLetter} / {d.l}{lossLetter}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Puzzle stats */}
            {analyticsData.puzzleTotal > 0 && (
              <div className="dash-card" style={{ marginBottom: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8 }}>{en ? 'Puzzles' : 'Головоломки'}</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{analyticsData.puzzleAccuracy}%</span><div style={{ fontSize: 9, color: 'var(--ink3)' }}>{en ? 'accuracy' : 'точность'}</div></div>
                  <div><span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{analyticsData.puzzleTotal}</span><div style={{ fontSize: 9, color: 'var(--ink3)' }}>{en ? 'solved' : 'решено'}</div></div>
                  {analyticsData.rushBest > 0 && <div><span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{analyticsData.rushBest}</span><div style={{ fontSize: 9, color: 'var(--ink3)' }}>{en ? 'Rush best' : 'Рекорд Rush'}</div></div>}
                </div>
              </div>
            )}
          </>
  )
}
