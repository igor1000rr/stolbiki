// Вибрация при игровых событиях (только в native)
let Haptics = null

async function init() {
  if (!window.Capacitor?.isNativePlatform?.()) return
  try {
    const mod = await import('@capacitor/haptics')
    Haptics = mod.Haptics
  } catch {}
}
init()

// Лёгкий тап — размещение фишки
export function tapLight() {
  Haptics?.impact({ style: 'LIGHT' }).catch(() => {})
}

// Средний тап — перенос, выбор стойки
export function tapMedium() {
  Haptics?.impact({ style: 'MEDIUM' }).catch(() => {})
}

// Тяжёлый — закрытие стойки, победа
export function tapHeavy() {
  Haptics?.impact({ style: 'HEAVY' }).catch(() => {})
}

// Двойная вибрация — победа
export function notifySuccess() {
  Haptics?.notification({ type: 'SUCCESS' }).catch(() => {})
}

// Ошибка — поражение, неверный ход
export function notifyError() {
  Haptics?.notification({ type: 'ERROR' }).catch(() => {})
}

// Предупреждение — swap offer, draw offer
export function notifyWarning() {
  Haptics?.notification({ type: 'WARNING' }).catch(() => {})
}
