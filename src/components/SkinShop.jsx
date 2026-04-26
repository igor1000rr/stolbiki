/**
 * SkinShop — popup для кастомизации.
 *
 * 26.04.2026 — большая ревизия по обратной связи Александра:
 *
 * "Соединить Темы и Фоны как одну сущность. Окошки выбора как у Backgrounds.
 *  Light → Sunny Day in Park + light фон, default бесплатная.
 *  Dark → Night City + ночной фон, за кирпичи.
 *  Остальные темы тоже за кирпичи. Стили дублировать с разными сюжетами.
 *  УДАЛИТЬ вкладку Backgrounds (объединить с темами).
 *  УДАЛИТЬ вкладку Stands (нет игровой логики)."
 *
 * Что сделано в этом коммите (frontend-only, без миграции БД):
 * - Каждая тема получила linkedBgId — при выборе темы автоматически
 *   выставляется связанный фон.
 * - Вкладка Stands и Backgrounds СКРЫТЫ из UI. Старые купленные стенды
 *   продолжают применяться через settings.standStyle (backward compat),
 *   но новых не купить — это как раз для последующей миграции БД 14.
 * - В превью темы — фон в качестве фона миниатюры (вместо плоского bg-цвета).
 * - Тематика тем расширена: "Sunny Day in Park" (minimal+day), "Night City"
 *   (default+night). Остальные пока используют bg_city_night по умолчанию,
 *   расширим когда добавим больше фонов.
 *
 * НЕ сделано здесь (требует backend):
 * - Snappy Block для одинаковых скинов у двух игроков
 * - Миграция БД 14: рефанд кирпичей за купленные стенды
 * - Новые премиум-блоки (золото, алмаз, $1.5+)
 *
 * v5.2: bricks с сервера, кнопка Rewarded только в native / DEV
 * v5.5: 3D превью активного скина в вкладке Блоки
 */
import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import { useGameContext } from '../engine/GameContext'
import { getSettings, saveSettings, applySettings } from '../engine/settings'
import { showRewarded } from '../engine/admob'
import Block3DPreview from './Block3DPreview'

const isNative = () => !!window.Capacitor?.isNativePlatform?.()
const showRewardedBtn = () => isNative() || import.meta.env.DEV

const CHIP_SKINS = [
  { id: 'blocks_classic', legacyId: 'classic', ru: 'Классика', en: 'Classic', level: 1, price: 0, rarity: 'common',
    css0: 'linear-gradient(180deg, #85c4ff, #4a9eff, #3580d4)',
    css1: 'linear-gradient(180deg, #ffa0a4, #ff6066, #d44c52)',
    shadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)', radius: 7 },
  { id: 'blocks_flat', legacyId: 'flat', ru: 'Плоские', en: 'Flat', level: 1, price: 0, rarity: 'common',
    css0: '#4a9eff', css1: '#ff6066', shadow: 'none', radius: 2 },
  { id: 'blocks_round', legacyId: 'rounded', ru: 'Круглые', en: 'Round', level: 2, price: 50, rarity: 'common',
    css0: '#4a9eff', css1: '#ff6066', shadow: 'none', radius: '50%', size: 14 },
  { id: 'blocks_glass', legacyId: 'glass', ru: 'Стекло', en: 'Glass', level: 3, price: 80, rarity: 'rare',
    css0: 'linear-gradient(180deg, rgba(74,158,255,0.7), rgba(74,158,255,0.3))',
    css1: 'linear-gradient(180deg, rgba(255,96,102,0.7), rgba(255,96,102,0.3))',
    shadow: '0 2px 8px rgba(74,158,255,0.2), inset 0 1px 0 rgba(255,255,255,0.5)', radius: 7 },
  { id: 'blocks_metal', legacyId: 'metal', ru: 'Металл', en: 'Metal', level: 5, price: 120, rarity: 'rare',
    css0: 'linear-gradient(180deg, #b8d4f0, #6a9cc8, #4a7ca8, #6a9cc8)',
    css1: 'linear-gradient(180deg, #f0b8b8, #c86a6a, #a84a4a, #c86a6a)',
    shadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.6)', radius: 7 },
  { id: 'blocks_candy', legacyId: 'candy', ru: 'Candy', en: 'Candy', level: 7, price: 200, rarity: 'epic',
    css0: 'linear-gradient(180deg, #a0e0ff, #60c0ff, #40a0e0)',
    css1: 'linear-gradient(180deg, #ffa0c0, #ff6090, #e04070)',
    shadow: '0 3px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.4)', radius: 10 },
  { id: 'blocks_pixel', legacyId: 'pixel', ru: 'Пиксель', en: 'Pixel', level: 10, price: 150, rarity: 'rare',
    css0: '#4a9eff', css1: '#ff6066', shadow: '2px 2px 0 rgba(0,0,0,0.3)', radius: 0 },
  { id: 'blocks_neon', legacyId: 'neon', ru: 'Неон', en: 'Neon', level: 12, price: 300, rarity: 'epic',
    css0: '#00e5ff', css1: '#ff3090',
    shadow: '0 0 8px rgba(0,229,255,0.5), 0 0 16px rgba(0,229,255,0.3)',
    shadow1: '0 0 8px rgba(255,48,144,0.5), 0 0 16px rgba(255,48,144,0.3)', radius: 7 },
  { id: 'blocks_glow', legacyId: 'glow', ru: 'Свечение', en: 'Glow', level: 15, price: 350, rarity: 'legendary',
    css0: '#4a9eff', css1: '#ff6066',
    shadow: '0 0 8px rgba(74,158,255,0.5), 0 0 16px rgba(74,158,255,0.3)',
    shadow1: '0 0 8px rgba(255,96,102,0.5), 0 0 16px rgba(255,96,102,0.3)', radius: 7 },
]

// STAND_SKINS оставлен в коде для backward-совместимости: купленные ранее
// стенды продолжают применяться через settings.standStyle (Board.jsx
// использует это значение). Но в UI больше не показываем — Александр
// удалил вкладку Stands ("нет игровой логики").
const STAND_SKINS = [
  { id: 'stands_classic', legacyId: 'classic', ru: 'Классика', en: 'Classic', level: 1, price: 0, rarity: 'common',
    bg: 'linear-gradient(180deg, rgba(20,20,32,0.9), rgba(20,20,32,0.6))', border: 'rgba(255,255,255,0.06)' },
  { id: 'stands_marble', legacyId: 'marble', ru: 'Мрамор', en: 'Marble', level: 2, price: 60, rarity: 'common',
    bg: 'linear-gradient(170deg, #2a2a3a, #1e1e2e, #2a2840, #1a1a28)', border: 'rgba(255,255,255,0.1)' },
  { id: 'stands_concrete', legacyId: 'concrete', ru: 'Бетон', en: 'Concrete', level: 3, price: 0, rarity: 'common',
    bg: 'linear-gradient(180deg, #3a3a42, #2e2e36)', border: 'rgba(255,255,255,0.06)' },
  { id: 'stands_bamboo', legacyId: 'bamboo', ru: 'Бамбук', en: 'Bamboo', level: 4, price: 100, rarity: 'rare',
    bg: 'linear-gradient(180deg, #3a5a30, #2a4820, #1e3a16)', border: 'rgba(100,180,60,0.15)' },
  { id: 'stands_obsidian', legacyId: 'obsidian', ru: 'Обсидиан', en: 'Obsidian', level: 6, price: 180, rarity: 'epic',
    bg: 'linear-gradient(180deg, #1a1a22, #0e0e14, #1a1a22)', border: 'rgba(100,100,140,0.15)' },
  { id: 'stands_crystal', legacyId: 'crystal', ru: 'Кристалл', en: 'Crystal', level: 8, price: 250, rarity: 'epic',
    bg: 'linear-gradient(180deg, rgba(60,80,120,0.6), rgba(30,40,60,0.8))', border: 'rgba(100,160,255,0.15)' },
  { id: 'stands_rust', legacyId: 'rust', ru: 'Ржавчина', en: 'Rust', level: 12, price: 200, rarity: 'rare',
    bg: 'linear-gradient(180deg, #4a3028, #3a2018, #2a1810)', border: 'rgba(180,100,60,0.2)' },
  { id: 'stands_void', legacyId: 'void', ru: 'Void', en: 'Void', level: 16, price: 400, rarity: 'legendary',
    bg: 'linear-gradient(180deg, #0a0a14, #050508, #0a0a14)', border: 'rgba(80,60,120,0.2)' },
  { id: 'stands_ice', legacyId: 'ice', ru: 'Лёд', en: 'Ice', level: 20, price: 500, rarity: 'legendary',
    bg: 'linear-gradient(180deg, rgba(180,220,255,0.3), rgba(120,180,240,0.15), rgba(180,220,255,0.25))', border: 'rgba(120,180,240,0.25)' },
]

// Фоны — теперь не отдельная категория. Используются только для linkedBgId
// в темах. Если в будущем добавим премиум-фоны, можно вернуть отдельную
// вкладку — но по ТЗ Александра в апр 2026 объединили с темами.
const BG_SKINS = [
  { id: 'bg_city_day',   ru: 'Дневной город', en: 'City Day',   price: 0,   rarity: 'common',
    asset: '/backgrounds/day-tablet-landscape.webp' },
  { id: 'bg_city_night', ru: 'Ночной город',  en: 'City Night', price: 200, rarity: 'rare',
    asset: '/backgrounds/night-tablet-landscape.webp' },
]

// Темы расширены: каждая знает свой linkedBgId. При выборе темы автоматом
// выставляется связанный фон. Названия по ТЗ Александра: minimal=Light=
// "Sunny Day in Park", default=Dark="Night City". Остальные используют
// bg_city_night как универсальный фон до добавления новых.
const THEMES = [
  { id: 'default',  themeId: 'theme_default',  ru: 'Город ночью',     en: 'Night City',
    price: 0,   rarity: 'common', linkedBgId: 'bg_city_night',
    bg: '#0c0c12', surface: '#1a1a2a', accent: '#3bb8a8', p1: '#4a9eff',  p2: '#ff6066' },
  { id: 'minimal',  themeId: 'theme_minimal',  ru: 'Парк днём',       en: 'Sunny Day in Park',
    price: 0,   rarity: 'common', linkedBgId: 'bg_city_day',
    bg: '#f5f5f7', surface: '#ffffff', accent: '#0071e3', p1: '#007aff',  p2: '#ff3b30' },
  { id: 'forest',   themeId: 'theme_forest',   ru: 'Лес',             en: 'Forest',
    price: 0,   rarity: 'common', linkedBgId: 'bg_city_night',
    bg: '#0c1a0f', surface: '#1a2e1f', accent: '#4caf50', p1: '#81c784',  p2: '#e57373' },
  { id: 'ocean',    themeId: 'theme_ocean',    ru: 'Океан',           en: 'Ocean',
    price: 300, rarity: 'rare', linkedBgId: 'bg_city_night',
    bg: '#0a1628', surface: '#132840', accent: '#00bcd4', p1: '#4fc3f7',  p2: '#ef5350' },
  { id: 'wood',     themeId: 'theme_wood',     ru: 'Дерево',          en: 'Wood',
    price: 300, rarity: 'rare', linkedBgId: 'bg_city_night',
    bg: '#2c1e0f', surface: '#4a3520', accent: '#d4803a', p1: '#f0ece0',  p2: '#2a2018' },
  { id: 'sunset',   themeId: 'theme_sunset',   ru: 'Закат',           en: 'Sunset',
    price: 400, rarity: 'rare', linkedBgId: 'bg_city_day',
    bg: '#1a0e1e', surface: '#2e1a32', accent: '#ff7043', p1: '#ffa726',  p2: '#ab47bc' },
  { id: 'arctic',   themeId: 'theme_arctic',   ru: 'Арктика',         en: 'Arctic',
    price: 400, rarity: 'rare', linkedBgId: 'bg_city_day',
    bg: '#0a1520', surface: '#122436', accent: '#40c4ff', p1: '#80d8ff',  p2: '#ff8a80' },
  { id: 'royal',    themeId: 'theme_royal',    ru: 'Королевская',     en: 'Royal',
    price: 400, rarity: 'epic', linkedBgId: 'bg_city_night',
    bg: '#0e0a18', surface: '#1e1638', accent: '#9c27b0', p1: '#ce93d8',  p2: '#ef5350' },
  { id: 'retro',    themeId: 'theme_retro',    ru: 'Ретро',           en: 'Retro',
    price: 500, rarity: 'epic', linkedBgId: 'bg_city_night',
    bg: '#0a0a00', surface: '#1a1a06', accent: '#76ff03', p1: '#76ff03',  p2: '#ff6e40' },
  { id: 'sakura',   themeId: 'theme_sakura',   ru: 'Сакура',          en: 'Sakura',
    price: 500, rarity: 'epic', linkedBgId: 'bg_city_day',
    bg: '#1a0e14', surface: '#2e1824', accent: '#f06292', p1: '#f48fb1',  p2: '#4fc3f7' },
  { id: 'neon',     themeId: 'theme_neon',     ru: 'Неон',            en: 'Neon',
    price: 600, rarity: 'legendary', linkedBgId: 'bg_city_night',
    bg: '#05050a', surface: '#0f0f22', accent: '#ff00ff', p1: '#00e5ff',  p2: '#ff3090' },
]

const RARITY_COLOR = { common: 'var(--ink3)', rare: '#4a9eff', epic: '#9b59b6', legendary: '#ffc145' }

// Превью темы теперь отображается на фоне связанной webp-картинки —
// игрок сразу видит "тема + фон" в комплекте, как просил Александр.
function ThemePreview({ theme }) {
  const bgSkin = BG_SKINS.find(b => b.id === theme.linkedBgId)
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 8, border: `1px solid ${theme.accent}30`,
      minHeight: 70,
    }}>
      {bgSkin && (
        <img src={bgSkin.asset} alt="" loading="lazy" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center bottom',
          opacity: 0.55,
        }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
      )}
      {/* Полупрозрачный overlay цвета bg темы — приглушает фон чтобы было
          видно цвет темы. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.bg, opacity: 0.45, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', gap: 3, justifyContent: 'center', padding: '8px 6px',
      }}>
        {[4, 6, 3].map((count, si) => (
          <div key={si} style={{ width: 18, minHeight: 50, borderRadius: '4px 4px 0 0',
            background: theme.surface, border: si === 0 ? `1px solid ${theme.accent}40` : `1px solid ${theme.accent}15`,
            display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', padding: '2px 1px', gap: 1 }}>
            {Array.from({ length: count }).map((_, ci) => {
              const isP1 = si === 0 ? ci < 2 : si === 1 ? ci >= 3 : ci < 1
              return <div key={ci} style={{ width: 12, height: 4, borderRadius: 2, background: isP1 ? theme.p1 : theme.p2 }} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChipPreview({ skin }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 1, padding: '4px 0' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const isP1 = i < 3
        const w = skin.size || 32, h = skin.size || 10
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

function RarityBadge({ rarity, en }) {
  const labels = { common: '', rare: en ? 'Rare' : 'Редкий', epic: en ? 'Epic' : 'Эпик', legendary: en ? 'Legend' : 'Легенда' }
  if (!labels[rarity]) return null
  return <span style={{ fontSize: 9, fontWeight: 700, color: RARITY_COLOR[rarity], letterSpacing: 0.3 }}>{labels[rarity]}</span>
}

export function PaintIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
    </svg>
  )
}

function applyBgSkin(bgId) {
  try { document.documentElement.setAttribute('data-skin-bg', bgId) } catch {}
}

export default function SkinShop({ onClose, _userLevel = 1, currentTheme = 'default', onThemeChange, bricks = 0, onBricksChange }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const gameCtx = useGameContext()
  const [tab, setTab] = useState('themes')
  const [settings, setSettings] = useState(getSettings)
  const [ownedSkins, setOwnedSkins] = useState(new Set())
  const [purchasing, setPurchasing] = useState(null)
  const [equipping, setEquipping] = useState(null)
  const [localBricks, setLocalBricks] = useState(bricks)
  const [serverActive, setServerActive] = useState({ blocks: null, stands: null, background: null })
  const [watchingAd, setWatchingAd] = useState(false)
  const [rewardMsg, setRewardMsg] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('stolbiki_token')
    if (!token) return
    fetch('/api/bricks/skins', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.skins) setOwnedSkins(new Set(d.skins.filter(s => s.owned).map(s => s.id)))
        if (d.active) {
          setServerActive(d.active)
          if (d.active.background) applyBgSkin(d.active.background)
        }
        if (typeof d.bricks === 'number') {
          setLocalBricks(d.bricks)
          onBricksChange?.(d.bricks)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { setLocalBricks(bricks) }, [bricks])

  useEffect(() => {
    if (!serverActive.blocks && !serverActive.stands) return
    const chipSkin = CHIP_SKINS.find(s => s.id === serverActive.blocks)
    const standSkin = STAND_SKINS.find(s => s.id === serverActive.stands)
    if (chipSkin || standSkin) {
      const ns = { ...getSettings() }
      if (chipSkin) ns.chipStyle = chipSkin.legacyId || chipSkin.id
      if (standSkin) ns.standStyle = standSkin.legacyId || standSkin.id
      setSettings(ns); saveSettings(ns); applySettings(ns)
    }
  }, [serverActive])

  function isUnlocked(skin) {
    if (skin.price === 0) return true
    return ownedSkins.has(skin.id) || ownedSkins.has(skin.themeId)
  }

  // При выборе темы автоматом выставляется её linkedBgId. Это и есть
  // объединение Темы+Фоны по ТЗ Александра — игроку не надо отдельно
  // лезть в Backgrounds-вкладку.
  function applyThemeWithBg(theme) {
    if (theme.linkedBgId) {
      applyBgSkin(theme.linkedBgId)
      const ns = { ...getSettings(), bgStyle: theme.linkedBgId }
      setSettings(ns); saveSettings(ns); applySettings(ns)
      setServerActive(prev => ({ ...prev, background: theme.linkedBgId }))
      // Сообщаем серверу что фон теперь такой (при наличии токена)
      const token = localStorage.getItem('stolbiki_token')
      if (token) {
        fetch('/api/bricks/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ skinId: theme.linkedBgId }),
        }).catch(() => {})
      }
    }
    onThemeChange?.(theme.id)
  }

  async function equip(skin, kind /* 'chip' */) {
    const selectKey = 'chipStyle'
    const selectVal = skin.legacyId || skin.id
    const ns = { ...settings, [selectKey]: selectVal }
    setSettings(ns); saveSettings(ns); applySettings(ns)
    gameCtx?.emit('settingsChanged')
    const token = localStorage.getItem('stolbiki_token')
    if (token) {
      setEquipping(skin.id)
      try {
        await fetch('/api/bricks/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ skinId: skin.id }),
        })
        setServerActive(prev => ({ ...prev, blocks: skin.id }))
      } catch {}
      setEquipping(null)
    }
  }

  async function purchase(skin) {
    if (localBricks < skin.price) return
    setPurchasing(skin.id)
    try {
      const r = await fetch('/api/bricks/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({ skinId: skin.id }),
      })
      const d = await r.json()
      if (r.ok) {
        setOwnedSkins(prev => new Set([...prev, skin.id]))
        if (d.bricks !== null && d.bricks !== undefined) {
          setLocalBricks(d.bricks); onBricksChange?.(d.bricks)
        }
      }
    } catch {}
    setPurchasing(null)
  }

  async function purchaseTheme(th) {
    if (localBricks < th.price) return
    setPurchasing(th.themeId)
    try {
      const r = await fetch('/api/bricks/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({ skinId: th.themeId }),
      })
      const d = await r.json()
      if (r.ok) {
        setOwnedSkins(prev => new Set([...prev, th.themeId]))
        if (d.bricks !== null && d.bricks !== undefined) {
          setLocalBricks(d.bricks); onBricksChange?.(d.bricks)
        }
        applyThemeWithBg(th)
      }
    } catch {}
    setPurchasing(null)
  }

  async function watchAdForBricks() {
    if (!localStorage.getItem('stolbiki_token')) return
    setWatchingAd(true)
    try {
      await showRewarded(async (rewardAmount) => {
        const r = await fetch('/api/bricks/award-rewarded', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('stolbiki_token')}` },
          body: JSON.stringify({ amount: rewardAmount || 10 }),
        })
        const d = await r.json()
        if (r.ok && typeof d.bricks === 'number') {
          setLocalBricks(d.bricks)
          onBricksChange?.(d.bricks)
          setRewardMsg(`+${rewardAmount || 10} 🧱`)
          setTimeout(() => setRewardMsg(null), 3000)
        }
      })
    } catch {}
    setWatchingAd(false)
  }

  // renderSkinCard остался только для блоков. Stands и Backgrounds больше
  // не показываются — полностью убраны из UI по ТЗ Александра.
  function renderSkinCard(skin) {
    const unlocked = isUnlocked(skin)
    const activeId = serverActive.blocks || settings.chipStyle
    const active = skin.id === activeId || skin.legacyId === activeId

    return (
      <div key={skin.id} style={{
        padding: 12, borderRadius: 12,
        background: active ? 'rgba(59,184,168,0.08)' : 'var(--surface)',
        border: `2px solid ${active ? 'var(--accent)' : RARITY_COLOR[skin.rarity] + '30'}`,
        opacity: !unlocked && skin.price === 0 ? 0.4 : 1,
        transition: 'all 0.2s', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 1 }}>
          <RarityBadge rarity={skin.rarity} en={en} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center',
          padding: '6px 0 8px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 8, marginBottom: 8,
          minHeight: 60, alignItems: 'center' }}>
          <ChipPreview skin={skin} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--ink)' }}>
            {en ? skin.en : skin.ru}
          </span>
          {active && <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>}
        </div>
        {unlocked ? (
          <button onClick={() => equip(skin, 'chip')} disabled={active || equipping === skin.id} style={{
            width: '100%', padding: '5px 0', borderRadius: 6, border: 'none',
            background: active ? 'rgba(59,184,168,0.1)' : 'rgba(255,255,255,0.05)',
            color: active ? 'var(--accent)' : 'var(--ink2)',
            cursor: active ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            {equipping === skin.id ? '…' : active ? (en ? 'Equipped ✓' : 'Экипирован ✓') : (en ? 'Equip' : 'Экипировать')}
          </button>
        ) : skin.price > 0 ? (
          <button onClick={() => purchase(skin)} disabled={localBricks < skin.price || purchasing === skin.id} style={{
            width: '100%', padding: '5px 0', borderRadius: 6, border: 'none',
            background: localBricks >= skin.price ? 'rgba(255,193,69,0.15)' : 'var(--surface2)',
            color: localBricks >= skin.price ? 'var(--gold)' : 'var(--ink3)',
            cursor: localBricks >= skin.price ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            opacity: purchasing === skin.id ? 0.6 : 1, transition: 'all 0.15s',
          }}>
            {purchasing === skin.id ? '…' : `🧱 ${skin.price}`}
          </button>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', padding: '4px 0' }}>
            Lv.{skin.level}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column', overflow: 'auto',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--surface2)', flexShrink: 0,
        position: 'sticky', top: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PaintIcon size={18} color="var(--accent)" />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{en ? 'Customize' : 'Оформление'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rewardMsg && (
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', animation: 'fadeIn 0.3s ease' }}>
              {rewardMsg}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)',
            background: 'rgba(255,193,69,0.1)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,193,69,0.2)' }}>
            🧱 {localBricks}
          </span>
          <button className="btn" onClick={onClose} style={{ fontSize: 12, padding: '6px 14px' }}>
            {en ? 'Done' : 'Готово'}
          </button>
        </div>
      </div>

      {/* Только 2 вкладки: Темы (=Темы+Фоны) и Блоки (монетизация).
          Stands и Backgrounds полностью удалены по ТЗ Александра. */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--surface2)', flexShrink: 0,
        position: 'sticky', top: 56, background: 'rgba(0,0,0,0.92)', zIndex: 9,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        {[
          ['themes', en ? 'Themes' : 'Темы', THEMES.length],
          ['chips',  en ? 'Blocks' : 'Блоки', `${CHIP_SKINS.filter(s => isUnlocked(s)).length}/${CHIP_SKINS.length}`],
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {THEMES.map(th => {
              const active = currentTheme === th.id
              const owned = isUnlocked(th)
              const buyLoading = purchasing === th.themeId
              const canBuy = !owned && th.price > 0 && localBricks >= th.price
              return (
                <div key={th.id} style={{
                  padding: 12, borderRadius: 12, cursor: owned ? 'pointer' : 'default',
                  background: active ? 'rgba(59,184,168,0.08)' : 'var(--surface)',
                  border: `2px solid ${active ? 'var(--accent)' : owned ? 'var(--surface2)' : RARITY_COLOR[th.rarity] + '50'}`,
                  opacity: !owned ? 0.75 : 1, transition: 'all 0.2s',
                }} onClick={() => owned && applyThemeWithBg(th)}>
                  <ThemePreview theme={th} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {en ? th.en : th.ru}
                    </span>
                    {active && <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>✓</span>}
                    {!owned && <RarityBadge rarity={th.rarity} en={en} />}
                  </div>
                  {!owned && th.price > 0 ? (
                    <button onClick={e => { e.stopPropagation(); purchaseTheme(th) }} disabled={!canBuy || buyLoading} style={{
                      width: '100%', padding: '5px 0', borderRadius: 6, border: 'none',
                      background: canBuy ? 'rgba(255,193,69,0.15)' : 'var(--surface2)',
                      color: canBuy ? 'var(--gold)' : 'var(--ink3)',
                      cursor: canBuy ? 'pointer' : 'default',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                      {buyLoading ? '…' : `🧱 ${th.price}`}
                    </button>
                  ) : owned && !active ? (
                    <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', padding: '4px 0' }}>
                      {en ? 'Click to apply' : 'Нажми чтобы применить'}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'chips' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Block3DPreview
                skinId={serverActive.blocks || settings.chipStyle || 'blocks_classic'}
                height={160}
              />
              <div style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center', marginTop: 4, opacity: 0.6 }}>
                {en ? 'Currently equipped · Rotating preview' : 'Активный скин · Крутящееся превью'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {CHIP_SKINS.map(skin => renderSkinCard(skin))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surface)',
          borderRadius: 10, border: '1px solid var(--surface2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
                {en ? 'Earn bricks' : 'Заработать кирпичи'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.6 }}>
                {en
                  ? showRewardedBtn()
                    ? 'Win games (1–5 per game) · Watch an ad for +10 🧱'
                    : 'Win games (1–5 per game) · Ad rewards available in the mobile app'
                  : showRewardedBtn()
                    ? 'Побеждай (1–5 за игру) · Смотри рекламу за +10 🧱'
                    : 'Побеждай (1–5 за игру) · Реклама за кирпичи — в мобильном приложении'}
              </div>
            </div>
            {showRewardedBtn() && localStorage.getItem('stolbiki_token') && (
              <button
                onClick={watchAdForBricks}
                disabled={watchingAd}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,193,69,0.3)',
                  background: 'rgba(255,193,69,0.1)', color: 'var(--gold)',
                  cursor: watchingAd ? 'default' : 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  opacity: watchingAd ? 0.6 : 1, transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                }}
              >
                {watchingAd
                  ? (en ? 'Loading…' : 'Загрузка…')
                  : (en ? '▶ Watch ad +10 🧱' : '▶ Реклама +10 🧱')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
