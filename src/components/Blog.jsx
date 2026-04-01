import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'

const TAG_STYLE = {
  release: { bg: '#3dd68c20', color: 'var(--green)', label: { ru: 'Релиз', en: 'Release' } },
  feature: { bg: '#4a9eff20', color: 'var(--p1)', label: { ru: 'Фича', en: 'Feature' } },
  ai: { bg: '#9b59b620', color: 'var(--purple)', label: { ru: 'AI', en: 'AI' } },
  update: { bg: '#ffc14520', color: 'var(--gold)', label: { ru: 'Обновление', en: 'Update' } },
  roadmap: { bg: '#3bb8a820', color: 'var(--accent)', label: { ru: 'Планы', en: 'Roadmap' } },
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  if (lang === 'en') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
}

function PostCard({ post, lang, onOpen }) {
  const title = lang === 'en' && post.title_en ? post.title_en : post.title_ru
  const body = lang === 'en' && post.body_en ? post.body_en : post.body_ru
  const preview = body.split('\n')[0].slice(0, 160) + (body.length > 160 ? '...' : '')
  const tag = TAG_STYLE[post.tag] || TAG_STYLE.update

  return (
    <article className="dash-card" onClick={() => onOpen(post)}
      style={{ padding: '20px 24px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {post.pinned ? <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style={{ flexShrink: 0 }}><path d="M16 3l-4 4-4-1-3 3 5 5-4 4h2l3-3 5 5 3-3-1-4 4-4z"/></svg> : null}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: tag.bg, color: tag.color, fontWeight: 600 }}>
          {tag.label[lang] || tag.label.ru}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink3)', marginLeft: 'auto' }}>
          {formatDate(post.created_at, lang)}
        </span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.4, textTransform: 'none', letterSpacing: 0 }}>
        {title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.6, margin: 0 }}>
        {preview}
      </p>
    </article>
  )
}

function PostView({ post, lang, onBack }) {
  const { t } = useI18n()
  const title = lang === 'en' && post.title_en ? post.title_en : post.title_ru
  const body = lang === 'en' && post.body_en ? post.body_en : post.body_ru
  const tag = TAG_STYLE[post.tag] || TAG_STYLE.update

  return (
    <article style={{ maxWidth: 700, margin: '0 auto' }}>
      <button className="btn" onClick={onBack} style={{ fontSize: 11, padding: '5px 12px', marginBottom: 16 }}>
        ← {t('blog.allPosts')}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: tag.bg, color: tag.color, fontWeight: 600 }}>
          {tag.label[lang] || tag.label.ru}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{formatDate(post.created_at, lang)}</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', marginBottom: 20, lineHeight: 1.3 }}>
        {title}
      </h1>

      <div style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
        {(body || '').split(/(\*\*.+?\*\*)/).map((part, i) =>
          part.startsWith('**') && part.endsWith('**')
            ? <b key={i} style={{ color: 'var(--ink)' }}>{part.slice(2, -2)}</b>
            : part
        )}
      </div>
    </article>
  )
}

export default function Blog() {
  const { t, lang } = useI18n()
  const [posts, setPosts] = useState([])
  const [activePost, setActivePost] = useState(null)
  const [loading, setLoading] = useState(true)

  // Read slug from URL path: /blog/my-post-slug
  useEffect(() => {
    const path = location.pathname.replace(/^\/en\/?/, '/')
    const match = path.match(/^\/blog\/(.+)$/)
    if (match) {
      const slug = match[1]
      fetch(`/api/blog/${slug}`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(post => { setActivePost(post); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [])

  useEffect(() => {
    fetch('/api/blog')
      .then(r => r.json())
      .then(data => { setPosts(data.posts || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function openPost(post) {
    setActivePost(post)
    const base = location.pathname.startsWith('/en') ? '/en/' : '/'
    history.replaceState(null, '', `${base}blog/${post.slug}`)
    document.title = `${lang === 'en' && post.title_en ? post.title_en : post.title_ru} — Snatch Highrise`
  }

  function goBack() {
    setActivePost(null)
    const base = location.pathname.startsWith('/en') ? '/en/' : '/'
    history.replaceState(null, '', `${base}blog`)
    document.title = 'Snatch Highrise — Strategy board game with AI'
  }

  if (activePost) {
    return <PostView post={activePost} lang={lang} onBack={goBack} />
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 700, margin: 0 }}>
          {t('blog.title')}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>
          {t('blog.subtitle')}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--ink3)', padding: 40 }}>
          {t('common.loading')}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--ink3)', padding: 40 }}>
          {t('blog.noPosts')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(p => (
            <PostCard key={p.id} post={p} lang={lang} onOpen={openPost} />
          ))}
        </div>
      )}
    </div>
  )
}
