/**
 * VictoryCity — Three.js 3D «Город побед»
 *
 * НОВАЯ КОНЦЕПЦИЯ (после v5.8):
 * 1 победа = N кирпичей. Кирпичи укладываются хронологически в стойки по 11 —
 * как в самой игре. Закрытая стойка (11 кирпичей) = небоскрёб.
 *
 * Backend: GET /api/buildings/city/:userId возвращает {towers, total_bricks,
 * total_wins, next_tower_progress}.
 *
 * Цвет кирпича = скин игрока на момент той победы. piece.special — золотой кирпич.
 * tower.golden_top — над высоткой висит шпиль-корона.
 *
 * Режимы:
 *  - Photo Mode: 4 пресета (Iso, Top, Cinematic, FPV) + автоповорот
 *  - Day/Night: 4 пресета времени суток, окна зажигаются ночью
 *  - Time-lapse: проигрывает постройку города tower за tower
 *  - Filter: всё / золотые шпили / содержит Impossible / последняя неделя
 *  - Weather: снег зимой, дождь весной, листья осенью
 *  - Minimap, Fullscreen, Snapshot+watermark+filter, Saved views (6 слотов)
 *  - MP4 video record: 8-сек FPV-облёт через MediaRecorder, .webm файл
 *  - Hall of Fame: кнопка-ссылка открывает топ-городов модалкой
 *
 * Performance: rafRef, кэш мешей, IntersectionObserver, visibilityState,
 * prefers-reduced-motion, mobile-режим (упрощённая графика на слабых).
 *
 * Fallback: WebGL error → VictoryCity2D с теми же towers данными.
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useI18n } from '../engine/i18n'
import {
  GOLDEN_HEX, CROWN_HEX, TOWER_HEIGHT, VIDEO_DURATION_MS, VIDEO_FPS, VIDEO_BITRATE,
  MAX_SAVED_VIEWS, PRESET_MS, COLS, SPACING, FLOOR_H, BLOCK_W, CROWN_W,
  INTRO_MS, FOCUS_MS, GROW_MS, GROW_STAGGER, GROW_START_AT, TIME_MS,
  TIMELAPSE_STAGGER, TIMELAPSE_GROW_MS, SMOKE_PER_BUILDING,
  WEATHER_COUNT_HIGH, WEATHER_COUNT_LOW, TIME_PRESETS, WEATHER_PARAMS,
  pieceColor, pieceEmissive, getDiffLabel, hasWebGL, prefersReducedMotion,
  hasLowPower, getSeason, easeOutCubic, lerp, pickVideoMimeType,
  towerMatchesFilter, uniqueWinsInTower, snapshotSceneTimeState,
  loadSavedViews, persistSavedViews,
} from './victoryCityUtils'
import { makeStarTexture, makeRoadTexture, makeSoftDotTexture } from './victoryCityTextures'

const VictoryCity2D = lazy(() => import('./VictoryCity2D'))
const HallOfFame = lazy(() => import('./HallOfFame'))

export default function VictoryCity({ userId }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const [cityData, setCityData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selTowerIdx, setSelTowerIdx] = useState(null)
  const [webglOk] = useState(() => hasWebGL())
  const [forceSvg, setForceSvg] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState(null)
  const [currentPreset, setCurrentPreset] = useState('iso')
  const [autoRotate, setAutoRotate] = useState(false)
  const [timeOfDay, setTimeOfDay] = useState('night')
  const [hoverInfo, setHoverInfo] = useState(null)
  const [isTimelapsing, setIsTimelapsing] = useState(false)
  const [timelapseDate, setTimelapseDate] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shotFilter, setShotFilter] = useState('original')
  const [showShotMenu, setShowShotMenu] = useState(false)
  const [savedViews, setSavedViews] = useState(() => loadSavedViews())
  const [weatherEnabled, setWeatherEnabled] = useState(true)
  const [season] = useState(() => getSeason())
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordProgress, setRecordProgress] = useState(0)
  const [showHallOfFame, setShowHallOfFame] = useState(false)

  const containerRef = useRef(null)
  const threeRef = useRef(null)
  const recorderRef = useRef(null)
  const progressTimerRef = useRef(null)
