/**
 * SkinShop — popup для выбора скинов фишек и стоек
 * Live preview mini-board, level-locked items
 */
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../engine/i18n'
import { getSettings, saveSettings, applySettings } from '../engine/settings'

const CHIP_SKINS = [
  { id: 'classic', ru: 'Классика', en: 'Classic', level: 1, preview: { borderRadius: '7px', bg0: 'linear-gradient(180deg, #85c4ff, #4a9eff, #3580d4)', bg1: 'linear-gradient(180deg, #ffa0a4, #ff6066, #d44c52)' } },
  { id: 'flat', ru: 'Плоские', en: 'Flat', level: 1, preview: { borderRadius: '2px', bg0: '#4a9eff', bg1: '#ff6066' } },
  { id: 'rounded', ru: 'Круглые', en: 'Round', level: 2, preview: { borderRadius: '50%', bg0: '#4a9eff', bg1: '#ff6066', size: 14 } },
  { id: 'glass', ru: 'Стекло', en: 'Glass', level: 3, preview: { borderRadius: '7px', bg0: 'linear-gradient(180deg, rgba(74,158,255,0.7), rgba(74,158,255,0.3))', bg1: 'linear-gradient(180deg, rgba(255,96,102,0.7), rgba(255,96,102,0.3))' } },
  { id: 'metal', ru: 'Металл', en: 'Metal', level: 5, preview: { borderRadius: '7px', bg0: 'linear-gradient(180deg, #b8d4f0, #6a9cc8, #4a7ca8, #6a9cc8)', bg1: 'linear-gradient(180deg, #f0b8b8, #c86a6a, #a84a4a, #c86a6a)' } },
  { id: 'candy', ru: 'Candy', en: 'Candy', level: 7, preview: { borderRadius: '10px', bg0: 'linear-gradient(180deg, #a0e0ff, #60c0ff, #40a0e0)', bg1: 'linear-gradient(180deg, #ffa0c0, #ff6090, #e04070)' } },
  { id: 'pixel', ru: 'Пиксель', en: 'Pixel', level: 10, preview: { borderRadius: '0px', bg0: '#4a9eff', bg1: '#ff6066' } },
  { id: 'glow', ru: 'Свечение', en: 'Glow', level: 15, preview: { borderRadius: '7px', bg0: '#4a9eff', bg1: '#ff6066', glow: true } },
]

const STAND_SKINS = [
  { id: 'classic', ru: 'Классика', en: 'Classic', level: 1, color: '#1a1a2a' },
  { id: 'marble', ru: 'Мрамор', en: 'Marble', level: 2, color: '#2a2a3a' },
  { id: 'concrete', ru: 'Бетон', en: 'Concrete', level: 3, color: '#3a3a42' },
  { id: 'bamboo', ru: 'Бамбук', en: 'Bamboo', level: 4, color: '#2a4820' },
  { id: 'obsidian', ru: 'Обсидиан', en: 'Obsidian', level: 6, color: '#0e0e14' },
  { id: 'crystal', ru: 'Кристалл', en: 'Crystal', level: 8, color: '#1e2a40' },
  { id: 'rust', ru: 'Ржавчина', en: 'Rust', level: 12, color: '#3a2018' },
  { id: 'void', ru: 'Void', en: 'Void', level: 16, color: '#050508' },
  { id: 'ice', ru: 'Лёд', en: 'Ice', level: 20, color: '#c0daf0' },
]

function MiniBoard({ chipSkin, standSkin }) {
  const p = CHIP_SKINS.find(c => c.id === chipSkin)?.preview || CHIP_SKINS[0].preview
  const sc = STAND_SKINS.find(s => s.id === standSkin)?.color || '#1a1a2a'
  const chipH = p.size || 11
  const chipW = p.size || 32
  const chipR = p.borderRadius || '7px'

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '16px 8px',
      background: 'color-mix(in srgb, var(--surface) 92%, transparent)', borderRadius: 14,
      border: '1px solid var(--surface2)' }}>
      {[0, 1, 2].map(si => (
        <div key={si} style={{
          width: 36, minHeight: 90, borderRadius: '8px 8px 0 0',
          background: sc, border: '1px solid var(--surface3)', borderBottom: 'none',
          display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
          padding: '3px 2px 4px', gap: 1,
          boxShadow: si === 0 ? '0 0 8px var(--gold-glow)' : 'none',
        }}>
          {Array.from({ length: si === 0 ? 5 : si === 1 ? 7 : 4 }).map((_, ci) => {
            const isP1 = si === 0 ? ci < 3 : si === 1 ? ci >= 4 : ci < 2
            return (
              <div key={ci} style={{
                width: chipW, height: chipH, borderRadius: chipR,
                background: isP1 ? (p.bg0 || 'var(--p1)') : (p.bg1 || 'var(--p2)'),
                boxShadow: p.glow ? `0 0 6px ${isP1 ? 'var(--p1-glow)' : 'var(--p2-glow)'}` : 'none',
              }} />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function SkinCard({ skin, selected, locked, onClick, en }) {
  return (
    <div onClick={!locked ? onClick : undefined} style={{
      padding: '10px 14px', borderRadius: 10, cursor: locked ? 'default' : 'pointer',
      background: selected ? 'var(--accent-glow)' : 'var(--surface)',
      border: `2px solid ${selected ? 'var(--accent)' : 'var(--surface2)'}`,
      opacity: locked ? 0.45 : 1,
      transition: 'all 0.2s',
      display: 'flex', alignItems: 'center', gap: 10,
      position: 'relative',
    }}>
      {locked && (
        <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: 'var(--ink3)',
          background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
          Lv.{skin.level}
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400,
        color: selected ? 'var(--accent)' : 'var(--ink)' }}>
        {en ? skin.en : skin.ru}
      </div>
      {selected && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 'auto' }}>✓</span>}
    </div>
  )
}

export default function SkinShop({ onClose, userLevel = 1 }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [tab, setTab] = useState('chips') // chips | stands
  const [settings, setSettings] = useState(getSettings)
  const previewRef = useRef(null)

  function select(key, value) {
    const ns = { ...settings, [key]: value }
    setSettings(ns)
    saveSettings(ns)
    applySettings(ns)
  }

  const chipSkins = CHIP_SKINS
  const standSkins = STAND_SKINS

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
          {en ? 'Skin Shop' : 'Магазин скинов'}
        </div>
        <button className="btn" onClick={onClose} style={{ fontSize: 12, padding: '6px 14px' }}>
          {en ? 'Done' : 'Готово'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

        {/* Left: live preview */}
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 20, borderRight: '1px solid var(--surface2)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 10, textAlign: 'center' }}>
            {en ? 'Preview' : 'Превью'}
          </div>
          <MiniBoard chipSkin={settings.chipStyle} standSkin={settings.standStyle} />
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{en ? 'Your level' : 'Ваш уровень'}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--p1)' }}>Lv.{userLevel}</div>
          </div>
        </div>

        {/* Right: tabs + grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--surface2)', flexShrink: 0 }}>
            {[
              ['chips', en ? 'Chip skins' : 'Скины фишек', `${chipSkins.filter(s => s.level <= userLevel).length}/${chipSkins.length}`],
              ['stands', en ? 'Stand skins' : 'Скины стоек', `${standSkins.filter(s => s.level <= userLevel).length}/${standSkins.length}`],
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

          {/* Grid */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {tab === 'chips' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {chipSkins.map(skin => (
                  <SkinCard key={skin.id} skin={skin} en={en}
                    selected={settings.chipStyle === skin.id}
                    locked={skin.level > userLevel}
                    onClick={() => select('chipStyle', skin.id)} />
                ))}
              </div>
            )}

            {tab === 'stands' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {standSkins.map(skin => (
                  <SkinCard key={skin.id} skin={skin} en={en}
                    selected={settings.standStyle === skin.id}
                    locked={skin.level > userLevel}
                    onClick={() => select('standStyle', skin.id)} />
                ))}
              </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface)',
              borderRadius: 10, border: '1px solid var(--surface2)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.8 }}>
                {en
                  ? 'New skins unlock as you level up. Win games, complete missions, and solve puzzles to earn XP!'
                  : 'Новые скины открываются с ростом уровня. Побеждайте, выполняйте миссии и решайте головоломки!'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
