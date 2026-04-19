/**
 * AdMob — обёртка над @capacitor-community/admob
 * Используется только в native (Capacitor) приложении.
 *
 * Установка:
 *   npm install @capacitor-community/admob --legacy-peer-deps
 *   npx cap sync android
 *
 * В AndroidManifest.xml добавить внутри <application>:
 *   <meta-data
 *     android:name="com.google.android.gms.ads.APPLICATION_ID"
 *     android:value="YOUR_APP_ID"/>
 *
 * Реальные ID берём из консоли AdMob: admob.google.com
 */

const ADS_CONFIG = {
  android: {
    appId:        'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    banner:       'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  ios: {
    appId:        'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    banner:       'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  },
  // Тестовые ID Google
  test: {
    appId:        'ca-app-pub-3940256099942544~3347511713',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded:     'ca-app-pub-3940256099942544/5224354917',
    banner:       'ca-app-pub-3940256099942544/6300978111',
  },
}

let AdMob = null
let initialized = false
let interstitialReady = false
let gamesAfterAd = 0

const isNative = () => !!window.Capacitor?.isNativePlatform?.()
const isTestAdsEnabled = () => window.ADMOB_TEST === true || import.meta.env.DEV

function getAdUnit(type) {
  if (isTestAdsEnabled()) return ADS_CONFIG.test[type]
  const platform = window.Capacitor?.getPlatform?.() || 'android'
  return ADS_CONFIG[platform]?.[type] || ADS_CONFIG.android[type]
}

export async function initAdMob() {
  if (!isNative()) return
  try {
    const mod = await import('@capacitor-community/admob')
    AdMob = mod.AdMob
    await AdMob.initialize({
      requestTrackingAuthorization: true,
      initializeForTesting: isTestAdsEnabled(),
    })
    initialized = true
    await loadInterstitial()
  } catch (e) {
    console.warn('[AdMob] init failed:', e?.message)
  }
}

export async function loadInterstitial() {
  if (!initialized || !AdMob) return
  try {
    await AdMob.prepareInterstitial({
      adId: getAdUnit('interstitial'),
      isTesting: isTestAdsEnabled(),
    })
    interstitialReady = true
  } catch {
    interstitialReady = false
  }
}

/**
 * Показываем interstitial каждые everyN партий.
 * Вызывать после окончания партии (mode ai/online, не spectate/pvp).
 */
export async function maybeShowInterstitial(everyN = 3) {
  if (!isNative() || !initialized) return false
  gamesAfterAd++
  if (gamesAfterAd < everyN) return false
  if (!interstitialReady) {
    await loadInterstitial()
    if (!interstitialReady) return false
  }
  try {
    gamesAfterAd = 0
    interstitialReady = false
    await AdMob.showInterstitial()
    setTimeout(() => loadInterstitial(), 1000)
    return true
  } catch (e) {
    console.warn('[AdMob] showInterstitial failed:', e?.message)
    return false
  }
}

/**
 * Rewarded: покажи рекламу → вызови onRewarded(amount).
 * На вебе (dev) сразу даёт награду для тестирования.
 */
export async function showRewarded(onRewarded) {
  if (!isNative() || !initialized || !AdMob) {
    if (!isNative()) { onRewarded?.(10); return true }
    return false
  }
  try {
    await AdMob.prepareRewardVideoAd({
      adId: getAdUnit('rewarded'),
      isTesting: isTestAdsEnabled(),
    })
    const result = await AdMob.showRewardVideoAd()
    if (result?.rewardAmount > 0 || result?.type === 'ad') {
      onRewarded?.(10)
      return true
    }
    return false
  } catch (e) {
    console.warn('[AdMob] showRewarded failed:', e?.message)
    return false
  }
}

export async function showBanner() {
  if (!isNative() || !initialized || !AdMob) return
  try {
    await AdMob.showBanner({
      adId: getAdUnit('banner'),
      adSize: 'SMART_BANNER',
      position: 'BOTTOM_CENTER',
      isTesting: isTestAdsEnabled(),
    })
  } catch {}
}

export async function hideBanner() {
  if (!isNative() || !initialized || !AdMob) return
  try { await AdMob.hideBanner() } catch {}
}

export async function removeBanner() {
  if (!isNative() || !initialized || !AdMob) return
  try { await AdMob.removeBanner() } catch {}
}
