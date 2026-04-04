// Firebase Push Notifications (Capacitor)
// Отключено: требует @capacitor/push-notifications + google-services.json
// Для включения: npm install @capacitor/push-notifications, настроить Firebase, раскомментировать код

export async function initPush() {
  // Push notifications отключены — нет google-services.json
  // Когда настроишь Firebase:
  // 1. npm install @capacitor/push-notifications
  // 2. Скачай google-services.json из Firebase Console → android/app/
  // 3. Раскомментируй код ниже
  // 4. npx cap sync && cd android && ./gradlew assembleRelease
}
