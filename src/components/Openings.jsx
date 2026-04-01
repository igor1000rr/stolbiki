import { useState, useMemo } from 'react'
import { useI18n } from '../engine/i18n'

// Данные дебютов (из анализа 239K партий)
const OPENINGS = [
  {
    name: { ru: 'Центральная', en: 'Central' },
    moves: '5', // первый ход на стойку 5
    frequency: 18.2,
    winP1: 50.3,
    desc: { ru: 'Ставка на центральную стойку. Гибкий дебют, позволяющий развивать обе стороны.', en: 'Central stand play. Flexible opening for both sides.' },
  },
  {
    name: { ru: 'Золотая', en: 'Golden' },
    moves: '★',
    frequency: 14.7,
    winP1: 50.6,
    desc: { ru: 'Ранний контроль золотой стойки. Страховка при 5:5.', en: 'Early golden stand control. Insurance for 5:5 ties.' },
  },
  {
    name: { ru: 'Фланговая', en: 'Flank' },
    moves: '9',
    frequency: 11.3,
    winP1: 50.4,
    desc: { ru: 'Крайняя стойка. Противнику сложнее атаковать фланг.', en: 'Edge stand. Harder for opponent to attack the flank.' },
  },
  {
    name: { ru: 'Парная', en: 'Paired' },
    moves: '4',
    frequency: 10.8,
    winP1: 50.2,
    desc: { ru: 'Стойка рядом с центром. Готовит парную достройку 4+5.', en: 'Near-center stand. Prepares paired completion of 4+5.' },
  },
  {
    name: { ru: 'Swap-ловушка', en: 'Swap trap' },
    moves: '1',
    frequency: 8.9,
    winP1: 49.6,
    desc: { ru: 'Слабый ход-провокация. Если P2 делает swap — позиция невыгодная.', en: 'Weak provocative move. If P2 swaps — position is unfavorable.' },
  },
]

// Тепловая карта активности стоек (из 239K+ партий)
const HEATMAP_DATA = {
  // Средняя частота закрытия каждой стойки
  closeFreq: [7.2, 10.8, 11.5, 10.1, 9.8, 12.1, 10.4, 9.9, 9.3, 8.9],
  // Процент владения P1
  p1Ownership: [48.2, 50.8, 50.6, 50.1, 49.5, 50.4, 50.8, 49.2, 49.8, 47.1],
  // Средний ход закрытия
  avgCloseTurn: [14.2, 11.8, 10.5, 12.1, 12.8, 10.2, 11.4, 12.6, 13.1, 13.8],
  // Частота первого хода на каждую стойку
  firstMoveFreq: [14.7, 8.9, 7.2, 8.1, 10.8, 18.2, 9.5, 7.8, 3.5, 11.3],
}

function HeatmapBar({ values, labels, colorFn, title }) {
  const max = Math.max(...values)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {values.map((v, i) => {
          const intensity = v / max
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 32, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, color: intensity > 0.6 ? '#fff' : 'var(--ink2)',
                background: colorFn(intensity),
                transition: 'all 0.3s',
              }}>
                {v.toFixed(1)}
              </div>
              <div style={{ fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>
                {labels?.[i] ?? (i === 0 ? '★' : i)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Openings() {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState('openings') // openings | heatmap

  const labels = ['★', '1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '12px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        
        <h2 style={{ fontSize: 20, color: 'var(--ink)', fontWeight: 700 }}>
          {t('openings.title')}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>
          {t('openings.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, justifyContent: 'center' }}>
        {[
          ['openings', t('openings.tabOpenings')],
          ['heatmap', t('openings.tabHeatmap')],
        ].map(([id, label]) => (
          <button key={id} className={`btn ${tab === id ? 'primary' : ''}`}
            onClick={() => setTab(id)} style={{ fontSize: 12, padding: '6px 14px' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'openings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPENINGS.map((o, i) => (
            <div key={i} className="dash-card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'var(--accent)',
                }}>
                  {o.moves}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                    {o.name[lang] || o.name.ru}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink3)' }}>
                    {o.frequency}% {t('openings.usage')} · P1 WR {o.winP1}%
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.6 }}>
                {o.desc[lang] || o.desc.ru}
              </div>
              {/* Визуализация winrate bar */}
              <div style={{ display: 'flex', height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${o.winP1}%`, background: 'var(--p1)', transition: 'width 0.5s' }} />
                <div style={{ flex: 1, background: 'var(--p2)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink3)', marginTop: 2 }}>
                <span>P1: {o.winP1}%</span>
                <span>P2: {(100 - o.winP1).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'heatmap' && (
        <div>
          <HeatmapBar
            values={HEATMAP_DATA.firstMoveFreq} labels={labels}
            colorFn={i => `rgba(240,96,64,${0.15 + i * 0.75})`}
            title={t('openings.firstMoveFreq')}
          />
          <HeatmapBar
            values={HEATMAP_DATA.closeFreq} labels={labels}
            colorFn={i => `rgba(74,158,255,${0.15 + i * 0.75})`}
            title={t('openings.closeFreq')}
          />
          <HeatmapBar
            values={HEATMAP_DATA.p1Ownership} labels={labels}
            colorFn={i => {
              const diff = (HEATMAP_DATA.p1Ownership[HEATMAP_DATA.p1Ownership.indexOf(Math.max(...HEATMAP_DATA.p1Ownership))] - 47) / 7
              const norm = (HEATMAP_DATA.p1Ownership[labels.indexOf(labels[HEATMAP_DATA.p1Ownership.indexOf(i * Math.max(...HEATMAP_DATA.p1Ownership))])] || i * 53) / 53
              return i > 0.52 ? `rgba(74,158,255,${0.2 + (i - 0.5) * 1.5})` : `rgba(255,96,102,${0.2 + (0.5 - i) * 1.5})`
            }}
            title={t('openings.p1Ownership')}
          />
          <HeatmapBar
            values={HEATMAP_DATA.avgCloseTurn} labels={labels}
            colorFn={i => `rgba(61,214,140,${0.15 + (1 - i) * 0.75})`}
            title={t('openings.avgCloseTurn')}
          />

          <div className="dash-card" style={{ marginTop: 16, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              {t('openings.insights')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.8 }}>
              <p>• {t('openings.insight1')}</p>
              <p>• {t('openings.insight2')}</p>
              <p>• {t('openings.insight3')}</p>
              <p>• {t('openings.insight4')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
