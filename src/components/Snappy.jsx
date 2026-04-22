/**
 * Snappy — всплывающий маскот-комментатор.
 *
 * Использование:
 *   <Snappy event="tower_takeover" lang={lang} onDone={() => {}} />
 *
 * Принцип:
 *   - Появляется снизу-справа с маскотом + bubble с фразой.
 *   - Через duration мс (по умолчанию 2.5с) исчезает.
 *   - Анимации входа/выхода — slideUp + fadeIn (mascot-bounce от Mascot).
 *   - При size='banner' растягивается на всю ширину (для GameResultPanel).
 *
 * Anti-spam: использует canShow/markShown из snappy.js. Если кулдаун не
 * истёк — компонент не рендерится.
 */

import { useEffect, useState, useRef } from 'react'
import Mascot from './Mascot'
import { pickPhrase, canShow, markShown } from '../engine/snappy'

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
