/**
 * AdMob — обёртка над @capacitor-community/admob
 * Используется только в native (Capacitor) приложении.
 *
 * ─── Конфигурация ID через env ───
 * Production IDs передаются в build через Vite env переменные:
 *   VITE_ADMOB_APP_ID_ANDROID, VITE_ADMOB_INTERSTITIAL_ANDROID,
 *   VITE_ADMOB_REWARDED_ANDROID, VITE_ADMOB_BANNER_ANDROID
 *   (+ аналогичные _IOS)
 *
 * В release-android.yml они прокидываются из GH Secrets.
 * Если env-переменная не задана — используется Google test ID (публичный,
 * безопасный). AdMob воспринимает test ID как "безопасный режим" и
 * не крутит реальный трафик по ним.
 *
 * AndroidManifest APPLICATION_ID резолвится отдельно через manifestPlaceholders
 * в gradle (-PadmobAppId=...). Без этого native AdMob при init падает с
 * "Missing application ID", что крашит всё приложение.
 *
 * ─── Установка ───
 *   npm install @capacitor-community/admob --legacy-peer-deps
 *   npx cap sync android
 */

// Google test IDs — публичные, их можно держать в коде. AdMob не крутит
// по ним реальную рекламу даже в release билде.
const TEST_IDS = {
  appId:        'ca-app-pub-3940256099942544~3347511713',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded:     'ca-app-pub-3940256099942544/5224354917',
  banner:       'ca-app-pub-3940256099942544/6300978111',
}

const env = import.meta.env || {}
const ADS_CONFIG = {
  android: {
    appId:        env.VITE_ADMOB_APP_ID_ANDROID        || TEST_IDS.appId,
    interstitial: env.VITE_ADMOB_INTERSTITIAL_ANDROID  || TEST_IDS.interstitial,
    rewarded:     env.VITE_ADMOB_REWARDED_ANDROID      || TEST_IDS.rewarded,
    banner:       env.VITE_ADMOB_BANNER_ANDROID        || TEST_IDS.banner,
  },
  ios: {
    appId:        env.VITE_ADMOB_APP_ID_IOS        || TEST_IDS.appId,
    interstitial: env.VITE_ADMOB_INTERSTITIAL_IOS  || TEST_IDS.interstitial,
    rewarded:     env.VITE_ADMOB_REWARDED_IOS      || TEST_IDS.rewarded,
    banner:       env.VITE_ADMOB_BANNER_IOS        || TEST_IDS.banner,
  },
}

// Production режим активен если хотя бы одна real-ID env-переменная задана
// для текущей платформы. Иначе SDK получает isTesting=true и гарантированно
// отдаёт тестовые креативы.
function hasRealIds(platform) {
  const p = platform === 'ios' ? 'IOS' : 'ANDROID'
  return !!(env[`VITE_ADMOB_APP_ID_${p}`])
}

let AdMob = null
let initialized = false
let interstitialReady = false
let gamesAfterAd = 0

const isNative = () => !!window.Capacitor?.isNativePlatform?.()

function currentPlatform() {
  return window.Capacitor?.getPlatform?.() === 'ios' ? 'ios' : 'android'
}

function isTestAdsEnabled() {
  // Приоритет: dev всегда test, window override всегда применяется,
  // в prod test только если реальные ID не настроены.
  if (env.DEV) return true
  if (window.ADMOB_TEST === true) return true
  return !hasRealIds(currentPlatform())
}

function getAdUnit(type) {
  return ADS_CONFIG[currentPlatform()]?.[type] || TEST_IDS[type]
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
