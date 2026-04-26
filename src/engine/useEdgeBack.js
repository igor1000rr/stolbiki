/**
 * useEdgeBack — свайп от левого края экрана + Capacitor back-button →
 * возврат на предыдущую вкладку через window.history.back().
 *
 * По обратной связи Александра: "Свайп от края экрана возвращает в
 * предыдущий раздел". Реализовано двумя путями параллельно:
 *
 * 1. Web/PWA/iOS Safari — pointer events на window. Старт от clientX < 24,
 *    свайп вправо deltaX > 60 при deltaY < 40 за время < 500ms → back.
 *
 * 2. Capacitor native Android — App.backButton event. Срабатывает на
 *    system-back-gesture (свайп от края Android 10+) и на back-кнопке.
 *    Это корректный путь для Android — ловить системное событие, а не
 *    перехватывать pointer (который Android может зарезать первым).
 *
 * Возврат:
 * - Если есть колбэк onBack — вызываем его (для модалок: закрыть себя).
 * - Иначе window.history.back() — popstate handler в App.jsx обновит tab.
 *
 * Защита от ложных срабатываний:
 * - target.closest('.no-edge-swipe') — компонент явно отказался
 *   (3D-сцена, Board.jsx, OrbitControls).
 * - target.tagName ∈ INPUT/TEXTAREA/SELECT/CANVAS — не перехватываем.
 * - В sheet/modal — обрабатывает onBack модалки если задан, иначе
 *   глобальный history.back.
 *
 * Использование:
 *   useEdgeBack({ onBack: () => setOpen(false), enabled: open })
 *   useEdgeBack()  // глобально на App.jsx — history.back()
 */

import { useEffect, useRef } from 'react'

const EDGE_THRESHOLD = 24      /* px от левого края для старта свайпа */
const SWIPE_MIN_X = 60         /* минимальная горизонтальная дельта */
const SWIPE_MAX_Y = 40         /* максимальный вертикальный дрейф */
const SWIPE_MAX_TIME = 500     /* мс — иначе это не свайп, а медленный drag */

export function useEdgeBack({ onBack, enabled = true } = {}) {
  const startRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    function isInteractive(target) {
      if (!target) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (tag === 'CANVAS') return true
      if (target.closest?.('.no-edge-swipe')) return true
      // Native Android system-back gesture в Capacitor — handled через
      // App.backButton, не через pointer. Не дублируем.
      return false
    }

    function fireBack() {
      try {
        if (typeof onBack === 'function') {
          onBack()
        } else if (window.history.length > 1) {
          window.history.back()
        }
      } catch (e) {
        console.warn('[edge-back]', e)
      }
    }

    function onPointerDown(e) {
      if (e.clientX > EDGE_THRESHOLD) return
      if (isInteractive(e.target)) return
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        id: e.pointerId,
      }
    }

    function onPointerUp(e) {
      const s = startRef.current
      if (!s || s.id !== e.pointerId) return
      startRef.current = null
      const dx = e.clientX - s.x
      const dy = Math.abs(e.clientY - s.y)
      const dt = performance.now() - s.t
      if (dx >= SWIPE_MIN_X && dy <= SWIPE_MAX_Y && dt <= SWIPE_MAX_TIME) {
        fireBack()
      }
    }

    function onPointerCancel(e) {
      if (startRef.current?.id === e.pointerId) startRef.current = null
    }

    // passive=true — мы не вызываем preventDefault, чтобы не блокировать
    // нативные жесты (Android system-back-gesture, scroll, OrbitControls).
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerCancel, { passive: true })

    // Capacitor App backButton — отдельный канал для native Android.
    // Срабатывает на hardware back и на system-back-gesture.
    // Если onBack задан — закрываем модалку, иначе history.back.
    let unregister = null
    const App = window.Capacitor?.Plugins?.App
    if (App?.addListener) {
      App.addListener('backButton', () => {
        // Если модалка открыта (onBack передан) — закроем её.
        // Иначе делаем стандартный history.back. Если history пустая
        // (мы на корне 'game' в native) — exitApp, чтобы кнопка back
        // вышла из приложения как ожидает Android.
        if (typeof onBack === 'function') {
          onBack()
        } else if (window.history.length > 1) {
          window.history.back()
        } else {
          App.exitApp?.()
        }
      }).then((handle) => {
        unregister = () => handle?.remove?.()
      }).catch(() => {})
    }

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      try { unregister?.() } catch {}
    }
  }, [onBack, enabled])
}
