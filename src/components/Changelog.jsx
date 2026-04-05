/**
 * Changelog — история версий
 * Написано от руки, без AI-генерации
 */
import { useI18n } from '../engine/i18n'
import VERSIONS from '../data/changelog'


const TYPE_STYLE = {
  new: { label: 'NEW', color: 'var(--green)', bg: 'rgba(61,214,140,0.1)' },
  improve: { label: 'UPD', color: 'var(--p1)', bg: 'rgba(74,158,255,0.1)' },
  fix: { label: 'FIX', color: 'var(--coral)', bg: 'rgba(240,101,74,0.1)' },
  perf: { label: 'PERF', color: 'var(--purple)', bg: 'rgba(155,89,182,0.1)' },
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  if (lang === 'en') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Changelog() {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{en ? 'Changelog' : 'История обновлений'}</h2>
        <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 6 }}>
          {en ? 'What changed and when. Every update in one place.' : 'Что менялось и когда. Все обновления в одном месте.'}
        </p>
      </div>

      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* Вертикальная линия */}
        <div style={{
          position: 'absolute', left: 8, top: 8, bottom: 0, width: 2,
          background: 'linear-gradient(to bottom, var(--accent), var(--surface3))',
          borderRadius: 1,
        }} />

        {VERSIONS.map((v, vi) => {
          const changes = en ? v.changes_en : v.changes_ru
          const title = en ? v.title_en : v.title_ru

          return (
            <div key={v.version} style={{ marginBottom: vi < VERSIONS.length - 1 ? 36 : 0, position: 'relative' }}>
              {/* Точка на линии */}
              <div style={{
                position: 'absolute', left: -24, top: 6, width: 14, height: 14,
                borderRadius: '50%', background: vi === 0 ? 'var(--accent)' : 'var(--surface3)',
                border: `2px solid ${vi === 0 ? 'var(--accent)' : 'var(--surface3)'}`,
              }} />

              {/* Заголовок версии */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 18, fontWeight: 700, color: 'var(--ink)',
                  fontFamily: "'DM Serif Display', serif",
                }}>v{v.version}</span>
                <span style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 500 }}>{title}</span>
                <span style={{ fontSize: 11, color: 'var(--ink3)', marginLeft: 'auto' }}>{formatDate(v.date, lang)}</span>
              </div>

              {/* Список изменений */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {changes.map((c, ci) => {
                  const t = TYPE_STYLE[c.type] || TYPE_STYLE.new
                  return (
                    <div key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                        background: t.bg, color: t.color, flexShrink: 0, marginTop: 2,
                        letterSpacing: 0.5, lineHeight: '14px',
                      }}>{t.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{c.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
