/**
 * ProfileAccount — управление аккаунтом (смена пароля, экспорт, удаление)
 * Извлечён из Profile.jsx
 */

import { useState } from 'react'
import * as API from '../engine/api'

export default function ProfileAccount({ en, profileName }) {
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [deletePass, setDeletePass] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12,
          background: msg.includes('✓') ? 'rgba(61,214,140,0.08)' : 'rgba(255,99,99,0.08)',
          color: msg.includes('✓') ? 'var(--green)' : 'var(--p2)',
          border: `1px solid ${msg.includes('✓') ? 'rgba(61,214,140,0.2)' : 'rgba(255,99,99,0.2)'}` }}>
          {msg}
        </div>
      )}

      {/* Смена пароля */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>{en ? 'Change password' : 'Смена пароля'}</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <input type="password" placeholder={en ? 'Current password' : 'Текущий пароль'}
            value={currentPass} onChange={e => setCurrentPass(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--surface2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }} />
          <input type="password" placeholder={en ? 'New password (min 6)' : 'Новый пароль (мин 6)'}
            value={newPass} onChange={e => setNewPass(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--surface2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }} />
          <button className="btn primary" disabled={loading || !currentPass || newPass.length < 6}
            onClick={async () => {
              setLoading(true); setMsg('')
              try {
                await API.changePassword(currentPass, newPass)
                setMsg(en ? '✓ Password changed' : '✓ Пароль изменён')
                setCurrentPass(''); setNewPass('')
              } catch (e) { setMsg(e.message || 'Error') }
              setLoading(false)
            }}
            style={{ fontSize: 13, padding: '10px 0', justifyContent: 'center' }}>
            {loading ? '...' : en ? 'Change' : 'Изменить'}
          </button>
        </div>
      </div>

      {/* Экспорт данных */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>{en ? 'Export data' : 'Экспорт данных'}</h3>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 12 }}>
          {en ? 'Download all your data as JSON.' : 'Скачайте все данные в формате JSON.'}
        </p>
        <button className="btn" onClick={async () => {
          try {
            const data = await API.exportData()
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `highrise-heist-${profileName || 'data'}.json`; a.click()
            URL.revokeObjectURL(url)
            setMsg(en ? '✓ Data exported' : '✓ Данные экспортированы')
          } catch (e) { setMsg(e.message || 'Error') }
        }} style={{ fontSize: 13, padding: '10px 16px' }}>
          {en ? 'Download JSON' : 'Скачать JSON'}
        </button>
      </div>

      {/* Удаление аккаунта */}
      <div className="dash-card" style={{ border: '1px solid rgba(255,99,99,0.15)' }}>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: 'var(--p2)' }}>{en ? 'Delete account' : 'Удаление аккаунта'}</h3>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 12 }}>
          {en ? 'Irreversible. All data permanently deleted.' : 'Необратимо. Все данные удаляются навсегда.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" placeholder={en ? 'Confirm password' : 'Пароль'}
            value={deletePass} onChange={e => setDeletePass(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,99,99,0.2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }} />
          <button className="btn" disabled={loading || !deletePass}
            onClick={async () => {
              if (!confirm(en ? 'Are you sure? Cannot be undone!' : 'Уверены? Нельзя отменить!')) return
              setLoading(true); setMsg('')
              try {
                await API.deleteAccount(deletePass)
                localStorage.removeItem('stolbiki_profile'); localStorage.removeItem('stolbiki_token')
                location.reload()
              } catch (e) { setMsg(e.message || 'Error'); setLoading(false) }
            }}
            style={{ fontSize: 12, padding: '8px 16px', color: 'var(--p2)', borderColor: 'rgba(255,99,99,0.3)' }}>
            {en ? 'Delete' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  )
}
