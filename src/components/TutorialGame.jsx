/**
 * TutorialGame — обучающая партия из 3 шагов по ТЗ Александра (28.04.2026,
 * Проблема 3). Не более 1 минуты, чтобы игрок быстро понял что делать.
 *
 * Расстановки и логика взяты дословно из ТЗ:
 *
 * Шаг 1. ПЕРЕХВАТ — первая часть каждого хода (можно пропустить).
 *   Стойки:
 *     1 (золотая): BRRBBBBBR  — 9 блоков
 *     2:           BBRBRBB     — 7 блоков
 *     3:           пустая
 *     4:           RRRBRBB     — 7 блоков
 *     5:           RRRBRBBRR   — 9 блоков
 *   - Вертикальные стрелки на 4 непустые стойки
 *   - После нажатия верх выбранной стойки выделяется
 *   - Стрелки появляются на стойки с верхом такого же цвета и над пустой
 *   - После переноса автопереход к шагу 2
 *
 * Шаг 2. УСТАНОВКА — обязательная вторая часть хода.
 *   Стойки:
 *     1 (золотая): BRRBBBBBR  — 9 блоков (специально, чтобы игрок попробовал лимит 10)
 *     2:           BB          — 2 блока
 *     3:           пустая
 *   - Вертикальные стрелки над каждой стойкой
 *   - Можно от 1 до 3 блоков, на 1 или 2 стойках, до 10 этажа
 *   - На 3-м блоке автопереход к шагу 3
 *
 * Шаг 3. ЗАВЕРШЕНИЕ (11 этаж).
 *   Стойки:
 *     1 (золотая): BRRBBBR     — 7 блоков
 *     2:           BBRBBBRRB   — 9 блоков
 *     3:           RRBRRRRRR   — 9 блоков
 *   - Стрелка на 3 → игрок нажимает
 *   - Стрелка на 1 → игрок нажимает (перенос RR на BRRBBBR → BRRBBBRRR... нет, упрощаем)
 *   - Закрытие 1 стойки с эффектами
 *   - Snappy: 'Обучение пройдено. Ну наконец-то.'
 *
 * Окно с подсказками — над башнями посередине (фиксировано вверху).
 * Кнопки как в обычной игре (.btn). Поле упрощённое (без таймеров и счёта).
 */
import { useState, useEffect, useCallback } from 'react'
import '../css/game.css'
import '../css/tutorial.css'
import Snappy, { triggerSnappy } from './Snappy'

// Цвета: 0 = blue (B), 1 = red (R)
const B = 0
const R = 1

// Хелпер: парсинг строки цветов вида "BRRBBBBBR" в массив [0,1,1,0,0,0,0,0,1]
function parseStr(s) {
  return s.split('').map(c => c === 'B' ? B : R)
}

const STEPS = [
  {
    id: 'intercept',
    titleRu: 'Шаг 1. Перехват',
    titleEn: 'Step 1. Intercept',
    hintRu: 'Нажми на любую стойку, её верх будет готов к переносу. Перенеси на такой же цвет или на пустую стойку.',
    hintEn: 'Tap any stand — its top will be ready to transfer. Move it onto the same color or an empty stand.',
    initialStands: [
      parseStr('BRRBBBBBR'),  // золотая
      parseStr('BBRBRBB'),
      [],
      parseStr('RRRBRBB'),
      parseStr('RRRBRBBRR'),
    ],
    goldenIdx: 0,
  },
  {
    id: 'placement',
    titleRu: 'Шаг 2. Установка',
    titleEn: 'Step 2. Placement',
    hintRu: 'За ход можно поставить от 1 до 3 блоков. Строить можно на 1 или 2 стойках. Только до 10 этажа.',
    hintEn: 'You can place 1-3 blocks per turn. On 1 or 2 stands. Only up to floor 10.',
    initialStands: [
      parseStr('BRRBBBBBR'),  // золотая, 9 блоков
      parseStr('BB'),
      [],
    ],
    goldenIdx: 0,
  },
  {
    id: 'finish',
    titleRu: 'Шаг 3. Завершение',
    titleEn: 'Step 3. Finish',
    hintRu: '11 этаж — только переносом. Лишние блоки сгорят. При 5:5 победит владелец золотой высотки.',
    hintEn: 'Floor 11 — only via transfer. Excess blocks burn. At 5:5 the golden tower owner wins.',
    initialStands: [
      parseStr('BRRBBBR'),     // золотая
      parseStr('BBRBBBRRB'),
      parseStr('RRBRRRRRR'),
    ],
    goldenIdx: 0,
  },
]

const MAX_FLOOR = 10  // лимит установки (11 — только перенос)
const PLAYER_COLOR = B  // игрок играет blue в обучении

/* ─── Подкомпонент стойки. Своя реализация, не Board.jsx — обучение
   использует упрощённую логику без game-engine. */
function TutorialStand({ chips, isGolden, isSelected, hasArrow, isClosed, onClick, label, highlightTop }) {
  let cls = 'stand tut-stand'
  if (isGolden) cls += ' golden'
  if (isClosed) cls += ' closed'
  if (isSelected) cls += ' selected'
  if (highlightTop) cls += ' tut-highlight-top'

  return (
    <div className={cls} onClick={onClick} role="button" tabIndex={0}>
      <span className="stand-label">{isGolden ? '★' : label}</span>
      {hasArrow && !isClosed && <div className="tut-arrow-down">▼</div>}
      {chips.map((c, j) => (
        <div key={j} className={`chip p${c} ${highlightTop && j === chips.length - 1 ? 'tut-chip-top' : ''}`} />
      ))}
    </div>
  )
}

export default function TutorialGame({ onClose, lang = 'ru' }) {
  const en = lang === 'en'

  const [stepIdx, setStepIdx] = useState(0)
  const [stands, setStands] = useState(STEPS[0].initialStands)
  const [selected, setSelected] = useState(null)        // индекс выбранной стойки (для transfer)
  const [placedCount, setPlacedCount] = useState(0)     // счётчик установленных блоков (шаг 2)
  const [placedAt, setPlacedAt] = useState([])          // на какие стойки уже клали (шаг 2, max 2)
  const [finishStep, setFinishStep] = useState(0)       // подшаг для шага 3 (0=жду нажатия 3, 1=жду нажатия 1, 2=закрытие)
  const [closedSet, setClosedSet] = useState(new Set()) // закрытые стойки (для finish-шага)
  const [errorMsg, setErrorMsg] = useState(null)        // временное сообщение об ошибке
  const [showFinalSnappy, setShowFinalSnappy] = useState(false) // показать tutorial_complete

  const step = STEPS[stepIdx]
  const numStands = step.initialStands.length

  // Сброс состояния при смене шага
  const goToStep = useCallback((newIdx) => {
    if (newIdx >= STEPS.length) {
      // Все шаги пройдены — показываем финальную фразу Snappy и закрываем
      setShowFinalSnappy(true)
      setTimeout(() => onClose?.(), 4000)
      return
    }
    setStepIdx(newIdx)
    setStands(STEPS[newIdx].initialStands)
    setSelected(null)
    setPlacedCount(0)
    setPlacedAt([])
    setFinishStep(0)
    setClosedSet(new Set())
    setErrorMsg(null)
  }, [onClose])

  // Авто-сброс error message
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 1800)
    return () => clearTimeout(t)
  }, [errorMsg])

  // Какие стойки имеют стрелку (зависит от шага и фазы)
  function getArrowSet() {
    const set = new Set()
    if (stepIdx === 0) {
      // Шаг 1: если ничего не выбрано — стрелки на непустые
      if (selected === null) {
        for (let i = 0; i < numStands; i++) {
          if (stands[i].length > 0) set.add(i)
        }
      } else {
        // Стрелки на стойки с верхом такого же цвета + пустые (кроме selected)
        const movedColor = stands[selected].at(-1)
        for (let i = 0; i < numStands; i++) {
          if (i === selected) continue
          if (stands[i].length === 0) set.add(i)
          else if (stands[i].at(-1) === movedColor) set.add(i)
        }
      }
    } else if (stepIdx === 1) {
      // Шаг 2: стрелки над всеми не закрытыми и не достигшими 10 этажа
      for (let i = 0; i < numStands; i++) {
        if (stands[i].length < MAX_FLOOR) set.add(i)
      }
    } else if (stepIdx === 2) {
      // Шаг 3: подшаг 0 → стрелка на 3 (i=2), подшаг 1 → стрелка на 1 (i=0)
      if (finishStep === 0) set.add(2)
      else if (finishStep === 1) set.add(0)
    }
    return set
  }

  function handleStandClick(i) {
    if (closedSet.has(i)) return

    if (stepIdx === 0) {
      // ШАГ 1: ПЕРЕХВАТ
      if (selected === null) {
        // Выбираем источник — должен быть непустым
        if (stands[i].length === 0) {
          setErrorMsg(en ? 'Empty stand — pick another' : 'Стойка пустая — выбери другую')
          return
        }
        setSelected(i)
      } else {
        // Выбираем цель
        if (i === selected) {
          // Отмена выбора
          setSelected(null)
          return
        }
        const movedColor = stands[selected].at(-1)
        const targetTop = stands[i].at(-1)
        if (stands[i].length > 0 && targetTop !== movedColor) {
          // По ТЗ Александра: «Когда игрок пытается закрыть чужую стойку,
          // Snappy выскочил с фразой Чужую не трогай!». В шаге 1 это
          // попытка перенести на стойку с верхом другого цвета — что и есть
          // «чужая» в контексте обучения.
          triggerSnappy('tutorial_wrong_target')
          setErrorMsg(en ? 'Different color — pick same color or empty' : 'Другой цвет — нужен такой же или пустая')
          return
        }
        // Выполняем перенос
        const newStands = stands.map((s, idx) => {
          if (idx === selected) return s.slice(0, -1)
          if (idx === i) return [...s, movedColor]
          return s
        })
        setStands(newStands)
        setSelected(null)
        // Через 900мс переходим к шагу 2
        setTimeout(() => goToStep(1), 900)
      }
    } else if (stepIdx === 1) {
      // ШАГ 2: УСТАНОВКА
      if (placedCount >= 3) return
      if (stands[i].length >= MAX_FLOOR) {
        setErrorMsg(en ? `Limit ${MAX_FLOOR} floors for placement` : `Лимит ${MAX_FLOOR} этажей для установки`)
        return
      }
      // Можно строить только на 1 или 2 стойках
      if (!placedAt.includes(i) && placedAt.length >= 2) {
        setErrorMsg(en ? 'Only 1-2 stands allowed' : 'Можно только на 1-2 стойках')
        return
      }
      // По ТЗ Александра: «когда игрок пытается закрыть чужую стойку, Snappy
      // выскочил с фразой Чужую не трогай!». На шаге Установки чужая стойка =
      // верхний блок чужого цвета (R, не PLAYER_COLOR=B). На пустую можно,
      // на свою (top=B) можно. На стойку противника — блокируем + Snappy.
      const topColor = stands[i].at(-1)
      if (stands[i].length > 0 && topColor !== PLAYER_COLOR) {
        triggerSnappy('tutorial_wrong_target')
        setErrorMsg(en ? 'Don\'t build on enemy stands' : 'Не строй на чужих стойках')
        return
      }
      // Ставим блок цвета игрока
      const newStands = stands.map((s, idx) => idx === i ? [...s, PLAYER_COLOR] : s)
      const newPlacedAt = placedAt.includes(i) ? placedAt : [...placedAt, i]
      const newCount = placedCount + 1
      setStands(newStands)
      setPlacedAt(newPlacedAt)
      setPlacedCount(newCount)
      if (newCount >= 3) {
        setTimeout(() => goToStep(2), 900)
      }
    } else if (stepIdx === 2) {
      // ШАГ 3: ЗАВЕРШЕНИЕ
      if (finishStep === 0) {
        if (i !== 2) {
          setErrorMsg(en ? 'Tap stand 3 first' : 'Нажми сначала на 3 стойку')
          return
        }
        setSelected(2)
        setFinishStep(1)
      } else if (finishStep === 1) {
        if (i !== 0) {
          setErrorMsg(en ? 'Now tap stand 1' : 'Теперь нажми на 1 стойку')
          return
        }
        // Перенос верхнего блока с 3 на 1 — стойка 1 закрывается (7 → 11 нет, но в обучении упрощаем —
        // переносим столько блоков с 3, чтобы 1-я закрылась = 11 этажей).
        // У 1-й стойки 7 блоков, нужно ещё 4 до закрытия. Из 3-й (RRBRRRRRR=9 блоков) верхняя группа
        // одного цвета — RRRRRR (6 R сверху подряд начиная с idx 3). Берём 4 R сверху.
        const fromStand = stands[2]   // RRBRRRRRR
        const toStand = stands[0]      // BRRBBBR
        const need = 11 - toStand.length  // 4
        // Считаем сколько верхних подряд одного цвета (с конца)
        const topColor = fromStand.at(-1)
        let take = 0
        for (let k = fromStand.length - 1; k >= 0; k--) {
          if (fromStand[k] === topColor) take++
          else break
        }
        const moveCount = Math.min(take, need)
        const newFromStand = fromStand.slice(0, -moveCount)
        const newToStand = [...toStand, ...Array(moveCount).fill(topColor)]
        const newStands = stands.map((s, idx) => {
          if (idx === 0) return newToStand
          if (idx === 2) return newFromStand
          return s
        })
        setStands(newStands)
        setSelected(null)
        // Если 1-я закрылась (>=11) — добавим в closed
        if (newToStand.length >= 11) {
          setTimeout(() => {
            setClosedSet(new Set([0]))
            setFinishStep(2)
          }, 600)
          // Завершение через 2.5с — Snappy + закрытие модалки
          setTimeout(() => goToStep(3), 2500)
        }
      }
    }
  }

  const arrows = getArrowSet()
  const titleText = en ? step.titleEn : step.titleRu
  const hintText = en ? step.hintEn : step.hintRu
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']  // для не-золотых стоек

  return (
    <div className="tutorial-overlay">
      {/* Кнопка закрытия в углу — игрок может выйти из обучения в любой момент */}
      <button className="tut-close-btn" onClick={onClose} aria-label="Close tutorial">×</button>

      {/* Окно с подсказкой над башнями посередине (по ТЗ Александра) */}
      <div className="tut-hint-panel">
        <div className="tut-step-num">
          {en ? `Step ${stepIdx + 1} of 3` : `Шаг ${stepIdx + 1} из 3`}
        </div>
        <h2 className="tut-step-title">{titleText}</h2>
        <p className="tut-step-hint">{hintText}</p>
        {/* Шаг 2: показываем счётчик установленных блоков */}
        {stepIdx === 1 && (
          <div className="tut-counter">
            {en ? 'Blocks placed' : 'Поставлено блоков'}: <strong>{placedCount}/3</strong>
          </div>
        )}
      </div>

      {/* Игровая доска — упрощённая, без использования Board.jsx чтобы не
          ломать игровую логику. Свои классы tut-stand для стилей. */}
      <div className="board tut-board" style={{ marginTop: 24 }}>
        {stands.map((chips, i) => (
          <TutorialStand
            key={i}
            chips={chips}
            isGolden={i === step.goldenIdx}
            isSelected={selected === i}
            hasArrow={arrows.has(i)}
            isClosed={closedSet.has(i)}
            highlightTop={selected === i && stepIdx === 0}
            label={labels[i] || String(i + 1)}
            onClick={() => handleStandClick(i)}
          />
        ))}
      </div>

      {/* Сообщение об ошибке (мелкое, исчезает) */}
      {errorMsg && (
        <div className="tut-error-msg" role="alert">{errorMsg}</div>
      )}

      {/* Snappy появляется только в самом конце обучения с финальной
          фразой 'tutorial_complete' (Александр прописал точную цитату:
          «Обучение пройдено. Ну наконец-то.»). */}
      {showFinalSnappy && (
        <Snappy
          event="tutorial_complete"
          lang={lang}
          variant="anchored"
          cooldown={false}
          duration={3500}
        />
      )}
    </div>
  )
}
