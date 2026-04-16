/**
 * Кнопка-бейдж модификатора (Fog, DoubleTransfer, Blitz).
 * Используется в ряду модов и в mobile settings sheet.
 */
export default function ModifierBadge({ label, active, onToggle, color = 'var(--accent)' }) {
  return (
    <button
      onClick={onToggle}
      style={{
        fontSize: 10, padding: '3px 8px', borderRadius: 6,
        border: `1px solid ${active ? color : 'var(--surface3)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--ink3)',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  )
}
