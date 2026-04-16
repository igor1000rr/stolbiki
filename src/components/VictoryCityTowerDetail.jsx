import { uniqueWinsInTower, getDiffLabel, TOWER_HEIGHT } from './victoryCityUtils'

export default function VictoryCityTowerDetail({ selTower, selTowerIdx, setSelTowerIdx, en }) {
  if (!selTower) return null
  const wins = uniqueWinsInTower(selTower)
  return (
    <div style={{
      marginTop: 10, padding: '14px 16px',
      background: 'var(--surface)', borderRadius: 10,
      border: '1px solid rgba(255,193,69,0.22)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: selTower.golden_top ? 'var(--gold)' : 'var(--ink)' }}>
            {selTower.golden_top ? '★ ' : '🏢 '}
            {en ? 'Highrise' : 'Высотка'} #{selTowerIdx + 1} <span style={{ color: 'var(--ink3)', fontSize: 12, fontWeight: 400 }}>({selTower.height}/{TOWER_HEIGHT})</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
            {selTower.is_closed
              ? (en ? 'Closed' : 'Закрыта') + (selTower.golden_top ? ' · ' + (en ? 'Crowned' : 'С короной') : '')
              : (en ? `Building... ${TOWER_HEIGHT - selTower.height} bricks to go` : `Строится... ещё ${TOWER_HEIGHT - selTower.height} кирпичей`)}
          </div>
        </div>
        <button onClick={() => setSelTowerIdx(null)}
          style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
        {en ? 'Built from' : 'Построено из'} <strong style={{ color: 'var(--accent)' }}>{wins.length}</strong> {en ? 'wins' : 'побед'}
        {' · '}{new Date(selTower.period_from * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
        {selTower.period_to !== selTower.period_from && ' — ' +
          new Date(selTower.period_to * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
      </div>
      <div style={{ maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
        {wins.map(w => (
          <div key={w.source_id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11,
          }}>
            <div>
              <span style={{ color: 'var(--ink)' }}>vs {w.opponent || (w.is_ai ? 'Snappy' : (en ? 'Player' : 'Игрок'))}</span>
              {w.golden && <span style={{ color: 'var(--gold)', marginLeft: 4 }}>★</span>}
              {w.is_ai && w.ai_difficulty && (
                <span style={{ color: 'var(--ink3)', marginLeft: 6, fontSize: 10 }}>
                  {getDiffLabel(w.ai_difficulty, en)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{w.bricks}🧱</span>
              <span style={{ color: 'var(--ink3)', fontSize: 10 }}>
                {new Date(w.date * 1000).toLocaleDateString(en ? 'en-US' : 'ru', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
