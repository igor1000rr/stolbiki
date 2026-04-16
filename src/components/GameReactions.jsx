const EMOJI_REACTIONS = ['👍', '🔥', '😮', '😂', '💪', '🎉']

/**
 * Ряд эмодзи-реакций в онлайн-партии. Клик отправляет
 * WebSocket-сообщение оппоненту. Вынесено из Game.jsx.
 */
export default function GameReactions({ onSendReaction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 }}>
      {EMOJI_REACTIONS.map(e => (
        <button
          key={e}
          onClick={() => onSendReaction(e)}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '4px 6px', fontSize: 16,
            cursor: 'pointer', transition: 'transform 0.15s',
          }}
          onMouseDown={ev => ev.currentTarget.style.transform = 'scale(1.3)'}
          onMouseUp={ev => ev.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
