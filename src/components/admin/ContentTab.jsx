import { useEffect, useState } from 'react'


export function ContentTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [search, setSearch] = useState('')
  const [edited, setEdited] = useState({})

  useEffect(() => {
    fetch('/api/admin/content', { headers: { 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` } })
      .then(r => r.json()).then(data => {
        setItems(data)
        const sections = [...new Set(data.map(i => i.section))]
        if (sections.length) setActiveSection(sections[0])
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  const sections = [...new Set(items.map(i => i.section))]
  const filtered = items.filter(i => {
    if (activeSection && i.section !== activeSection) return false
    if (search) {
      const q = search.toLowerCase()
      return i.label?.toLowerCase().includes(q) || i.value_ru.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    }
    return true
  })

  function handleChange(key, field, value) {
    setEdited(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function saveItem(key) {
    const item = items.find(i => i.key === key)
    const edits = edited[key] || {}
    const body = {
      value_ru: edits.value_ru !== undefined ? edits.value_ru : item.value_ru,
      value_en: edits.value_en !== undefined ? edits.value_en : item.value_en,
    }
    setSaving(key)
    try {
      await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify(body),
      })
      setItems(prev => prev.map(i => i.key === key ? { ...i, ...body } : i))
      setEdited(prev => { const n = { ...prev }; delete n[key]; return n })
      localStorage.removeItem('stolbiki_content')
    } catch {}
    setSaving(null)
  }

  async function saveAll() { for (const key of Object.keys(edited)) await saveItem(key) }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>Загрузка...</div>

  const hasEdits = Object.keys(edited).length > 0

  return (
    <div>
      {/* Вкладки по секциям */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: activeSection === s ? 'var(--accent)' : 'var(--surface2)',
            color: activeSection === s ? '#fff' : 'var(--ink3)',
          }}>{s} ({items.filter(i => i.section === s).length})</button>
        ))}
      </div>

      {/* Поиск + сохранить */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по описанию или тексту..."
          style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13 }} />
        {hasEdits && (
          <button onClick={saveAll} style={{
            padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>Сохранить ({Object.keys(edited).length})</button>
        )}
      </div>

      {/* Карточки */}
      {filtered.map(item => {
        const e = edited[item.key] || {}
        const ruVal = e.value_ru !== undefined ? e.value_ru : item.value_ru
        const enVal = e.value_en !== undefined ? e.value_en : item.value_en
        const isChanged = item.key in edited
        const long = (item.value_ru + item.value_en).length > 120

        return (
          <div key={item.key} style={{
            padding: '14px 18px', marginBottom: 10, borderRadius: 12,
            background: isChanged ? 'rgba(240,96,64,0.05)' : 'var(--surface)',
            border: `1px solid ${isChanged ? 'rgba(240,96,64,0.2)' : 'var(--surface3)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.label || item.key}</span>
              {isChanged && (
                <button onClick={() => saveItem(item.key)} disabled={saving === item.key}
                  style={{ padding: '4px 14px', borderRadius: 6, background: 'var(--green)', color: '#000', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {saving === item.key ? '...' : 'Сохранить'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--p2)', marginBottom: 4, fontWeight: 600 }}>Русский</div>
                {long ? (
                  <textarea value={ruVal} onChange={e2 => handleChange(item.key, 'value_ru', e2.target.value)} rows={3}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                ) : (
                  <input value={ruVal} onChange={e2 => handleChange(item.key, 'value_ru', e2.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13 }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--p1)', marginBottom: 4, fontWeight: 600 }}>English</div>
                {long ? (
                  <textarea value={enVal} onChange={e2 => handleChange(item.key, 'value_en', e2.target.value)} rows={3}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                ) : (
                  <input value={enVal} onChange={e2 => handleChange(item.key, 'value_en', e2.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--surface3)', color: 'var(--ink)', fontSize: 13 }} />
                )}
              </div>
            </div>
          </div>
        )
      })}
      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>Ничего не найдено</div>}
    </div>
  )
}
