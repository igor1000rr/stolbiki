import { useI18n } from '../engine/i18n'

const FEATURES = [
  { icon: '🤖', title: { ru: 'AI на основе AlphaZero', en: 'AlphaZero-based AI' }, desc: { ru: '3 уровня сложности. Нейросеть обучена на GPU по 239K+ партий. Винрейт 97%', en: '3 difficulty levels. GPU-trained neural net on 239K+ games. 97% win rate' } },
  { icon: '🌐', title: { ru: 'Онлайн мультиплеер', en: 'Online multiplayer' }, desc: { ru: 'Отправьте ссылку другу — играйте мгновенно без регистрации. Серии из 3 и 5 партий', en: 'Send a link to a friend — play instantly, no signup. Best-of-3 and best-of-5 series' } },
  { icon: '🧩', title: { ru: 'Головоломки', en: 'Puzzles' }, desc: { ru: 'Ежедневные и еженедельные задачи + банк из 50 головоломок. Лидерборды', en: 'Daily & weekly challenges + 50 puzzle bank. Leaderboards' } },
  { icon: '🎓', title: { ru: 'Тренер', en: 'Trainer' }, desc: { ru: 'AI оценивает каждый ваш ход в реальном времени и показывает силу позиции', en: 'AI evaluates every move in real-time and shows position strength' } },
  { icon: '📊', title: { ru: 'Аналитика', en: 'Analytics' }, desc: { ru: 'Книга дебютов, тепловые карты стоек, детальная статистика из 239K партий', en: 'Opening book, stand heatmaps, detailed stats from 239K games' } },
  { icon: '📱', title: { ru: 'Везде', en: 'Everywhere' }, desc: { ru: 'PWA — работает на телефоне как приложение. Оффлайн режим. 4 цветовых темы', en: 'PWA — works on phone like an app. Offline mode. 4 color themes' } },
]

const HOW_TO = [
  { step: '1', title: { ru: 'Ставьте фишки', en: 'Place chips' }, desc: { ru: 'Каждый ход — до 3 фишек на максимум 2 стойки. Первый ход — всегда 1 фишка', en: 'Each turn — up to 3 chips on max 2 stands. First move — always 1 chip' }, visual: '🎯' },
  { step: '2', title: { ru: 'Переносите', en: 'Transfer' }, desc: { ru: 'Переместите верхнюю группу своих фишек на другую стойку — ключевой тактический приём', en: 'Move your top chip group to another stand — the key tactical move' }, visual: '↗️' },
  { step: '3', title: { ru: 'Закрывайте стойки', en: 'Close stands' }, desc: { ru: 'При 11 фишках стойка закрывается. Цвет верхних фишек = владелец. Закройте 6 из 10!', en: 'At 11 chips a stand closes. Top chips color = owner. Close 6 of 10!' }, visual: '🏆' },
]

const FAQ = [
  { q: { ru: 'Сколько длится одна партия?', en: 'How long is a game?' }, a: { ru: '5–15 минут в зависимости от уровня игроков', en: '5–15 minutes depending on player level' } },
  { q: { ru: 'Что такое золотая стойка (★)?', en: 'What is the golden stand (★)?' }, a: { ru: 'Первая стойка (★) решает при ничьей 5:5 — её владелец побеждает', en: 'The first stand (★) breaks 5:5 ties — its owner wins' } },
  { q: { ru: 'Можно ли играть на телефоне?', en: 'Can I play on mobile?' }, a: { ru: 'Да! Сайт — PWA, добавьте на главный экран и играйте оффлайн', en: 'Yes! The site is a PWA — add to home screen and play offline' } },
  { q: { ru: 'Как работает Swap?', en: 'How does Swap work?' }, a: { ru: 'После первого хода синих красные могут «забрать» их позицию, поменяв цвета', en: 'After Blue\'s first move, Red can "take" their position by swapping colors' } },
  { q: { ru: 'Игра сбалансирована?', en: 'Is the game balanced?' }, a: { ru: 'Да — 52:48 в пользу первого хода (P1). Подтверждено на 239K+ партий', en: 'Yes — 52:48 in favor of first move (P1). Confirmed across 239K+ games' } },
]

export default function Landing({ onPlay, onTutorial, publicStats }) {
  const { lang } = useI18n()

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* ═══ HERO ═══ */}
      <section style={{ textAlign: 'center', padding: '48px 20px 40px' }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, color: 'var(--ink)', fontFamily: 'DM Serif Display, serif', lineHeight: 1.2, marginBottom: 16, whiteSpace: 'pre-line' }}>
          {lang === 'en' ? 'The strategy board game\nyou can play anywhere' : 'Стратегическая настолка,\nв которую можно играть везде'}
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink2)', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 28px' }}>
          {lang === 'en'
            ? '10 stands, 11 chips each, infinite depth. Play against AI, friends online, or print and play at the table.'
            : '10 стоек, 11 фишек на каждой, бесконечная глубина. Играйте против AI, с друзьями онлайн, или распечатайте и играйте за столом.'
          }
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={onPlay} style={{ fontSize: 16, padding: '14px 36px' }}>
            {lang === 'en' ? '🎮 Play free' : '🎮 Играть бесплатно'}
          </button>
          <button className="btn" onClick={onTutorial} style={{ fontSize: 14, padding: '12px 24px' }}>
            {lang === 'en' ? '📖 Learn in 2 min' : '📖 Научиться за 2 мин'}
          </button>
        </div>
        {/* Статы под кнопками */}
        {publicStats && (
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--surface2)' }}>
            {[
              { v: publicStats.totalUsers || '—', l: lang === 'en' ? 'players' : 'игроков' },
              { v: publicStats.totalGames || '0', l: lang === 'en' ? 'games played' : 'партий сыграно' },
              { v: '239K+', l: lang === 'en' ? 'AI training games' : 'партий для AI' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ КАК ИГРАТЬ ═══ */}
      <section style={{ padding: '40px 0', borderTop: '1px solid var(--surface2)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, color: 'var(--ink)', fontWeight: 700, marginBottom: 28 }}>
          {lang === 'en' ? 'Learn in 3 steps' : 'Научитесь за 3 шага'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, maxWidth: 800, margin: '0 auto' }}>
          {HOW_TO.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{s.visual}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', opacity: 0.3, marginBottom: 4 }}>{s.step}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                {s.title[lang] || s.title.ru}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.6 }}>
                {s.desc[lang] || s.desc.ru}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ФИЧИ ═══ */}
      <section style={{ padding: '40px 0', borderTop: '1px solid var(--surface2)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, color: 'var(--ink)', fontWeight: 700, marginBottom: 28 }}>
          {lang === 'en' ? 'Everything you need' : 'Всё, что нужно для игры'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="dash-card" style={{ padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  {f.title[lang] || f.title.ru}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>
                  {f.desc[lang] || f.desc.ru}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ДЛЯ КОГО ═══ */}
      <section style={{ padding: '40px 0', borderTop: '1px solid var(--surface2)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, color: 'var(--ink)', fontWeight: 700, marginBottom: 28 }}>
          {lang === 'en' ? 'For everyone' : 'Для всех'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, maxWidth: 800, margin: '0 auto' }}>
          {[
            { icon: '👨‍👩‍👧‍👦', title: { ru: 'Семья', en: 'Family' }, desc: { ru: 'Простые правила, глубокая стратегия. Дети от 8 лет', en: 'Simple rules, deep strategy. Kids from 8+' } },
            { icon: '🎲', title: { ru: 'Настольщики', en: 'Board gamers' }, desc: { ru: 'Оригинальная механика с AlphaZero-анализом. Баланс 52:48', en: 'Original mechanics with AlphaZero analysis. 52:48 balance' } },
            { icon: '💻', title: { ru: 'Онлайн', en: 'Online' }, desc: { ru: 'Нет друга рядом? Играйте через ссылку или тренируйтесь с AI', en: 'No friend nearby? Play via link or train with AI' } },
          ].map((c, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '24px 20px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--surface2)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{c.title[lang] || c.title.ru}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{c.desc[lang] || c.desc.ru}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PRINT & PLAY ═══ */}
      <section style={{ padding: '40px 0', borderTop: '1px solid var(--surface2)' }}>
        <div className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '28px 32px', maxWidth: 700, margin: '0 auto' }}>
          <span style={{ fontSize: 48, flexShrink: 0 }}>🖨️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Print & Play</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6 }}>
              {lang === 'en'
                ? 'Download a PDF with the game board, 110 chips to cut out, and full rules. Perfect for game nights!'
                : 'Скачайте PDF с игровым полем, 110 фишками для вырезания и полными правилами. Идеально для вечеринок!'
              }
            </div>
          </div>
          <a href="/print-and-play.pdf" target="_blank" className="btn primary"
            style={{ textDecoration: 'none', fontSize: 14, padding: '12px 24px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            📥 PDF
          </a>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ padding: '40px 0', borderTop: '1px solid var(--surface2)' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, color: 'var(--ink)', fontWeight: 700, marginBottom: 28 }}>
          {lang === 'en' ? 'FAQ' : 'Частые вопросы'}
        </h2>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ.map((f, i) => (
            <details key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--surface2)', overflow: 'hidden' }}>
              <summary style={{ padding: '14px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--ink)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {f.q[lang] || f.q.ru}
                <span style={{ fontSize: 12, color: 'var(--ink3)', transition: 'transform 0.2s' }}>▾</span>
              </summary>
              <div style={{ padding: '0 20px 14px', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                {f.a[lang] || f.a.ru}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ textAlign: 'center', padding: '48px 20px 32px', borderTop: '1px solid var(--surface2)' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
          {lang === 'en' ? 'Ready to play?' : 'Готовы играть?'}
        </div>
        <button className="btn primary" onClick={onPlay} style={{ fontSize: 16, padding: '14px 40px' }}>
          {lang === 'en' ? '🎮 Start now — it\'s free' : '🎮 Начать — бесплатно'}
        </button>
      </section>
    </div>
  )
}
