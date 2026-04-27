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
 *
 * 27.04.2026 — КРИТИЧНЫЙ ФИКС CRASH AT STARTUP:
 *   Александр прислал скрин ErrorBoundary с текстом
 *   "l.addListener(...).then is not a function". Причина: использовался
 *   глобальный legacy proxy `window.Capacitor.Plugins.App` — на некоторых
 *   Android-устройствах/эмуляторах он возвращает СИНХРОННЫЙ
 *   PluginListenerHandle (не Promise), и `.then(...)` крашит весь App.jsx
 *   через ErrorBoundary при монтировании.
 *
 *   Решение:
 *   1. ESM импорт `@capacitor/app` (как в main.jsx) — этот путь
 *      гарантированно возвращает Promise через addListenerNative.
 *   2. Defensive — проверяем что результат имеет .then, иначе работаем
 *      с ним как с PluginListenerHandle напрямую.
 *   3. Всё внутри try/catch — никакой path не должен валить App.
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
    //
    // ВАЖНО: используем ESM импорт `@capacitor/app`, а НЕ глобальный
    // `window.Capacitor.Plugins.App`. Глобальный legacy proxy на ряде
    // Android-конфигураций возвращает синхронный PluginListenerHandle,
    // и `.then()` после addListener крашил App с ошибкой
    // "l.addListener(...).then is not a function" (фикс 27.04.2026).
    //
    // ESM путь идёт через addListenerNative из @capacitor/core — там
    // гарантированно Promise<PluginListenerHandle>.
    let unregister = null
    let cancelled = false

    function handleBackButton() {
      // Если модалка открыта (onBack передан) — закроем её.
      // Иначе делаем стандартный history.back. Если history пустая
      // (мы на корне 'game' в native) — exitApp, чтобы кнопка back
      // вышла из приложения как ожидает Android.
      try {
        if (typeof onBack === 'function') {
          onBack()
        } else if (window.history.length > 1) {
          window.history.back()
        } else {
          // Импорт @capacitor/app для exitApp — берём из глобала
          // (если он определён), это безопасно — просто вызов метода
          // без ожидания результата.
          window.Capacitor?.Plugins?.App?.exitApp?.()
        }
      } catch (e) {
        console.warn('[edge-back] handler error:', e)
      }
    }

    // Только на native — Android back gesture. На web глобальный proxy
    // если и есть, то App не зарегистрирован и мы получим reject.
    const isNative = !!window.Capacitor?.isNativePlatform?.()
    if (isNative) {
      // Динамический import чтобы не тянуть @capacitor/app в web bundle.
      // .catch swallow — на web/без плагина ничего не делаем.
      import('@capacitor/app').then(({ App }) => {
        if (cancelled) return
        try {
          const result = App.addListener('backButton', handleBackButton)
          // Defensive: result может быть Promise<PluginListenerHandle>
          // (новый Capacitor 6+) или PluginListenerHandle напрямую (старый
          // или проксированный API). Поддерживаем оба варианта.
          if (result && typeof result.then === 'function') {
            result.then((handle) => {
              if (cancelled) {
                handle?.remove?.()
              } else {
                unregister = () => handle?.remove?.()
              }
            }).catch((e) => {
              console.warn('[edge-back] addListener promise rejected:', e?.message)
            })
          } else if (result && typeof result.remove === 'function') {
            // Синхронный PluginListenerHandle
            unregister = () => result.remove()
          }
        } catch (e) {
          console.warn('[edge-back] addListener threw:', e?.message)
        }
      }).catch(() => {})
    }

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      try { unregister?.() } catch {}
    }
  }, [onBack, enabled])
}
