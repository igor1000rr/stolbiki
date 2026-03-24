import { useI18n } from '../engine/i18n'
import Icon from './Icon'

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon"><Icon name={icon} size={22} color="var(--accent)" /></div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  )
}

function StepCard({ num, title, desc }) {
  return (
    <div className="step-card">
      <div className="step-num">{num}</div>
      <h3 className="step-title">{title}</h3>
      <p className="step-desc">{desc}</p>
    </div>
  )
}

function StatBlock({ value, label }) {
  return (
    <div className="stat-block">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function Landing({ onPlay, onTutorial, publicStats }) {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div className="landing">

      {/* ═══ HERO ═══ */}
      <section className="landing-hero">
        {/* Визуальный элемент — абстрактные стойки */}
        <div className="hero-visual">
          <div className="hero-stands">
            {[7, 11, 9, 11, 6, 8, 10, 11, 5, 7].map((h, i) => (
              <div key={i} className="hero-stand" style={{ height: `${h * 8}%` }}>
                <div className="hero-stand-fill" style={{
                  height: '100%',
                  background: i === 0 ? 'var(--gold)' : (i % 3 === 0 ? 'var(--p2)' : 'var(--p1)'),
                  opacity: h === 11 ? 0.9 : 0.3 + (h / 11) * 0.4,
                }} />
              </div>
            ))}
          </div>
        </div>

        <h1 className="hero-title">
          {en ? 'Strategy board game powered by AI' : 'Стратегическая настолка с AI'}
        </h1>
        <p className="hero-subtitle">
          {en
            ? '10 stands, 11 chips each, infinite depth. Play against a neural network trained on 239K games, challenge friends online, or print and play at the table.'
            : '10 стоек, 11 фишек на каждой, бесконечная глубина. Играйте против нейросети, обученной на 239K партиях, соревнуйтесь с друзьями онлайн или распечатайте и играйте за столом.'
          }
        </p>
        <div className="hero-note">
          <span className="beta-badge">beta</span>
          <span>{en ? 'Open beta — active development' : 'Открытая бета — активная разработка'}</span>
        </div>
        <div className="hero-actions">
          <button className="btn primary hero-btn" onClick={onPlay}>
            <Icon name="play" size={18} color="#fff" />
            {en ? 'Play free' : 'Играть'}
          </button>
          <button className="btn hero-btn" onClick={onTutorial}>
            <Icon name="rules" size={16} />
            {en ? 'Learn in 2 min' : 'Обучение за 2 мин'}
          </button>
        </div>
      </section>

      {/* ═══ СТАТИСТИКА ═══ */}
      <section className="landing-stats">
        <StatBlock value="239K+" label={en ? 'games analyzed' : 'партий проанализировано'} />
        <div className="stat-divider" />
        <StatBlock value="97%" label={en ? 'AI win rate' : 'винрейт AI'} />
        <div className="stat-divider" />
        <StatBlock value="52:48" label={en ? 'P1/P2 balance' : 'баланс P1/P2'} />
        <div className="stat-divider" />
        <StatBlock value="6" label={en ? 'templates' : 'шаблонов головоломок'} />
        {publicStats && publicStats.totalGames > 10 && (
          <>
            <div className="stat-divider" />
            <StatBlock value={publicStats.totalGames} label={en ? 'games played' : 'партий сыграно'} />
          </>
        )}
      </section>

      {/* ═══ КАК ИГРАТЬ ═══ */}
      <section className="landing-section">
        <h2 className="section-title">{en ? 'Learn in 3 steps' : 'Научитесь за 3 шага'}</h2>
        <div className="steps-grid">
          <StepCard num="01" title={en ? 'Place chips' : 'Ставьте фишки'} desc={en ? 'Up to 3 chips on max 2 stands per turn. First move is always 1 chip.' : 'До 3 фишек на максимум 2 стойки за ход. Первый ход — всегда 1 фишка.'} />
          <StepCard num="02" title={en ? 'Transfer' : 'Переносите'} desc={en ? 'Move your top chip group to another stand. The key tactical move.' : 'Переместите верхнюю группу своих фишек. Ключевой тактический приём.'} />
          <StepCard num="03" title={en ? 'Close stands' : 'Закрывайте'} desc={en ? 'At 11 chips a stand closes. Top color = owner. Close 6 of 10 to win.' : 'При 11 фишках стойка закрывается. Цвет сверху = владелец. Закройте 6 из 10.'} />
        </div>
      </section>

      {/* ═══ ФИЧИ ═══ */}
      <section className="landing-section">
        <h2 className="section-title">{en ? 'Everything you need' : 'Всё для игры'}</h2>
        <div className="features-grid">
          <FeatureCard icon="ai" title={en ? 'AlphaZero-based AI' : 'AI на базе AlphaZero'} desc={en ? '3 difficulty levels. GPU-trained neural net, 97% win rate against random play.' : '3 уровня сложности. Нейросеть обучена на GPU, 97% винрейт.'} />
          <FeatureCard icon="online" title={en ? 'Online multiplayer' : 'Онлайн мультиплеер'} desc={en ? 'Send a link — play instantly. Best-of-3 and best-of-5 series. No signup.' : 'Отправьте ссылку — играйте сразу. Серии из 3 и 5 партий. Без регистрации.'} />
          <FeatureCard icon="puzzle" title={en ? 'Daily puzzles' : 'Ежедневные головоломки'} desc={en ? 'New puzzle every day. Weekly challenge. Bank of 50 puzzles. Leaderboards.' : 'Новая задача каждый день. Еженедельный челлендж. Банк из 50 задач.'} />
          <FeatureCard icon="trainer" title={en ? 'Trainer mode' : 'Режим «Тренер»'} desc={en ? 'AI evaluates every move in real-time. Shows position strength bar.' : 'AI оценивает каждый ход в реальном времени. Шкала силы позиции.'} />
          <FeatureCard icon="chart" title={en ? 'Opening book' : 'Книга дебютов'} desc={en ? 'Heatmaps, opening strategies, stand analytics from 239K games.' : 'Тепловые карты, стратегии дебютов, аналитика из 239K партий.'} />
          <FeatureCard icon="theme" title={en ? 'Themes & PWA' : 'Темы и PWA'} desc={en ? '4 color themes. Works offline on mobile. Add to home screen.' : '4 цветовые темы. Работает оффлайн. Добавьте на главный экран.'} />
        </div>
      </section>

      {/* ═══ ДЛЯ КОГО ═══ */}
      <section className="landing-section">
        <h2 className="section-title">{en ? 'Who is it for' : 'Для кого'}</h2>
        <div className="audience-grid">
          {[
            { icon: 'star', title: en ? 'Families' : 'Семьи', desc: en ? 'Simple rules, deep strategy. Ages 8+.' : 'Простые правила, глубокая стратегия. Возраст 8+.' },
            { icon: 'trophy', title: en ? 'Board gamers' : 'Настольщики', desc: en ? 'Original mechanics. Balanced 52:48. Verified on 239K games.' : 'Оригинальная механика. Баланс 52:48. Проверено на 239K партиях.' },
            { icon: 'online', title: en ? 'Online players' : 'Онлайн-игроки', desc: en ? 'No friend nearby? Play via link or train with AI.' : 'Нет друга рядом? Играйте онлайн или тренируйтесь с AI.' },
          ].map((c, i) => (
            <div key={i} className="audience-card">
              <Icon name={c.icon} size={24} color="var(--accent)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{c.title}</h3>
              <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PRINT & PLAY ═══ */}
      <section className="landing-section">
        <div className="printplay-card">
          <div className="printplay-content">
            <Icon name="download" size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Print & Play</h3>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.6, marginBottom: 16 }}>
              {en
                ? 'Download a 3-page PDF: game board, 110 chips, and full rules. Print, cut, play.'
                : 'Скачайте PDF на 3 страницы: игровое поле, 110 фишек и полные правила. Распечатайте, вырежьте, играйте.'
              }
            </p>
            <a href="/print-and-play.pdf" target="_blank" className="btn primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="download" size={16} color="#fff" /> PDF
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="landing-section">
        <h2 className="section-title">{en ? 'FAQ' : 'Частые вопросы'}</h2>
        <div className="faq-list">
          {[
            [en ? 'How long is a game?' : 'Сколько длится партия?', en ? '5-15 minutes depending on player level.' : '5-15 минут в зависимости от уровня.'],
            [en ? 'What is the golden stand?' : 'Что такое золотая стойка?', en ? 'First stand — breaks 5:5 ties. Its owner wins.' : 'Первая стойка — решает при ничьей 5:5. Её владелец побеждает.'],
            [en ? 'Can I play on mobile?' : 'Можно играть на телефоне?', en ? 'Yes. PWA — add to home screen, play offline.' : 'Да. PWA — добавьте на экран, играйте оффлайн.'],
            [en ? 'How does Swap work?' : 'Как работает Swap?', en ? 'After Blue\'s first move, Red can take their position by swapping colors.' : 'После первого хода синих красные могут забрать их позицию, поменяв цвета.'],
            [en ? 'Is the game balanced?' : 'Игра сбалансирована?', en ? '52:48 in favor of first move. Confirmed across 239K games.' : '52:48 в пользу первого хода. Подтверждено на 239K партиях.'],
          ].map(([q, a], i) => (
            <details key={i} className="faq-item">
              <summary className="faq-q">{q}<Icon name="arrow" size={16} className="faq-arrow" /></summary>
              <div className="faq-a">{a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="landing-cta">
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
          {en ? 'Ready to play?' : 'Готовы играть?'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 24, maxWidth: 420, lineHeight: 1.7 }}>
          {en
            ? 'Open beta — we ship new features every week. Follow the blog for updates.'
            : 'Открытая бета — новые фичи каждую неделю. Следите за блогом.'
          }
        </p>
        <button className="btn primary hero-btn" onClick={onPlay}>
          <Icon name="play" size={18} color="#fff" />
          {en ? 'Start playing' : 'Начать играть'}
        </button>
      </section>
    </div>
  )
}
