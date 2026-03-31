import { useState } from 'react'

const SLIDES = [
  {
    title_ru: 'Добро пожаловать!',
    title_en: 'Welcome!',
    desc_ru: 'Snatch Highrise — стратегическая настольная игра для двоих с AI на нейросетях',
    desc_en: 'Snatch Highrise — a strategy board game for two with neural network AI',
    icon: <img src="/logo-full.webp" alt="Snatch Highrise" style={{ width: 200, height: 'auto' }} />,
  },
  {
    title_ru: 'Ставьте фишки',
    title_en: 'Place chips',
    desc_ru: 'Каждый ход — ставьте до 3 фишек на 1-2 стойки. Заполните стойку до 11 — и она ваша!',
    desc_en: 'Each turn — place up to 3 chips on 1-2 stands. Fill a stand to 11 — and it\'s yours!',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="15" y="20" width="14" height="50" rx="4" fill="#2a2a38" stroke="#4a9eff33" strokeWidth="1"/>
        <rect x="33" y="20" width="14" height="50" rx="4" fill="#2a2a38" stroke="#4a9eff33" strokeWidth="1"/>
        <rect x="51" y="20" width="14" height="50" rx="4" fill="#2a2a38" stroke="#4a9eff33" strokeWidth="1"/>
        <rect x="17" y="58" width="10" height="5" rx="2" fill="#4a9eff"/>
        <rect x="17" y="51" width="10" height="5" rx="2" fill="#4a9eff"/>
        <rect x="17" y="44" width="10" height="5" rx="2" fill="#ff6b6b"/>
        <rect x="35" y="58" width="10" height="5" rx="2" fill="#ff6b6b"/>
        <rect x="53" y="58" width="10" height="5" rx="2" fill="#4a9eff"/>
        <rect x="53" y="51" width="10" height="5" rx="2" fill="#ff6b6b"/>
        <text x="40" y="14" textAnchor="middle" fill="#ffc145" fontSize="12" fontWeight="700">★</text>
      </svg>
    ),
  },
  {
    title_ru: 'Закройте 6 стоек',
    title_en: 'Close 6 stands',
    desc_ru: 'Цвет верхней группы определяет владельца. Золотая ★ стойка решает при ничьей 5:5',
    desc_en: 'Top group color determines the owner. Golden ★ stand decides at 5:5 tie',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={4 + i * 7.4} y="50" width="6" height="3" rx="1"
            fill={i < 6 ? '#4a9eff' : i < 9 ? '#ff6b6b' : '#ffc145'} opacity={0.9} />
        ))}
        <text x="40" y="38" textAnchor="middle" fill="#3dd68c" fontSize="28" fontWeight="800">6:4</text>
        <text x="40" y="72" textAnchor="middle" fill="#3dd68c" fontSize="11" fontWeight="600">Victory!</text>
      </svg>
    ),
  },
  {
    title_ru: 'Играйте!',
    title_en: 'Play!',
    desc_ru: 'Против AI, онлайн с друзьями, решайте головоломки и покоряйте рейтинг',
    desc_en: 'VS AI, online with friends, solve puzzles and climb the rankings',
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="30" stroke="#4a9eff33" strokeWidth="2" fill="none"/>
        <path d="M32 28l22 12-22 12V28z" fill="#4a9eff"/>
      </svg>
    ),
  },
]

export default function Onboarding({ onDone, lang = 'ru' }) {
  const [slide, setSlide] = useState(0)
  const en = lang === 'en'
  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: '#0d0d14',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      paddingTop: 'env(safe-area-inset-top, 40px)',
      paddingBottom: 'calc(40px + env(safe-area-inset-bottom))',
    }}>
      {/* Иконка */}
      <div style={{ marginBottom: 32, opacity: 0.9 }}>{s.icon}</div>

      {/* Текст */}
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e8e6f0', marginBottom: 12, textAlign: 'center' }}>
        {en ? s.title_en : s.title_ru}
      </h2>
      <p style={{ fontSize: 15, color: '#a09cb0', textAlign: 'center', lineHeight: 1.6, maxWidth: 320 }}>
        {en ? s.desc_en : s.desc_ru}
      </p>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
            background: i === slide ? '#4a9eff' : '#2a2a38',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: 12, marginTop: 32, width: '100%', maxWidth: 320 }}>
        {slide > 0 && (
          <button onClick={() => setSlide(slide - 1)} style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)', background: 'none',
            color: '#a09cb0', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            {en ? 'Back' : 'Назад'}
          </button>
        )}
        <button onClick={() => {
          if (isLast) { localStorage.setItem('stolbiki_onboarding_done', '1'); onDone() }
          else setSlide(slide + 1)
        }} style={{
          flex: 2, padding: '14px 0', borderRadius: 12,
          border: 'none', background: isLast ? '#4a9eff' : 'rgba(74,158,255,0.15)',
          color: isLast ? '#fff' : '#4a9eff', fontSize: 15, fontWeight: 600,
          fontFamily: 'inherit', cursor: 'pointer',
        }}>
          {isLast ? (en ? 'Start playing!' : 'Начать играть!') : (en ? 'Next' : 'Далее')}
        </button>
      </div>

      {/* Пропустить */}
      {!isLast && (
        <button onClick={() => { localStorage.setItem('stolbiki_onboarding_done', '1'); onDone() }}
          style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, marginTop: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
          {en ? 'Skip' : 'Пропустить'}
        </button>
      )}
    </div>
  )
}
