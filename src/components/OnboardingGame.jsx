/**
 * OnboardingGame — сценарная обучающая партия для первого запуска.
 *
 * Принцип: игрок реально кликает по доске, но каждый его клик строго
 * предписан сценарием. AI делает заранее определённые ходы. Гарантированная
 * победа в конце — счёт 5:5, золотая стойка у игрока.
 *
 * Не интегрируется с Game.jsx чтобы не зависеть от движка и не рисковать
 * сломать боевую игру. Своя простая отрисовка SVG, своё состояние доски.
 *
 * Сценарий по спецификации Игоря:
 *   - 7 стоек уже закрыты (3 у игрока, 4 у AI), осталось 3 открытых.
 *   - 8 ходов сторон, в финале игрок закрывает 3-ю стойку.
 *   - Итог: 5 у игрока (включая золотую), 5 у AI. Игрок побеждает по золотой.
 *
 * Триггер показа — в App.jsx по флагу localStorage.stolbiki_onboarding_done.
 * После победы вызывается onComplete(authUser) — App перенаправит в Город побед.
 */

import { useState, useEffect, useCallback } from 'react'

const PLAYER = 'B'  // игрок — синие
const AI = 'R'      // соперник — красные

// Изначальная доска. 3 видимых стойки (1, 2, 3), остальные 7 уже закрыты.
const INITIAL_BOARD = {
  // Стойки в порядке отображения слева направо.
  stands: [
    // Stand 0 = "1": 9 блоков, верх = R (соперник)
    ['B','R','R','B','B','B','B','B','R'],
    // Stand 1 = "2", золотая: 7 блоков, верх = B (игрок)
    ['B','B','R','B','R','B','B'],
    // Stand 2 = "3": пустая
    [],
  ],
  goldenIdx: 1,
  // Декорации — закрытые стойки сверху доски (просто для антуража).
  closedAbove: [
    { owner: PLAYER }, { owner: PLAYER }, { owner: PLAYER },
    { owner: AI }, { owner: AI }, { owner: AI }, { owner: AI },
  ],
}

// Сценарий. Каждый шаг — одно атомарное действие.
// AI-шаги выполняются автоматически, player-шаги ждут клика.
const SCRIPT = [
  // Ход 1 — соперник
  { actor: 'ai', kind: 'place', stand: 0, blocks: ['R'],
    say_ru: 'Соперник ставит блок на стойку 1.',
    say_en: 'Opponent places a block on stand 1.' },
  { actor: 'ai', kind: 'place', stand: 1, blocks: ['R','R'],
    say_ru: 'И ещё два на золотую (стойка 2). Хочет её захватить.',
    say_en: 'And two more on the golden stand 2. Trying to grab it.' },

  // Ход 2 — игрок
  { actor: 'player', kind: 'transfer-pickup', stand: 0, count: 2,
    hint_ru: 'Ваш ход. Тапните на стойку 1 — снимем верхние 2 красных блока, чтобы перенести их.',
    hint_en: 'Your turn. Tap stand 1 — we pick up the top 2 red blocks to transfer.' },
  { actor: 'player', kind: 'transfer-drop', stand: 2,
    hint_ru: 'Теперь тапните на пустую стойку 3 — перенесём блоки туда.',
    hint_en: 'Now tap the empty stand 3 — we move the blocks there.' },
  { actor: 'player', kind: 'place', stand: 2, blocks: ['B','B'],
    hint_ru: 'Поставьте 2 ваших синих блока на стойку 3 (просто тапайте по ней).',
    hint_en: 'Place 2 of your blue blocks on stand 3 (just tap it).' },
  { actor: 'player', kind: 'place', stand: 1, blocks: ['B'],
    hint_ru: 'И последний синий блок этого хода — на золотую стойку 2. За ход можно ставить до 3 блоков.',
    hint_en: 'And one last blue block this turn — on golden stand 2. Up to 3 blocks per turn.' },

  // Ход 3 — соперник
  { actor: 'ai', kind: 'place', stand: 0, blocks: ['R','R'],
    say_ru: 'Соперник усиливает стойку 1.',
    say_en: 'Opponent reinforces stand 1.' },

  // Ход 4 — игрок: закрывает золотую переносом
  { actor: 'player', kind: 'transfer-pickup', stand: 2, count: 2,
    hint_ru: 'Снова ваш ход. Тапните стойку 3 — снимем 2 ваших синих блока с верха.',
    hint_en: 'Your turn again. Tap stand 3 — pick up 2 blue blocks from the top.' },
  { actor: 'player', kind: 'transfer-drop-close', stand: 1,
    hint_ru: 'Перенесите их на золотую (стойка 2) — она достроится и станет ВАШЕЙ!',
    hint_en: 'Drop them on the golden stand 2 — it completes and is YOURS!' },
  { actor: 'player', kind: 'place', stand: 2, blocks: ['B','B','B'],
    hint_ru: 'Доставьте 3 синих блока на стойку 3.',
    hint_en: 'Place 3 blue blocks on stand 3.' },

  // Ход 5 — соперник: закрывает 1-ю и ставит на 3-ю
  { actor: 'ai', kind: 'place-close', stand: 0, blocks: ['R'],
    say_ru: 'Соперник закрывает стойку 1 — она его. Счёт 4:5.',
    say_en: 'Opponent closes stand 1 — it is theirs. Score 4:5.' },
  { actor: 'ai', kind: 'place', stand: 2, blocks: ['R'],
    say_ru: 'И ставит блок на вашу стойку 3.',
    say_en: 'And places a block on your stand 3.' },

  // Ход 6 — игрок
  { actor: 'player', kind: 'place', stand: 2, blocks: ['B'],
    hint_ru: 'Поставьте 1 синий блок на стойку 3.',
    hint_en: 'Place 1 blue block on stand 3.' },

  // Ход 7 — соперник: рывок
  { actor: 'ai', kind: 'place', stand: 2, blocks: ['R','R','R'],
    say_ru: 'Соперник делает рывок — 3 блока на стойку 3. Хочет её отобрать!',
    say_en: 'Opponent surges — 3 blocks on stand 3. Trying to take it!' },

  // Ход 8 — игрок: финальное закрытие
  { actor: 'player', kind: 'place-close', stand: 2, blocks: ['B'],
    hint_ru: 'Финал! 1 синий блок на стойку 3 — закрываете её для себя. Счёт станет 5:5, но золотая ваша — победа!',
    hint_en: 'Finale! 1 blue block on stand 3 — close it for yourself. Score 5:5, but the golden is yours — VICTORY!' },
]

const COLOR = { B: '#4a9eff', R: '#ff6b6b' }

function Block({ kind, idx, total, x, w, h }) {
  return (
    <rect
      x={x}
      y={-h * (idx + 1) - 2}
      width={w}
      height={h}
      rx={2}
      fill={COLOR[kind]}
      stroke="rgba(0,0,0,0.2)"
      strokeWidth={0.5}
      style={{ animation: idx === total - 1 ? 'blockPop 0.3s ease' : undefined }}
    />
  )
}

function Stand({ x, label, blocks, golden, closed, closedBy, highlight, dim, onClick }) {
  const W = 60
  const H = 240
  const blockH = 14
  const blockW = W - 12
  const standY = 0
  const standW = W
  const standH = 18

  const closedColor = closedBy === PLAYER ? COLOR.B : COLOR.R
  const fillStand = closed
    ? closedColor
    : (golden ? '#ffc145' : '#3a3a4a')

  return (
    <g
      transform={`translate(${x}, 0)`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Подсветка-кольцо для подсказки */}
      {highlight && (
        <rect
          x={-6}
          y={-H + 20}
          width={W + 12}
          height={H + 30}
          rx={8}
          fill="none"
          stroke="#ffc145"
          strokeWidth={3}
          strokeDasharray="6 4"
          style={{ animation: 'highlightPulse 1.2s ease-in-out infinite' }}
        />
      )}

      {/* Сама стойка (постамент) */}
      <rect x={0} y={standY} width={standW} height={standH} rx={3} fill={fillStand} />
      {golden && !closed && (
        <text x={W / 2} y={standY + 13} textAnchor="middle" fontSize="11" fontWeight="700" fill="#000">
          ★
        </text>
      )}

      {/* Блоки на стойке */}
      {!closed && blocks.map((b, i) => (
        <Block key={i} kind={b} idx={i} total={blocks.length} x={6} w={blockW} h={blockH} />
      ))}

      {/* Метка закрытой стойки */}
      {closed && (
        <text x={W / 2} y={standY + 13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
          {closedBy === PLAYER ? '\u2713' : '\u2717'}
        </text>
      )}

      {/* Подпись номера стойки */}
      <text x={W / 2} y={standY + 36} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.6)">
        {label}
      </text>
    </g>
  )
}

function ClosedStandMini({ owner }) {
  const color = owner === PLAYER ? COLOR.B : COLOR.R
  return (
    <div
      style={{
        width: 24, height: 24, borderRadius: 4,
        background: color, opacity: 0.4,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: '#fff', fontWeight: 700,
      }}
    >
      {owner === PLAYER ? '\u2713' : '\u2717'}
    </div>
  )
}

export default function OnboardingGame({ lang = 'ru', onComplete, onSkip, isLoggedIn = false }) {
  const en = lang === 'en'
  const [stands, setStands] = useState(() => INITIAL_BOARD.stands.map(s => [...s]))
  const [closedActive, setClosedActive] = useState([null, null, null]) // owner для закрытых среди активных
  const [stepIdx, setStepIdx] = useState(0)
  const [pickup, setPickup] = useState(null) // { fromStand, blocks }
  const [shake, setShake] = useState(false)
  const [score, setScore] = useState({ player: 3, ai: 4 })
  const [finished, setFinished] = useState(false)

  const step = SCRIPT[stepIdx]

  // Автовыполнение AI-шагов с задержкой.
  useEffect(() => {
    if (!step || step.actor !== 'ai' || finished) return
    const t = setTimeout(() => {
      applyAiStep(step)
      setStepIdx(i => i + 1)
    }, 1400)
    return () => clearTimeout(t)
  }, [stepIdx, finished])

  // Автоматическое завершение когда сценарий пройден.
  useEffect(() => {
    if (stepIdx >= SCRIPT.length && !finished) {
      setFinished(true)
    }
  }, [stepIdx, finished])

  function applyAiStep(s) {
    setStands(prev => {
      const next = prev.map(arr => [...arr])
      next[s.stand].push(...s.blocks)
      return next
    })
    if (s.kind === 'place-close') {
      setClosedActive(prev => {
        const next = [...prev]
        next[s.stand] = AI
        return next
      })
      setScore(sc => ({ ...sc, ai: sc.ai + 1 }))
    }
  }

  const handleClick = useCallback((standIdx) => {
    if (!step || step.actor !== 'player' || finished) return
    if (closedActive[standIdx] !== null) return // нельзя кликать по закрытой

    const expected = step.stand
    if (standIdx !== expected) {
      // Не туда — мягкая встряска.
      setShake(true)
      setTimeout(() => setShake(false), 350)
      return
    }

    // Применяем действие в зависимости от kind.
    if (step.kind === 'transfer-pickup') {
      setStands(prev => {
        const next = prev.map(arr => [...arr])
        const taken = next[standIdx].splice(next[standIdx].length - step.count, step.count)
        setPickup({ fromStand: standIdx, blocks: taken })
        return next
      })
      setStepIdx(i => i + 1)
    } else if (step.kind === 'transfer-drop' || step.kind === 'transfer-drop-close') {
      if (!pickup) return
      const isClose = step.kind === 'transfer-drop-close'
      setStands(prev => {
        const next = prev.map(arr => [...arr])
        next[standIdx].push(...pickup.blocks)
        return next
      })
      setPickup(null)
      if (isClose) {
        setClosedActive(prev => {
          const next = [...prev]
          next[standIdx] = PLAYER
          return next
        })
        setScore(sc => ({ ...sc, player: sc.player + 1 }))
      }
      setStepIdx(i => i + 1)
    } else if (step.kind === 'place' || step.kind === 'place-close') {
      const isClose = step.kind === 'place-close'
      setStands(prev => {
        const next = prev.map(arr => [...arr])
        next[standIdx].push(...step.blocks)
        return next
      })
      if (isClose) {
        setClosedActive(prev => {
          const next = [...prev]
          next[standIdx] = PLAYER
          return next
        })
        setScore(sc => ({ ...sc, player: sc.player + 1 }))
      }
      setStepIdx(i => i + 1)
    }
  }, [step, pickup, closedActive, finished])

  const hint = step
    ? (step.actor === 'player' ? (en ? step.hint_en : step.hint_ru) : (en ? step.say_en : step.say_ru))
    : ''

  const isPlayerTurn = step?.actor === 'player'
  const highlightStand = isPlayerTurn ? step?.stand : null

  // Победа: 5 у игрока (включая золотую), 5 у AI, золотая закрыта игроком.
  const playerWon = finished && score.player === 5 && closedActive[INITIAL_BOARD.goldenIdx] === PLAYER

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'linear-gradient(180deg, #1a1a24 0%, #0f0f18 100%)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <style>{`
        @keyframes blockPop { 0% { transform: scaleY(0); transform-origin: bottom; } 100% { transform: scaleY(1); } }
        @keyframes highlightPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Заголовок */}
      <div style={{ textAlign: 'center', padding: '0 16px 12px' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
          {en ? 'Tutorial match' : 'Обучающая партия'}
        </div>
        <div style={{ fontSize: 14, color: '#ddd', fontWeight: 600 }}>
          {en ? 'Score' : 'Счёт'}: <span style={{ color: COLOR.B }}>{score.player}</span>
          <span style={{ color: '#666' }}> : </span>
          <span style={{ color: COLOR.R }}>{score.ai}</span>
          <span style={{ marginLeft: 12, color: '#888', fontSize: 11 }}>
            {en ? 'first to 6 wins' : 'до 6 побед'}
          </span>
        </div>
      </div>

      {/* Закрытые стойки сверху (декоративные, чтобы передать масштаб) */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 16px 16px', flexWrap: 'wrap' }}>
        {INITIAL_BOARD.closedAbove.map((c, i) => (
          <ClosedStandMini key={i} owner={c.owner} />
        ))}
      </div>

      {/* Доска */}
      <div
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
          animation: shake ? 'shake 0.35s ease' : undefined,
        }}
      >
        <svg
          viewBox="-20 -260 280 290"
          style={{ maxWidth: 360, width: '100%', height: 'auto' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {[0, 1, 2].map(i => (
            <Stand
              key={i}
              x={i * 80}
              label={String(i + 1)}
              blocks={stands[i]}
              golden={i === INITIAL_BOARD.goldenIdx}
              closed={closedActive[i] !== null}
              closedBy={closedActive[i]}
              highlight={highlightStand === i && !finished}
              dim={isPlayerTurn && highlightStand !== null && highlightStand !== i}
              onClick={isPlayerTurn ? () => handleClick(i) : undefined}
            />
          ))}
          {/* Индикатор переноса */}
          {pickup && (
            <g>
              {pickup.blocks.map((b, i) => (
                <rect
                  key={i}
                  x={pickup.fromStand * 80 + 6}
                  y={-280 - i * 14}
                  width={48}
                  height={12}
                  rx={2}
                  fill={COLOR[b]}
                  opacity={0.7}
                />
              ))}
              <text
                x={pickup.fromStand * 80 + 30}
                y={-310}
                textAnchor="middle"
                fontSize="10"
                fill="#ffc145"
              >
                {en ? 'in hand' : 'в руке'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Подсказка снизу */}
      {!finished && (
        <div style={{ padding: '12px 20px 0' }}>
          <div
            key={stepIdx}
            style={{
              background: isPlayerTurn ? 'rgba(74,158,255,0.12)' : 'rgba(255,107,107,0.10)',
              border: `1px solid ${isPlayerTurn ? 'rgba(74,158,255,0.3)' : 'rgba(255,107,107,0.2)'}`,
              borderRadius: 12,
              padding: '14px 16px',
              animation: 'fadeUp 0.3s ease',
            }}
          >
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>
              {isPlayerTurn
                ? (en ? 'YOUR MOVE' : 'ВАШ ХОД')
                : (en ? 'OPPONENT' : 'СОПЕРНИК')}
            </div>
            <div style={{ fontSize: 14, color: '#eee', lineHeight: 1.4 }}>
              {hint}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              onClick={onSkip}
              style={{
                background: 'none', border: 'none', color: '#666',
                fontSize: 12, cursor: 'pointer', padding: '6px 12px',
              }}
            >
              {en ? 'Skip tutorial' : 'Пропустить обучение'}
            </button>
          </div>
        </div>
      )}

      {/* Финальная модалка */}
      {finished && playerWon && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 3500,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(160deg, #2a2a3a 0%, #1a1a28 100%)',
              borderRadius: 20, padding: '32px 24px', maxWidth: 360, width: '100%',
              border: '1px solid rgba(255,193,69,0.3)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.6), 0 0 40px rgba(255,193,69,0.15)',
              textAlign: 'center',
              animation: 'fadeUp 0.4s ease',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              <svg viewBox="0 0 24 24" width="64" height="64" fill="#ffc145">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
              {en ? 'Victory!' : 'Победа!'}
            </h2>
            <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.5, marginBottom: 8 }}>
              {en
                ? 'Score 5:5, but the golden stand is yours. That is how every match can turn around \u2014 the golden decides ties.'
                : 'Счёт 5:5, но золотая стойка ваша. Так и решаются ничьи \u2014 золотая всё переворачивает.'}
            </p>
            <div
              style={{
                background: 'rgba(255,193,69,0.1)',
                border: '1px solid rgba(255,193,69,0.25)',
                borderRadius: 12, padding: '14px 16px', margin: '20px 0',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 12, color: '#ffc145', fontWeight: 700, marginBottom: 6 }}>
                {en ? 'IN YOUR HONOR' : 'В ЧЕСТЬ ВАШЕЙ ПОБЕДЫ'}
              </div>
              <div style={{ fontSize: 13, color: '#eee', lineHeight: 1.5 }}>
                {en
                  ? 'A new highrise was built in your Victory City. Each win adds a building \u2014 over time you grow your own skyline.'
                  : 'В вашем Городе побед построена новая высотка. Каждая победа добавляет здание \u2014 со временем у вас вырастет свой небоскрёбный город.'}
              </div>
              {isLoggedIn && (
                <div style={{ fontSize: 12, color: '#3dd68c', marginTop: 8 }}>
                  {en
                    ? '+ achievement \u201cFirst Win\u201d, + 20 bricks for the skin shop'
                    : '+ ачивка \u00abПервая победа\u00bb, + 20 кирпичей в магазин скинов'}
                </div>
              )}
            </div>
            <button
              onClick={() => onComplete?.({ goToCity: true })}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: '#ffc145', color: '#1a1a28', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
              }}
            >
              {en ? 'Visit my Victory City' : 'Открыть мой Город побед'}
            </button>
            <button
              onClick={() => onComplete?.({ goToCity: false })}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)', background: 'none',
                color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {en ? 'Build another tower (start a real game)' : 'Построить ещё башню (начать настоящую игру)'}
            </button>
            {!isLoggedIn && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 14, lineHeight: 1.4 }}>
                {en
                  ? 'Tip: register to save your wins, achievements and bricks.'
                  : 'Совет: зарегистрируйтесь, чтобы сохранять победы, ачивки и кирпичи.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
