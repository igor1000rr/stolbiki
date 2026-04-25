import { forwardRef } from 'react'

/**
 * Лог игры — последние 3 строки внизу экрана. По требованию Александра
 * (апр 2026 → апр 2026 ревизия): один ряд слишком мало, людям полезен
 * контекст. 3 строки — максимум что помещается до native-tabs без
 * наезжания на полосу сворачивания приложения.
 *
 * Формат log[] (из useGameLog.js):
 *   [{ text: '...', player: 0|1|-1, time: 'HH:MM:SS' }, ...]
 * addLog() добавляет через [newEntry, ...prev] — log[0] = свежий ход.
 *
 * Прокрутки нет. Полная история — через Replay/Review.
 */
const VISIBLE_LINES = 3

export default forwardRef(function GameLog({ log }, ref) {
  const items = Array.isArray(log) ? log.slice(0, VISIBLE_LINES) : []

  return (
    <div className="game-log game-log--multi" ref={ref} aria-live="polite">
      {items.length === 0 ? (
        <div className="game-log__line">{'\u00A0'}</div>
      ) : (
        items.map((entry, idx) => {
          const text = entry && typeof entry === 'object' ? (entry.text || '') : (entry || '')
          // idx 0 — самая свежая строка, делаем её акцентной (более яркой).
          // Старшие — приглушаются, чтобы взгляд автоматически шёл к свежей.
          return (
            <div key={idx} className="game-log__line" data-age={idx}>
              {text}
            </div>
          )
        })
      )}
    </div>
  )
})
