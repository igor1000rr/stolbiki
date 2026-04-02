import { useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import Icon from './Icon'
import { DEFAULTS, getSettings, saveSettings, applySettings } from '../engine/settings'

function load() { return getSettings() }
function save(s) { saveSettings(s) }

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
    window.dispatchEvent(new CustomEvent('stolbiki-settings-changed'))
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

        <SettingRow label={en ? 'Auto-confirm' : 'Автоподтверждение'} desc={en ? 'Submit move when max blocks placed' : 'Ход подтверждается автоматически при макс блоках'}>
          <Toggle checked={s.autoConfirm} onChange={v => update('autoConfirm', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Flip board' : 'Перевернуть доску'} desc={en ? 'View from red side' : 'Вид со стороны красных'}>
          <Toggle checked={s.boardFlip} onChange={v => update('boardFlip', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Confirm before complete' : 'Подтверждение достройки'} desc={en ? 'Ask before completing a highrise' : 'Спрашивать перед достройкой высотки'}>
          <Toggle checked={s.confirmClose} onChange={v => update('confirmClose', v)} />
        </SettingRow>
      </section>

      {/* ═══ ВНЕШНИЙ ВИД ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="theme" size={16} color="var(--accent)" />
          {en ? 'Appearance' : 'Внешний вид'}
        </h3>

        <SettingRow label={en ? 'Skins' : 'Скины'}>
          <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('stolbiki-open-skinshop'))}
            style={{ fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>
            {en ? `Blocks: ${s.chipStyle} · Stands: ${s.standStyle}` : `Блоки: ${s.chipStyle} · Стойки: ${s.standStyle}`}
          </button>
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

        <SettingRow label={en ? 'Show block count' : 'Счётчик блоков'}>
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

      {/* ═══ ГЕЙМПЛЕЙ РАСШИРЕННЫЙ ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="play" size={16} color="var(--accent)" />
          {en ? 'Advanced gameplay' : 'Расширенный геймплей'}
        </h3>

        <SettingRow label={en ? 'Default AI difficulty' : 'Сложность AI'} desc={en ? 'Applied when starting a new game' : 'Применяется при старте новой игры'}>
          <SegmentControl value={s.defaultDifficulty} onChange={v => update('defaultDifficulty', v)} options={[
            { value: 'easy', label: en ? 'Easy' : 'Легко' },
            { value: 'medium', label: en ? 'Med' : 'Средн' },
            { value: 'hard', label: en ? 'Hard' : 'Сложно' },
            { value: 'extreme', label: en ? 'Max' : 'Макс' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Start screen' : 'Стартовый экран'} desc={en ? 'What opens when you launch the app' : 'Что открывается при запуске'}>
          <SegmentControl value={s.defaultMode} onChange={v => update('defaultMode', v)} options={[
            { value: 'landing', label: en ? 'Home' : 'Главная' },
            { value: 'game', label: en ? 'Game' : 'Игра' },
            { value: 'online', label: en ? 'Online' : 'Онлайн' },
            { value: 'puzzles', label: en ? 'Puzzles' : 'Задачи' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Auto-rematch' : 'Авто-реванш'} desc={en ? 'Start new game after result screen' : 'Автоматически начинать новую партию'}>
          <Toggle checked={s.autoRematch} onChange={v => update('autoRematch', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Confirm resign' : 'Подтверждение сдачи'} desc={en ? 'Ask before resigning' : 'Спрашивать перед сдачей партии'}>
          <Toggle checked={s.confirmResign} onChange={v => update('confirmResign', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Zen mode' : 'Zen режим'} desc={en ? 'Minimal UI — just the board' : 'Минимальный UI — только доска'}>
          <Toggle checked={s.zenMode} onChange={v => update('zenMode', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Move log' : 'Лог ходов'} desc={en ? 'Show move history during game' : 'Показывать историю ходов в игре'}>
          <Toggle checked={s.showMoveLog} onChange={v => update('showMoveLog', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Stand labels' : 'Подписи стоек'}>
          <SegmentControl value={s.standLabels} onChange={v => update('standLabels', v)} options={[
            { value: 'letters', label: 'A-I' },
            { value: 'numbers', label: '1-9' },
            { value: 'off', label: en ? 'Off' : 'Выкл' },
          ]} />
        </SettingRow>
      </section>

      {/* ═══ ПРИВАТНОСТЬ ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="online" size={16} color="var(--accent)" />
          {en ? 'Privacy & Data' : 'Приватность'}
        </h3>

        <SettingRow label={en ? 'Profile visibility' : 'Видимость профиля'}>
          <SegmentControl value={s.profileVisibility} onChange={v => update('profileVisibility', v)} options={[
            { value: 'public', label: en ? 'Public' : 'Все' },
            { value: 'friends', label: en ? 'Friends' : 'Друзья' },
            { value: 'private', label: en ? 'Private' : 'Скрыт' },
          ]} />
        </SettingRow>

        <SettingRow label={en ? 'Show rating before match' : 'Рейтинг до матча'} desc={en ? 'Show opponent rating before online game' : 'Показывать рейтинг оппонента перед игрой'}>
          <Toggle checked={s.showPreRating} onChange={v => update('showPreRating', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Auto-save replays' : 'Авто-сохранение реплеев'} desc={en ? 'Save every game replay automatically' : 'Сохранять каждую партию автоматически'}>
          <Toggle checked={s.autoSaveReplay} onChange={v => update('autoSaveReplay', v)} />
        </SettingRow>

        <SettingRow label={en ? 'Export data' : 'Экспорт данных'} desc={en ? 'Download all your game data as JSON' : 'Скачать все данные в JSON'}>
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
            {en ? '📦 Download JSON' : '📦 Скачать JSON'}
          </button>
        </SettingRow>
      </section>

      {/* ═══ ДОСТУПНОСТЬ ═══ */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Icon name="profile" size={16} color="var(--accent)" />
          {en ? 'Accessibility' : 'Доступность'}
        </h3>

        <SettingRow label={en ? 'Colorblind mode' : 'Режим для дальтоников'} desc={en ? 'Patterns on blocks instead of colors only' : 'Паттерны на блоках вместо только цвета'}>
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
