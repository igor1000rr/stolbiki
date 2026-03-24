import { useI18n } from '../engine/i18n'

const FEATURES = [
  {
    icon: '🤖',
    title: { ru: 'AI на основе AlphaZero', en: 'AlphaZero-based AI' },
    desc: { ru: '3 уровня сложности, 239K+ проанализированных партий, нейросеть GPU-обучена', en: '3 difficulty levels, 239K+ games analyzed, GPU-trained neural network' },
  },
  {
    icon: '🌐',
    title: { ru: 'Онлайн мультиплеер', en: 'Online multiplayer' },
    desc: { ru: 'Скинь другу ссылку — играйте без регистрации', en: 'Share a link with a friend — play without signup' },
  },
  {
    icon: '🧩',
    title: { ru: 'Головоломки', en: 'Puzzles' },
    desc: { ru: 'Тактические задачки от простых к сложным', en: 'Tactical puzzles from easy to hard' },
  },
  {
    icon: '📅',
    title: { ru: 'Ежедневный челлендж', en: 'Daily Challenge' },
    desc: { ru: 'Одинаковая позиция для всех — сравнивай результаты', en: 'Same position for everyone — compare results' },
  },
  {
    icon: '🎓',
    title: { ru: 'Режим «Тренер»', en: 'Trainer mode' },
    desc: { ru: 'AI оценивает каждый ваш ход и учит стратегии', en: 'AI evaluates every move and teaches strategy' },
  },
  {
    icon: '📊',
    title: { ru: 'Книга дебютов', en: 'Opening book' },
    desc: { ru: 'Аналитика стоек, тепловые карты, стратегии', en: 'Stand analytics, heatmaps, strategies' },
  },
]

export default function Landing({ onPlay, onTutorial }) {
  const { t, lang } = useI18n()

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 0' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>♟️</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, fontFamily: 'DM Serif Display, serif' }}>
          {t('header.title')}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink2)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
          {lang === 'en'
            ? 'A strategy board game for 2 players. Close stands, control the golden one, outsmart your opponent.'
            : 'Стратегическая настольная игра для 2 игроков. Закрывайте стойки, контролируйте золотую, переиграйте противника.'
          }
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <button className="btn primary" onClick={onPlay} style={{ fontSize: 16, padding: '14px 32px' }}>
            {lang === 'en' ? '🎮 Play now' : '🎮 Играть'}
          </button>
          <button className="btn" onClick={onTutorial} style={{ fontSize: 14, padding: '12px 20px' }}>
            {lang === 'en' ? '📖 Learn' : '📖 Обучение'}
          </button>
        </div>
      </div>

      {/* Фичи */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginBottom: 24 }}>
        {FEATURES.map((f, i) => (
          <div key={i} className="dash-card" style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                {f.title[lang] || f.title.ru}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
                {f.desc[lang] || f.desc.ru}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Статистика */}
      <div className="dash-card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { v: '239K+', l: lang === 'en' ? 'games analyzed' : 'партий проанализировано' },
            { v: '97%', l: lang === 'en' ? 'AI win rate' : 'винрейт AI' },
            { v: '52:48', l: lang === 'en' ? 'game balance' : 'баланс игры' },
            { v: '14', l: lang === 'en' ? 'achievements' : 'ачивок' },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Print & Play */}
      <div className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', marginBottom: 24 }}>
        <span style={{ fontSize: 36 }}>🖨️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            Print & Play
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
            {lang === 'en'
              ? 'Download PDF with board, chips and rules. Print, cut, play!'
              : 'Скачайте PDF с полем, фишками и правилами. Распечатайте, вырежьте, играйте!'
            }
          </div>
        </div>
        <a href="/print-and-play.pdf" target="_blank" className="btn primary"
          style={{ textDecoration: 'none', fontSize: 12, padding: '8px 16px', whiteSpace: 'nowrap' }}>
          📥 PDF
        </a>
      </div>

      {/* QR */}
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink3)' }}>
        {lang === 'en'
          ? 'Works on mobile — add to home screen for offline play'
          : 'Работает на мобильных — добавьте на главный экран для оффлайн игры'
        }
      </div>
    </div>
  )
}
