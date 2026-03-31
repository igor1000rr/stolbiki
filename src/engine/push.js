// Firebase Push Notifications (Capacitor)
// Требует: google-services.json в android/app/

let PushNotifications = null

export async function initPush() {
  if (!window.Capacitor?.isNativePlatform?.()) return

  try {
    const mod = await import('@capacitor/push-notifications')
    PushNotifications = mod.PushNotifications

    // Запрашиваем разрешение
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') {
      // Push denied
      return
    }

    // Регистрируемся
    await PushNotifications.register()

    // Получаем токен
    PushNotifications.addListener('registration', (token) => {
      // Push registered
      // Отправляем токен на сервер
      const authToken = localStorage.getItem('stolbiki_token')
      if (authToken) {
        fetch('/api/push/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ token: token.value, platform: 'android' }),
        }).catch(() => {})
      }
    })

    // Ошибка регистрации
    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err)
    })

    // Уведомление получено (приложение на переднем плане)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Push foreground
      // Можно показать in-app banner
    })

    // Пользователь нажал на уведомление
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // Push tap
      const data = action.notification.data
      // Навигация по типу уведомления
      if (data?.room) {
        window.location.hash = `online?room=${data.room}`
      } else if (data?.type === 'daily') {
        window.location.hash = 'puzzles'
      }
    })

  } catch (err) {
    // Push unavailable
  }
}
