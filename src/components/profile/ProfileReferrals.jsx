/**
 * Вкладка Приглашения — реферальная система.
 * Фикс: ребрендинг 'Snatch Highrise' → 'Highrise Heist' в share.
 */

import { useState } from 'react'

export default function ProfileReferrals({ data, en }) {
  const [copied, setCopied] = useState(false)

  if (!data) {
    return (
      <div className="dash-card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--ink3)' }}>{en ? 'Loading...' : 'Загрузка...'}</div>
      </div>
    )
  }

  const refLink = data.link || ''
  const refCode = data.code || ''

  function copyLink() {
    navigator.clipboard?.writeText(refLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function shareInvite() {
    if (!navigator.share) return
    navigator.share({
      title: 'Highrise Heist',
      text: en
        ? `Play Highrise Heist! Use my code: ${refCode}`
        : `Играй в Highrise Heist! Мой код: ${refCode}`,
      url: refLink,
    }).catch(() => {})
  }

  return (
    <div className="dash-card" style={{ padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--gold)" strokeWidth="1.5"
          style={{ margin: '0 auto 8px', display: 'block' }}>
          <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
        </svg>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
          {en ? 'Invite friends' : 'Пригласи друзей'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 4 }}>
          {en ? '+100 XP for each invited player' : '+100 XP за каждого приглашённого'}
        </div>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
          {refLink}
        </div>
        <button className="btn primary" onClick={copyLink}
          style={{ fontSize: 12, padding: '6px 14px', flexShrink: 0 }}>
          {copied ? (en ? 'Copied!' : 'Готово!') : (en ? 'Copy' : 'Скопировать')}
        </button>
      </div>

      {navigator.share && (
        <button className="btn" onClick={shareInvite}
          style={{ width: '100%', fontSize: 13, padding: '12px 0', justifyContent: 'center',
            marginBottom: 16, borderColor: 'var(--accent)', color: 'var(--accent)' }}>
          {en ? 'Share invite' : 'Поделиться'}
        </button>
      )}

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink3)', marginBottom: 16 }}>
        {en ? 'Your code' : 'Ваш код'}: <span style={{ fontWeight: 700, color: 'var(--gold)', letterSpacing: 1 }}>{refCode}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--bg2)', borderRadius: 10, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{data.count}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{en ? 'Invited' : 'Приглашено'}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 20px', background: 'var(--bg2)', borderRadius: 10, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>+{data.totalXP}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>XP</div>
        </div>
      </div>

      {data.referrals?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>
            {en ? 'Your referrals' : 'Приглашённые'}
          </div>
          {data.referrals.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--surface2)', fontSize: 13 }}>
              <span style={{ color: 'var(--ink)' }}>{r.username}</span>
              <span style={{ color: 'var(--green)', fontSize: 12 }}>+{r.xp} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
