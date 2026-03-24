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

// Схема переноса (SVG)
function TransferDiagram({ lang }) {
  const en = lang === 'en'
  const w = 460, h = 140, standW = 44, chipH = 10, gap = 2
  const stands = [
    { x: 40, chips: [0,0,1,1,1], label: en ? 'Source' : 'Откуда' },
    { x: 260, chips: [0,0], label: en ? 'Target' : 'Куда' },
  ]
  const result = [
    { x: 40, chips: [0,0], label: '' },
    { x: 260, chips: [0,0,1,1,1], label: '' },
  ]

  function drawStand(s, y0) {
    const bx = s.x, by = y0
    return (
      <g key={s.x + '-' + y0}>
        <rect x={bx} y={by} width={standW} height={80} rx={4} fill="#1a1a2a" stroke="#333" strokeWidth={1} />
        {s.chips.map((c, i) => (
          <rect key={i} x={bx+6} y={by+80-8-(i+1)*(chipH+gap)} width={standW-12} height={chipH} rx={4}
            fill={c === 0 ? '#4a9eff' : '#ff6066'} />
        ))}
        {s.label && <text x={bx+standW/2} y={by-6} textAnchor="middle" fontSize={10} fill="#a09cb0">{s.label}</text>}
      </g>
    )
  }

  return (
    <div style={{ padding: '8px 0', overflow: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
        {/* До */}
        <text x={20} y={14} fontSize={10} fill="#6b6880" fontWeight={600}>{en ? 'BEFORE' : 'ДО'}</text>
        {stands.map(s => drawStand(s, 22))}
        {/* Стрелка с подписью */}
        <line x1={100} y1={62} x2={245} y2={62} stroke="#ffc145" strokeWidth={1.5} markerEnd="url(#arrowG)" />
        <text x={172} y={54} textAnchor="middle" fontSize={9} fill="#ffc145">
          {en ? '3 red chips' : '3 красных'}
        </text>
        {/* Выделяем группу */}
        <rect x={46} y={28} width={standW-12} height={3*(chipH+gap)-gap+4} rx={3}
          fill="none" stroke="#ffc145" strokeWidth={1} strokeDasharray="3 2" />

        {/* Стрелка маркер */}
        <defs>
          <marker id="arrowG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#ffc145" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
        </defs>
      </svg>
    </div>
  )
}

// Схема закрытия стойки (SVG)
function CloseDiagram({ lang }) {
  const en = lang === 'en'
  const w = 460, h = 110, standW = 44, chipH = 6, gap = 1

  return (
    <div style={{ padding: '8px 0', overflow: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
        {/* Стойка с 8 фишками */}
        <text x={62} y={12} textAnchor="middle" fontSize={9} fill="#a09cb0">{en ? '8 chips' : '8 фишек'}</text>
        <rect x={40} y={18} width={standW} height={74} rx={4} fill="#1a1a2a" stroke="#333" strokeWidth={1} />
        {[1,1,0,0,0,0,0,0].map((c, i) => (
          <rect key={i} x={46} y={18+74-4-(i+1)*(chipH+gap)} width={standW-12} height={chipH} rx={3}
            fill={c === 0 ? '#4a9eff' : '#ff6066'} />
        ))}

        {/* + перенос 3 синих */}
        <text x={120} y={60} fontSize={18} fill="#ffc145" fontWeight={700}>+</text>
        <text x={155} y={55} fontSize={9} fill="#a09cb0">{en ? '3 blue' : '3 синих'}</text>
        <text x={155} y={67} fontSize={9} fill="#a09cb0">{en ? 'transfer' : 'перенос'}</text>

        {/* Стрелка */}
        <text x={225} y={60} fontSize={16} fill="#555">→</text>

        {/* Стойка с 11 = закрыта */}
        <text x={302} y={12} textAnchor="middle" fontSize={9} fill="#3dd68c">{en ? '11 = CLOSED' : '11 = ЗАКРЫТА'}</text>
        <rect x={280} y={18} width={standW} height={74} rx={4} fill="rgba(61,214,140,0.06)" stroke="#3dd68c" strokeWidth={1.5} />
        {[1,1,0,0,0,0,0,0,0,0,0].slice(0,11).map((c, i) => (
          <rect key={i} x={286} y={18+74-4-(i+1)*(chipH+gap)} width={standW-12} height={chipH} rx={3}
            fill={i >= 8 ? '#4a9eff' : (c === 0 ? '#4a9eff' : '#ff6066')} opacity={0.5} />
        ))}
        <text x={302} y={98} textAnchor="middle" fontSize={9} fill="#3dd68c" fontWeight={600}>
          {en ? 'Blue owns' : 'Синие ★'}
        </text>

        {/* Замок */}
        <text x={360} y={50} fontSize={10} fill="#555">{en ? 'Locked:' : 'Блокировка:'}</text>
        <text x={360} y={65} fontSize={9} fill="#6b6880">{en ? '• No placement' : '• Нельзя ставить'}</text>
        <text x={360} y={78} fontSize={9} fill="#6b6880">{en ? '• No transfer' : '• Нельзя переносить'}</text>
      </svg>
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
