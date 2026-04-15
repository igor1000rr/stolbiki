/**
 * Панель подсказки в игре (клавиша H или кнопка 💡).
 * Вынесена из Game.jsx.
 */
export default function HintPanel({ hint, lang }) {
  if (!hint) return null
  return (
    <div className="hint-panel">
      <div className="hint-title">{lang === 'en' ? 'Hint' : 'Подсказка'}</div>
      {hint.explanation.map((l, i) => <p key={i} className="hint-line">{l}</p>)}
    </div>
  )
}
