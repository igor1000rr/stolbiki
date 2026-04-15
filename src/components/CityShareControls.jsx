/**
 * CityShareControls — кнопки шаринга и сравнения под VictoryCity в Профиле.
 * Использует роуты /embed/city/:userId и /compare/:id1/:id2.
 *
 * 1) Поделиться городом — модалка с embed-URL, iframe-снипетом, Web Share API
 * 2) Сравнить с другом — модалка со списком друзей + топом из leaderboard
 */
import { useState, useEffect } from 'react'

function Modal({ children, onClose, title }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)', padding: 20,
        maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--ink3)',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function copyToClipboard(text, onDone) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => onDone(true)).catch(() => onDone(false))
  } else {
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      onDone(true)
    } catch { onDone(false) }
  }
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input readOnly value={value} onFocus={e => e.target.select()} style={{
          flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 6,
          background: 'var(--surface2)', border: '1px solid var(--surface3)',
          color: 'var(--ink)', fontSize: 11, fontFamily: 'monospace',
        }} />
        <button onClick={() => copyToClipboard(value, ok => {
          if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
        })} style={{
          padding: '8px 12px', borderRadius: 6, border: 'none',
          background: copied ? 'var(--green)' : 'var(--accent)',
          color: '#0a0a12', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
        }}>{copied ? '✓' : 'Копия'}</button>
      </div>
    </div>
  )
}

function ShareModal({ userId, userName, en, onClose }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://highriseheist.com'
  const profileUrl = `${origin}/profile?u=${encodeURIComponent(userName || '')}`
  const embedUrl = `${origin}/embed/city/${userId}`
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="720" frameborder="0" style="border-radius:12px;background:#06060f"></iframe>`

  function nativeShare() {
    const text = en
      ? `Check out my Victory City in Highrise Heist!`
      : `Посмотри мой Город побед в Highrise Heist!`
    if (navigator.share) {
      navigator.share({ title: 'Highrise Heist', text, url: embedUrl }).catch(() => {})
    } else {
      copyToClipboard(`${text} ${embedUrl}`, () => {})
    }
  }

  return (
    <Modal title={en ? 'Share your city' : 'Поделиться городом'} onClose={onClose}>
      <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 16, lineHeight: 1.5 }}>
        {en
          ? 'Show off your highrises in Telegram, Reddit, BGG, or embed in your blog.'
          : 'Покажи свои высотки в Telegram, Reddit, BGG или встрой в блог.'}
      </div>

      <CopyField label={en ? 'Embed link (→ standalone page)' : 'Ссылка на виджет'} value={embedUrl} />
      <CopyField label={en ? 'Profile link' : 'Ссылка на профиль'} value={profileUrl} />
      <CopyField label={en ? 'iframe snippet (HTML)' : 'iframe-снипет (HTML)'} value={iframeSnippet} />

      <button onClick={nativeShare} style={{
        width: '100%', padding: '12px', borderRadius: 8, border: 'none',
        background: 'var(--accent)', color: '#0a0a12', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
      }}>
        {typeof navigator !== 'undefined' && navigator.share
          ? (en ? '📤 Share via…' : '📤 Поделиться…')
          : (en ? '📎 Copy share text' : '📎 Скопировать с описанием')}
      </button>
    </Modal>
  )
}

function CompareModal({ userId, friendsList, en, onClose }) {
  const [leaderboard, setLeaderboard] = useState(null)
  const [tab, setTab] = useState(friendsList?.length ? 'friends' : 'top')
  const [manualName, setManualName] = useState('')
  const [manualErr, setManualErr] = useState(null)
  const [manualLoading, setManualLoading] = useState(false)

  useEffect(() => {
    fetch('/api/buildings/leaderboard')
      .then(r => r.ok ? r.json() : null)
      .then(setLeaderboard)
      .catch(() => setLeaderboard(null))
  }, [])

  function goCompare(opponentId) {
    if (!opponentId || opponentId === userId) return
    window.location.href = `/compare/${userId}/${opponentId}`
  }

  async function tryManual() {
    setManualErr(null)
    if (!manualName.trim()) return
    setManualLoading(true)
    try {
      const r = await fetch(`/api/profile/public/${encodeURIComponent(manualName.trim())}`)
      if (!r.ok) throw new Error('not found')
      const data = await r.json()
      const oppId = data?.id || data?.user?.id
      if (!oppId) throw new Error('no id')
      goCompare(oppId)
    } catch {
      setManualErr(en ? 'User not found' : 'Пользователь не найден')
    } finally {
      setManualLoading(false)
    }
  }

  // Берём топ по leaderboard.by_score (или фолбэк из любого списка в ответе)
  const topRows = (() => {
    if (!leaderboard) return []
    const list = leaderboard.by_score || leaderboard.by_bricks || leaderboard.by_towers || []
    return list.filter(r => r.user_id !== userId).slice(0, 12)
  })()

  const tabs = [
    ...(friendsList?.length ? [{ id: 'friends', label: en ? `Friends (${friendsList.length})` : `Друзья (${friendsList.length})` }] : []),
    { id: 'top', label: en ? 'Top players' : 'Топ игроков' },
    { id: 'manual', label: en ? 'By name' : 'По нику' },
  ]

  return (
    <Modal title={en ? 'Compare with...' : 'Сравнить с…'} onClose={onClose}>
      <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 12, lineHeight: 1.5 }}>
        {en
          ? 'Pick a player to compare your cities side by side.'
          : 'Выбери с кем сравнить ваши города.'}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, padding: 3,
        background: 'var(--surface2)', borderRadius: 8 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px 10px', borderRadius: 5, border: 'none',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0a0a12' : 'var(--ink2)',
            fontSize: 11, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'friends' && (
        <div>
          {(friendsList || []).length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'No friends yet' : 'Пока нет друзей'}
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {friendsList.map(f => (
                <button key={f.id} onClick={() => goCompare(f.id)} style={{
                  width: '100%', padding: '10px 12px', marginBottom: 4,
                  borderRadius: 8, border: '1px solid var(--surface2)',
                  background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13 }}>{f.username || f.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--accent)' }}>→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'top' && (
        <div>
          {!leaderboard ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>...</div>
          ) : topRows.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink3)', fontSize: 12 }}>
              {en ? 'No players in top yet' : 'Пока никого в топе'}
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {topRows.map((r, i) => (
                <button key={r.user_id} onClick={() => goCompare(r.user_id)} style={{
                  width: '100%', padding: '10px 12px', marginBottom: 4,
                  borderRadius: 8, border: '1px solid var(--surface2)',
                  background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <span style={{
                      width: 22, textAlign: 'center', fontSize: 11, fontWeight: 700,
                      color: i < 3 ? 'var(--gold)' : 'var(--ink3)',
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <span style={{
                      fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{r.name || `Player #${r.user_id}`}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--ink3)', flexShrink: 0 }}>
                    {r.score != null ? r.score : (r.total_bricks || 0)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>
            {en ? 'Enter exact username:' : 'Введи точный ник:'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={manualName}
              onChange={e => { setManualName(e.target.value); setManualErr(null) }}
              onKeyDown={e => { if (e.key === 'Enter') tryManual() }}
              placeholder={en ? 'username' : 'никнейм'}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 6,
                background: 'var(--surface2)', border: '1px solid var(--surface3)',
                color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
              }}
              autoFocus
            />
            <button onClick={tryManual} disabled={manualLoading || !manualName.trim()} style={{
              padding: '10px 16px', borderRadius: 6, border: 'none',
              background: 'var(--accent)', color: '#0a0a12', fontWeight: 700,
              fontSize: 13, cursor: manualLoading ? 'wait' : 'pointer',
              opacity: (!manualName.trim() || manualLoading) ? 0.5 : 1,
              fontFamily: 'inherit',
            }}>
              {manualLoading ? '…' : (en ? 'Compare' : 'Вперёд')}
            </button>
          </div>
          {manualErr && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--p2)' }}>{manualErr}</div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function CityShareControls({ userId, userName, friendsList, en }) {
  const [showShare, setShowShare] = useState(false)
  const [showCompare, setShowCompare] = useState(false)

  if (!userId) return null

  return (
    <>
      <div style={{
        display: 'flex', gap: 8, marginTop: 16, paddingTop: 14,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <button onClick={() => setShowShare(true)} style={{
          padding: '10px 16px', borderRadius: 8, border: '1px solid var(--accent)',
          background: 'rgba(74,158,255,0.1)', color: 'var(--accent)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>🔗</span>
          <span>{en ? 'Share city' : 'Поделиться городом'}</span>
        </button>
        <button onClick={() => setShowCompare(true)} style={{
          padding: '10px 16px', borderRadius: 8, border: '1px solid var(--gold)',
          background: 'rgba(255,216,110,0.1)', color: 'var(--gold)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>⚔</span>
          <span>{en ? 'Compare with...' : 'Сравнить с…'}</span>
        </button>
      </div>

      {showShare && (
        <ShareModal userId={userId} userName={userName} en={en} onClose={() => setShowShare(false)} />
      )}
      {showCompare && (
        <CompareModal userId={userId} friendsList={friendsList} en={en} onClose={() => setShowCompare(false)} />
      )}
    </>
  )
}
