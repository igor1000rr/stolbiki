import * as MP from '../engine/multiplayer'

const EMOJIS = ['👍', '🔥', '😮', '😂', '💪', '🎉']

/**
 * Панель эмодзи для online + флоатинг-дисплей входящей эмодзи от противника.
 */
export default function GameEmojiReactions({ show, floatingEmoji }) {
  return (
    <>
      {show && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 }}>
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => MP.send({ type: 'reaction', emoji: e })}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
                padding: '4px 6px', fontSize: 16, cursor: 'pointer', transition: 'transform 0.15s',
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
      )}

      {floatingEmoji && (
        <div
          key={floatingEmoji.key}
          style={{
            position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
            fontSize: 64, zIndex: 9999, pointerEvents: 'none',
            animation: 'emojiFloat 2s ease-out forwards',
          }}
        >
          {floatingEmoji.emoji}
        </div>
      )}
    </>
  )
}
