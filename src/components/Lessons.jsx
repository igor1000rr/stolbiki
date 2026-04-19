/**
 * Lessons — 5 интерактивных уроков
 * Каждый: текст + задание на интерактивной доске
 */
import { useState, useEffect } from 'react'
import { GameState, getValidTransfers } from '../engine/game'
import Board from './Board'
import Mascot from './Mascot'
import { useI18n } from '../engine/i18n'
import * as API from '../engine/api'

const LESSONS = [
  {
    id: 'basics',
    title_ru: 'Основы: ставьте блоки',
    title_en: 'Basics: place blocks',
    desc_ru: 'Каждый ход ставьте до 3 блоков на 1-2 стойки. Первый ход — только 1 блок.\n\nЗадание: поставьте 1 блок на любую стойку и нажмите ✓.',
    desc_en: 'Each turn place up to 3 blocks on 1-2 stands. First turn — only 1 block.\n\nTask: place 1 block on any stand and press ✓.',
    setup: () => { const gs = new GameState(); return gs },
    goal: (gs, action) => {
      const totalPlaced = Object.values(action.placement || {}).reduce((a, b) => a + b, 0)
      return totalPlaced === 1 && !action.transfer
    },
    xp: 10,
  },
  {
    id: 'transfer',
    title_ru: 'Перенос: ключевой приём',
    title_en: 'Transfer: key tactic',
    desc_ru: 'Перенос перемещает верхнюю группу блоков с одной стойки на другую. Это меняет контроль!\n\nЗадание: выполните перенос со стойки 3 на стойку 5.',
    desc_en: 'Transfer moves the top group of blocks from one stand to another. This changes control!\n\nTask: transfer from stand 3 to stand 5.',
    setup: () => {
      const gs = new GameState()
      gs.turn = 6; gs.currentPlayer = 0
      gs.stands[2] = [0, 0, 1, 1, 0, 0] // Stand 3: blue on top
      gs.stands[4] = [1, 1, 1] // Stand 5: some red
      gs.stands[0] = [0, 1, 0, 1, 0] // Stand 1
      gs.stands[7] = [1, 0, 1] // Stand 8
      return gs
    },
    goal: (gs, action) => {
      return action.transfer && action.transfer[0] === 2 && action.transfer[1] === 4
    },
    xp: 15,
  },
  {
    id: 'golden',
    title_ru: 'Золотая стойка',
    title_en: 'Golden stand',
    desc_ru: 'Стойка #1 (золотая ★) решает при ничьей 5:5. Кто её контролирует — побеждает!\n\nЗадание: поставьте блоки на золотую стойку (#1) чтобы получить контроль.',
    desc_en: 'Stand #1 (golden ★) breaks 5:5 ties. Who controls it wins!\n\nTask: place blocks on the golden stand (#1) to take control.',
    setup: () => {
      const gs = new GameState()
      gs.turn = 6; gs.currentPlayer = 0
      gs.stands[0] = [1, 0, 1, 1, 0, 1, 0, 1] // Golden — red on top
      gs.stands[1] = [0, 0, 1, 0, 1]
      gs.stands[3] = [1, 0, 0, 1]
      gs.stands[6] = [0, 1, 1, 0, 0, 1]
      return gs
    },
    goal: (gs, action) => {
      return action.placement && (0 in action.placement) && action.placement[0] > 0
    },
    xp: 15,
  },
  {
    id: 'closing',
    title_ru: 'Закрытие стоек',
    title_en: 'Closing stands',
    desc_ru: 'Когда стойка набирает 11 блоков — высотка достроена. Цвет верхней группы = владелец. Достройте 6 из 10 чтобы победить!\n\nЗадание: поставьте блоки чтобы достроить высотку #4 (нужно довести до 11 блоков).',
    desc_en: 'When a stand reaches 11 blocks it is complete. Top group color = owner. Complete 6 of 10 to win!\n\nTask: place blocks to complete stand #4 (bring to 11 blocks).',
    setup: () => {
      const gs = new GameState()
      gs.turn = 8; gs.currentPlayer = 0
      gs.stands[3] = [0, 1, 0, 0, 1, 0, 0, 1, 0] // 9 блоков, нужно ещё 2
      gs.stands[0] = [0, 1, 0, 1, 0]
      gs.stands[5] = [1, 0, 1, 0]
      gs.stands[8] = [0, 0, 1]
      return gs
    },
    goal: (gs, action) => {
      return action.placement && (3 in action.placement) && action.placement[3] >= 2
    },
    xp: 20,
  },
  {
    id: 'strategy',
    title_ru: 'Стратегия: контроль центра',
    title_en: 'Strategy: center control',
    desc_ru: 'Опытные игроки контролируют центральные стойки — они ближе к достройке. Размещайте блоки стратегически!\n\nЗадание: поставьте блоки на 2 разные стойки одновременно.',
    desc_en: 'Experienced players control central stands — they\'re closer to completion. Place blocks strategically!\n\nTask: place blocks on 2 different stands at once.',
    setup: () => {
      const gs = new GameState()
      gs.turn = 6; gs.currentPlayer = 0
      gs.stands[4] = [0, 1, 0, 1, 0, 1]
      gs.stands[5] = [1, 0, 1, 0, 1]
      gs.stands[2] = [0, 0, 1]
      gs.stands[7] = [1, 1, 0]
      return gs
    },
    goal: (gs, action) => {
      return action.placement && Object.keys(action.placement).length >= 2
    },
    xp: 20,
  },
]

export default function Lessons({ onClose }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [lessonIdx, setLessonIdx] = useState(0)
  const [gs, setGs] = useState(null)
  const [placement, setPlacement] = useState({})
  const [transfer, setTransfer] = useState(null)
  const [phase, setPhase] = useState('place')
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState(null) // null | 'correct' | 'wrong'
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stolbiki_lessons') || '[]') } catch { return [] }
  })

  const lesson = LESSONS[lessonIdx]

  useEffect(() => {
    if (!lesson) return
    const state = lesson.setup()
    setGs(state); setPlacement({}); setTransfer(null); setPhase('place')
    setSelected(null); setStatus(null)
  }, [lessonIdx])

  function handleStandClick(i) {
    if (status) return
    if (phase === 'transfer-target') {
      if (selected !== null && gs && getValidTransfers(gs).some(([s, d]) => s === selected && d === i)) {
        setTransfer([selected, i]); setSelected(null); setPhase('place')
      }
      return
    }
    if (!gs || gs.standSpace(i) <= 0 || (i in gs.closed)) return
    const maxTotal = gs.isFirstTurn() ? 1 : 3
    const currentTotal = Object.values(placement).reduce((a, b) => a + b, 0)
    if (i in placement) {
      const cur = placement[i]
      if (currentTotal < maxTotal && gs.standSpace(i) - cur > 0) {
        setPlacement({ ...placement, [i]: cur + 1 })
      } else {
        const np = { ...placement }; delete np[i]; setPlacement(np)
      }
    } else {
      if (Object.keys(placement).length >= 2 || currentTotal >= maxTotal) return
      setPlacement({ ...placement, [i]: 1 })
    }
  }

  function confirm() {
    const action = { placement: { ...placement }, transfer: transfer || undefined, swap: false }
    if (lesson.goal(gs, action)) {
      setStatus('correct')
      if (!completed.includes(lesson.id)) {
        const nc = [...completed, lesson.id]
        setCompleted(nc)
        localStorage.setItem('stolbiki_lessons', JSON.stringify(nc))
        if (API.isLoggedIn()) API.missionProgress('solve_puzzle').catch(() => {})
      }
    } else {
      setStatus('wrong')
    }
  }

  function next() {
    if (lessonIdx < LESSONS.length - 1) setLessonIdx(lessonIdx + 1)
    else onClose?.()
  }

  function retry() {
    const state = lesson.setup()
    setGs(state); setPlacement({}); setTransfer(null); setPhase('place')
    setSelected(null); setStatus(null)
  }

  if (!lesson || !gs) return null

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0)
  const maxTotal = gs.isFirstTurn() ? 1 : 3
  const canConfirm = totalPlaced > 0 && totalPlaced <= maxTotal
  const allDone = completed.length >= LESSONS.length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          <Mascot pose="point" size={32} animate={false} />
          {en ? 'Lesson' : 'Урок'} {lessonIdx + 1} / {LESSONS.length}
        </div>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {LESSONS.map((l, i) => (
            <div key={i} onClick={() => setLessonIdx(i)} style={{
              width: 10, height: 10, borderRadius: '50%', cursor: 'pointer',
              background: completed.includes(l.id) ? 'var(--green)' : i === lessonIdx ? 'var(--p1)' : 'var(--surface2)',
              border: i === lessonIdx ? '2px solid var(--p1)' : '2px solid transparent',
            }} />
          ))}
        </div>
        <button className="btn" onClick={onClose} style={{ fontSize: 11, padding: '6px 12px' }}>
          {en ? 'Exit' : 'Выход'}
        </button>
      </div>

      {/* Content */}
      <div className="lessons-content" style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
        {/* Left: lesson text */}
        <div className="lessons-text" style={{ width: 300, padding: 20, borderRight: '1px solid var(--surface2)', overflow: 'auto', flexShrink: 0 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>
            {en ? lesson.title_en : lesson.title_ru}
          </h3>
          <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {en ? lesson.desc_en : lesson.desc_ru}
          </div>

          {status === 'correct' && (
            <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mascot pose="celebrate" size={48} animate={false} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                  {en ? 'Correct!' : 'Правильно!'} +{lesson.xp} XP
                </div>
                <button className="btn primary" onClick={next} style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                  {lessonIdx < LESSONS.length - 1 ? (en ? 'Next lesson' : 'Следующий урок') : (en ? 'Complete!' : 'Завершить!')}
                </button>
              </div>
            </div>
          )}

          {status === 'wrong' && (
            <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,96,102,0.08)', border: '1px solid rgba(255,96,102,0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--p2)', marginBottom: 4 }}>
                {en ? 'Not quite — try again!' : 'Не совсем — попробуйте ещё!'}
              </div>
              <button className="btn" onClick={retry} style={{ marginTop: 8 }}>
                {en ? 'Retry' : 'Заново'}
              </button>
            </div>
          )}

          {allDone && status !== 'correct' && (
            <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,193,69,0.08)', border: '1px solid rgba(255,193,69,0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                {en ? 'All lessons completed!' : 'Все уроки пройдены!'}
              </div>
            </div>
          )}
        </div>

        {/* Right: interactive board */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 480 }}>
            <Board gs={gs} humanPlayer={0} placement={placement} transfer={transfer}
              onStandClick={!status ? handleStandClick : undefined} locked={!!status} selectedStand={selected} />
          </div>

          {!status && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {lesson.id !== 'basics' && (
                <button className="btn" onClick={() => { setPhase('transfer-target'); setSelected(null) }}
                  style={{ fontSize: 11, padding: '6px 12px' }}>↗ {en ? 'Transfer' : 'Перенос'}</button>
              )}
              <button className="btn primary" disabled={!canConfirm} onClick={confirm}
                style={{ fontSize: 13, padding: '10px 24px' }}>
                ✓ {en ? 'Confirm' : 'Подтвердить'}
              </button>
              <button className="btn" onClick={() => { setPlacement({}); setTransfer(null); setSelected(null); setPhase('place') }}
                style={{ fontSize: 11, padding: '6px 12px' }}>↺</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
