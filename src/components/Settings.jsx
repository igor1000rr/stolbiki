import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import Icon from './Icon'

const DEFAULTS = {
  chipStyle: 'classic',      // classic | flat | rounded
  boardDensity: 'normal',    // compact | normal | wide
  animSpeed: 'normal',       // slow | normal | fast | off
  soundPack: 'classic',      // classic | minimal | retro | off
  timer: 'off',              // off | blitz | rapid | classical
  autoConfirm: false,
  boardFlip: false,
  colorblind: false,
  reducedMotion: false,
  largeText: false,
  highContrast: false,
  showCoords: true,
  showFillBar: true,
  showChipCount: true,
  confirmClose: true,
}

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('stolbiki_settings') || '{}') } }
  catch { return { ...DEFAULTS } }
}

function save(s) { localStorage.setItem('stolbiki_settings', JSON.stringify(s)) }

// Применяем к DOM
function applySettings(s) {
  const root = document.documentElement
  root.classList.toggle('chip-flat', s.chipStyle === 'flat')
  root.classList.toggle('chip-rounded', s.chipStyle === 'rounded')
  root.classList.toggle('board-compact', s.boardDensity === 'compact')
  root.classList.toggle('board-wide', s.boardDensity === 'wide')
  root.classList.toggle('anim-slow', s.animSpeed === 'slow')
  root.classList.toggle('anim-fast', s.animSpeed === 'fast')
  root.classList.toggle('anim-off', s.animSpeed === 'off')
  root.classList.toggle('colorblind', s.colorblind)
  root.classList.toggle('reduced-motion', s.reducedMotion)
  root.classList.toggle('large-text', s.largeText)
  root.classList.toggle('high-contrast', s.highContrast)
}

// Экспортируем для использования в других компонентах
export function getSettings() { return load() }
export function getSetting(key) { return load()[key] }

function SettingRow({ label, desc, children }) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <div className="setting-label">{label}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function SegmentControl({ options, value, onChange }) {
  return (
    <div className="segment-control">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <div className="toggle-thumb" />
    </button>
  )
}

export default function Settings() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [s, setS] = useState(load)

  function update(key, val) {
    const ns = { ...s, [key]: val }
    setS(ns)
    save(ns)
    applySettings(ns)
  }

  // Применяем при загрузке
  useEffect(() => { applySettings(s) }, [])

  return (
    <div className="settings-page">
      <h2 className="settings-title">{en ? 'Settings' : 'Настройки'}</h2>

      {/* ═══ ГЕЙМПЛЕЙ ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="play" size={16} color="var(--accent)" />
          {en ? 'Gameplay' : 'Геймплей'}
        </h3>

        <SettingRow label={en ? 'Timer' : 'Таймер'} desc={en ? 'Time control per player' : 'Контроль времени на игрока'}>
          <SegmentControl value={s.timer} onChange={v => update('timer', v)} options={[
            { value: 'off', label: en ? 'Off' : 'Нет' },
            { value: 'blitz', label: en ? 'Blitz 3m' : 'Блиц 3м' },
            { value: 'rapid', label: en ? 'Rapid 10m' : 'Рапид 10м' },
            { value: 'classical', label: en ? '30m' : '30м' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Auto-confirm' : 'Автоподтверждение'} desc={en ? 'Submit move when max chips placed' : 'Ход подтверждается автоматически при макс фишках'}>
          <Toggle checked={s.autoConfirm} onChange={v => update('autoConfirm', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Flip board' : 'Перевернуть доску'} desc={en ? 'View from red side' : 'Вид со стороны красных'}>
          <Toggle checked={s.boardFlip} onChange={v => update('boardFlip', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Confirm before close' : 'Подтверждение закрытия'} desc={en ? 'Ask before closing a stand' : 'Спрашивать перед закрытием стойки'}>
          <Toggle checked={s.confirmClose} onChange={v => update('confirmClose', v)} />
        </SettingRow>
      </section>

      {/* ═══ ВНЕШНИЙ ВИД ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="theme" size={16} color="var(--accent)" />
          {en ? 'Appearance' : 'Внешний вид'}
        </h3>

        <SettingRow label={en ? 'Chip style' : 'Стиль фишек'}>
          <SegmentControl value={s.chipStyle} onChange={v => update('chipStyle', v)} options={[
            { value: 'classic', label: en ? 'Classic' : 'Классика' },
            { value: 'flat', label: en ? 'Flat' : 'Плоские' },
            { value: 'rounded', label: en ? 'Round' : 'Круглые' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Board density' : 'Плотность доски'}>
          <SegmentControl value={s.boardDensity} onChange={v => update('boardDensity', v)} options={[
            { value: 'compact', label: en ? 'Compact' : 'Компакт' },
            { value: 'normal', label: en ? 'Normal' : 'Обычная' },
            { value: 'wide', label: en ? 'Wide' : 'Широкая' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Animation speed' : 'Скорость анимаций'}>
          <SegmentControl value={s.animSpeed} onChange={v => update('animSpeed', v)} options={[
            { value: 'slow', label: en ? 'Slow' : 'Медл.' },
            { value: 'normal', label: en ? 'Normal' : 'Обычн.' },
            { value: 'fast', label: en ? 'Fast' : 'Быстро' },
            { value: 'off', label: en ? 'Off' : 'Нет' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Show chip count' : 'Счётчик фишек'}>
          <Toggle checked={s.showChipCount} onChange={v => update('showChipCount', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Show fill bar' : 'Полоса заполнения'}>
          <Toggle checked={s.showFillBar} onChange={v => update('showFillBar', v)} />
        </SettingRow>
      </section>

      {/* ═══ ЗВУК ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="star" size={16} color="var(--accent)" />
          {en ? 'Sound' : 'Звук'}
        </h3>

        <SettingRow label={en ? 'Sound pack' : 'Звуковой пакет'}>
          <SegmentControl value={s.soundPack} onChange={v => update('soundPack', v)} options={[
            { value: 'classic', label: en ? 'Classic' : 'Классика' },
            { value: 'minimal', label: en ? 'Soft' : 'Мягкий' },
            { value: 'retro', label: en ? 'Retro' : 'Ретро' },
            { value: 'off', label: en ? 'Off' : 'Тихо' },
          ]} />
        </SettingRow>
      </section>

      {/* ═══ ДОСТУПНОСТЬ ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="profile" size={16} color="var(--accent)" />
          {en ? 'Accessibility' : 'Доступность'}
        </h3>

        <SettingRow label={en ? 'Colorblind mode' : 'Режим для дальтоников'} desc={en ? 'Patterns on chips instead of colors only' : 'Паттерны на фишках вместо только цвета'}>
          <Toggle checked={s.colorblind} onChange={v => update('colorblind', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Reduced motion' : 'Меньше анимаций'} desc={en ? 'Disable most animations' : 'Отключить большинство анимаций'}>
          <Toggle checked={s.reducedMotion} onChange={v => update('reducedMotion', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Large text' : 'Крупный текст'}>
          <Toggle checked={s.largeText} onChange={v => update('largeText', v)} />
        </SettingRow>

        <SettingRow label={en ? 'High contrast' : 'Высокий контраст'}>
          <Toggle checked={s.highContrast} onChange={v => update('highContrast', v)} />
        </SettingRow>
      </section>

      {/* Сброс */}
      <div style={{ textAlign: 'center', paddingTop: 16 }}>
        <button className="btn" onClick={() => { setS({ ...DEFAULTS }); save(DEFAULTS); applySettings(DEFAULTS) }}
          style={{ fontSize: 12, opacity: 0.6 }}>
          {en ? 'Reset to defaults' : 'Сбросить настройки'}
        </button>
      </div>
    </div>
  )
}
