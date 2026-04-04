import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import * as API from '../engine/api'
import { useGameContext } from '../engine/GameContext'
import Icon from './Icon'
import { DEFAULTS, getSettings, saveSettings, applySettings } from '../engine/settings'

function load() { return getSettings() }
function save(s) { saveSettings(s) }

function SettingRow({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function SegmentControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', borderRadius: 8, padding: 2, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          fontSize: 11, fontWeight: 500, padding: '6px 10px', border: 'none',
          background: value === o.value ? 'var(--surface)' : 'transparent',
          color: value === o.value ? 'var(--ink)' : 'var(--ink3)',
          cursor: 'pointer', borderRadius: 6, fontFamily: "'Outfit', sans-serif",
          transition: 'all 0.15s', whiteSpace: 'nowrap',
          boxShadow: value === o.value ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none',
      background: checked ? 'var(--accent)' : 'var(--surface3)',
      cursor: 'pointer', padding: 2, transition: 'background 0.2s',
      display: 'flex', alignItems: 'center', flexShrink: 0,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
      }} />
    </button>
  )
}

export default function Settings() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const gameCtx = useGameContext()
  const [s, setS] = useState(load)

  function update(key, val) {
    API.track('setting_change', 'settings', { key, val: String(val).slice(0, 20) })
    const ns = { ...s, [key]: val }
    setS(ns)
    save(ns)
    applySettings(ns)
    gameCtx?.emit('settingsChanged')
  }

  // Применяем при загрузке
  useEffect(() => { applySettings(s) }, [])

  // Обновляем при изменении из SkinShop
  useEffect(() => {
    const refresh = () => setS(load())
    window.addEventListener('stolbiki-settings-changed', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('stolbiki-settings-changed', refresh); window.removeEventListener('focus', refresh) }
  }, [])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 24 }}>{en ? 'Settings' : 'Настройки'}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ═══ ГЕЙМПЛЕЙ ═══ */}
        <div className="dash-card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--surface2)', paddingBottom: 10, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="play" size={16} color="var(--accent)" />
            {en ? 'Gameplay' : 'Геймплей'}
          </h3>
          <SettingRow label={en ? 'Timer' : 'Таймер'} desc={en ? 'Time control per player' : 'Контроль времени на игрока'}>
            <SegmentControl value={s.timer} onChange={v => update('timer', v)} options={[
              { value: 'off', label: en ? 'Off' : 'Нет' },
              { value: 'blitz', label: '3м' },
              { value: 'rapid', label: '10м' },
              { value: 'classical', label: '30м' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Auto-confirm' : 'Автоподтверждение'}>
            <Toggle checked={s.autoConfirm} onChange={v => update('autoConfirm', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Flip board' : 'Перевернуть доску'}>
            <Toggle checked={s.boardFlip} onChange={v => update('boardFlip', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Confirm close' : 'Подтверждение достройки'}>
            <Toggle checked={s.confirmClose} onChange={v => update('confirmClose', v)} />
          </SettingRow>
        </div>

        {/* ═══ ВНЕШНИЙ ВИД ═══ */}
        <div className="dash-card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--surface2)', paddingBottom: 10, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="theme" size={16} color="var(--accent)" />
            {en ? 'Appearance' : 'Внешний вид'}
          </h3>
          <SettingRow label={en ? 'Skins' : 'Скины'}>
            <button className="btn" onClick={() => gameCtx?.emit('openSkinShop')}
              style={{ fontSize: 11, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
              {s.chipStyle} · {s.standStyle}
            </button>
          </SettingRow>
          <SettingRow label={en ? 'Board density' : 'Плотность доски'}>
            <SegmentControl value={s.boardDensity} onChange={v => update('boardDensity', v)} options={[
              { value: 'compact', label: en ? 'S' : 'S' },
              { value: 'normal', label: 'M' },
              { value: 'wide', label: 'L' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Animations' : 'Анимации'}>
            <SegmentControl value={s.animSpeed} onChange={v => update('animSpeed', v)} options={[
              { value: 'slow', label: en ? 'Slow' : 'Медл.' },
              { value: 'normal', label: en ? 'Norm' : 'Обычн.' },
              { value: 'fast', label: en ? 'Fast' : 'Быстро' },
              { value: 'off', label: en ? 'Off' : 'Нет' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Block count' : 'Счётчик блоков'}>
            <Toggle checked={s.showChipCount} onChange={v => update('showChipCount', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Fill bar' : 'Полоса заполнения'}>
            <Toggle checked={s.showFillBar} onChange={v => update('showFillBar', v)} />
          </SettingRow>
        </div>

        {/* ═══ ЗВУК + AI ═══ */}
        <div className="dash-card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--surface2)', paddingBottom: 10, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="star" size={16} color="var(--accent)" />
            {en ? 'Sound & AI' : 'Звук и AI'}
          </h3>
          <SettingRow label={en ? 'Sound pack' : 'Звуковой пакет'}>
            <SegmentControl value={s.soundPack} onChange={v => update('soundPack', v)} options={[
              { value: 'classic', label: en ? 'Classic' : 'Класс.' },
              { value: 'minimal', label: en ? 'Soft' : 'Мягкий' },
              { value: 'retro', label: en ? 'Retro' : 'Ретро' },
              { value: 'off', label: en ? 'Off' : 'Тихо' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Default AI' : 'Сложность AI'}>
            <SegmentControl value={s.defaultDifficulty} onChange={v => update('defaultDifficulty', v)} options={[
              { value: 'easy', label: en ? 'Easy' : 'Лёгк.' },
              { value: 'medium', label: en ? 'Med' : 'Средн.' },
              { value: 'hard', label: en ? 'Hard' : 'Сложн.' },
              { value: 'extreme', label: en ? 'Max' : 'Макс' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Start screen' : 'Стартовый экран'}>
            <SegmentControl value={s.defaultMode} onChange={v => update('defaultMode', v)} options={[
              { value: 'landing', label: en ? 'Home' : 'Главная' },
              { value: 'game', label: en ? 'Game' : 'Игра' },
              { value: 'online', label: en ? 'Online' : 'Онлайн' },
              { value: 'puzzles', label: en ? 'Puzzles' : 'Задачи' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Stand labels' : 'Подписи стоек'}>
            <SegmentControl value={s.standLabels} onChange={v => update('standLabels', v)} options={[
              { value: 'letters', label: 'A-I' },
              { value: 'numbers', label: '1-9' },
              { value: 'off', label: en ? 'Off' : 'Выкл' },
            ]} />
          </SettingRow>
        </div>

        {/* ═══ ПРИВАТНОСТЬ + ДОСТУПНОСТЬ ═══ */}
        <div className="dash-card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--surface2)', paddingBottom: 10, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="online" size={16} color="var(--accent)" />
            {en ? 'Privacy & Access.' : 'Приватность и доступн.'}
          </h3>
          <SettingRow label={en ? 'Profile' : 'Профиль'}>
            <SegmentControl value={s.profileVisibility} onChange={v => update('profileVisibility', v)} options={[
              { value: 'public', label: en ? 'Public' : 'Все' },
              { value: 'friends', label: en ? 'Friends' : 'Друзья' },
              { value: 'private', label: en ? 'Private' : 'Скрыт' },
            ]} />
          </SettingRow>
          <SettingRow label={en ? 'Auto-rematch' : 'Авто-реванш'}>
            <Toggle checked={s.autoRematch} onChange={v => update('autoRematch', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Confirm resign' : 'Подтв. сдачи'}>
            <Toggle checked={s.confirmResign} onChange={v => update('confirmResign', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Zen mode' : 'Zen режим'}>
            <Toggle checked={s.zenMode} onChange={v => update('zenMode', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Move log' : 'Лог ходов'}>
            <Toggle checked={s.showMoveLog} onChange={v => update('showMoveLog', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Pre-game rating' : 'Рейтинг до игры'}>
            <Toggle checked={s.showPreRating} onChange={v => update('showPreRating', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Auto-save replays' : 'Авто-реплеи'}>
            <Toggle checked={s.autoSaveReplay} onChange={v => update('autoSaveReplay', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Colorblind' : 'Дальтоники'}>
            <Toggle checked={s.colorblind} onChange={v => update('colorblind', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Reduced motion' : 'Меньше анимаций'}>
            <Toggle checked={s.reducedMotion} onChange={v => update('reducedMotion', v)} />
          </SettingRow>
          <SettingRow label={en ? 'Large text' : 'Крупный текст'}>
            <Toggle checked={s.largeText} onChange={v => update('largeText', v)} />
          </SettingRow>
          <SettingRow label={en ? 'High contrast' : 'Выс. контраст'}>
            <Toggle checked={s.highContrast} onChange={v => update('highContrast', v)} />
          </SettingRow>
        </div>
      </div>

      {/* Экспорт + Сброс */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
        <button className="btn" onClick={async () => {
          try {
            const token = localStorage.getItem('stolbiki_token')
            if (!token) return
            const [profile, games, history] = await Promise.all([
              fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
              fetch('/api/games?limit=9999', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
              fetch('/api/profile/rating-history', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            ])
            const blob = new Blob([JSON.stringify({ profile, games, ratingHistory: history, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'snatch-highrise-data.json'; a.click()
          } catch {}
        }} style={{ fontSize: 12, padding: '8px 16px' }}>
          {en ? 'Export data' : 'Экспорт данных'}
        </button>
        <button className="btn" onClick={() => { setS({ ...DEFAULTS }); save(DEFAULTS); applySettings(DEFAULTS) }}
          style={{ fontSize: 12, opacity: 0.6 }}>
          {en ? 'Reset to defaults' : 'Сбросить настройки'}
        </button>
      </div>
    </div>
  )
}
