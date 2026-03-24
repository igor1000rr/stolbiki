import { useI18n } from '../engine/i18n'

const FEATURES = [
  { icon: '🤖', title: { ru: 'AI на основе AlphaZero', en: 'AlphaZero-based AI' }, desc: { ru: '3 уровня сложности, нейросеть GPU-обучена на 239K+ партий', en: '3 difficulty levels, GPU-trained neural network on 239K+ games' } },
  { icon: '🌐', title: { ru: 'Онлайн мультиплеер', en: 'Online multiplayer' }, desc: { ru: 'Скинь другу ссылку — играйте без регистрации', en: 'Share a link — play without signup' } },
  { icon: '🧩', title: { ru: 'Головоломки', en: 'Puzzles' }, desc: { ru: 'Тактические задачки от простых к сложным', en: 'Tactical puzzles from easy to hard' } },
  { icon: '📅', title: { ru: 'Ежедневный челлендж', en: 'Daily Challenge' }, desc: { ru: 'Одинаковая позиция для всех — кто быстрее?', en: 'Same position for everyone — who\'s faster?' } },
  { icon: '🎓', title: { ru: 'Тренер', en: 'Trainer' }, desc: { ru: 'AI оценивает каждый ваш ход', en: 'AI evaluates every move' } },
  { icon: '📊', title: { ru: 'Книга дебютов', en: 'Opening book' }, desc: { ru: 'Тепловые карты, стратегии, аналитика', en: 'Heatmaps, strategies, analytics' } },
]

export default function Landing({ onPlay, onTutorial }) {
  const { lang } = useI18n()

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 20px 32px' }}>
        <p style={{ fontSize: 16, color: 'var(--ink2)', lineHeight: 1.8, maxWidth: 560, margin: '0 auto 24px' }}>
          {lang === 'en'
            ? 'A strategy board game for 2 players. Close stands, control the golden one, outsmart your opponent.'
            : 'Стратегическая настольная игра для 2 игроков. Закрывайте стойки, контролируйте золотую, переиграйте противника.'
          }
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={onPlay} style={{ fontSize: 16, padding: '14px 36px' }}>
            {lang === 'en' ? '🎮 Play now' : '🎮 Играть'}
          </button>
          <button className="btn" onClick={onTutorial} style={{ fontSize: 14, padding: '12px 24px' }}>
            {lang === 'en' ? '📖 How to play' : '📖 Обучение'}
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32, padding: '16px 0', borderTop: '1px solid var(--surface2)', borderBottom: '1px solid var(--surface2)' }}>
        {[
          { v: '239K+', l: lang === 'en' ? 'games analyzed' : 'партий' },
          { v: '97%', l: lang === 'en' ? 'AI win rate' : 'винрейт AI' },
          { v: '52:48', l: lang === 'en' ? 'balance' : 'баланс' },
          { v: '14', l: lang === 'en' ? 'achievements' : 'ачивок' },
        ].map(s => (
          <div key={s.l} style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{s.v}</div>
            <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Фичи — 2 колонки на десктопе, 1 на мобилке */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 32 }}>
        {FEATURES.map((f, i) => (
          <div key={i} className="dash-card" style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
                {f.title[lang] || f.title.ru}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>
                {f.desc[lang] || f.desc.ru}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Print & Play */}
      <div className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', marginBottom: 24 }}>
        <span style={{ fontSize: 40 }}>🖨️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Print & Play</div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>
            {lang === 'en'
              ? 'Download PDF with board, chips and rules. Print, cut out, play at the table!'
              : 'Скачайте PDF с полем, фишками и правилами. Распечатайте, вырежьте, играйте за столом!'
            }
          </div>
        </div>
        <a href="/print-and-play.pdf" target="_blank" className="btn primary"
          style={{ textDecoration: 'none', fontSize: 13, padding: '10px 20px', whiteSpace: 'nowrap' }}>
          📥 PDF
        </a>
      </div>
    </div>
  )
}
