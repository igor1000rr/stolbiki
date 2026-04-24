import { forwardRef } from 'react'

/**
 * Компактный лог игры — ОДНА СТРОКА внизу экрана. По требованию Александра
 * (апр 2026): log занимал слишком много места, игрок хочет видеть только
 * последнее действие (последнюю строку из массива log[]).
 *
 * Прокрутки нет. Если нужна история — открывать через Replay или Review.
 */
export default forwardRef(function GameLog({ log }, ref) {
  const last = Array.isArray(log) && log.length > 0 ? log[log.length - 1] : ''
  return (
    <div className="game-log game-log--single" ref={ref} aria-live="polite">
      {last || '\u00A0'}
    </div>
  )
})
