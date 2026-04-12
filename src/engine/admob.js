/**
 * AdMob — обёртка над @capacitor-community/admob
 * Используется только в native (Capacitor) приложении.
 *
 * Установка:
 *   npm install @capacitor-community/admob
 *   npx cap sync android
 *
 * В AndroidManifest.xml добавить внутри <application>:
 *   <meta-data
 *     android:name="com.google.android.gms.ads.APPLICATION_ID"
 *     android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
 *
 * Для iOS в Info.plist добавить:
 *   <key>GADApplicationIdentifier</key>
 *   <string>ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
 *
 * Реальные ID берём из консоли AdMob: admob.google.com
 */

// ─── ID блоков (заменить на реальные из AdMob консоли) ───
const ADS_CONFIG = {
  // Android
  android: {
    appId:          'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX', // App ID
    interstitial:   'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX', // Interstitial
    rewarded:       'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX', // Rewarded
    banner:         'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX', // Banner
  },
  // iOS (если понадобится)
  ios: {
    appId:          'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    interstitial:   'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    rewarded:       'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    banner:         'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  // Тестовые ID Google (работают без верификации AdMob)
  test: {
    appId:          'ca-app-pub-3940256099942544~3347511713',
    interstitial:   'ca-app-pub-3940256099942544/1033173712',
    rewarded:       'ca-app-pub-3940256099942544/5224354917',
    banner:         'ca-app-pub-3940256099942544/6300978111',
  },
}

// ─── Состояние ───
let AdMob = null
let initialized = false
let interstitialReady = false
let gamesAfterAd = 0

const isNative = () => !!window.Capacitor?.isNativePlatform?.()
const useTestAds = () => window.ADMOB_TEST === true || import.meta.env.DEV

function getAdUnit(type) {
  if (useTestAds()) return ADS_CONFIG.test[type]
  const platform = window.Capacitor?.getPlatform?.() || 'android'
  return ADS_CONFIG[platform]?.[type] || ADS_CONFIG.android[type]
}

// ─── Инициализация ───
export async function initAdMob() {
  if (!isNative()) return
  try {
    const mod = await import('@capacitor-community/admob')
    AdMob = mod.AdMob
    await AdMob.initialize({
      requestTrackingAuthorization: true,
      initializeForTesting: useTestAds(),
    })
    initialized = true
    console.log('[AdMob] initialized, test:', useTestAds())
    // Подгружаем первый interstitial сразу
    await loadInterstitial()
  } catch (e) {
    console.warn('[AdMob] init failed:', e?.message)
  }
}

// ─── Interstitial (межстраничная реклама) ───
export async function loadInterstitial() {
  if (!initialized || !AdMob) return
  try {
    await AdMob.prepareInterstitial({
      adId: getAdUnit('interstitial'),
      isTesting: useTestAds(),
    })
    interstitialReady = true
  } catch (e) {
    interstitialReady = false
    console.warn('[AdMob] loadInterstitial failed:', e?.message)
  }
}

/**
 * Показываем interstitial каждые N партий.
 * Вызывать после окончания партии в Game.jsx.
 * @param {number} everyN — каждые сколько партий (default: 3)
 */
export async function maybeShowInterstitial(everyN = 3) {
  if (!isNative() || !initialized) return false
  gamesAfterAd++
  if (gamesAfterAd < everyN) return false
  if (!interstitialReady) {
    // Попробуем загрузить сейчас
    await loadInterstitial()
    if (!interstitialReady) return false
  }
  try {
    gamesAfterAd = 0
    interstitialReady = false
    await AdMob.showInterstitial()
    // Подгружаем следующий в фоне
    setTimeout(() => loadInterstitial(), 1000)
    return true
  } catch (e) {
    console.warn('[AdMob] showInterstitial failed:', e?.message)
    return false
  }
}

// ─── Rewarded (реклама за вознаграждение) ───
/**
 * Показываем rewarded. Если пользователь досмотрел — вызываем onRewarded(bricks).
 * Используется в профиле/магазине: «Посмотри рекламу — получи 10 кирпичей».
 */
export async function showRewarded(onRewarded) {
  if (!isNative() || !initialized || !AdMob) {
    // На вебе симулируем (для тестирования)
    if (!isNative()) { onRewarded?.(10); return true }
    return false
  }
  try {
    await AdMob.prepareRewardVideoAd({
      adId: getAdUnit('rewarded'),
      isTesting: useTestAds(),
    })
    const result = await AdMob.showRewardVideoAd()
    if (result?.rewardAmount > 0 || result?.type === 'ad') {
      onRewarded?.(10) // +10 кирпичей за просмотр
      return true
    }
    return false
  } catch (e) {
    console.warn('[AdMob] showRewarded failed:', e?.message)
    return false
  }
}

// ─── Banner (нижний баннер) ───
export async function showBanner() {
  if (!isNative() || !initialized || !AdMob) return
  try {
    await AdMob.showBanner({
      adId: getAdUnit('banner'),
      adSize: 'SMART_BANNER',
      position: 'BOTTOM_CENTER',
      isTesting: useTestAds(),
    })
  } catch (e) {
    console.warn('[AdMob] showBanner failed:', e?.message)
  }
}

export async function hideBanner() {
  if (!isNative() || !initialized || !AdMob) return
  try { await AdMob.hideBanner() } catch {}
}

export async function removeBanner() {
  if (!isNative() || !initialized || !AdMob) return
  try { await AdMob.removeBanner() } catch {}
}
