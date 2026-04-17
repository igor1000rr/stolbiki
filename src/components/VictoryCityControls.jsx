import { MAX_SAVED_VIEWS, PRESET_MS, getSeason, persistSavedViews } from './victoryCityUtils'

const CAMERA_PRESETS_UI = [
  { id: 'iso', emoji: '📐', label_ru: 'Изо', label_en: 'Iso' },
  { id: 'top', emoji: '🚁', label_ru: 'Сверху', label_en: 'Top' },
  { id: 'cinematic', emoji: '🎬', label_ru: 'Кино', label_en: 'Cine' },
  { id: 'fpv', emoji: '🛸', label_ru: 'Облёт', label_en: 'FPV' },
]
const TIME_PRESETS_UI = [
  { id: 'night',   emoji: '🌙', label_ru: 'Ночь',  label_en: 'Night' },
  { id: 'morning', emoji: '🌅', label_ru: 'Утро',  label_en: 'Morn' },
  { id: 'day',     emoji: '☀️', label_ru: 'День',  label_en: 'Day' },
  { id: 'sunset',  emoji: '🌇', label_ru: 'Закат', label_en: 'Dusk' },
]
const FILTERS_UI = [
  { id: 'original', label_ru: 'Ориг',  label_en: 'Orig' },
  { id: 'vivid',    label_ru: 'Vivid', label_en: 'Vivid' },
  { id: 'bw',       label_ru: 'Ч/Б',   label_en: 'B&W' },
  { id: 'sepia',    label_ru: 'Сепия', label_en: 'Sepia' },
]
const BUILDING_FILTERS_UI = [
  { id: 'all',        label_ru: 'Все',          label_en: 'All',     emoji: '🏙' },
  { id: 'golden',     label_ru: 'С короной',    label_en: 'Crowned', emoji: '★' },
  { id: 'impossible', label_ru: 'С Impossible', label_en: 'Imposs.', emoji: '⚡' },
  { id: 'week',       label_ru: 'За неделю',    label_en: 'Week',    emoji: '🗓' },
]

export default function VictoryCityControls({
  en, threeRef,
  currentPreset, setCurrentPreset,
  autoRotate, setAutoRotate,
  isTimelapsing, isRecording, isFullscreen,
  weatherEnabled, setWeatherEnabled,
  season,
  buildingFilter, setBuildingFilter,
  showFilterMenu, setShowFilterMenu,
  showShotMenu, setShowShotMenu,
  shotFilter, setShotFilter,
  snapshotMsg,
  savedViews, setSavedViews,
  timeOfDay, setTimeOfDay,
  containerRef,
  onTimelapse, onFullscreen, onDownloadScreenshot, onRecordVideo,
  setShowHallOfFame, setSnapshotMsg,
}) {
  const seasonEmoji = { winter: '❄️', spring: '🌧', autumn: '🍂', summer: null }[season]
  const seasonLabel = {
    winter: en ? 'Snow' : 'Снег', spring: en ? 'Rain' : 'Дождь',
    autumn: en ? 'Leaves' : 'Листья', summer: null,
  }[season]

  function applyCameraPreset(name) {
    const t = threeRef.current
    if (!t?.cameraPresets || !t?.startCamAnim) return
    const preset = t.cameraPresets[name]
    if (!preset) return
    setCurrentPreset(name)
    t.startCamAnim(preset.pos, preset.target, PRESET_MS)
    if (preset.autoRotate && !autoRotate) {
      setAutoRotate(true)
      if (t.animRef) t.animRef.autoRotate = true
    }
  }

  function toggleAutoRotate() {
    setAutoRotate(prev => {
      const next = !prev
      const t = threeRef.current
      if (t?.animRef && t?.controls) {
        t.animRef.autoRotate = next
        if (t.controls.enabled) t.controls.autoRotate = next
      }
      return next
    })
  }

  function applyTimeOfDay(name) {
    setTimeOfDay(name)
    const t = threeRef.current
    if (t?.startTimeAnim) t.startTimeAnim(name)
  }

  function saveCurrentView() {
    const t = threeRef.current
    if (!t?.camera || !t?.controls) return
    if (savedViews.length >= MAX_SAVED_VIEWS) {
      setSnapshotMsg(en ? `Max ${MAX_SAVED_VIEWS} views` : `Максимум ${MAX_SAVED_VIEWS}`)
      setTimeout(() => setSnapshotMsg(null), 2000)
      return
    }
    const name = window.prompt(en ? 'Name this view:' : 'Название ракурса:', `View ${savedViews.length + 1}`)
    if (!name) return
    const view = {
      name: name.slice(0, 20),
      pos: [t.camera.position.x, t.camera.position.y, t.camera.position.z],
      target: [t.controls.target.x, t.controls.target.y, t.controls.target.z],
    }
    const next = [...savedViews, view]
    setSavedViews(next); persistSavedViews(next)
    setSnapshotMsg(en ? 'View saved!' : 'Сохранено!')
    setTimeout(() => setSnapshotMsg(null), 1500)
  }

  function loadView(view) {
    const t = threeRef.current
    if (!t?.startCamAnim || !t?.THREE_MOD) return
    const THREE = t.THREE_MOD
    t.startCamAnim(
      new THREE.Vector3(view.pos[0], view.pos[1], view.pos[2]),
      new THREE.Vector3(view.target[0], view.target[1], view.target[2]),
      PRESET_MS,
    )
    setCurrentPreset(null)
  }

  function deleteView(idx) {
    const next = savedViews.filter((_, i) => i !== idx)
    setSavedViews(next); persistSavedViews(next)
  }

  const disabled = isTimelapsing || isRecording

  return (
    <>
      {/* Панель кнопок Photo Mode */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          {CAMERA_PRESETS_UI.map(p => {
            const active = currentPreset === p.id
            return (
              <button key={p.id} onClick={() => applyCameraPreset(p.id)} disabled={disabled}
                style={{
                  fontSize: 11, padding: '6px 10px', borderRadius: 6,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.5 : 1, fontWeight: active ? 700 : 500,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                }} aria-pressed={active}>
                <span>{p.emoji}</span><span>{en ? p.label_en : p.label_ru}</span>
              </button>
            )
          })}
        </div>

        <button onClick={toggleAutoRotate} disabled={disabled}
          style={{
            fontSize: 11, padding: '6px 10px', borderRadius: 8,
            background: autoRotate ? 'rgba(61,214,140,0.15)' : 'var(--surface2)',
            color: autoRotate ? 'var(--green)' : 'var(--ink3)',
            border: `1px solid ${autoRotate ? 'var(--green)' : 'rgba(255,255,255,0.05)'}`,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1, fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }} aria-pressed={autoRotate}>
          <span>🔄</span><span>{en ? 'Rotate' : 'Авто'}</span>
        </button>

        <button onClick={onTimelapse} disabled={isRecording}
          style={{
            fontSize: 11, padding: '6px 10px', borderRadius: 8,
            background: isTimelapsing ? 'rgba(255,193,69,0.18)' : 'var(--surface2)',
            color: isTimelapsing ? 'var(--gold)' : 'var(--ink3)',
            border: `1px solid ${isTimelapsing ? 'var(--gold)' : 'rgba(255,255,255,0.05)'}`,
            cursor: isRecording ? 'default' : 'pointer',
            opacity: isRecording ? 0.5 : 1,
            fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span>{isTimelapsing ? '⏹' : '⏯'}</span>
          <span>{isTimelapsing ? (en ? 'Stop' : 'Стоп') : (en ? 'Time-lapse' : 'История')}</span>
        </button>

        <button onClick={onFullscreen} disabled={isRecording}
          style={{
            fontSize: 11, padding: '6px 10px', borderRadius: 8,
            background: 'var(--surface2)', color: 'var(--ink3)',
            border: '1px solid rgba(255,255,255,0.05)',
            cursor: isRecording ? 'default' : 'pointer',
            opacity: isRecording ? 0.5 : 1,
            fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span>{isFullscreen ? '🗗' : '⛶'}</span>
          <span>{isFullscreen ? (en ? 'Exit' : 'Свернуть') : (en ? 'Full' : 'Полный')}</span>
        </button>

        {seasonEmoji && (
          <button onClick={() => setWeatherEnabled(v => !v)} disabled={disabled}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: weatherEnabled ? 'rgba(74,158,255,0.15)' : 'var(--surface2)',
              color: weatherEnabled ? 'var(--accent)' : 'var(--ink3)',
              border: `1px solid ${weatherEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }} aria-pressed={weatherEnabled}>
            <span>{seasonEmoji}</span><span>{seasonLabel}</span>
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowFilterMenu(s => !s)} disabled={disabled}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 8,
              background: buildingFilter !== 'all' ? 'rgba(155,89,182,0.15)' : (showFilterMenu ? 'rgba(255,255,255,0.05)' : 'var(--surface2)'),
              color: buildingFilter !== 'all' ? '#cf9cff' : 'var(--ink3)',
              border: `1px solid ${buildingFilter !== 'all' ? '#9b59b6' : 'rgba(255,255,255,0.05)'}`,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>🔍</span><span>{en ? 'Filter' : 'Фильтр'}</span>
          </button>
          {showFilterMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 6, minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 10,
            }}>
              {BUILDING_FILTERS_UI.map(f => {
                const active = buildingFilter === f.id
                return (
                  <button key={f.id}
                    onClick={() => { setBuildingFilter(f.id); setShowFilterMenu(false) }}
                    style={{
                      width: '100%', padding: '7px 10px', borderRadius: 6,
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                      cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: 12,
                      fontFamily: 'inherit', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                    }}>
                    <span style={{ width: 16 }}>{f.emoji}</span>
                    <span>{en ? f.label_en : f.label_ru}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowShotMenu(s => !s)} disabled={isRecording}
            style={{
              fontSize: 11, padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--accent)',
              background: showShotMenu ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: 'var(--accent)',
              cursor: isRecording ? 'default' : 'pointer',
              opacity: isRecording ? 0.5 : 1,
              fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>📸</span><span>{en ? 'Snapshot' : 'Снимок'}</span>
          </button>
          {showShotMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 8, minWidth: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 10,
            }}>
              <div style={{ fontSize: 10, color: 'var(--ink3)', marginBottom: 6, padding: '0 4px' }}>
                {en ? 'Filter' : 'Фильтр'}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {FILTERS_UI.map(f => {
                  const active = shotFilter === f.id
                  return (
                    <button key={f.id} onClick={() => setShotFilter(f.id)}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 6,
                        background: active ? 'var(--accent)' : 'var(--surface2)',
                        color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                        cursor: 'pointer', fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                      }}>{en ? f.label_en : f.label_ru}</button>
                  )
                })}
              </div>
              <button onClick={onDownloadScreenshot}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'var(--accent)', color: '#0a0a12', border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                  marginBottom: 6,
                }}>📷 {en ? 'Save photo' : 'Сохранить фото'}</button>
              <button onClick={onRecordVideo}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'linear-gradient(90deg, #ff5050 0%, #ff7060 100%)', color: '#fff', border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                }}>🎥 {en ? 'Record 8s flythrough' : 'Записать 8с облёт'}</button>
            </div>
          )}
        </div>

        <button onClick={() => setShowHallOfFame(true)} disabled={isRecording}
          style={{
            fontSize: 11, padding: '6px 12px', borderRadius: 8,
            background: 'linear-gradient(90deg, rgba(255,193,69,0.15) 0%, rgba(255,140,40,0.15) 100%)',
            color: 'var(--gold)',
            border: '1px solid rgba(255,193,69,0.4)',
            cursor: isRecording ? 'default' : 'pointer',
            opacity: isRecording ? 0.5 : 1,
            fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <span>🏆</span><span>{en ? 'Top' : 'Топ'}</span>
        </button>

        {snapshotMsg && (
          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{snapshotMsg}</span>
        )}
      </div>

      {/* Saved views */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {savedViews.map((v, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', background: 'var(--surface2)',
            borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden',
          }}>
            <button onClick={() => loadView(v)} disabled={disabled}
              style={{
                fontSize: 11, padding: '5px 10px', background: 'transparent',
                color: 'var(--ink2)', border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', fontWeight: 500,
              }}>📍 {v.name}</button>
            <button onClick={() => deleteView(i)} disabled={isRecording}
              style={{
                fontSize: 12, padding: '5px 8px', background: 'transparent',
                color: 'var(--ink3)', border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.05)',
                cursor: isRecording ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: isRecording ? 0.5 : 1,
              }} aria-label="delete view">×</button>
          </div>
        ))}
        {savedViews.length < MAX_SAVED_VIEWS && (
          <button onClick={saveCurrentView} disabled={disabled}
            style={{
              fontSize: 11, padding: '5px 10px', borderRadius: 6,
              background: 'transparent', color: 'var(--ink3)',
              border: '1px dashed rgba(255,255,255,0.15)',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>+</span><span>{en ? 'Save view' : 'Сохранить ракурс'}</span>
          </button>
        )}
      </div>

      {/* Time presets */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
          {TIME_PRESETS_UI.map(p => {
            const active = timeOfDay === p.id
            return (
              <button key={p.id} onClick={() => applyTimeOfDay(p.id)} disabled={disabled}
                style={{
                  fontSize: 11, padding: '6px 10px', borderRadius: 6,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#0a0a12' : 'var(--ink2)', border: 'none',
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.5 : 1, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }} aria-pressed={active}>
                <span>{p.emoji}</span><span>{en ? p.label_en : p.label_ru}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
