// Push + AdMob — инициализация натив-плагинов при запуске

import { initAdMob } from './admob.js'

export async function initPush() {
  const native = !!window.Capacitor?.isNativePlatform?.()
  if (!native) return

  // Инициализируем AdMob
  await initAdMob()

  // Push отключены — нет google-services.json
  // Когда настроишь Firebase:
  // 1. npm install @capacitor/push-notifications
  // 2. Скачай google-services.json → android/app/
  // 3. Разкомментируй код ниже
}
