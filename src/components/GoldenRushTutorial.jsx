import { useState } from 'react'

/**
 * GoldenRushTutorial — 4-шаговый overlay-туториал для новичка перед первой партией.
 * Показывается один раз (флаг в localStorage: stolbiki_gr_tutorial_seen).
 * Пользователь может вызвать повторно из Lobby кнопкой «Как играть».
 */

const PLAYER_COLORS = ['#4a9eff', '#ff6066', '#3dd68c', '#e040fb']

function CrossSchema({ highlight }) {
  // highlight: 'your-arms' | 'center' | 'queue' | null
  const size = 200
  const c = size / 2
  const r = size * 0.36
  const stands = [
    { x: c - r * 0.9, y: c - r * 0.9, color: 0, order: 1 },
    { x: c - r,       y: c,           color: 0, order: 2 },
    { x: c + r * 0.9, y: c - r * 0.9, color: 1, order: 1 },
    { x: c + r,       y: c,           color: 1, order: 2 },
    { x: c + r * 0.9, y: c + r * 0.9, color: 2, order: 1 },
    { x: c,           y: c + r,       color: 2, order: 2 },
    { x: c - r * 0.9, y: c + r * 0.9, color: 3, order: 1 },
    { x: c,           y: c - r,       color: 3, order: 2 },
  ]
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      <line x1={stands[0].x} y1={stands[0].y} x2={stands[5].x} y2={stands[5].y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <line x1={stands[2].x} y1={stands[2].y} x2={stands[7].x} y2={stands[7].y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {highlight === 'center' && <circle cx={c} cy={c} r={28} fill="#ffc14530" />}

      {stands.map((s, i) => {
        const isYourArm = highlight === 'your-arms' && s.color === 0
        const isQueue = highlight === 'queue' && (i === 0 || i === 1)
        const highlighted = isYourArm || isQueue
        return (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={14}
              fill="#0a0a18"
              stroke={isQueue && i <= 1 ? '#3dd68c' : PLAYER_COLORS[s.color]}
              strokeWidth={highlighted ? 2.5 : 1.2}
              opacity={highlight && !highlighted && highlight !== 'center' ? 0.3 : 1}
            />
            <text x={s.x} y={s.y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={PLAYER_COLORS[s.color]}>
              {s.order}
            </text>
            {isQueue && i === 1 && (
              <g>
                <circle cx={s.x} cy={s.y - 22} r={6} fill="#3dd68c" />
                <text x={s.x} y={s.y - 19} textAnchor="middle" fontSize="8" fontWeight="700" fill="#0a0a18">✓</text>
              </g>
            )}
          </g>
        )
      })}

      {/* Центр */}
      <circle cx={c} cy={c} r={18}
        fill="#2a2420"
        stroke="#ffc145"
        strokeWidth={highlight === 'center' ? 2.5 : 1.5}
      />
      <text x={c} y={c + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#ffc145">★</text>
    </svg>
  )
}

const STEPS_RU = [
  {
    title: 'Твоё поле — крест из 9 стоек',
    schema: null,
    body: 'В Golden Rush играют 4 человека. Поле — крест из 9 стоек: 8 «рук» (по 2 у каждого игрока) + 1 общий золотой центр (★).',
  },
  {
    title: 'У тебя две стойки',
    schema: 'your-arms',
    body: 'Твои стойки — «order=1» (ближняя) и «order=2» (дальняя) твоего цвета. Их нужно замкнуть в порядке: сначала 1, потом 2. Пока 1 открыта — у стойки 2 cap = 10 блоков (11-й не пройдёт).',
  },
  {
    title: 'Замкнул обе — вставай в очередь на центр',
    schema: 'queue',
    body: 'Как только обе твои стойки замкнуты, ты в FIFO-очереди на центр. Первый в очереди ставит на него свой флажок и получает +15 очков.',
  },
  {
    title: 'Очки и награды',
    schema: 'center',
    body: '+1 за каждый блок · +5 за стойку 1 · +8 за стойку 2 · +15 за центр · +5 команде в 2v2. Онлайн-бонус: +2 🧱 за участие, +10 🧱 за победу, +3 🧱 за центр. Resign = 0.',
  },
]

const STEPS_EN = [
  {
    title: 'Your board — 9 stands in a cross',
    schema: null,
    body: 'Golden Rush is for 4 players. The board is a cross of 9 stands: 8 arms (two per player) + 1 shared golden center (★).',
  },
  {
    title: 'You own two stands',
    schema: 'your-arms',
    body: 'Your stands are «order=1» (near) and «order=2» (far), both in your color. Close them in order — first 1, then 2. While 1 is open, stand 2 has cap = 10 blocks (the 11th is blocked).',
  },
  {
    title: 'Close both — join the queue for the center',
    schema: 'queue',
    body: 'Once both your stands are closed, you enter the FIFO queue for the center. The first player in queue captures it and earns +15 points.',
  },
  {
    title: 'Scoring and rewards',
    schema: 'center',
    body: '+1 per block · +5 for stand 1 · +8 for stand 2 · +15 for center · +5 team bonus in 2v2. Online rewards: +2 🧱 participation, +10 🧱 win, +3 🧱 center. Resign = 0.',
  },
]

export default function GoldenRushTutorial({ lang, onClose }) {
  const en = lang === 'en'
  const steps = en ? STEPS_EN : STEPS_RU
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 420, width: '100%',
          background: 'var(--card, #1a1a2e)',
          border: '1px solid var(--ink4, rgba(255,255,255,0.1))',
          borderRadius: 14, padding: 24,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: 14,
            background: 'transparent', color: 'var(--ink3)',
            border: 'none', cursor: 'pointer', fontSize: 16,
          }}
        >
          ×
        </button>

        <div style={{ fontSize: 10, color: '#ffc145', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
          Golden Rush · {step + 1} / {steps.length}
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px', lineHeight: 1.3 }}>
          {current.title}
        </h3>

        {current.schema && (
          <div style={{ marginBottom: 14, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
            <CrossSchema highlight={current.schema} />
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65, margin: '0 0 20px' }}>
          {current.body}
        </p>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? '#ffc145' : 'var(--ink4, rgba(255,255,255,0.12))',
              transition: 'width 0.2s',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                flex: 1, padding: '9px 14px',
                background: 'transparent', color: 'var(--ink2)',
                border: '1px solid var(--ink4, rgba(255,255,255,0.12))',
                borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              ←
            </button>
          )}
          <button
            onClick={() => isLast ? onClose() : setStep(step + 1)}
            style={{
              flex: 2, padding: '9px 14px',
              background: '#ffc145', color: '#1a1a2e',
              border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {isLast
              ? (en ? 'Got it, find match' : 'Понятно, искать матч')
              : (en ? 'Next' : 'Дальше')}
          </button>
        </div>
      </div>
    </div>
  )
}
