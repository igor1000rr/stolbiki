import { useState } from 'react'

const SLIDES = [
  {
    title_ru: 'Добро пожаловать!',
    title_en: 'Welcome!',
    desc_ru: 'Highrise Heist — стратегическая настольная игра для двоих с AI на нейросетях',
    desc_en: 'Highrise Heist — a strategy board game for two with neural network AI',
    icon: <img src="/mascot/wave-lg.webp" alt="Снуппи" width={120} height={120} style={{ objectFit: 'contain' }} />,
  },
  {
    title_ru: 'Ставьте блоки',
    title_en: 'Place blocks',
    desc_ru: 'Каждый ход — ставьте до 3 блоков на 1-2 стойки. Заполните стойку до 11 — и она ваша!',
    desc_en: 'Each turn — place up to 3 blocks on 1-2 stands. Fill a stand to 11 — and it\'s yours!',
    icon: <img src="/mascot/hero-lg.webp" alt="Снуппи" width={120} height={120} style={{ objectFit: 'contain' }} />,
  },
  {
    title_ru: 'Достройте 6 высоток',
    title_en: 'Complete 6 highrises',
    desc_ru: 'Цвет верхней группы определяет владельца. Золотая ★ стойка решает при ничьей 5:5',
    desc_en: 'Top group color determines the owner. Golden ★ stand decides at 5:5 tie',
    icon: <img src="/mascot/celebrate-lg.webp" alt="Снуппи" width={120} height={120} style={{ objectFit: 'contain' }} />,
  },
  {
    title_ru: 'Играйте!',
    title_en: 'Play!',
    desc_ru: 'Против AI, онлайн с друзьями, решайте головоломки и покоряйте рейтинг',
    desc_en: 'VS AI, online with friends, solve puzzles and climb the rankings',
    icon: <img src="/mascot/point-lg.webp" alt="Снуппи" width={120} height={120} style={{ objectFit: 'contain' }} />,
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
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      paddingTop: 'env(safe-area-inset-top, 40px)',
      paddingBottom: 'calc(40px + env(safe-area-inset-bottom))',
    }}>
      {/* Иконка */}
      <div style={{ marginBottom: 32, opacity: 0.9 }}>{s.icon}</div>

      {/* Текст */}
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, textAlign: 'center' }}>
        {en ? s.title_en : s.title_ru}
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink2)', textAlign: 'center', lineHeight: 1.6, maxWidth: 320 }}>
        {en ? s.desc_en : s.desc_ru}
      </p>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
            background: i === slide ? 'var(--p1)' : 'var(--surface2)',
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
            color: 'var(--ink2)', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            {en ? 'Back' : 'Назад'}
          </button>
        )}
        <button onClick={() => {
          if (isLast) { localStorage.setItem('stolbiki_onboarding_done', '1'); localStorage.setItem('stolbiki_tutorial_seen', '1'); onDone() }
          else setSlide(slide + 1)
        }} style={{
          flex: 2, padding: '14px 0', borderRadius: 12,
          border: 'none', background: isLast ? 'var(--p1)' : 'rgba(74,158,255,0.15)',
          color: isLast ? '#fff' : 'var(--p1)', fontSize: 15, fontWeight: 600,
          fontFamily: 'inherit', cursor: 'pointer',
        }}>
          {isLast ? (en ? 'Start playing!' : 'Начать играть!') : (en ? 'Next' : 'Далее')}
        </button>
      </div>

      {/* Пропустить */}
      {!isLast && (
        <button onClick={() => { localStorage.setItem('stolbiki_onboarding_done', '1'); localStorage.setItem('stolbiki_tutorial_seen', '1'); onDone() }}
          style={{ background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 12, marginTop: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
          {en ? 'Skip' : 'Пропустить'}
        </button>
      )}
    </div>
  )
}
