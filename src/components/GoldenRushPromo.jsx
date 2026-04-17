/**
 * GoldenRushPromo — рекламный блок для Landing.
 * Главная задача — дать видимость новому режиму, с кнопками на два пути: локально (hot-seat) и online.
 *
 * Дизайн в golden tones чтобы визуально выделяться от базовой игры (синий/красный).
 * SVG-превью креста — не весь рендерер, миниатюра для узнаваемости топологии.
 */
import { useI18n } from '../engine/i18n'

const PLAYER_COLORS = ['#4a9eff', '#ff6b6b', '#3dd68c', '#ffc145']

export default function GoldenRushPromo({ go }) {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <section className="l-section" style={{ paddingTop: 8 }}>
      <div style={{
        background: 'linear-gradient(135deg, #2a1e08 0%, #1a1208 50%, #0f0a04 100%)',
        border: '1px solid #ffc14540',
        borderRadius: 20,
        padding: '36px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 80% 50%, #ffc14520 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 280px)',
          gap: 28,
          alignItems: 'center',
          position: 'relative',
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: 10, fontWeight: 700, letterSpacing: 2,
              color: '#ffc145', textTransform: 'uppercase',
              padding: '3px 10px',
              background: '#ffc14518',
              border: '1px solid #ffc14560',
              borderRadius: 6,
              marginBottom: 14,
            }}>
              {en ? '★ New mode' : '★ Новый режим'}
            </div>

            <h2 style={{
              fontSize: 30, fontWeight: 800,
              color: '#ffd770',
              margin: '0 0 12px', lineHeight: 1.1,
            }}>
              Golden Rush
            </h2>

            <p style={{
              fontSize: 15, color: 'rgba(255,255,255,0.8)',
              lineHeight: 1.6, margin: '0 0 18px',
              maxWidth: 520,
            }}>
              {en
                ? '9 stands in a cross. 4 players race to close their arm and claim the golden center. Two modes: 4-FFA or 2v2 with diagonal teams.'
                : '9 стоек крестом. 4 игрока гонятся за золотом в центре, замыкая свои линии. Два режима: 4-FFA или 2v2 с командами по диагонали.'}
            </p>

            <div style={{ display: 'flex', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>🏳️</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {en ? 'Close your line → +13' : 'Замкни линию → +13'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>⭐</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {en ? 'Claim the center → +15' : 'Забери центр → +15'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>🧭</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {en ? '2v2 bonus → +10' : 'Бонус команды → +10'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => go('goldenrush-online')}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #ffc145, #ff9500)',
                  color: '#1a1208',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px #ffc14530',
                }}
              >
                {en ? 'Play online →' : 'Играть онлайн →'}
              </button>
              <button
                onClick={() => go('goldenrush')}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: '#ffd770',
                  border: '1px solid #ffc14560',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {en ? 'Hot-seat (local)' : 'На одном устройстве'}
              </button>
            </div>
          </div>

          {/* SVG-превью креста */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: 220 }}>
              <circle cx="100" cy="100" r="60" fill="#ffc14510" />
              <line x1="40" y1="100" x2="160" y2="100" stroke="#ffc14530" strokeWidth="1" />
              <line x1="100" y1="40" x2="100" y2="160" stroke="#ffc14530" strokeWidth="1" />

              {[
                { cx: 100, cy: 100, r: 16, fill: '#3a2a0c', stroke: '#ffc145', label: '★' }, // center
                { cx: 100, cy: 170, r: 12, fill: '#0f1220', stroke: PLAYER_COLORS[0] },          // p0 close
                { cx: 100, cy: 135, r: 11, fill: '#0f1220', stroke: PLAYER_COLORS[0] },          // p0 far
                { cx: 30,  cy: 100, r: 12, fill: '#0f1220', stroke: PLAYER_COLORS[1] },          // p1 close
                { cx: 65,  cy: 100, r: 11, fill: '#0f1220', stroke: PLAYER_COLORS[1] },          // p1 far
                { cx: 100, cy: 30,  r: 12, fill: '#0f1220', stroke: PLAYER_COLORS[2] },          // p2 close
                { cx: 100, cy: 65,  r: 11, fill: '#0f1220', stroke: PLAYER_COLORS[2] },          // p2 far
                { cx: 170, cy: 100, r: 12, fill: '#0f1220', stroke: PLAYER_COLORS[3] },          // p3 close
                { cx: 135, cy: 100, r: 11, fill: '#0f1220', stroke: PLAYER_COLORS[3] },          // p3 far
              ].map((s, i) => (
                <g key={i}>
                  <circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth="2" />
                  {s.label && (
                    <text x={s.cx} y={s.cy + 5} textAnchor="middle" fill="#ffc145" fontSize="16" fontWeight="800">
                      {s.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
