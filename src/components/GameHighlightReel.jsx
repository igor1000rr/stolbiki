/**
 * GameHighlightReel — генератор TikTok/Reels видео из партии
 * 9:16 формат (1080×1920), MediaRecorder + canvas
 * Рендерит ключевые моменты: закрытия, большие переносы, финал
 */
import { useRef, useState, useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import { applyAction } from '../engine/game'
import { GameState } from '../engine/game'

// ─── Цветовые схемы скинов для canvas ───
const SKIN_COLORS = {
  blocks_classic:  { p1: '#4a9eff', p2: '#ff6066' },
  blocks_flat:     { p1: '#4a9eff', p2: '#ff6066' },
  blocks_round:    { p1: '#4a9eff', p2: '#ff6066' },
  blocks_glass:    { p1: 'rgba(74,158,255,0.8)', p2: 'rgba(255,96,102,0.8)' },
  blocks_metal:    { p1: '#b8d4f0', p2: '#f0b8b8' },
  blocks_candy:    { p1: '#60c0ff', p2: '#ff6090' },
  blocks_pixel:    { p1: '#4a9eff', p2: '#ff6066' },
  blocks_neon:     { p1: '#00e5ff', p2: '#ff3090' },
  blocks_glow:     { p1: '#7ec8ff', p2: '#ff9090' },
}

const W = 540   // рендерим 540×960, покажем 2× для 1080×1920
const H = 960
const STANDS = 10
const STAND_MAX = 11
const GOLDEN = 0

// ─── Рендер одного состояния на canvas ───
function renderState(ctx, gs, meta, skinId) {
  const colors = SKIN_COLORS[skinId] || SKIN_COLORS.blocks_classic
  const p1 = colors.p1
  const p2 = colors.p2

  // Фон
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#08080f')
  grad.addColorStop(1, '#0c0c1a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Шапка — логотип / счёт
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(0, 0, W, 160)

  // Лого
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('HIGHRISE HEIST', W / 2, 48)

  // Метка момента
  if (meta?.label) {
    ctx.fillStyle = meta.color || '#ffc145'
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.fillText(meta.label, W / 2, 82)
  }

  // Счёт
  const s0 = gs.countClosed(0), s1 = gs.countClosed(1)
  const totalClosed = Object.keys(gs.closed).length

  ctx.font = 'bold 56px system-ui, sans-serif'
  ctx.textAlign = 'center'
  // P0 (синие)
  ctx.fillStyle = p1
  ctx.fillText(String(s0), W / 2 - 70, 148)
  // :
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = 'bold 36px system-ui, sans-serif'
  ctx.fillText(':', W / 2, 142)
  // P1 (красные)
  ctx.fillStyle = p2
  ctx.font = 'bold 56px system-ui, sans-serif'
  ctx.fillText(String(s1), W / 2 + 70, 148)

  // ─── Игровое поле — 10 стоек ───
  const boardTop = 190
  const boardH = H - boardTop - 200
  const standW = (W - 40) / STANDS
  const standGap = 4

  for (let i = 0; i < STANDS; i++) {
    const sx = 20 + i * standW
    const isGolden = i === GOLDEN
    const isClosed = i in gs.closed
    const owner = gs.closed[i]
    const chips = gs.stands[i] || []
    const maxH = boardH - 60

    // Основание стойки
    ctx.fillStyle = isGolden ? 'rgba(255,193,69,0.12)' : 'rgba(255,255,255,0.04)'
    ctx.strokeStyle = isGolden ? 'rgba(255,193,69,0.4)' : 'rgba(255,255,255,0.08)'
    ctx.lineWidth = isClosed ? 2 : 1
    roundRect(ctx, sx + standGap, boardTop, standW - standGap * 2, boardH - 40, 6)
    ctx.fill()
    ctx.stroke()

    // Метка
    ctx.fillStyle = isGolden ? '#ffc145' : 'rgba(255,255,255,0.2)'
    ctx.font = `bold ${isGolden ? 11 : 9}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(isGolden ? '★' : String.fromCharCode(64 + i), sx + standW / 2, boardTop + boardH - 20)

    // Блоки
    const chipH = Math.min(Math.floor((maxH - 20) / STAND_MAX), 22)
    const chipW = standW - standGap * 2 - 6

    for (let j = 0; j < chips.length; j++) {
      const cy = boardTop + boardH - 48 - j * (chipH + 2)
      const color = chips[j] === 0 ? p1 : p2
      const isTop = j === chips.length - 1

      if (isClosed && isTop) {
        // Верхний блок закрытой — ярче
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 8
      } else {
        ctx.shadowBlur = 0
        ctx.fillStyle = isClosed ? color + 'aa' : color + 'cc'
      }

      ctx.beginPath()
      ctx.roundRect(sx + standGap + 3, cy, chipW, chipH, 3)
      ctx.fill()
      ctx.shadowBlur = 0

      // Полоска на топе
      if (isTop && !isClosed) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.fillRect(sx + standGap + 3, cy, chipW, 2)
      }
    }

    // Закрытая стойка — оверлей
    if (isClosed) {
      const ownerColor = owner === 0 ? p1 : p2
      ctx.fillStyle = ownerColor + '22'
      roundRect(ctx, sx + standGap, boardTop, standW - standGap * 2, boardH - 40, 6)
      ctx.fill()
      // Тик
      ctx.strokeStyle = ownerColor
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(sx + standW * 0.3, boardTop + boardH * 0.35)
      ctx.lineTo(sx + standW * 0.5, boardTop + boardH * 0.5)
      ctx.lineTo(sx + standW * 0.75, boardTop + boardH * 0.2)
      ctx.stroke()
    }
  }

  // Ход
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = '13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`Turn ${gs.turn} · ${totalClosed}/10 closed`, W / 2, H - 160)

  // Подпись внизу
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, H - 140, W, 140)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText('highriseheist.com', W / 2, H - 60)
  ctx.fillStyle = '#3bb8a8'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.fillText('🎮 Play free at highriseheist.com', W / 2, H - 30)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─── Находим ключевые моменты из истории ходов ───
function extractHighlights(moveHistory) {
  const highlights = []
  let gs = new GameState()
  const prev = { closed: 0 }

  for (let i = 0; i < moveHistory.length; i++) {
    const { action, player } = moveHistory[i]
    gs = applyAction(gs, action)
    const closedNow = Object.keys(gs.closed).length

    if (closedNow > prev.closed) {
      // Новое закрытие!
      const newClosed = Object.keys(gs.closed).filter(k => !(k in Object.keys(gs.closed).slice(0, closedNow - 1)))
      highlights.push({
        gs: gs,
        label: `Stand closed! ${gs.countClosed(0)}:${gs.countClosed(1)}`,
        color: '#ffc145',
        priority: 2,
        duration: 1800,
      })
      prev.closed = closedNow
    } else if (action.transfer) {
      highlights.push({
        gs: gs,
        label: `Transfer: ${action.transfer[0] === 0 ? '★' : String.fromCharCode(64 + action.transfer[0])} → ${action.transfer[1] === 0 ? '★' : String.fromCharCode(64 + action.transfer[1])}`,
        color: '#9b59b6',
        priority: 1,
        duration: 1200,
      })
    }

    // Финал
    if (gs.gameOver) {
      const won = gs.winner === 0 ? 'Blue' : 'Red'
      highlights.push({
        gs: gs,
        label: `🏆 ${won} wins! ${gs.countClosed(0)}:${gs.countClosed(1)}`,
        color: '#3dd68c',
        priority: 3,
        duration: 3000,
      })
    }
  }

  // Берём не больше 8 лучших моментов: все приоритет 2+, остальное по 1
  const high = highlights.filter(h => h.priority >= 2)
  const low = highlights.filter(h => h.priority === 1).slice(-3)
  return [...low, ...high].sort((a, b) => b.priority - a.priority).slice(0, 8)
}

// ─── Компонент ───
export default function GameHighlightReel({ moveHistory, _result, _humanPlayer, skinId, onClose }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | rendering | done | error | unsupported
  const [videoUrl, setVideoUrl] = useState(null)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(null)
  const recorderRef = useRef(null)

  const activeSkin = skinId || 'blocks_classic'

  const isSupported = typeof MediaRecorder !== 'undefined' &&
    (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ||
     MediaRecorder.isTypeSupported('video/webm'))

  function generate() {
    if (!isSupported) { setStatus('unsupported'); return }
    const canvas = canvasRef.current
    if (!canvas) return

    const highlights = extractHighlights(moveHistory)
    if (!highlights.length) { setStatus('error'); return }

    setStatus('rendering')
    setProgress(0)

    const stream = canvas.captureStream(30)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 })
    recorderRef.current = recorder
    const chunks = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      setStatus('done')
    }
    recorder.start()

    // Рендерим кадры по очереди
    let frameIdx = 0
    let frameStart = performance.now()
    const totalDuration = highlights.reduce((s, h) => s + h.duration, 0)
    let elapsed = 0

    // Transition frames (crossfade)
    const TRANSITION_MS = 300
    let transitionProgress = 1 // 0→1 = fade-in
    let nextHighlight = null

    function drawFrame(now) {
      if (frameIdx >= highlights.length) {
        recorder.stop()
        return
      }

      const h = highlights[frameIdx]
      const frameDur = h.duration
      const frameElapsed = now - frameStart

      const ctx = canvas.getContext('2d')

      if (frameElapsed >= frameDur) {
        // Переход к следующему
        frameIdx++
        elapsed += frameDur
        frameStart = now
        setProgress(Math.round((elapsed / totalDuration) * 100))
        rafRef.current = requestAnimationFrame(drawFrame)
        return
      }

      // Рендер + переход
      renderState(ctx, h.gs, h, activeSkin)

      // Fade-in первых ~300ms
      if (frameElapsed < TRANSITION_MS) {
        const alpha = 1 - frameElapsed / TRANSITION_MS
        ctx.fillStyle = `rgba(8,8,15,${alpha * 0.8})`
        ctx.fillRect(0, 0, W, H)
      }

      rafRef.current = requestAnimationFrame(drawFrame)
    }

    // Начальный кадр
    const ctx = canvas.getContext('2d')
    const firstH = highlights[0]
    renderState(ctx, firstH.gs, firstH, activeSkin)
    frameStart = performance.now()
    rafRef.current = requestAnimationFrame(drawFrame)
  }

  function download() {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `highrise-heist-${Date.now()}.webm`
    a.click()
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop()
      }
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(0,0,0,0.9)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: '24px 20px',
        maxWidth: 400, width: '100%', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
            🎬 {en ? 'TikTok Highlight Reel' : 'TikTok-клип'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 18 }}>✕</button>
        </div>

        {/* Canvas — скрыт, используется для записи */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            borderRadius: 12,
            maxWidth: '100%',
            maxHeight: 300,
            objectFit: 'contain',
            display: status === 'idle' ? 'none' : 'block',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        />

        {status === 'idle' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🦝🏙</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 16 }}>
              {en
                ? 'Generate a short 9:16 highlight video from this game — share to TikTok, Reels or Shorts!'
                : 'Создай короткий 9:16 видеоклип с лучшими моментами партии — для TikTok, Reels, Shorts!'}
            </div>
            {!isSupported && (
              <div style={{ fontSize: 11, color: 'var(--p2)', marginBottom: 10 }}>
                {en ? 'Your browser does not support video recording.' : 'Браузер не поддерживает запись видео.'}
              </div>
            )}
            <button
              className="btn primary"
              onClick={generate}
              disabled={!isSupported}
              style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}
            >
              {en ? '▶ Generate clip' : '▶ Создать клип'}
            </button>
          </div>
        )}

        {status === 'rendering' && (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 12 }}>
              {en ? 'Rendering...' : 'Рендеринг...'} {progress}%
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s', borderRadius: 3 }} />
            </div>
          </div>
        )}

        {status === 'done' && videoUrl && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <video
              src={videoUrl}
              controls
              loop
              muted
              autoPlay
              style={{ width: '100%', maxHeight: 280, borderRadius: 10, background: '#000', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={download} style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                ⬇ {en ? 'Download .webm' : 'Скачать .webm'}
              </button>
              <button className="btn" onClick={() => { setStatus('idle'); setVideoUrl(null); setProgress(0) }} style={{ fontSize: 12 }}>
                ↺
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 8 }}>
              {en ? 'Share to TikTok, Instagram Reels or YouTube Shorts' : 'Поделись в TikTok, Instagram Reels или YouTube Shorts'}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--p2)', marginBottom: 12 }}>
              {en ? 'Not enough game data. Play a longer game!' : 'Недостаточно данных партии. Сыграй подольше!'}
            </div>
            <button className="btn" onClick={onClose}>{en ? 'Close' : 'Закрыть'}</button>
          </div>
        )}

        {status === 'unsupported' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 12 }}>
              {en ? 'Video recording is not supported in this browser. Try Chrome or Edge.' : 'Запись видео не поддерживается в этом браузере. Попробуй Chrome или Edge.'}
            </div>
            <button className="btn" onClick={onClose}>{en ? 'Close' : 'Закрыть'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
