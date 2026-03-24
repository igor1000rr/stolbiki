import { useState } from 'react'
import { useI18n } from '../engine/i18n'

// Мини-стойка SVG
function MiniStand({ chips = [], golden, closed, owner, label, w = 36, h = 80 }) {
  const chipH = 6, gap = 1, padBot = 4
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x={2} y={12} width={w-4} height={h-12} rx={4} fill={golden ? 'rgba(255,190,48,0.08)' : '#1a1a2a'}
        stroke={golden ? 'rgba(255,190,48,0.3)' : '#333'} strokeWidth={1} />
      {closed && <line x1={4} y1={14} x2={w-4} y2={h-2} stroke="#555" strokeWidth={1} opacity={0.4} />}
      <text x={w/2} y={10} textAnchor="middle" fontSize={8} fill={golden ? '#ffc145' : '#555'}>{label}</text>
      {chips.map((c, i) => (
        <rect key={i} x={6} y={h - padBot - (i+1)*(chipH+gap)} width={w-12} height={chipH} rx={3}
          fill={c === 0 ? '#4a9eff' : '#ff6066'} opacity={closed ? 0.3 : 0.9} />
      ))}
      {owner !== undefined && <text x={w/2} y={h-1} textAnchor="middle" fontSize={7} fill="#888">П{owner+1}</text>}
    </svg>
  )
}

function MiniBoard({ stands, golden = 0, closed = {} }) {
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', padding: '8px 0' }}>
      {stands.map((chips, i) => (
        <MiniStand key={i} chips={chips} golden={i === golden} closed={i in closed}
          owner={closed[i]} label={i === golden ? '★' : i} />
      ))}
    </div>
  )
}

function Section({ title, children, icon }) {
  return (
    <div className="dash-card" style={{ marginBottom: 14 }}>
      <h3>{icon && <span style={{ marginRight: 6 }}>{icon}</span>}{title}</h3>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  )
}

function Tip({ children, color = '#6db4ff' }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 8, background: `${color}08`, borderLeft: `3px solid ${color}`,
      fontSize: 12, color: '#c8c4d8', lineHeight: 1.7, marginBottom: 8 }}>
      {children}
    </div>
  )
}

// Интерактивный пример переноса
function TransferDemo({ steps: demoSteps, lang }) {
  const [step, setStep] = useState(0)
  const en = lang === 'en'
  const steps = demoSteps || []
  if (!steps.length) return null
  const s = steps[step]
  return (
    <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid #2a2a38' }}>
      <div style={{ fontSize: 11, color: '#a09cb0', fontWeight: 600, marginBottom: 4 }}>
        {en ? 'Step' : 'Шаг'} {step + 1}/{steps.length}: {s.label}
      </div>
      <MiniBoard stands={s.stands} />
      <div style={{ fontSize: 11, color: '#6b6880', textAlign: 'center', marginBottom: 8 }}>{s.desc}</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <button className="btn" onClick={() => setStep(Math.max(0, step-1))} style={{ padding: '4px 12px', fontSize: 11, minHeight: 28 }}
          disabled={step === 0}>{en ? 'Back' : 'Назад'}</button>
        <button className="btn primary" onClick={() => setStep(Math.min(steps.length-1, step+1))} style={{ padding: '4px 12px', fontSize: 11, minHeight: 28 }}
          disabled={step === steps.length-1}>{en ? 'Next' : 'Далее'}</button>
      </div>
    </div>
  )
}

// ═══ Интерактивные схемы правил ═══

// Мини-стойка для диаграмм (анимированные фишки)
function DiagramStand({ chips = [], golden, closed, owner, label, highlight, w = 40, h = 90 }) {
  const chipH = 7, gap = 1.5, padBot = 6
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 9, color: golden ? '#ffc145' : '#6b6880', fontWeight: 600, height: 14 }}>
        {label || (golden ? '★' : '')}
      </div>
      <div style={{
        width: w, height: h, borderRadius: 6, position: 'relative',
        background: closed ? 'rgba(61,214,140,0.06)' : '#1a1a2a',
        border: `1.5px solid ${closed ? '#3dd68c' : highlight ? '#ffc145' : '#333'}`,
        transition: 'all 0.4s ease', overflow: 'hidden',
      }}>
        {chips.map((c, i) => (
          <div key={i} style={{
            position: 'absolute', left: 5, right: 5, height: chipH, borderRadius: 4,
            bottom: padBot + i * (chipH + gap),
            background: c === 0 ? '#4a9eff' : '#ff6066',
            opacity: closed ? 0.4 : 0.9,
            transition: 'all 0.4s ease',
            boxShadow: c === 0 ? '0 1px 4px rgba(74,158,255,0.3)' : '0 1px 4px rgba(255,96,102,0.3)',
          }} />
        ))}
        {closed && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#3dd68c', opacity: 0.6,
          }}>✓</div>
        )}
      </div>
      {owner !== undefined && (
        <div style={{ fontSize: 8, color: owner === 0 ? '#4a9eff' : '#ff6066', fontWeight: 700 }}>
          {owner === 0 ? 'BLUE' : 'RED'}
        </div>
      )}
    </div>
  )
}

// Интерактивная схема переноса
function TransferDiagram({ lang }) {
  const en = lang === 'en'
  const [step, setStep] = useState(0)

  const steps = [
    {
      label: en ? 'Starting position' : 'Начальная позиция',
      desc: en ? 'Stand A has blue and red chips. Stand B has blue chips.' : 'На стойке A синие и красные фишки. На стойке B — синие.',
      a: [0, 0, 0, 1, 1, 1], b: [0, 0], highlightA: false, highlightB: false, arrow: false,
    },
    {
      label: en ? 'Select top group' : 'Выбор верхней группы',
      desc: en ? 'Top group: 3 red chips (consecutive same color). This group will be transferred.' : 'Верхняя группа: 3 красных фишки (непрерывная группа одного цвета). Она будет перенесена.',
      a: [0, 0, 0, 1, 1, 1], b: [0, 0], highlightA: true, highlightB: false, arrow: false,
      bracketFrom: 3, bracketTo: 5,
    },
    {
      label: en ? 'Transfer!' : 'Перенос!',
      desc: en ? 'Group moves to empty stand or stand with same color on top. Red → can go to empty or red top.' : 'Группа перемещается на пустую или стойку с тем же цветом сверху. Красные → на пустую или к красным.',
      a: [0, 0, 0], b: [0, 0, 1, 1, 1], highlightA: false, highlightB: true, arrow: true,
    },
    {
      label: en ? 'Done! Now placement phase' : 'Готово! Теперь фаза установки',
      desc: en ? 'After transfer, place up to 3 of your chips on up to 2 stands.' : 'После переноса установите до 3 своих фишек на 1-2 стойки.',
      a: [0, 0, 0], b: [0, 0, 1, 1, 1], highlightA: false, highlightB: false, arrow: false,
    },
  ]

  const s = steps[step]

  return (
    <div style={{
      padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12,
      border: '1px solid #2a2a38', marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#ffc145', fontWeight: 600 }}>
          {en ? 'Transfer demo' : 'Демо переноса'} — {step + 1}/{steps.length}
        </div>
        <div style={{ fontSize: 11, color: '#a09cb0', fontWeight: 600 }}>{s.label}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 30, marginBottom: 12, position: 'relative' }}>
        <div style={{ textAlign: 'center' }}>
          <DiagramStand chips={s.a} label={en ? 'Stand A' : 'Стойка A'} highlight={s.highlightA} />
        </div>

        <div style={{
          fontSize: 22, color: s.arrow ? '#ffc145' : '#333', fontWeight: 700,
          transition: 'all 0.3s', transform: s.arrow ? 'scale(1.2)' : 'scale(1)',
          alignSelf: 'center',
        }}>→</div>

        <div style={{ textAlign: 'center' }}>
          <DiagramStand chips={s.b} label={en ? 'Stand B' : 'Стойка B'} highlight={s.highlightB} />
        </div>
      </div>

      <div style={{
        fontSize: 12, color: '#c8c4d8', textAlign: 'center', lineHeight: 1.6,
        minHeight: 36, padding: '0 12px',
      }}>{s.desc}</div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
        {steps.map((_, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: i === step ? 'var(--accent)' : 'var(--surface2)',
            color: i === step ? '#fff' : 'var(--ink3)',
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}>{i + 1}</button>
        ))}
      </div>
    </div>
  )
}

// Интерактивная схема закрытия
function CloseDiagram({ lang }) {
  const en = lang === 'en'
  const [step, setStep] = useState(0)

  const steps = [
    {
      label: en ? 'Stand has 8 chips' : 'На стойке 8 фишек',
      desc: en ? 'Stand has 6 blue + 2 red chips (8 total). Blue on top.' : 'На стойке 6 синих + 2 красных (8 всего). Синие сверху.',
      chips: [1, 1, 0, 0, 0, 0, 0, 0], closed: false,
      srcChips: [0, 0, 0], srcLabel: en ? 'Source' : 'Откуда',
    },
    {
      label: en ? 'Transfer 3 blue chips' : 'Переносим 3 синих',
      desc: en ? 'Transferring 3 blue chips from another stand. 8 + 3 = 11 — the limit!' : 'Переносим 3 синих с другой стойки. 8 + 3 = 11 — предел!',
      chips: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], closed: false,
      srcChips: [], srcLabel: '',
      arrow: true,
    },
    {
      label: en ? 'Stand closes!' : 'Стойка закрылась!',
      desc: en ? '11 chips reached. Top color = Blue → Blue owns this stand. Stand is now locked.' : '11 фишек достигнуто. Сверху синие → стойка принадлежит синим. Теперь заблокирована.',
      chips: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], closed: true, owner: 0,
      srcChips: [], srcLabel: '',
    },
  ]

  const s = steps[step]

  return (
    <div style={{
      padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12,
      border: '1px solid #2a2a38', marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#3dd68c', fontWeight: 600 }}>
          {en ? 'Close demo' : 'Демо закрытия'} — {step + 1}/{steps.length}
        </div>
        <div style={{ fontSize: 11, color: '#a09cb0', fontWeight: 600 }}>{s.label}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 30, marginBottom: 12 }}>
        {s.srcChips.length > 0 && (
          <>
            <DiagramStand chips={s.srcChips} label={s.srcLabel} highlight />
            <div style={{
              fontSize: 22, color: s.arrow ? '#ffc145' : '#333', fontWeight: 700,
              alignSelf: 'center', transition: 'all 0.3s',
            }}>→</div>
          </>
        )}

        <DiagramStand
          chips={s.chips} closed={s.closed} owner={s.owner}
          label={en ? 'Target stand' : 'Целевая стойка'}
          highlight={s.arrow}
          h={110}
        />

        {s.closed && (
          <div style={{
            alignSelf: 'center', padding: '10px 14px', borderRadius: 8,
            background: 'rgba(61,214,140,0.06)', border: '1px solid rgba(61,214,140,0.2)',
            fontSize: 11, color: '#a09cb0', lineHeight: 1.8,
          }}>
            <div style={{ color: '#3dd68c', fontWeight: 700, marginBottom: 4 }}>{en ? 'Locked!' : 'Заблокирована!'}</div>
            {en ? '• No more placement' : '• Нельзя ставить'}<br/>
            {en ? '• No transfer from/to' : '• Нельзя переносить'}<br/>
            {en ? '• Counts for owner' : '• Считается за владельца'}
          </div>
        )}
      </div>

      <div style={{
        fontSize: 12, color: '#c8c4d8', textAlign: 'center', lineHeight: 1.6,
        minHeight: 36, padding: '0 12px',
      }}>{s.desc}</div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
        {steps.map((_, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: i === step ? '#3dd68c' : 'var(--surface2)',
            color: i === step ? '#000' : 'var(--ink3)',
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}>{i + 1}</button>
        ))}
      </div>
    </div>
  )
}

// Интерактивная схема Swap Rule
function SwapDiagram({ lang }) {
  const en = lang === 'en'
  const [swapped, setSwapped] = useState(false)

  return (
    <div style={{
      padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12,
      border: '1px solid #2a2a38', marginTop: 8,
    }}>
      <div style={{ fontSize: 12, color: '#9b59b6', fontWeight: 600, marginBottom: 12 }}>
        {en ? 'Swap rule demo' : 'Демо правила Swap'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#a09cb0', marginBottom: 6 }}>{en ? 'Player 1' : 'Игрок 1'}</div>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: swapped ? 'rgba(255,96,102,0.15)' : 'rgba(74,158,255,0.15)',
            border: `2px solid ${swapped ? '#ff6066' : '#4a9eff'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.5s ease',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: swapped ? '#ff6066' : '#4a9eff',
              transition: 'all 0.5s ease',
            }} />
          </div>
        </div>

        <button onClick={() => setSwapped(!swapped)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: swapped ? '#9b59b6' : 'var(--surface2)',
          color: swapped ? '#fff' : 'var(--ink2)',
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          transition: 'all 0.3s',
        }}>
          ⇄ SWAP
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#a09cb0', marginBottom: 6 }}>{en ? 'Player 2' : 'Игрок 2'}</div>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: swapped ? 'rgba(74,158,255,0.15)' : 'rgba(255,96,102,0.15)',
            border: `2px solid ${swapped ? '#4a9eff' : '#ff6066'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.5s ease',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: swapped ? '#4a9eff' : '#ff6066',
              transition: 'all 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#c8c4d8', textAlign: 'center', lineHeight: 1.6 }}>
        {swapped
          ? (en ? 'Colors swapped! Player 2 takes Player 1\'s first move.' : 'Цвета поменялись! Игрок 2 забирает первый ход Игрока 1.')
          : (en ? 'After P1\'s first move, P2 can swap colors. Click SWAP to try!' : 'После первого хода П1, П2 может поменять цвета. Нажмите SWAP!')}
      </div>
    </div>
  )
}

export default function Rules() {
  const { lang } = useI18n()
  const en = lang === 'en'

  // Демо-шаги
  const steps = en ? [
    { label: 'Starting position', stands: [[0,0,1,1], [1,0], [0], [], [1,1,0]], desc: 'Blue (0) wants to transfer a group' },
    { label: 'Selected stand 0 — top 2 reds', stands: [[0,0], [1,0], [0], [1,1], [1,1,0]], desc: 'Group [red,red] transferred to stand 3 (empty)' },
    { label: 'Placement: 2 chips on stand 2', stands: [[0,0], [1,0], [0,0,0], [1,1], [1,1,0]], desc: 'Placed 2 blue on stand 2' },
  ] : [
    { label: 'Исходная позиция', stands: [[0,0,1,1], [1,0], [0], [], [1,1,0]], desc: 'Синие (0) хотят перенести группу' },
    { label: 'Выбрали стойку 0 — верхние 2 красные', stands: [[0,0], [1,0], [0], [1,1], [1,1,0]], desc: 'Группа [red,red] перенесена на стойку 3 (пустая)' },
    { label: 'Установка: 2 фишки на стойку 2', stands: [[0,0], [1,0], [0,0,0], [1,1], [1,1,0]], desc: 'Поставили 2 синих на стойку 2' },
  ]

  return (
    <div>
      <Section title={en ? 'Rules of "Stacks"' : 'Правила игры «Стойки»'}>
        <div style={{ fontSize: 13, color: '#c8c4d8', lineHeight: 1.8 }}>
          {en ? 'A strategy board game for two players. Goal: close more stands than your opponent. Balance confirmed on 239K+ games.'
            : 'Стратегическая настольная игра для двух игроков. Цель — закрыть больше стоек, чем соперник. Баланс подтверждён на 239K+ партиях.'}
        </div>
      </Section>

      <Section title={en ? 'Game Board' : 'Игровое поле'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: 12, background: 'rgba(255,193,69,0.06)', borderRadius: 8, border: '1px solid rgba(255,193,69,0.15)' }}>
            <div style={{ fontSize: 12, color: '#ffc145', fontWeight: 600 }}>{en ? 'Golden stand' : 'Золотая стойка'}</div>
            <div style={{ fontSize: 11, color: '#a09cb0', marginTop: 4 }}>{en ? '1 stand. In a 5:5 tie — its owner wins' : '1 штука. При ничьей 5:5 — владелец побеждает'}</div>
          </div>
          <div style={{ padding: 12, background: 'rgba(74,158,255,0.06)', borderRadius: 8, border: '1px solid rgba(74,158,255,0.15)' }}>
            <div style={{ fontSize: 12, color: '#6db4ff', fontWeight: 600 }}>{en ? 'Regular stands' : 'Обычные стойки'}</div>
            <div style={{ fontSize: 11, color: '#a09cb0', marginTop: 4 }}>{en ? '9 stands. Each holds up to 11 chips' : '9 штук. Каждая вмещает до 11 фишек'}</div>
          </div>
        </div>
        <MiniBoard stands={[[], [], [], [], [0], [], [], [1], [], []]} />
        <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>{en ? '10 stands: golden + 9 regular' : '10 стоек: золотая + 9 обычных'}</div>
      </Section>

      <Section title={en ? 'Turn Structure' : 'Ход'}>
        <div style={{ fontSize: 12, color: '#c8c4d8', lineHeight: 1.8, marginBottom: 8 }}>
          {en ? 'Each turn has 2 phases in order:' : 'Каждый ход состоит из двух фаз по порядку:'}
        </div>

        <Tip color="#4a9eff">
          <b style={{ color: '#6db4ff' }}>{en ? 'Phase 1: Transfer' : 'Фаза 1: Перенос'}</b> ({en ? 'optional — can skip' : 'необязательно — можно пропустить'})<br/>
          {en
            ? '• Transfer the top consecutive group of one color from one stand to another'
            : '• Переносится верхняя непрерывная группа фишек одного цвета с одной стойки на другую'}<br/>
          {en
            ? '• The group is moved whole — cannot be split'
            : '• Группа переносится целиком — делить нельзя'}<br/>
          {en
            ? '• Can transfer your own chips AND opponent\'s chips'
            : '• Можно переносить свои фишки и фишки соперника'}<br/>
          {en
            ? '• Target: empty stand or stand with same color on top'
            : '• Куда: на пустую стойку или на фишки такого же цвета сверху'}
        </Tip>

        {/* Схема переноса */}
        <TransferDiagram lang={lang} />

        <Tip color="#f0654a">
          <b style={{ color: '#f0654a' }}>{en ? 'Phase 2: Placement' : 'Фаза 2: Установка'}</b><br/>
          {en
            ? '• Place 1 to 3 chips of your color'
            : '• Поставьте от 1 до 3 фишек своего цвета'}<br/>
          {en
            ? '• On max 2 stands per turn'
            : '• На максимум 2 стойки за ход'}<br/>
          {en
            ? '• Max 11 chips on any stand'
            : '• Максимум 11 фишек на любой стойке'}<br/>
          {en
            ? '• First move of the game — only 1 chip'
            : '• Первый ход игры — только 1 фишка'}
        </Tip>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#a09cb0', fontWeight: 600, marginBottom: 6 }}>{en ? 'Interactive example:' : 'Интерактивный пример:'}</div>
          <TransferDemo steps={steps} lang={lang} />
        </div>
      </Section>

      <Section title={en ? 'Closing Stands' : 'Закрытие стоек'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Tip color="#3498db">
            <b>{en ? 'By transfer' : 'Переносом'}</b><br/>
            {en
              ? '• Stand reaches 11 chips after transfer → closes'
              : '• Стойка достигает 11 фишек после переноса → закрывается'}<br/>
            {en
              ? '• Owner = color of top group'
              : '• Владелец = цвет верхней группы'}<br/>
            {en
              ? '• Excess chips removed from bottom'
              : '• Лишние фишки снизу удаляются'}
          </Tip>
          <Tip color="#e67e22">
            <b>{en ? 'By placement (exception)' : 'Установкой (исключение)'}</b><br/>
            {en
              ? '• Only when 2 stands remain open'
              : '• Только когда осталось 2 открытых стойки'}<br/>
            {en
              ? '• Can close by filling to 11'
              : '• Можно закрыть заполнив до 11'}
          </Tip>
        </div>

        <Tip color="#e74c3c">
          <b>{en ? 'Important rules:' : 'Важные правила:'}</b><br/>
          {en
            ? '• Can only close a stand with YOUR color on top'
            : '• Закрыть стойку можно только СВОИМ цветом сверху'}<br/>
          {en
            ? '• Max 1 stand closed per turn'
            : '• За ход можно закрыть только одну стойку'}<br/>
          {en
            ? '• After closing: stand is locked — no placement, no transfer from/to it'
            : '• После закрытия: стойка блокируется — нельзя ставить, нельзя переносить'}
        </Tip>

        {/* Схема закрытия */}
        <CloseDiagram lang={lang} />
      </Section>

      <Section title="Swap Rule">
        <Tip color="#9b59b6">
          {en ? 'After P1\'s first move, Player 2 can swap colors — taking P1\'s move. Compensates first-move advantage. Used in ~30% of games.'
            : 'После первого хода П1, Игрок 2 может поменять цвета — забрать ход П1. Компенсирует преимущество первого хода. Используется в ~30% партий.'}
        </Tip>
        <SwapDiagram lang={lang} />
      </Section>

      <Section title={en ? 'Victory' : 'Победа'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { v: '6+', l: en ? 'stands = win' : 'стоек = победа', c: '#3dd68c' },
            { v: '5:5', l: en ? 'golden decides' : 'золотая решает', c: '#ffc145' },
            { v: '85%', l: en ? 'last close → win' : 'последний → win', c: '#e74c3c' },
          ].map(m => (
            <div key={m.l} style={{ textAlign: 'center', padding: 12, background: `${m.c}08`, borderRadius: 10, border: `1px solid ${m.c}18` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.c }}>{m.v}</div>
              <div style={{ fontSize: 10, color: '#a09cb0', marginTop: 4 }}>{m.l}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={en ? 'Strategy' : 'Стратегия'}>
        {(en ? [
          { text: 'Golden stand is priority #1. 77% of ties are decided by golden.' },
          { text: 'Endgame matters. Whoever closes the last stand wins 85%.' },
          { text: 'Transfer is the key mechanic. Most stands close via transfer.' },
          { text: 'Swap rule. If P1 placed on golden — consider swap.' },
          { text: 'Control. Early capture of 3-4 stands = strategic advantage.' },
          { text: 'Diversify. Place on different stands — don\'t stack all in one.' },
        ] : [
          { text: 'Золотая стойка — приоритет №1. 77% ничьих решает золотая.' },
          { text: 'Эндгейм решает. Кто закрыл последнюю — побеждает в 85%.' },
          { text: 'Перенос — главная механика. Большинство стоек закрываются переносом.' },
          { text: 'Swap rule. Если П1 поставил на золотую — рассмотрите swap.' },
          { text: 'Контроль. Ранний захват 3-4 стоек = стратегическое преимущество.' },
          { text: 'Разнообразие. Ставьте на разные стойки — не складывайте все в одну.' },
        ]).map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#a09cb0', lineHeight: 1.6 }}>{t.text}</span>
          </div>
        ))}
      </Section>

      <Section title={en ? 'Keyboard Shortcuts' : 'Горячие клавиши'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['Enter', en ? 'Confirm move' : 'Подтвердить ход'],
            ['Esc', en ? 'Cancel transfer' : 'Отмена переноса'],
            ['N', en ? 'New game' : 'Новая игра'],
            ['Z', en ? 'Undo (PvP)' : 'Отмена хода (PvP)'],
          ].map(([k, d]) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <kbd style={{ padding: '2px 8px', borderRadius: 4, background: '#2a2a38', border: '1px solid #444',
                fontSize: 11, fontFamily: 'monospace', color: '#e8e6f0' }}>{k}</kbd>
              <span style={{ fontSize: 11, color: '#a09cb0' }}>{d}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
