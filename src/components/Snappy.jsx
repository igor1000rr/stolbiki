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
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import Mascot from './Mascot'
import { pickPhrase, canShow, markShown } from '../engine/snappy'
import { useI18n } from '../engine/i18n'

const SNAPPY_EVENT_NAME = 'snappy:trigger'

/**
 * Глобальный триггер Snappy. Можно звать из любого места — Game.jsx, движка,
 * WS-обработчиков. SnappyOverlay подхватит и покажет реакцию.
 *
 * Пример:
 *   import { triggerSnappy } from './Snappy'
 *   triggerSnappy('tower_takeover')
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
  onDoneRef.current = onDone

  useEffect(() => {
    if (!event) return
    if (cooldown && !canShow()) return

    const p = pickPhrase(event, lang)
    if (!p) return

    if (cooldown) markShown()
    setPhrase(p)
    setVisible(true)

    // Автоскрытие
    timerRef.current = setTimeout(() => {
      setVisible(false)
      // Колбек чуть позже — после анимации скрытия
      setTimeout(() => { onDoneRef.current?.() }, 250)
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [event, lang, duration, cooldown])

  if (!phrase || !visible) return null

  // Inline вариант — для встройки внутрь карточки результата
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

  // Corner вариант — overlay снизу-справа поверх игры
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
        gap: 8,
        pointerEvents: 'none',
        animation: 'snappy-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div style={{
        padding: '8px 14px',
        borderRadius: 16,
        borderBottomRightRadius: 4,
        background: 'linear-gradient(135deg, rgba(40,40,55,0.95), rgba(30,30,40,0.98))',
        color: '#ffe7b3',
        fontSize: 14,
        fontWeight: 600,
        fontStyle: 'italic',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,193,69,0.35)',
        maxWidth: 240,
        lineHeight: 1.3,
      }}>
        {phrase.text}
      </div>
      <Mascot pose={phrase.pose} size={64} animate />
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
