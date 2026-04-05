import { useEffect, useState } from 'react'
import { S, ago, api } from './_utils'
import { Confirm } from './_shared'

export function BlogTab() {
  const [posts, setPosts] = useState([])
  const [editPost, setEditPost] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  function load() { api('/admin/blog').then(setPosts) }
  useEffect(() => { load() }, [])

  async function savePost(post) {
    if (post._new) {
      await api('/blog', { method: 'POST', body: JSON.stringify(post) })
    } else {
      await api(`/blog/${post.slug}`, { method: 'PUT', body: JSON.stringify(post) })
    }
    setEditPost(null); load()
  }

  async function deletePost(slug) {
    await api(`/admin/blog/${slug}`, { method: 'DELETE' })
    setConfirmDel(null); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{posts.length} постов</span>
        <button style={S.btn('primary')} onClick={() => setEditPost({ _new: true, slug: '', title_ru: '', title_en: '', body_ru: '', body_en: '', tag: 'update', pinned: 0, published: 1 })}>
          + Новый пост
        </button>
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Slug</th>
              <th style={S.th}>Заголовок</th>
              <th style={S.th}>Тег</th>
              <th style={S.th}>Статус</th>
              <th style={S.th}>Дата</th>
              <th style={S.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.slug}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{p.slug}</td>
                <td style={{ ...S.td, color: 'var(--ink)', fontWeight: 500 }}>{p.title_ru}</td>
                <td style={S.td}><span style={S.badge(p.tag === 'release' ? 'var(--green)' : p.tag === 'ai' ? 'var(--p1)' : 'var(--ink3)')}>{p.tag}</span></td>
                <td style={S.td}>
                  {p.published ? <span style={S.badge('var(--green)')}>опубликован</span> : <span style={S.badge('var(--ink3)')}>черновик</span>}
                  {p.pinned ? <span style={{ ...S.badge('var(--gold)'), marginLeft: 4 }}>pin</span> : null}
                </td>
                <td style={{ ...S.td, fontSize: 11 }}>{ago(p.created_at)}</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }} onClick={() => setEditPost(p)}>✎</button>
                    <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 11 }} onClick={() => setConfirmDel(p)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editPost && <BlogEditModal post={editPost} onSave={savePost} onClose={() => setEditPost(null)} />}
      {confirmDel && <Confirm msg={`Удалить пост «${confirmDel.title_ru}»?`} onOk={() => deletePost(confirmDel.slug)} onCancel={() => setConfirmDel(null)} />}
    </div>
  )
}

function BlogEditModal({ post, onSave, onClose }) {
  const [form, setForm] = useState({ ...post })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const ta = { ...S.input, minHeight: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, overflow: 'auto', padding: 20 }} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 680, margin: '40px auto' }} onClick={e => e.stopPropagation()}>
        <div style={S.cardTitle}>{post._new ? 'Новый пост' : `Редактировать: ${post.slug}`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {post._new && (
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Slug (URL)
              <input style={{ ...S.input, marginTop: 4 }} value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="my-post-slug" />
            </label>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Заголовок RU
              <input style={{ ...S.input, marginTop: 4 }} value={form.title_ru} onChange={e => set('title_ru', e.target.value)} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Заголовок EN
              <input style={{ ...S.input, marginTop: 4 }} value={form.title_en || ''} onChange={e => set('title_en', e.target.value)} />
            </label>
          </div>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Текст RU
            <textarea style={{ ...ta, marginTop: 4 }} value={form.body_ru} onChange={e => set('body_ru', e.target.value)} />
          </label>
          <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
            Текст EN
            <textarea style={{ ...ta, marginTop: 4 }} value={form.body_en || ''} onChange={e => set('body_en', e.target.value)} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--ink3)' }}>
              Тег
              <select style={{ ...S.input, marginTop: 4 }} value={form.tag} onChange={e => set('tag', e.target.value)}>
                <option value="update">update</option>
                <option value="release">release</option>
                <option value="ai">ai</option>
                <option value="feature">feature</option>
                <option value="guide">guide</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" checked={!!form.pinned} onChange={e => set('pinned', e.target.checked ? 1 : 0)} />
              Закреплён
            </label>
            <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" checked={form.published !== 0} onChange={e => set('published', e.target.checked ? 1 : 0)} />
              Опубликован
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button style={S.btn()} onClick={onClose}>Отмена</button>
          <button style={S.btn('primary')} onClick={() => onSave(form)}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
