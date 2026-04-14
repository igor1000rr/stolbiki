// Rate app popup — показываем после N побед
const RATE_KEY = 'stolbiki_rate_asked'
const RATE_AFTER_WINS = 5

export function shouldAskRating() {
  if (!window.Capacitor?.isNativePlatform?.()) return false
  if (localStorage.getItem(RATE_KEY)) return false
  try {
    const p = JSON.parse(localStorage.getItem('stolbiki_profile'))
    return p?.wins >= RATE_AFTER_WINS
  } catch { return false }
}

export function markRatingAsked() {
  localStorage.setItem(RATE_KEY, Date.now().toString())
}

// Share приложение
export async function shareApp(lang = 'ru') {
  const text = lang === 'en'
    ? 'Play Highrise Heist — a strategy board game with AI! 🎲'
    : 'Играй в Highrise Heist — стратегическая настольная игра с AI! 🎲'
  const url = 'https://highriseheist.com'

  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title: 'Highrise Heist', text, url, dialogTitle: 'Share Highrise Heist' })
      return
    } catch {}
  }

  if (navigator.share) {
    navigator.share({ title: 'Highrise Heist', text, url }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(`${text} ${url}`)
  }
}
