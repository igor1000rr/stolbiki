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
        <div style={{ fontSize: 12, color: '#c8c4d8', lineHeight: 1.8 }}>
          {en ? 'Each turn has 2 phases:' : 'Каждый ход — 2 фазы:'}
        </div>
        <Tip color="#4a9eff">
          <b style={{ color: '#6db4ff' }}>{en ? 'Phase 1: Transfer' : 'Фаза 1: Перенос'}</b> ({en ? 'optional' : 'опционально'})<br/>
          {en ? 'Top consecutive group of one color → to a stand with same color on top or empty. If stand reaches 11 — it closes.'
            : 'Верхняя непрерывная группа одного цвета → на стойку того же цвета сверху или пустую. Если при переносе стойка достигает 11 — закрывается.'}
        </Tip>
        <Tip color="#f0654a">
          <b style={{ color: '#f0654a' }}>{en ? 'Phase 2: Placement' : 'Фаза 2: Установка'}</b><br/>
          {en ? 'Up to 3 chips of your color on max 2 stands. First move — only 1 chip.'
            : 'До 3 фишек своего цвета на максимум 2 стойки. Первый ход — только 1 фишка.'}
        </Tip>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#a09cb0', fontWeight: 600, marginBottom: 6 }}>{en ? 'Example turn:' : 'Пример хода:'}</div>
          <TransferDemo steps={steps} lang={lang} />
        </div>
      </Section>

      <Section title={en ? 'Closing Stands' : 'Закрытие стоек'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Tip color="#3498db">
            <b>{en ? 'By transfer' : 'Переносом'}</b> — {en ? 'stand reaches 11 chips. Owner = top group color. Excess removed from bottom.' : 'стойка достигла 11 фишек. Владелец = цвет верхней группы. Лишние снизу → сброс.'}
          </Tip>
          <Tip color="#e67e22">
            <b>{en ? 'By placement' : 'Установкой'}</b> — {en ? 'only the last 2 open stands can be closed by filling to 11.' : 'только последние 2 стойки можно закрыть заполнив до 11.'}
          </Tip>
        </div>
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
