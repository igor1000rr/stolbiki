import { useState, useEffect } from 'react'
import { GameState, applyAction, GOLDEN_STAND, MAX_CHIPS } from '../engine/game'
import { useI18n } from '../engine/i18n'
import Board from './Board'

const STEPS = [
  {
    title: { ru: 'Установка блоков', en: 'Placing blocks' },
    text: {
      ru: 'Кликните на стойку 3, чтобы поставить блок. Первый ход — всегда 1 блок.',
      en: 'Click on stand 3 to place a block. First move is always 1 block.',
    },
    setup: (gs) => { gs.turn = 0; gs.currentPlayer = 0 },
    validClick: 3,
    action: { placement: { 3: 1 } },
  },
  {
    title: { ru: 'Обычный ход', en: 'Normal turn' },
    text: {
      ru: 'Теперь поставьте 2 блока: кликните на стойку 5 дважды. До 3 блоков на 2 стойки за ход.',
      en: 'Now place 2 blocks: click stand 5 twice. Up to 3 blocks on 2 stands per turn.',
    },
    setup: (gs) => {
      gs.stands[3] = [1] // от прошлого хода
      gs.turn = 2; gs.currentPlayer = 0; gs.swapAvailable = false
    },
    validClick: 5,
    clicksNeeded: 2,
    action: { placement: { 5: 2 } },
  },
  {
    title: { ru: 'Перенос блоков', en: 'Transferring blocks' },
    text: {
      ru: 'Перенос — ключевой элемент! Кликните на стойку 2 (откуда), потом на стойку 1 (куда). Переносить можно свои и чужие блоки.',
      en: 'Transfer is key! Click stand 2 (from), then stand 1 (to). You can move your own and opponent\'s blocks.',
    },
    setup: (gs) => {
      gs.stands[1] = [0,0,0,0,0,0,0,0] // 8 наших
      gs.stands[2] = [0,0,0] // 3 наших для переноса
      gs.turn = 6; gs.currentPlayer = 0; gs.swapAvailable = false
    },
    isTransfer: true,
    validFrom: 2, validTo: 1,
    action: { transfer: [2, 1], placement: {} },
    afterText: {
      ru: 'Высотка 1 достроена! При 11+ блоках высотка достроена. Цвет верхней группы — владелец.',
      en: 'Highrise 1 is complete! At 11+ blocks the highrise is complete. Top group color = owner.',
    },
  },
  {
    title: { ru: 'Золотая стойка ★', en: 'Golden stand ★' },
    text: {
      ru: 'Стойка ★ (0) решает при ничьей 5:5. Поставьте 3 блока на неё — кликните 3 раза.',
      en: 'Stand ★ (0) breaks 5:5 ties. Place 3 blocks on it — click 3 times.',
    },
    setup: (gs) => {
      gs.stands[0] = [0,0,0,0,0] // 5 фишек на золотой
      gs.closed = { 1: 0, 2: 0, 3: 1, 4: 1 } // 2:2
      gs.turn = 10; gs.currentPlayer = 0; gs.swapAvailable = false
    },
    validClick: 0,
    clicksNeeded: 3,
    action: { placement: { 0: 3 } },
  },
  {
    title: { ru: 'Победа!', en: 'Victory!' },
    text: {
      ru: 'Достройте 6 из 10 высоток — и вы победили! Или при 5:5 — владелец ★ выигрывает. Теперь вы готовы играть!',
      en: 'Complete 6 of 10 highrises to win! Or at 5:5, the ★ owner wins. Now you\'re ready to play!',
    },
    setup: (gs) => {
      gs.closed = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 1 }
      gs.turn = 20; gs.currentPlayer = 0; gs.swapAvailable = false; gs.gameOver = true; gs.winner = 0
    },
    isFinal: true,
  },
]

export default function Tutorial({ onClose }) {
  const { t, lang } = useI18n()
  const [step, setStep] = useState(0)
  const [gs, setGs] = useState(() => { const s = new GameState(); STEPS[0].setup(s); return s })
  const [clicks, setClicks] = useState(0)
  const [transferPhase, setTransferPhase] = useState(null) // null | 'from' | 'to'
  const [showAfter, setShowAfter] = useState(false)
  const [placement, setPlacement] = useState({})

  const current = STEPS[step]

  function advanceStep() {
    const next = step + 1
    if (next >= STEPS.length) { onClose(); return }
    const newGs = new GameState()
    STEPS[next].setup(newGs)
    setGs(newGs)
    setStep(next)
    setClicks(0)
    setTransferPhase(null)
    setShowAfter(false)
    setPlacement({})
  }

  function onStandClick(i) {
    if (current.isFinal || showAfter) return

    // Перенос
    if (current.isTransfer) {
      if (!transferPhase || transferPhase === 'from') {
        if (i === current.validFrom) { setTransferPhase('to'); return }
        return
      }
      if (transferPhase === 'to') {
        if (i === current.validTo) {
          const ns = applyAction(gs, current.action)
          setGs(ns)
          setShowAfter(true)
          setPlacement({})
        }
        return
      }
      return
    }

    // Установка
    if (i !== current.validClick) return
    const needed = current.clicksNeeded || 1
    const newClicks = clicks + 1
    setClicks(newClicks)
    setPlacement(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }))

    if (newClicks >= needed) {
      // Применяем ход
      setTimeout(() => {
        const ns = applyAction(gs, current.action)
        setGs(ns)
        setPlacement({})
        if (current.afterText) setShowAfter(true)
        else setTimeout(advanceStep, 800)
      }, 300)
    }
  }

  const highlight = current.isTransfer
    ? (transferPhase === 'to' ? current.validTo : current.validFrom)
    : current.validClick

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '16px' }}>
      <div style={{ maxWidth: 480, width: '100%', margin: 'auto' }}>
        {/* Прогресс */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--surface3)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Шаг */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4 }}>
            {step + 1} / {STEPS.length}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {current.title[lang] || current.title.ru}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, padding: '0 8px' }}>
            {showAfter
              ? (current.afterText?.[lang] || current.afterText?.ru)
              : (current.text[lang] || current.text.ru)
            }
          </div>
        </div>

        {/* Подсветка целевой стойки */}
        <style>{`
          .tutorial-board .stand:nth-child(${(highlight ?? -1) + 1}) {
            box-shadow: 0 0 16px var(--accent-glow), 0 0 4px var(--accent) !important;
            border-color: var(--accent) !important;
            animation: tutorialPulse 1.2s ease-in-out infinite;
          }
          @keyframes tutorialPulse {
            0%, 100% { box-shadow: 0 0 16px var(--accent-glow); }
            50% { box-shadow: 0 0 28px var(--accent-glow), 0 0 8px var(--accent); }
          }
        `}</style>

        <div className="tutorial-board">
          <Board state={gs} pending={placement} selected={null} phase="place"
            humanPlayer={0} onStandClick={onStandClick} aiThinking={false} />
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          {(showAfter || current.isFinal) && (
            <button className="btn primary" onClick={current.isFinal ? onClose : advanceStep}
              style={{ fontSize: 14, padding: '10px 24px' }}>
              {current.isFinal
                ? t('tutorial.start')
                : t('tutorial.next')
              }
            </button>
          )}
          <button className="btn" onClick={onClose} style={{ fontSize: 11, padding: '6px 12px' }}>
            {t('tutorial.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
