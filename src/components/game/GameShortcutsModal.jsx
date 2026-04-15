/**
 * Модалка горячих клавиш. Тоггл по клавише ?.
 *
 * Вынесено из Game.jsx.
 */
export default function GameShortcutsModal({ lang, onClose }) {
  const en = lang === 'en'
  const items = [
    ['Enter', en ? 'Confirm turn' : 'Подтвердить ход'],
    ['Esc', en ? 'Cancel transfer' : 'Отменить перенос'],
    ['N', en ? 'New game' : 'Новая игра'],
    ['Z', en ? 'Undo (PvP)' : 'Отмена хода (PvP)'],
    ['H', en ? 'Hint' : 'Подсказка'],
    ['0-9', en ? 'Select stand' : 'Выбрать стойку'],
    ['?', en ? 'This help' : 'Эта справка'],
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 16, padding: '24px 32px',
          maxWidth: 340, width: '90%', border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
          {en ? 'Keyboard shortcuts' : 'Горячие клавиши'}
        </div>
        {items.map(([key, desc]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <kbd style={{
              background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 8px',
              fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)',
              minWidth: 36, textAlign: 'center',
            }}>{key}</kbd>
            <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{desc}</span>
          </div>
        ))}
        <button className="btn primary" onClick={onClose}
          style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>OK</button>
      </div>
    </div>
  )
}
