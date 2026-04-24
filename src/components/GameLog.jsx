import { forwardRef } from 'react'

/**
 * Компактный лог игры — ОДНА СТРОКА внизу экрана. По требованию Александра
 * (апр 2026): log занимал слишком много места, игрок хочет видеть только
 * последнее действие.
 *
 * Формат log[] (из useGameLog.js):
 *   [{ text: '...', player: 0|1|-1, time: 'HH:MM:SS' }, ...]
 * addLog() добавляет через [newEntry, ...prev] — т.е. свежий ход всегда log[0].
 *
 * Прокрутки нет. Если нужна история — открывать через Replay или Review.
 */
export default forwardRef(function GameLog({ log }, ref) {
  const latest = Array.isArray(log) && log.length > 0 ? log[0] : null
  // latest — объект {text, player, time}. Достаём .text или fallback на неразрывный пробел.
  const text = latest && typeof latest === 'object' ? (latest.text || '') : (latest || '')
  return (
    <div className="game-log game-log--single" ref={ref} aria-live="polite">
      {text || '\u00A0'}
    </div>
  )
})
