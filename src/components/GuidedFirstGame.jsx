/**
 * GuidedFirstGame — интерактивный сценарий первой партии.
 *
 * Запускается один раз для нового авторизованного игрока (флаг stolbiki_guided_done).
 * Поле — готовая боевая позиция (середина игры): 7 закрытых стоек, 3 открытых.
 * AI ходит автоматически с задержкой 1.5с. Игрок кликает только по подсвеченной
 * стойке — компонент валидирует, что клик соответствует ожидаемому подшагу.
 *
 * После победы:
 *   1. API.recordGame({ won: true, ... }) — поднимает gamesPlayed, wins, активирует
 *      ачивку first_win через серверный checkAchievements. Если бэк начисляет
 *      кирпичи за ачивку — придут автоматически. Если нет — добавим явный award.
 *   2. localStorage.stolbiki_open_city = '1' — Profile.jsx прочитает и сразу
 *      откроет вкладку Город побед.
 *   3. Модалка «Открыть Город побед».
 *
 * Собственный мини-движок (не engine/game-engine), потому что:
 *   - Сценарий жёстко скриптован, движок не нужен
 *   - Не ломаем Game.jsx
 *   - Полный контроль над UI/UX подсказок
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '../engine/i18n'
import * as API from '../engine/api'
import Mascot from './Mascot'

const TOTAL_STANDS = 10
const STAND_CAP = 11      // блоков для закрытия высотки
const GOLDEN_INDEX = 4    // золотая стойка
const AI_DELAY_MS = 1400  // пауза между ходами AI для читаемости

// 'P' = закрыта игроком, 'A' = закрыта AI, иначе массив блоков 'B'/'R' (снизу вверх)
const INITIAL_STANDS = [
  'P', 'P', 'P',
  ['B','R','R','B','B','B','B','B','R'],   // index 3 = «1»
  ['B','B','R','B','R','B','B'],            // index 4 = «2» (golden)
  [],                                        // index 5 = «3»
  'A', 'A', 'A', 'A',
]

// Сценарий партии. Stand-индексы — реальные (3,4,5 = «1»,«2»,«3» в подсказках).
const STEPS = [
  { actor: 'intro',
    ru: 'Привет! Я Снэппи. За одну короткую партию покажу все правила — читать ничего не надо. В финале ты построишь первую высотку в Городе побед.',
    en: 'Hi! I am Snappy. One short game and you know all the rules — no reading needed. At the end you build your first highrise in Victory City.',
    mascot: 'wave',
  },
  { actor: 'intro',
    ru: 'Поле — 10 высоток. Закрой 6 из 10, чтобы победить. Высотка закрывается, когда в ней 11 блоков. Цвет верхнего блока — владелец. Сейчас 7 уже закрыты, осталось 3.',
    en: 'Board: 10 highrises. Close 6 of 10 to win. A highrise closes at 11 blocks. The top block colour decides the owner. 7 are already closed, 3 to go.',
    mascot: 'think',
  },
  { actor: 'ai',
    ru: 'AI ставит R на высотку 1 и RR на золотую 2. За ход — до 3 блоков максимум на 2 высотки.',
    en: 'AI places R on highrise 1 and RR on golden 2. Per turn — up to 3 blocks on at most 2 highrises.',
    actions: [{ stand: 3, blocks: 'R' }, { stand: 4, blocks: 'RR' }],
  },
  { actor: 'player',
    ru: 'Твой ход. Главный приём — перенос верхушки. Возьми верхние RR с высотки 1 и перенеси на пустую 3. Кликни на высотку 1.',
    en: 'Your turn. The key trick — transfer the top group. Take the RR top from highrise 1 and move it to empty 3. Click highrise 1.',
    expected: { kind: 'transfer-from', stand: 3 },
  },
  { actor: 'player',
    ru: 'Теперь кликни на пустую 3 — RR переедет туда.',
    en: 'Now click empty 3 — RR moves there.',
    expected: { kind: 'transfer-to', stand: 5 },
  },
  { actor: 'player',
    ru: 'Теперь поставь 2 синих на 3 (твой цвет — Blue). Кликни на 3 дважды.',
    en: 'Now place 2 blue on highrise 3 (your colour is Blue). Click 3 twice.',
    expected: { kind: 'place', stand: 5, count: 2, color: 'B' },
  },
  { actor: 'player',
    ru: 'И ещё 1 синий на золотую 2. Кликни на 2.',
    en: 'And 1 more blue on golden 2. Click 2.',
    expected: { kind: 'place', stand: 4, count: 1, color: 'B' },
  },
  { actor: 'ai',
    ru: 'AI добавляет RR на высотку 1.',
    en: 'AI adds RR on highrise 1.',
    actions: [{ stand: 3, blocks: 'RR' }],
  },
  { actor: 'player',
    ru: 'Перенеси BB с 3 на золотую 2 — она закроется за тебя, и это +1 к шести! Кликни 3.',
    en: 'Transfer BB from 3 to golden 2 — it closes for you, that is +1 toward six! Click 3.',
    expected: { kind: 'transfer-from', stand: 5 },
  },
  { actor: 'player',
    ru: 'Кликни на золотую 2.',
    en: 'Click golden 2.',
    expected: { kind: 'transfer-to', stand: 4 },
  },
  { actor: 'player',
    ru: 'Поставь 3 синих на пустую 3 (кликай 3 трижды).',
    en: 'Place 3 blue on empty 3 (click 3 three times).',
    expected: { kind: 'place', stand: 5, count: 3, color: 'B' },
  },
  { actor: 'ai',
    ru: 'AI закрывает 1 за себя (R) и ставит R на 3, перебивая твою верхушку.',
    en: 'AI closes 1 for itself (R) and places R on 3, overtaking your top.',
    actions: [{ stand: 3, blocks: 'R' }, { stand: 5, blocks: 'R' }],
  },
  { actor: 'player',
    ru: 'Поставь B на 3 — вернёшь верхушку.',
    en: 'Place B on 3 — take the top back.',
    expected: { kind: 'place', stand: 5, count: 1, color: 'B' },
  },
  { actor: 'ai',
    ru: 'AI идёт ва-банк: RRR на 3.',
    en: 'AI goes all-in: RRR on 3.',
    actions: [{ stand: 5, blocks: 'RRR' }],
  },
  { actor: 'player',
    ru: 'Финальный B на 3 — закрывает последнюю высотку за тебя. Это победа!',
    en: 'Final B on 3 — closes the last highrise for you. This is the win!',
    expected: { kind: 'place', stand: 5, count: 1, color: 'B' },
  },
  { actor: 'victory' },
]

function isClosed(stand) { return stand === 'P' || stand === 'A' }

export default function GuidedFirstGame({ onComplete, onSkip }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [stands, setStands] = useState(() => INITIAL_STANDS.map(s => Array.isArray(s) ? [...s] : s))
  const [stepIdx, setStepIdx] = useState(0)
  const [transferSource, setTransferSource] = useState(null)
  const [placedInSubstep, setPlacedInSubstep] = useState(0)
  const [shake, setShake] = useState(null)
  const [recordPending, setRecordPending] = useState(false)
  const aiTimer = useRef(null)

  const step = STEPS[stepIdx]
  const text = step ? (en ? step.en : step.ru) : ''

  // ─── Перейти к следующему шагу ───
  const advance = useCallback(() => {
    setTransferSource(null)
    setPlacedInSubstep(0)
    setStepIdx(i => i + 1)
  }, [])

  // ─── Авто-проигрывание AI ходов ───
  useEffect(() => {
    if (!step || step.actor !== 'ai') return
    aiTimer.current = setTimeout(() => {
      setStands(prev => {
        const next = prev.map(s => Array.isArray(s) ? [...s] : s)
        for (const a of step.actions) {
          if (Array.isArray(next[a.stand])) {
            for (const ch of a.blocks) next[a.stand].push(ch)
            if (next[a.stand].length >= STAND_CAP) {
              const top = next[a.stand][next[a.stand].length - 1]
              next[a.stand] = top === 'R' ? 'A' : 'P'
            }
          }
        }
        return next
      })
      setTimeout(advance, 800)
    }, AI_DELAY_MS)
    return () => clearTimeout(aiTimer.current)
  }, [stepIdx, step, advance])

  // ─── Финал: запись партии и награды ───
  useEffect(() => {
    if (!step || step.actor !== 'victory' || recordPending) return
    setRecordPending(true)
    let cancelled = false
    const tasks = [
      API.recordGame({ won: true, score: '6:4', difficulty: 50, isOnline: false })
        .catch(() => null),
    ]
    if (typeof API.awardBricks === 'function') {
      tasks.push(API.awardBricks(50, 'first_win_tutorial').catch(() => null))
    }
    Promise.all(tasks).then(() => { if (cancelled) return })
    return () => { cancelled = true }
  }, [step, recordPending])

  // ─── Клик игрока по стойке ───
  function handleStandClick(idx) {
    if (!step || step.actor !== 'player') return
    const exp = step.expected
    if (!exp) return

    if (exp.kind === 'transfer-from') {
      if (idx !== exp.stand) { setShake(idx); setTimeout(() => setShake(null), 400); return }
      const stand = stands[idx]
      if (!Array.isArray(stand) || stand.length === 0) return
      const top = stand[stand.length - 1]
      let groupSize = 0
      for (let i = stand.length - 1; i >= 0; i--) { if (stand[i] === top) groupSize++; else break }
      setTransferSource({ from: idx, color: top, count: groupSize })
      advance()
      return
    }

    if (exp.kind === 'transfer-to') {
      if (idx !== exp.stand) { setShake(idx); setTimeout(() => setShake(null), 400); return }
      if (!transferSource) return
      setStands(prev => {
        const next = prev.map(s => Array.isArray(s) ? [...s] : s)
        const src = next[transferSource.from]
        if (!Array.isArray(src)) return prev
        for (let i = 0; i < transferSource.count; i++) src.pop()
        const dst = next[idx]
        if (!Array.isArray(dst)) return prev
        for (let i = 0; i < transferSource.count; i++) dst.push(transferSource.color)
        if (dst.length >= STAND_CAP) {
          const top = dst[dst.length - 1]
          next[idx] = top === 'B' ? 'P' : 'A'
        }
        return next
      })
      advance()
      return
    }

    if (exp.kind === 'place') {
      if (idx !== exp.stand) { setShake(idx); setTimeout(() => setShake(null), 400); return }
      const newCount = placedInSubstep + 1
      setStands(prev => {
        const next = prev.map(s => Array.isArray(s) ? [...s] : s)
        if (Array.isArray(next[idx])) {
          next[idx].push(exp.color)
          if (next[idx].length >= STAND_CAP) {
            const top = next[idx][next[idx].length - 1]
            next[idx] = top === 'B' ? 'P' : 'A'
          }
        }
        return next
      })
      if (newCount >= exp.count) advance()
      else setPlacedInSubstep(newCount)
    }
  }

  // ─── Подсветка ожидаемой стойки ───
  function highlightFor(idx) {
    if (!step || step.actor !== 'player') return null
    const exp = step.expected
    if (!exp) return null
    if (idx === exp.stand) return 'pulse'
    return null
  }

  // ─── Стойка, с которой идёт перенос ───
  function transferTopFor(idx) {
    if (!transferSource) return 0
    if (idx !== transferSource.from) return 0
    return transferSource.count
  }

  if (!step) return null

  const isVictory = step.actor === 'victory'
  const introOrAI = step.actor === 'intro' || step.actor === 'ai'

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink3)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {en ? 'Tutorial' : 'Обучение'} · {Math.min(stepIdx + 1, STEPS.length)} / {STEPS.length}
          </div>
          {!isVictory && (
            <button onClick={onSkip} style={skipBtnStyle}>
              {en ? 'Skip' : 'Пропустить'}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{
            width: `${((stepIdx + 1) / STEPS.length) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent), var(--gold))',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Board */}
        {!isVictory && (
          <div style={boardWrapStyle}>
            {stands.map((stand, idx) => (
              <StandView
                key={idx}
                stand={stand}
                index={idx}
                userIndex={idx >= 3 && idx <= 5 ? (idx - 2) : null}
                isGolden={idx === GOLDEN_INDEX}
                highlight={highlightFor(idx)}
                shake={shake === idx}
                transferTop={transferTopFor(idx)}
                onClick={() => handleStandClick(idx)}
              />
            ))}
          </div>
        )}

        {/* Hint bubble + mascot */}
        <div style={hintRowStyle}>
          <div style={{ flexShrink: 0 }}>
            <Mascot pose={step.mascot || (step.actor === 'ai' ? 'think' : step.actor === 'victory' ? 'celebrate' : 'wave')} size={56} />
          </div>
          <div style={hintBubbleStyle}>
            {isVictory ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>
                  {en ? 'Victory!' : 'Победа!'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
                  {en
                    ? 'A new highrise was built in your Victory City. Achievement First Win unlocked + 50 bricks for skins.'
                    : 'В честь твоей победы в Городе побед построена высотка. Получена ачивка «Первая победа» и 50 кирпичей на скины.'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{text}</div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {introOrAI && (
            <button
              onClick={step.actor === 'intro' ? advance : null}
              style={primaryBtnStyle}
              disabled={step.actor === 'ai'}
            >
              {step.actor === 'ai'
                ? (en ? 'AI is thinking...' : 'AI ходит...')
                : (stepIdx === 0 ? (en ? 'Start' : 'Начать') : (en ? 'Next' : 'Дальше'))}
            </button>
          )}
          {isVictory && (
            <>
              <button
                onClick={() => {
                  localStorage.setItem('stolbiki_guided_done', '1')
                  localStorage.setItem('stolbiki_open_city', '1')
                  onComplete && onComplete({ goCity: true })
                }}
                style={primaryBtnStyle}
              >
                {en ? 'Open Victory City' : 'Открыть Город побед'}
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('stolbiki_guided_done', '1')
                  onComplete && onComplete({ goCity: false })
                }}
                style={secondaryBtnStyle}
              >
                {en ? 'Play again' : 'Играть ещё'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Подкомпонент: стойка ───
function StandView({ stand, userIndex, isGolden, highlight, shake, transferTop, onClick }) {
  const closed = isClosed(stand)
  const blocks = Array.isArray(stand) ? stand : []
  const totalSlots = STAND_CAP

  const baseStyle = {
    width: 36,
    minHeight: 200,
    borderRadius: 6,
    background: closed
      ? (stand === 'P' ? 'rgba(74,158,255,0.15)' : 'rgba(255,90,90,0.15)')
      : 'rgba(255,255,255,0.04)',
    border: `1px solid ${closed
      ? (stand === 'P' ? '#4a9eff' : '#ff5a5a')
      : (highlight === 'pulse' ? '#ffc145' : 'var(--surface3)')}`,
    cursor: closed ? 'default' : 'pointer',
    display: 'flex',
    flexDirection: 'column-reverse',
    padding: 3,
    gap: 2,
    transition: 'all 0.15s',
    position: 'relative',
    boxShadow: highlight === 'pulse' ? '0 0 12px rgba(255,193,69,0.6)' : 'none',
    animation: shake ? 'shakeX 0.4s' : (highlight === 'pulse' ? 'pulse 1.2s ease-in-out infinite' : 'none'),
  }

  return (
    <div onClick={!closed ? onClick : undefined} style={baseStyle}>
      {/* Метка снизу */}
      {userIndex && (
        <div style={{
          position: 'absolute', bottom: -22, left: 0, right: 0,
          textAlign: 'center', fontSize: 11, fontWeight: 700,
          color: highlight === 'pulse' ? '#ffc145' : 'var(--ink3)',
        }}>
          {userIndex}{isGolden && ' ★'}
        </div>
      )}

      {/* Закрытая высотка */}
      {closed && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: stand === 'P' ? '#4a9eff' : '#ff5a5a' }}>
            {stand === 'P' ? 'BLUE' : 'RED'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink3)' }}>closed</div>
          {isGolden && <div style={{ fontSize: 14, color: 'var(--gold)' }}>★</div>}
        </div>
      )}

      {/* Блоки */}
      {!closed && blocks.map((b, i) => {
        const isTop = transferTop > 0 && i >= blocks.length - transferTop
        return (
          <div key={i} style={{
            height: 13,
            borderRadius: 2,
            background: b === 'B' ? '#4a9eff' : '#ff5a5a',
            opacity: isTop ? 0.4 : 1,
            border: isTop ? '1px dashed #ffc145' : 'none',
            transition: 'opacity 0.2s',
          }} />
        )
      })}

      {/* Counter */}
      {!closed && (
        <div style={{
          position: 'absolute', top: -18, left: 0, right: 0, textAlign: 'center',
          fontSize: 9, color: blocks.length >= 9 ? 'var(--gold)' : 'var(--ink3)', fontWeight: 600,
        }}>
          {blocks.length}/{STAND_CAP}
        </div>
      )}
    </div>
  )
}

// ─── Стили ───
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
  overflow: 'auto',
}

const panelStyle = {
  background: 'var(--surface)',
  borderRadius: 16,
  padding: '20px 24px',
  maxWidth: 720,
  width: '100%',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  maxHeight: '95vh',
  overflowY: 'auto',
}

const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
}

const skipBtnStyle = {
  background: 'none', border: '1px solid var(--surface3)', color: 'var(--ink3)',
  fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
}

const boardWrapStyle = {
  display: 'flex', gap: 6, justifyContent: 'center',
  padding: '32px 8px 36px', marginBottom: 16,
  background: 'var(--bg)', borderRadius: 12,
  flexWrap: 'wrap',
}

const hintRowStyle = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  background: 'rgba(255,193,69,0.06)',
  border: '1px solid rgba(255,193,69,0.15)',
  borderRadius: 12, padding: '12px 14px',
}

const hintBubbleStyle = { flex: 1, minWidth: 0 }

const primaryBtnStyle = {
  flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, var(--accent), var(--gold))',
  color: 'var(--bg)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryBtnStyle = {
  flex: 1, padding: '12px 20px', borderRadius: 10,
  border: '1px solid var(--surface3)', background: 'var(--surface2)',
  color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
}
