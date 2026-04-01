/**
 * SkinShop — popup для кастомизации: темы, скины фишек, скины стоек
 * Визуальный превью каждого скина с текстурами
 */
import { useState } from 'react'
import { useI18n } from '../engine/i18n'
import { getSettings, saveSettings, applySettings } from '../engine/settings'

const CHIP_SKINS = [
  { id: 'classic', ru: 'Классика', en: 'Classic', level: 1,
    css0: 'linear-gradient(180deg, #85c4ff, #4a9eff, #3580d4)',
    css1: 'linear-gradient(180deg, #ffa0a4, #ff6066, #d44c52)',
    shadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)', radius: 7 },
  { id: 'flat', ru: 'Плоские', en: 'Flat', level: 1,
    css0: '#4a9eff', css1: '#ff6066', shadow: 'none', radius: 2 },
  { id: 'rounded', ru: 'Круглые', en: 'Round', level: 2,
    css0: '#4a9eff', css1: '#ff6066', shadow: 'none', radius: '50%', size: 14 },
  { id: 'glass', ru: 'Стекло', en: 'Glass', level: 3,
    css0: 'linear-gradient(180deg, rgba(74,158,255,0.7), rgba(74,158,255,0.3))',
    css1: 'linear-gradient(180deg, rgba(255,96,102,0.7), rgba(255,96,102,0.3))',
    shadow: '0 2px 8px rgba(74,158,255,0.2), inset 0 1px 0 rgba(255,255,255,0.5)', radius: 7 },
  { id: 'metal', ru: 'Металл', en: 'Metal', level: 5,
    css0: 'linear-gradient(180deg, #b8d4f0, #6a9cc8, #4a7ca8, #6a9cc8)',
    css1: 'linear-gradient(180deg, #f0b8b8, #c86a6a, #a84a4a, #c86a6a)',
    shadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.6)', radius: 7 },
  { id: 'candy', ru: 'Candy', en: 'Candy', level: 7,
    css0: 'linear-gradient(180deg, #a0e0ff, #60c0ff, #40a0e0)',
    css1: 'linear-gradient(180deg, #ffa0c0, #ff6090, #e04070)',
    shadow: '0 3px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.4)', radius: 10 },
  { id: 'pixel', ru: 'Пиксель', en: 'Pixel', level: 10,
    css0: '#4a9eff', css1: '#ff6066', shadow: '2px 2px 0 rgba(0,0,0,0.3)', radius: 0 },
  { id: 'glow', ru: 'Свечение', en: 'Glow', level: 15,
    css0: '#4a9eff', css1: '#ff6066',
    shadow: '0 0 8px rgba(74,158,255,0.5), 0 0 16px rgba(74,158,255,0.3)', radius: 7,
    shadow1: '0 0 8px rgba(255,96,102,0.5), 0 0 16px rgba(255,96,102,0.3)' },
]

const STAND_SKINS = [
  { id: 'classic', ru: 'Классика', en: 'Classic', level: 1,
    bg: 'linear-gradient(180deg, rgba(20,20,32,0.9), rgba(20,20,32,0.6))', border: 'rgba(255,255,255,0.06)' },
  { id: 'marble', ru: 'Мрамор', en: 'Marble', level: 2,
    bg: 'linear-gradient(170deg, #2a2a3a, #1e1e2e, #2a2840, #1a1a28)', border: 'rgba(255,255,255,0.1)' },
  { id: 'concrete', ru: 'Бетон', en: 'Concrete', level: 3,
    bg: 'linear-gradient(180deg, #3a3a42, #2e2e36)', border: 'rgba(255,255,255,0.06)' },
  { id: 'bamboo', ru: 'Бамбук', en: 'Bamboo', level: 4,
    bg: 'linear-gradient(180deg, #3a5a30, #2a4820, #1e3a16)', border: 'rgba(100,180,60,0.15)' },
  { id: 'obsidian', ru: 'Обсидиан', en: 'Obsidian', level: 6,
    bg: 'linear-gradient(180deg, #1a1a22, #0e0e14, #1a1a22)', border: 'rgba(100,100,140,0.15)' },
  { id: 'crystal', ru: 'Кристалл', en: 'Crystal', level: 8,
    bg: 'linear-gradient(180deg, rgba(60,80,120,0.6), rgba(30,40,60,0.8))', border: 'rgba(100,160,255,0.15)' },
  { id: 'rust', ru: 'Ржавчина', en: 'Rust', level: 12,
    bg: 'linear-gradient(180deg, #4a3028, #3a2018, #2a1810)', border: 'rgba(180,100,60,0.2)' },
  { id: 'void', ru: 'Void', en: 'Void', level: 16,
    bg: 'linear-gradient(180deg, #0a0a14, #050508, #0a0a14)', border: 'rgba(80,60,120,0.2)' },
  { id: 'ice', ru: 'Лёд', en: 'Ice', level: 20,
    bg: 'linear-gradient(180deg, rgba(180,220,255,0.3), rgba(120,180,240,0.15), rgba(180,220,255,0.25))', border: 'rgba(120,180,240,0.25)' },
]

const THEMES = [
  { id: 'default', ru: 'Тёмная', en: 'Dark', bg: '#0c0c12', surface: '#1a1a2a', accent: '#3bb8a8', p1: '#4a9eff', p2: '#ff6066' },
  { id: 'ocean', ru: 'Океан', en: 'Ocean', bg: '#0a1628', surface: '#132840', accent: '#00bcd4', p1: '#4fc3f7', p2: '#ef5350' },
  { id: 'sunset', ru: 'Закат', en: 'Sunset', bg: '#1a0e1e', surface: '#2e1a32', accent: '#ff7043', p1: '#ffa726', p2: '#ab47bc' },
  { id: 'forest', ru: 'Лес', en: 'Forest', bg: '#0c1a0f', surface: '#1a2e1f', accent: '#4caf50', p1: '#81c784', p2: '#e57373' },
  { id: 'royal', ru: 'Королевская', en: 'Royal', bg: '#0e0a18', surface: '#1e1638', accent: '#9c27b0', p1: '#ce93d8', p2: '#ef5350' },
  { id: 'sakura', ru: 'Сакура', en: 'Sakura', bg: '#1a0e14', surface: '#2e1824', accent: '#f06292', p1: '#f48fb1', p2: '#4fc3f7' },
  { id: 'neon', ru: 'Неон', en: 'Neon', bg: '#05050a', surface: '#0f0f22', accent: '#ff00ff', p1: '#00e5ff', p2: '#ff3090' },
  { id: 'wood', ru: 'Дерево', en: 'Wood', bg: '#2c1e0f', surface: '#4a3520', accent: '#d4803a', p1: '#f0ece0', p2: '#2a2018' },
  { id: 'arctic', ru: 'Арктика', en: 'Arctic', bg: '#0a1520', surface: '#122436', accent: '#40c4ff', p1: '#80d8ff', p2: '#ff8a80' },
  { id: 'retro', ru: 'Ретро', en: 'Retro', bg: '#0a0a00', surface: '#1a1a06', accent: '#76ff03', p1: '#76ff03', p2: '#ff6e40' },
  { id: 'minimal', ru: 'Светлая', en: 'Light', bg: '#f5f5f7', surface: '#ffffff', accent: '#0071e3', p1: '#007aff', p2: '#ff3b30' },
]

function ThemePreview({ theme }) {
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', padding: '8px 6px',
      background: theme.bg, borderRadius: 8, border: `1px solid ${theme.accent}20` }}>
      {[4, 6, 3].map((count, si) => (
        <div key={si} style={{ width: 18, minHeight: 50, borderRadius: '4px 4px 0 0',
          background: theme.surface, borderBottom: 'none',
          border: si === 0 ? `1px solid ${theme.accent}40` : `1px solid ${theme.accent}15`,
          display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', padding: '2px 1px', gap: 1 }}>
          {Array.from({ length: count }).map((_, ci) => {
            const isP1 = si === 0 ? ci < 2 : si === 1 ? ci >= 3 : ci < 1
            return <div key={ci} style={{ width: 12, height: 4, borderRadius: 2,
              background: isP1 ? theme.p1 : theme.p2 }} />
          })}
        </div>
      ))}
    </div>
  )
}

function ChipPreview({ skin, count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 1, padding: '4px 0' }}>
      {Array.from({ length: count }).map((_, i) => {
        const isP1 = i < 3
        const w = skin.size || 32
        const h = skin.size || 10
        return <div key={i} style={{
          width: w, height: h,
          borderRadius: typeof skin.radius === 'string' ? skin.radius : skin.radius + 'px',
          background: isP1 ? skin.css0 : skin.css1,
          boxShadow: isP1 ? skin.shadow : (skin.shadow1 || skin.shadow),
        }} />
      })}
    </div>
  )
}

function StandPreview({ skin }) {
  return (
    <div style={{ width: 28, minHeight: 56, borderRadius: '6px 6px 0 0',
      background: skin.bg, border: `1.5px solid ${skin.border}`, borderBottom: 'none',
      display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', padding: '3px 2px', gap: 1 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ width: 18, height: 5, borderRadius: 3,
          background: i < 2 ? 'var(--p1)' : 'var(--p2)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
      ))}
    </div>
  )
}

export function PaintIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  )
}

export default function SkinShop({ onClose, userLevel = 1, currentTheme = 'default', onThemeChange }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [tab, setTab] = useState('themes')
  const [settings, setSettings] = useState(getSettings)

  function select(key, value) {
    const ns = { ...settings, [key]: value }
    setSettings(ns)
    saveSettings(ns)
    applySettings(ns)
    window.dispatchEvent(new CustomEvent('stolbiki-settings-changed'))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PaintIcon size={18} color="var(--accent)" />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
            {en ? 'Customize' : 'Оформление'}
          </span>
        </div>
        <button className="btn" onClick={onClose} style={{ fontSize: 12, padding: '6px 14px' }}>
          {en ? 'Done' : 'Готово'}
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
        {[
          ['themes', en ? 'Themes' : 'Темы', THEMES.length],
          ['chips', en ? 'Chips' : 'Фишки', `${CHIP_SKINS.filter(s => s.level <= userLevel).length}/${CHIP_SKINS.length}`],
          ['stands', en ? 'Stands' : 'Стойки', `${STAND_SKINS.filter(s => s.level <= userLevel).length}/${STAND_SKINS.length}`],
        ].map(([id, label, count]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
            background: tab === id ? 'var(--surface)' : 'transparent',
            color: tab === id ? 'var(--ink)' : 'var(--ink3)',
            fontWeight: tab === id ? 600 : 400, fontSize: 13,
            borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}>
            {label} <span style={{ fontSize: 10, opacity: 0.6 }}>({count})</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'themes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {THEMES.map(th => {
              const active = currentTheme === th.id
              return (
                <div key={th.id} onClick={() => onThemeChange?.(th.id)} style={{
                  padding: 12, borderRadius: 12, cursor: 'pointer',
                  background: active ? 'var(--accent-glow)' : 'var(--surface)',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--surface2)'}`,
                  transition: 'all 0.2s',
                }}>
                  <ThemePreview theme={th} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400,
                      color: active ? 'var(--accent)' : 'var(--ink)' }}>
                      {en ? th.en : th.ru}
                    </span>
                    {active && <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'chips' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {CHIP_SKINS.map(skin => {
              const active = settings.chipStyle === skin.id
              const locked = skin.level > userLevel
              return (
                <div key={skin.id} onClick={!locked ? () => select('chipStyle', skin.id) : undefined} style={{
                  padding: 12, borderRadius: 12, cursor: locked ? 'default' : 'pointer',
                  background: active ? 'var(--accent-glow)' : 'var(--surface)',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--surface2)'}`,
                  opacity: locked ? 0.4 : 1, transition: 'all 0.2s', position: 'relative',
                }}>
                  {locked && (
                    <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: 'var(--ink3)',
                      background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
                      Lv.{skin.level}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 8px',
                    background: 'rgba(0,0,0,0.15)', borderRadius: 8, marginBottom: 8 }}>
                    <ChipPreview skin={skin} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: active ? 600 : 400,
                      color: active ? 'var(--accent)' : 'var(--ink)' }}>
                      {en ? skin.en : skin.ru}
                    </span>
                    {active && <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'stands' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {STAND_SKINS.map(skin => {
              const active = settings.standStyle === skin.id
              const locked = skin.level > userLevel
              return (
                <div key={skin.id} onClick={!locked ? () => select('standStyle', skin.id) : undefined} style={{
                  padding: 12, borderRadius: 12, cursor: locked ? 'default' : 'pointer',
                  background: active ? 'var(--accent-glow)' : 'var(--surface)',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--surface2)'}`,
                  opacity: locked ? 0.4 : 1, transition: 'all 0.2s', position: 'relative',
                }}>
                  {locked && (
                    <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: 'var(--ink3)',
                      background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
                      Lv.{skin.level}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 4px',
                    background: 'rgba(0,0,0,0.15)', borderRadius: 8, marginBottom: 8 }}>
                    <StandPreview skin={skin} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: active ? 600 : 400,
                      color: active ? 'var(--accent)' : 'var(--ink)' }}>
                      {en ? skin.en : skin.ru}
                    </span>
                    {active && <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface)',
          borderRadius: 10, border: '1px solid var(--surface2)', fontSize: 11, color: 'var(--ink3)', lineHeight: 1.8 }}>
          {en ? 'New skins unlock as you level up. Win games, complete missions, and solve puzzles to earn XP!'
            : 'Новые скины открываются с ростом уровня. Побеждайте, выполняйте миссии и решайте головоломки!'}
        </div>
      </div>
    </div>
  )
}
