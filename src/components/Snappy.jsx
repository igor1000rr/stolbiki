/**
 * Snappy — всплывающий маскот-комментатор.
 *
 * Два способа использования:
 *
 * 1. Прямое — ставишь компонент в JSX:
 *    <Snappy event="victory" lang={lang} variant="inline" cooldown={false} />
 *    Подходит для встройки в карточки (GameResultPanel, VictoryCity).
 *
 * 2. Глобальное — через event-bus (window CustomEvent):
 *    triggerSnappy('tower_takeover')
 *    Срабатывает <SnappyOverlay/>, единожды смонтированный в App.jsx.
 *    Подходит для триггеров из глубины Game.jsx, движка, WS-обработчиков —
 *    без props-drilling и без прямых импортов.
 *
 * Anti-spam: cooldown=true (default) — не чаще 1 раза в 4 сек.
 * В variant='inline' с cooldown=false — для гарантированных показов в окнах.
 *
 * Analytics: каждый фактический показ (после cooldown check) трекается
 * через API.track('snappy_shown', variant, { event, pose, textLen }) —
 * это даёт метрику какие фразы заходят и не спамим ли мы.
 *
 * 26.04.2026 — апр ревизия по обратной связи Александра:
 * "Snappy который выскакивает сделать больше в 2 раза, чтобы было понятно
 *  что енот пролетает". Размеры в corner-варианте удвоены: 64→128,
 *  font 14→16, max-width 240→360, padding +30%.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import Mascot from './Mascot'
import { pickPhrase, canShow, markShown } from '../engine/snappy'
import { useI18n } from '../engine/i18n'
import { track } from '../engine/api'

const SNAPPY_EVENT_NAME = 'snappy:trigger'

/**
 * Глобальный триггер Snappy. Можно звать из любого места — Game.jsx, движка,
 * WS-обработчиков. SnappyOverlay подхватит и покажет реакцию.
 */
export function triggerSnappy(event) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SNAPPY_EVENT_NAME, { detail: { event } }))
}

export default function Snappy({
  event,
  lang = 'ru',
  duration = 2500,
  variant = 'corner', // 'corner' | 'inline'
  cooldown = true,
  onDone,
}) {
  const [phrase, setPhrase] = useState(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!event) return
    if (cooldown && !canShow()) return

    const p = pickPhrase(event, lang)
    if (!p) return

    if (cooldown) markShown()
    setPhrase(p)
    setVisible(true)

    try {
      track('snappy_shown', variant, {
        event,
        pose: p.pose,
        lang,
        textLen: p.text?.length || 0,
      })
    } catch {}

    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => { onDoneRef.current?.() }, 250)
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [event, lang, duration, cooldown, variant])

  if (!phrase || !visible) return null

  // Inline вариант — для встройки внутрь карточки результата.
  // Размер не меняли — здесь Snappy уже на видном месте, рядом с большой
  // картинкой результата. Удваивать имеет смысл только в corner.
  if (variant === 'inline') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
        marginTop: 6, animation: 'fadeIn 0.3s ease',
      }}>
        <Mascot pose={phrase.pose} size={36} animate={false} />
        <div style={{
          padding: '6px 12px', borderRadius: 14,
          background: 'rgba(255,193,69,0.12)', color: 'var(--gold)',
          fontSize: 13, fontWeight: 600, fontStyle: 'italic',
          border: '1px solid rgba(255,193,69,0.3)',
        }}>
          {phrase.text}
        </div>
      </div>
    )
  }

  // Corner вариант — overlay снизу-справа поверх игры. Удвоен в апр 2026 по
  // запросу Александра: "сделать больше в 2 раза чтобы было понятно что енот
  // пролетает". Маскот 128px вместо 64 — теперь действительно "пролетает".
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 1400, // ниже модалки результата (1500), но поверх игрового поля
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        pointerEvents: 'none',
        animation: 'snappy-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div style={{
        padding: '12px 18px',          /* было 8/14 — крупнее под x2 маскот */
        borderRadius: 20,
        borderBottomRightRadius: 4,
        background: 'linear-gradient(135deg, rgba(40,40,55,0.95), rgba(30,30,40,0.98))',
        color: '#ffe7b3',
        fontSize: 16,                  /* было 14 */
        fontWeight: 600,
        fontStyle: 'italic',
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,193,69,0.35)',
        maxWidth: 360,                 /* было 240 — больше места под текст */
        lineHeight: 1.35,
      }}>
        {phrase.text}
      </div>
      <Mascot pose={phrase.pose} size={128} animate />  {/* было 64 */}
      <style>{`
        @keyframes snappy-slide-in {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

/**
 * SnappyOverlay — слушает глобальные triggerSnappy() события и показывает
 * Snappy в corner-варианте. Один раз монтируется в App.jsx, дальше работает
 * автономно. Берёт текущий язык из useI18n().
 */
export function SnappyOverlay() {
  const { lang } = useI18n()
  const [event, setEvent] = useState(null)
  // ключ нужен чтобы один и тот же event подряд перерендерил Snappy
  const [key, setKey] = useState(0)

  const handleDone = useCallback(() => setEvent(null), [])

  useEffect(() => {
    const onTrigger = (e) => {
      const ev = e?.detail?.event
      if (!ev) return
      setEvent(ev)
      setKey(k => k + 1)
    }
    window.addEventListener(SNAPPY_EVENT_NAME, onTrigger)
    return () => window.removeEventListener(SNAPPY_EVENT_NAME, onTrigger)
  }, [])

  if (!event) return null

  return (
    <Snappy
      key={key}
      event={event}
      lang={lang}
      variant="corner"
      cooldown
      duration={2500}
      onDone={handleDone}
    />
  )
}
