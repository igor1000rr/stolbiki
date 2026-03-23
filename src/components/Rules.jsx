export default function Rules() {
  return (
    <div>
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Правила игры «Стойки»</h3>
        <p style={{ color: '#a09cb0', fontSize: 13, lineHeight: 1.8 }}>
          Настольная игра для двух игроков. Цель — закрыть больше стоек, чем соперник.
        </p>
      </div>

      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Поле</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          <div style={{ padding: 12, background: 'rgba(255,193,69,0.06)', borderRadius: 8, border: '1px solid rgba(255,193,69,0.15)' }}>
            <div style={{ fontSize: 12, color: '#ffc145', fontWeight: 600, marginBottom: 4 }}>★ Золотая стойка</div>
            <div style={{ fontSize: 12, color: '#a09cb0' }}>1 штука. Решает при ничьей 5:5</div>
          </div>
          <div style={{ padding: 12, background: 'rgba(74,158,255,0.06)', borderRadius: 8, border: '1px solid rgba(74,158,255,0.15)' }}>
            <div style={{ fontSize: 12, color: '#6db4ff', fontWeight: 600, marginBottom: 4 }}>Обычные стойки</div>
            <div style={{ fontSize: 12, color: '#a09cb0' }}>9 штук. Вмещают до 11 фишек</div>
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Ход</h3>
        <div style={{ fontSize: 13, color: '#c8c4d8', lineHeight: 2 }}>
          <p>Каждый ход состоит из <b>двух фаз</b>:</p>
          
          <div style={{ padding: 10, background: 'rgba(74,158,255,0.06)', borderRadius: 8, marginBottom: 10, border: '1px solid rgba(74,158,255,0.1)' }}>
            <div style={{ fontWeight: 600, color: '#6db4ff', marginBottom: 4 }}>Фаза 1: Перенос (опционально)</div>
            <div style={{ fontSize: 12, color: '#a09cb0' }}>
              Возьмите верхнюю непрерывную группу одного цвета с любой стойки и перенесите 
              на другую стойку того же цвета (сверху) или на пустую стойку.
              Если при переносе стойка достигает 11 фишек — она закрывается.
            </div>
          </div>

          <div style={{ padding: 10, background: 'rgba(240,101,74,0.06)', borderRadius: 8, border: '1px solid rgba(240,101,74,0.1)' }}>
            <div style={{ fontWeight: 600, color: '#f0654a', marginBottom: 4 }}>Фаза 2: Установка</div>
            <div style={{ fontSize: 12, color: '#a09cb0' }}>
              Поставьте до <b>3 фишек</b> своего цвета на максимум <b>2 стойки</b>.
              Первый ход — только 1 фишка.
            </div>
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Закрытие стоек</h3>
        <div style={{ fontSize: 13, color: '#c8c4d8', lineHeight: 1.8 }}>
          <p><b>Переносом:</b> если стойка достигла 11 фишек — она закрывается. 
          Владелец = цвет верхней группы. Лишние фишки снизу уходят в сброс.</p>
          <p><b>Установкой:</b> последние 2 стойки можно закрыть установкой фишек (заполнив до 11).</p>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Swap Rule (правило обмена)</h3>
        <div style={{ fontSize: 13, color: '#c8c4d8', lineHeight: 1.8 }}>
          <p>После первого хода Игрока 1, Игрок 2 может <b>поменять цвета</b> — 
          забрать себе ход Игрока 1. Это компенсирует преимущество первого хода.</p>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3>Победа</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
          <div style={{ textAlign: 'center', padding: 12, background: 'rgba(61,214,140,0.06)', borderRadius: 8, border: '1px solid rgba(61,214,140,0.15)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#3dd68c' }}>6+</div>
            <div style={{ fontSize: 11, color: '#a09cb0', marginTop: 4 }}>стоек = победа</div>
          </div>
          <div style={{ textAlign: 'center', padding: 12, background: 'rgba(255,193,69,0.06)', borderRadius: 8, border: '1px solid rgba(255,193,69,0.15)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ffc145' }}>5:5</div>
            <div style={{ fontSize: 11, color: '#a09cb0', marginTop: 4 }}>золотая решает</div>
          </div>
          <div style={{ textAlign: 'center', padding: 12, background: 'rgba(155,89,182,0.06)', borderRadius: 8, border: '1px solid rgba(155,89,182,0.15)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#9b59b6' }}>77%</div>
            <div style={{ fontSize: 11, color: '#a09cb0', marginTop: 4 }}>шанс с золотой</div>
          </div>
        </div>
      </div>

      <div className="dash-card">
        <h3>Стратегические советы</h3>
        <div style={{ fontSize: 12, color: '#a09cb0', lineHeight: 1.9 }}>
          <p>🎯 <b>Золотая стойка</b> — главный приоритет. 77% партий с ничьёй 5:5 решает золотая.</p>
          <p>🏁 <b>Эндгейм решает.</b> Кто закрыл последнюю стойку — побеждает в 85%.</p>
          <p>↗ <b>Перенос — ключевая механика.</b> Большинство стоек закрывается переносом, не установкой.</p>
          <p>🔄 <b>Swap rule.</b> Если P1 ставит фишку на золотую — рассмотрите swap.</p>
          <p>📊 <b>Контроль центра.</b> Ранний захват 3-4 стоек даёт стратегическое преимущество.</p>
        </div>
      </div>
    </div>
  )
}
