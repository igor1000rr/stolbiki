import { TOWER_HEIGHT } from './victoryCityUtils'

export default function VictoryCityStats({ cityData, towers, en }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          [cityData.total_wins,    en ? 'Wins'      : 'Побед',     'var(--green)'],
          [cityData.total_bricks,  en ? 'Bricks'    : 'Кирпичей',  'var(--accent)'],
          [towers.filter(t => t.is_closed).length, en ? 'Closed' : 'Высоток',  'var(--ink)'],
          [towers.filter(t => t.golden_top).length, '★ ' + (en ? 'Crowned' : 'С короной'), 'var(--gold)'],
        ].map(([v, l, c]) => (
          <div key={l} style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--surface2)', borderRadius: 8, minWidth: 60 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{l}</div>
          </div>
        ))}
      </div>

      {cityData.next_tower_progress > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 10, fontSize: 11, color: 'var(--ink3)' }}>
          {en ? 'Next highrise: ' : 'Следующая высотка: '}
          <strong style={{ color: 'var(--accent)' }}>{cityData.next_tower_progress}/{TOWER_HEIGHT}</strong>
          <span> {en ? 'bricks laid' : 'кирпичей'}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 10, justifyContent: 'center', flexWrap: 'wrap', fontSize: 10, color: 'var(--ink3)' }}>
        <div><span style={{ color: 'var(--accent)' }}>■</span> {en ? 'Regular brick' : 'Обычный кирпич'}</div>
        <div><span style={{ color: 'var(--gold)' }}>■</span> {en ? 'Special (Imposs/Golden)' : 'Особый (Imp/Золотая)'}</div>
        <div><span style={{ color: 'var(--gold)' }}>★</span> {en ? 'Crowned tower' : 'Высотка с короной'}</div>
      </div>
    </>
  )
}
