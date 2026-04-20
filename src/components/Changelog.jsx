/**
 * Changelog — история версий.
 * Hero, статы, распределение типов, фильтры и поиск.
 * Стиль сайта: тёмная палитра, accent teal, DM Serif для крупных цифр.
 */
import { useState, useMemo } from 'react'
import { useI18n } from '../engine/i18n'
import VERSIONS from '../data/changelog'

// Категории. Цвета берём из app.css переменных (не хардкодим конкретные hex).
const TYPES = {
  new:      { label_ru: 'Новое',       label_en: 'New',        color: 'var(--green)',  glow: 'var(--green-glow)',  bg: 'rgba(61,214,140,0.12)' },
  improve:  { label_ru: 'Улучшение',   label_en: 'Improved',   color: 'var(--p1)',     glow: 'var(--p1-glow)',     bg: 'rgba(74,158,255,0.12)' },
  fix:      { label_ru: 'Исправлено',  label_en: 'Fixed',      color: 'var(--coral)',  glow: 'rgba(240,101,74,0.3)', bg: 'rgba(240,101,74,0.12)' },
  perf:     { label_ru: 'Скорость',    label_en: 'Performance',color: 'var(--purple)', glow: 'rgba(155,89,182,0.3)', bg: 'rgba(155,89,182,0.12)' },
  security: { label_ru: 'Безопасность',label_en: 'Security',   color: 'var(--p2)',     glow: 'var(--p2-glow)',     bg: 'rgba(255,96,102,0.12)' },
  refactor: { label_ru: 'Рефакторинг', label_en: 'Refactor',   color: 'var(--ink3)',   glow: 'rgba(110,106,130,0.3)', bg: 'rgba(110,106,130,0.15)' },
}
const TYPE_ORDER = ['security', 'new', 'improve', 'fix', 'perf', 'refactor']


function relativeDate(dateStr, lang) {
  const d = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return lang === 'en' ? 'today' : 'сегодня'
  if (diffDays === 1) return lang === 'en' ? 'yesterday' : 'вчера'
  if (diffDays < 7) return lang === 'en' ? `${diffDays}d ago` : `${diffDays} дн. назад`
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7)
    return lang === 'en' ? `${w}w ago` : `${w} нед. назад`
  }
  const m = Math.floor(diffDays / 30)
  return lang === 'en' ? `${m}mo ago` : `${m} мес. назад`
}

export default function Changelog() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [activeType, setActiveType] = useState(null) // null = все
  const [search, setSearch] = useState('')

  // Все изменения в плоском виде для статистики.
  const allChanges = useMemo(() => {
    const out = []
    for (const v of VERSIONS) {
      const list = en ? v.changes_en : v.changes_ru
      for (const c of list) out.push({ ...c, version: v.version })
    }
    return out
  }, [en])

  // Счётчики по типам (для фильтров + полосы распределения).
  const typeCounts = useMemo(() => {
    const counts = {}
    for (const c of allChanges) counts[c.type] = (counts[c.type] || 0) + 1
    return counts
  }, [allChanges])

  const totalChanges = allChanges.length
  const totalReleases = VERSIONS.length
  const latest = VERSIONS[0]

  // Фильтрация релизов по типу и по поисковой строке.
  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return VERSIONS
      .map(v => {
        const list = en ? v.changes_en : v.changes_ru
        const title = en ? v.title_en : v.title_ru
        const filteredChanges = list.filter(c => {
          if (activeType && c.type !== activeType) return false
          if (q) {
            const hay = (c.text + ' ' + v.version + ' ' + title).toLowerCase()
            if (!hay.includes(q)) return false
          }
          return true
        })
        return { ...v, _title: title, _changes: filteredChanges }
      })
      .filter(v => v._changes.length > 0)
  }, [en, activeType, search])

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 4px' }}>
      {/* Хлебные крошки */}
      <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        <a href="/" style={{ color: 'var(--ink3)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('stolbiki-go-tab', { detail: 'landing' })) }}>
          {en ? 'Home' : 'Главная'}
        </a>
        <span style={{ opacity: 0.5 }}>/</span>
        <span style={{ color: 'var(--ink2)' }}>Changelog</span>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          padding: '5px 12px', borderRadius: 999, marginBottom: 20,
          fontWeight: 500, letterSpacing: 0.3,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent-glow)', animation: 'pulse 2s ease-in-out infinite',
          }} />
          {en ? 'Open development · weekly updates' : 'Открытая разработка · еженедельные обновления'}
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 68px)',
          lineHeight: 1.05,
          fontFamily: "'DM Serif Display', serif",
          fontWeight: 400,
          color: 'var(--ink)',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Changelog
        </h1>
        <p style={{
          fontSize: 15, lineHeight: 1.5, color: 'var(--ink2)',
          marginTop: 16, maxWidth: 560,
        }}>
          {en
            ? 'Every change to the platform — public. Security, features, fixes — without embellishment or marketing.'
            : 'Каждое изменение платформы — публично. Безопасность, фичи, исправления — без приукрашиваний и маркетинга.'}
        </p>
      </div>

      {/* Стат-карточки + полоса распределения */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 32,
        alignItems: 'center',
        padding: '24px 0',
        borderTop: '1px solid var(--surface2)',
        borderBottom: '1px solid var(--surface2)',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', gap: 28 }}>
          <Stat value={totalReleases} label={en ? 'releases' : 'релизов'} />
          <Stat value={totalChanges} label={en ? 'changes' : 'изменений'} />
          <Stat value={`v${latest?.version || '—'}`} label={relativeDate(latest?.date, lang)} accent />
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>
            {en ? 'DISTRIBUTION' : 'РАСПРЕДЕЛЕНИЕ'}
          </div>
          <DistributionBar typeCounts={typeCounts} total={totalChanges} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 10, fontSize: 11 }}>
            {TYPE_ORDER.filter(t => typeCounts[t]).map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPES[t].color }} />
                <span style={{ color: 'var(--ink3)' }}>{en ? TYPES[t].label_en : TYPES[t].label_ru}</span>
                <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{typeCounts[t]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Поиск + фильтры */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={en ? 'Search releases…' : 'Поиск релизов…'}
            style={{
              width: '100%', padding: '9px 14px 9px 34px',
              fontSize: 13, fontFamily: 'inherit',
              background: 'var(--surface)', color: 'var(--ink)',
              border: '1px solid var(--surface3)', borderRadius: 10,
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--surface3)'}
          />
        </div>

        <button onClick={() => setActiveType(null)} style={filterBtnStyle(!activeType, null)}>
          {en ? 'All' : 'Все'} <span style={filterCountStyle(!activeType, null)}>{totalChanges}</span>
        </button>
        {TYPE_ORDER.filter(t => typeCounts[t]).map(t => {
          const active = activeType === t
          return (
            <button key={t} onClick={() => setActiveType(active ? null : t)} style={filterBtnStyle(active, TYPES[t])}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPES[t].color, flexShrink: 0 }} />
              {en ? TYPES[t].label_en : TYPES[t].label_ru}
              <span style={filterCountStyle(active, TYPES[t])}>{typeCounts[t]}</span>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 16 }}>
        {filteredVersions.length === VERSIONS.length
          ? (en ? `${VERSIONS.length} releases` : `${VERSIONS.length} релизов`)
          : (en ? `${filteredVersions.length} of ${VERSIONS.length} releases` : `${filteredVersions.length} из ${VERSIONS.length} релизов`)}
      </div>

      {/* Карточки релизов */}
      {filteredVersions.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          border: '1px dashed var(--surface3)', borderRadius: 16,
          color: 'var(--ink3)', fontSize: 14,
        }}>
          {en ? 'Nothing found. Try a different query or filter.' : 'Ничего не найдено. Попробуй другой запрос или фильтр.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {filteredVersions.map((v, i) => (
            <ReleaseCard key={v.version} version={v} index={i} isLatest={i === 0 && !activeType && !search} lang={lang} />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────── Стат-ячейка ──────────
function Stat({ value, label, accent }) {
  return (
    <div>
      <div style={{
        fontSize: 30, fontWeight: 700, lineHeight: 1,
        fontFamily: "'DM Serif Display', serif",
        color: accent ? 'var(--accent)' : 'var(--ink)',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink3)', letterSpacing: 1.2, marginTop: 4, textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  )
}

// ────────── Полоса распределения ──────────
function DistributionBar({ typeCounts, total }) {
  if (!total) return null
  return (
    <div style={{
      display: 'flex', height: 8, borderRadius: 6, overflow: 'hidden',
      background: 'var(--surface2)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
    }}>
      {TYPE_ORDER.filter(t => typeCounts[t]).map(t => {
        const pct = (typeCounts[t] / total) * 100
        return (
          <div
            key={t}
            title={`${TYPES[t].label_ru}: ${typeCounts[t]}`}
            style={{ width: `${pct}%`, background: TYPES[t].color, transition: 'width 0.4s' }}
          />
        )
      })}
    </div>
  )
}

// ────────── Стили фильтра ──────────
function filterBtnStyle(active, typeDef) {
  const bg = active
    ? (typeDef ? typeDef.bg : 'color-mix(in srgb, var(--accent) 12%, transparent)')
    : 'var(--surface)'
  const border = active
    ? (typeDef ? typeDef.color : 'var(--accent)')
    : 'var(--surface3)'
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '7px 12px', borderRadius: 999,
    background: bg,
    border: `1px solid ${border}`,
    color: active ? 'var(--ink)' : 'var(--ink2)',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }
}

function filterCountStyle(active, typeDef) {
  return {
    fontSize: 10, fontWeight: 700,
    color: active && typeDef ? typeDef.color : 'var(--ink3)',
    opacity: active ? 1 : 0.8,
  }
}

// ────────── Карточка релиза ──────────
function ReleaseCard({ version, index, isLatest, lang }) {
  const en = lang === 'en'
  // Номер слева — это order в нашей отфильтрованной выдаче
  const n = index + 1

  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: 'clamp(64px, 10vw, 96px) 1fr',
        gap: 'clamp(16px, 3vw, 28px)',
        padding: 'clamp(18px, 3vw, 28px)',
        background: 'var(--surface)',
        border: `1px solid ${isLatest ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--surface2)'}`,
        borderRadius: 16,
        position: 'relative',
        boxShadow: isLatest ? '0 0 0 1px var(--accent-glow), 0 8px 30px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'border-color 0.2s',
      }}
    >
      {isLatest && (
        <div style={{
          position: 'absolute', top: -10, right: 20,
          fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
          padding: '3px 10px', borderRadius: 999,
          background: 'var(--accent)', color: '#fff',
          textTransform: 'uppercase',
          boxShadow: '0 2px 10px var(--accent-glow)',
        }}>
          {en ? 'Latest' : 'Свежий'}
        </div>
      )}

      {/* Левая колонка: большой номер */}
      <div>
        <div style={{
          fontSize: 'clamp(44px, 7vw, 72px)',
          lineHeight: 1,
          fontFamily: "'DM Serif Display', serif",
          color: isLatest ? 'var(--accent)' : 'var(--surface3)',
          fontWeight: 400,
          letterSpacing: '-0.04em',
        }}>
          {String(n).padStart(2, '0')}
        </div>
      </div>

      {/* Правая колонка */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <span style={{
            fontSize: 13, fontFamily: 'monospace', color: 'var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            padding: '3px 10px', borderRadius: 6, fontWeight: 600,
            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          }}>
            v{version.version}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink3)' }}>
            {relativeDate(version.date, lang)}
          </span>
          <a
            href={`#changelog-v${version.version}`}
            onClick={(e) => {
              e.preventDefault()
              navigator.clipboard?.writeText(`${location.origin}${location.pathname}#v${version.version}`).catch(() => {})
            }}
            style={{
              marginLeft: 'auto', fontSize: 11, color: 'var(--ink3)',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
              cursor: 'pointer',
            }}
            title={en ? 'Copy link' : 'Скопировать ссылку'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {en ? 'Link' : 'Ссылка'}
          </a>
        </div>

        <h3 style={{
          fontSize: 'clamp(18px, 2.5vw, 22px)',
          fontWeight: 600, color: 'var(--ink)', margin: '4px 0 14px',
          letterSpacing: '-0.01em', lineHeight: 1.3,
        }}>
          {version._title}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {version._changes.map((c, ci) => {
            const t = TYPES[c.type] || TYPES.new
            return (
              <div key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                  padding: '3px 8px', borderRadius: 4,
                  background: t.bg, color: t.color,
                  flexShrink: 0, marginTop: 3, lineHeight: '14px',
                  textTransform: 'uppercase',
                  border: `1px solid color-mix(in srgb, ${t.color} 30%, transparent)`,
                  minWidth: 72, textAlign: 'center',
                }}>
                  {en ? t.label_en : t.label_ru}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink2)' }}>{c.text}</span>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}
