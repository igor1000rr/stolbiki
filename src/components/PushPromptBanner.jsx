/**
 * PushPromptBanner — баннер-предложение подписаться на web-push уведомления.
 * Показывается в /online при первом входе (если юзер авторизован, браузер
 * поддерживает push, permission = 'default' и ещё не подписан).
 *
 * Не навязчив: после закрытия (×) или подписки больше не показывается
 * (флаг stolbiki_push_banner_dismissed в localStorage).
 */

import { useState, useEffect } from 'react'
import { isSupported, getPermission, getCurrentSubscription, subscribeToPush } from '../engine/webpush'
import * as API from '../engine/api'

const DISMISS_KEY = 'stolbiki_push_banner_dismissed'

export default function PushPromptBanner({ en }) {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      // Юзер закрыл баннер ранее
      if (localStorage.getItem(DISMISS_KEY)) return
      // Не авторизован
      if (!localStorage.getItem('stolbiki_token')) return
      // Браузер не поддерживает
      if (!isSupported()) return
      // Уже разрешил/заблокировал
      if (getPermission() !== 'default') return
      // Уже есть активная подписка (другой клиент на этом же аккаунте)
      const sub = await getCurrentSubscription()
      if (cancelled || sub) return
      setVisible(true)
      API.track('push_banner_shown', 'online')
    }
    check()
    return () => { cancelled = true }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
    API.track('push_banner_dismissed', 'online')
  }

  async function enable() {
    if (busy) return
    setBusy(true)
    setMsg(null)
    const r = await subscribeToPush()
    if (r.ok) {
      localStorage.setItem(DISMISS_KEY, '1') // чтобы не появлялся снова
      setMsg({ type: 'ok', text: en ? '✓ Notifications enabled!' : '✓ Уведомления включены!' })
      API.track('push_banner_subscribed', 'online')
      setTimeout(() => setVisible(false), 1800)
    } else {
      const reasons = {
        permission_denied: en ? 'Blocked in browser settings' : 'Заблокировано в настройках браузера',
        push_not_configured: en ? 'Push not configured on server' : 'Push не настроен',
        not_authenticated: en ? 'Please sign in first' : 'Сначала войдите',
      }
      setMsg({ type: 'err', text: reasons[r.reason] || (en ? 'Failed' : 'Не удалось') })
      // Если permission denied — не показывать снова
      if (r.reason === 'permission_denied') localStorage.setItem(DISMISS_KEY, '1')
    }
    setBusy(false)
  }

  if (!visible) return null

  return (
    <div className="dash-card" style={{
      maxWidth: 560, margin: '16px auto', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      border: '1px solid rgba(74,158,255,0.2)',
      background: 'linear-gradient(135deg, rgba(74,158,255,0.06), rgba(155,89,182,0.04))',
      position: 'relative',
    }}>
      <div style={{ fontSize: 28, flexShrink: 0, opacity: 0.9 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
          {en ? 'Get notified when it\'s your turn' : 'Уведомления о ходе соперника'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.4 }}>
          {en
            ? 'Subscribe so you don\'t miss online games while browsing other tabs.'
            : 'Узнавайте о ходах противника, даже если переключились в другую вкладку.'}
        </div>
        {msg && (
          <div style={{
            fontSize: 11, marginTop: 6,
            color: msg.type === 'ok' ? 'var(--green)' : 'var(--p2)',
          }}>{msg.text}</div>
        )}
      </div>
      <button
        className="btn primary"
        onClick={enable}
        disabled={busy}
        style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {busy ? '...' : (en ? 'Enable' : 'Включить')}
      </button>
      <button
        onClick={dismiss}
        aria-label={en ? 'Dismiss' : 'Закрыть'}
        style={{
          position: 'absolute', top: 6, right: 8,
          background: 'none', border: 'none', color: 'var(--ink3)',
          fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
        }}
      >×</button>
    </div>
  )
}
