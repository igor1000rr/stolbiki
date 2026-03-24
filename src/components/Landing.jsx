import { useI18n } from '../engine/i18n'
import Icon from './Icon'

export default function Landing({ onPlay, onTutorial, publicStats }) {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div className="landing">

      {/* ═══ HERO ═══ */}
      <section className="l-hero">
        <div className="l-hero-visual">
          {[7, 11, 9, 11, 6, 8, 10, 11, 5, 7].map((h, i) => (
            <div key={i} className="l-bar" style={{ height: `${h * 8}%`,
              background: i === 0 ? 'var(--gold)' : i % 3 === 0 ? 'var(--p2)' : 'var(--p1)',
              opacity: h === 11 ? 0.9 : 0.25 + (h / 11) * 0.45 }} />
          ))}
        </div>
        <h1 className="l-hero-title">
          {en ? 'Strategy board game powered by AI' : 'Стратегическая настолка с AI'}
        </h1>
        <p className="l-hero-sub">
          {en
            ? '10 stands. 11 chips each. Infinite depth. Play against a neural network trained on 239K games, challenge friends, or print and play at the table.'
            : '10 стоек. 11 фишек на каждой. Бесконечная глубина. Играйте против нейросети, обученной на 239K партиях, соревнуйтесь с друзьями или распечатайте и играйте за столом.'}
        </p>
        <div className="l-hero-meta">
          <span className="beta-badge">beta</span>
          {en ? 'Open beta — active development' : 'Открытая бета — активная разработка'}
        </div>
        <div className="l-hero-btns">
          <button className="btn primary l-btn-lg" onClick={onPlay}>
            <Icon name="play" size={18} color="#fff" />{en ? 'Play free' : 'Играть'}
          </button>
          <button className="btn l-btn-lg" onClick={onTutorial}>
            <Icon name="rules" size={16} />{en ? 'Learn in 2 min' : 'Обучение за 2 мин'}
          </button>
        </div>
      </section>

      {/* ═══ ЧИСЛА — горизонтальная полоса ═══ */}
      <section className="l-numbers">
        {[
          { v: '239K+', l: en ? 'games analyzed' : 'партий' },
          { v: '97%', l: en ? 'AI win rate' : 'винрейт AI' },
          { v: '52:48', l: en ? 'P1/P2 balance' : 'баланс' },
        ].map((s, i) => (
          <div key={i} className="l-num">
            <span className="l-num-val">{s.v}</span>
            <span className="l-num-label">{s.l}</span>
          </div>
        ))}
      </section>

      {/* ═══ КАК ИГРАТЬ — 3 шага горизонтально с линией ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'Learn in 3 steps' : 'Научитесь за 3 шага'}</h2>
        <div className="l-steps">
          {[
            { n: '01', t: en ? 'Place' : 'Ставьте', d: en ? 'Up to 3 chips on max 2 stands. First move — 1 chip.' : 'До 3 фишек на 2 стойки за ход. Первый ход — 1 фишка.' },
            { n: '02', t: en ? 'Transfer' : 'Переносите', d: en ? 'Move your top group to another stand. The key tactical move.' : 'Переместите группу фишек. Ключевой тактический приём.' },
            { n: '03', t: en ? 'Close' : 'Закрывайте', d: en ? '11 chips = closed. Top color owns it. Close 6 of 10 to win!' : '11 фишек = закрыта. Цвет сверху владеет. Закройте 6 из 10!' },
          ].map((s, i) => (
            <div key={i} className="l-step">
              <div className="l-step-n">{s.n}</div>
              <div className="l-step-t">{s.t}</div>
              <div className="l-step-d">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ГЛАВНАЯ ФИЧА — большой блок AI + 2 поменьше рядом ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'What\'s inside' : 'Что внутри'}</h2>
        <div className="l-features">
          {/* Большая карточка AI */}
          <div className="l-feat l-feat-big">
            <div className="l-feat-icon" style={{ background: '#4a9eff18' }}>
              <Icon name="ai" size={28} color="#4a9eff" />
            </div>
            <h3>{en ? 'AlphaZero AI' : 'AI на базе AlphaZero'}</h3>
            <p>{en
              ? 'Neural network trained via self-play on GPU. 1146 iterations, loss 0.098. Three difficulty levels — from casual to grandmaster. Win rate 97% vs random.'
              : 'Нейросеть обучена через self-play на GPU. 1146 итераций, loss 0.098. Три уровня сложности — от казуального до гроссмейстера. Винрейт 97%.'}</p>
            <div className="l-feat-tags">
              <span>GPU-trained</span><span>MCTS</span><span>Self-play</span>
            </div>
          </div>
          {/* Две карточки справа */}
          <div className="l-feat-side">
            <div className="l-feat l-feat-sm">
              <div className="l-feat-icon" style={{ background: '#3dd68c18' }}>
                <Icon name="online" size={20} color="#3dd68c" />
              </div>
              <h3>{en ? 'Online multiplayer' : 'Онлайн'}</h3>
              <p>{en ? 'Share a link — play instantly. Best-of-3 and best-of-5. No signup.' : 'Отправьте ссылку — играйте сразу. Серии 3/5. Без регистрации.'}</p>
            </div>
            <div className="l-feat l-feat-sm">
              <div className="l-feat-icon" style={{ background: '#ffc14518' }}>
                <Icon name="puzzle" size={20} color="#ffc145" />
              </div>
              <h3>{en ? 'Daily puzzles' : 'Головоломки'}</h3>
              <p>{en ? 'New challenge every day. Weekly hard mode. Bank of 50. Leaderboards.' : 'Новая задача каждый день. Еженедельная сложная. Банк из 50. Лидерборды.'}</p>
            </div>
          </div>
        </div>

        {/* Вторая строка — 3 компактных ═══ */}
        <div className="l-feat-row">
          {[
            { icon: 'trainer', c: '#9b59b6', t: en ? 'Trainer' : 'Тренер', d: en ? 'AI evaluates every move' : 'AI оценивает каждый ход' },
            { icon: 'chart', c: '#f06040', t: en ? 'Opening book' : 'Дебюты', d: en ? 'Heatmaps from 239K games' : 'Тепловые карты из 239K партий' },
            { icon: 'theme', c: '#00bcd4', t: en ? 'Themes & PWA' : 'Темы и PWA', d: en ? '4 themes. Offline mode' : '4 темы. Оффлайн режим' },
          ].map((f, i) => (
            <div key={i} className="l-feat l-feat-compact">
              <Icon name={f.icon} size={18} color={f.c} />
              <div>
                <strong>{f.t}</strong>
                <span>{f.d}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ДЛЯ КОГО — текст слева, 3 карточки справа ═══ */}
      <section className="l-section">
        <div className="l-audience">
          <div className="l-audience-text">
            <h2>{en ? 'For everyone' : 'Для всех'}</h2>
            <p>{en
              ? 'Simple rules make it accessible. Deep strategy keeps experts engaged. Works on any device.'
              : 'Простые правила делают игру доступной. Глубокая стратегия увлекает экспертов. Работает на любом устройстве.'}</p>
            <button className="btn primary" onClick={onPlay} style={{ marginTop: 16 }}>
              <Icon name="play" size={16} color="#fff" />{en ? 'Try now' : 'Попробовать'}
            </button>
          </div>
          <div className="l-audience-cards">
            {[
              { c: '#ffc145', t: en ? 'Families' : 'Семьи', d: en ? 'Ages 8+. Game night favorite.' : 'Возраст 8+. Для семейных вечеров.' },
              { c: '#3dd68c', t: en ? 'Board gamers' : 'Настольщики', d: en ? 'Balance 52:48. Verified.' : 'Баланс 52:48. Проверено.' },
              { c: '#4a9eff', t: en ? 'Online' : 'Онлайн', d: en ? 'Play via link or vs AI.' : 'Играйте по ссылке или с AI.' },
            ].map((a, i) => (
              <div key={i} className="l-aud-card" style={{ borderColor: `${a.c}30` }}>
                <div className="l-aud-dot" style={{ background: a.c }} />
                <strong>{a.t}</strong>
                <span>{a.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRINT & PLAY — горизонтальный баннер ═══ */}
      <section className="l-section">
        <a href="/print-and-play.pdf" target="_blank" className="l-print" style={{ textDecoration: 'none' }}>
          <div className="l-print-left">
            <Icon name="download" size={24} color="var(--accent)" />
          </div>
          <div className="l-print-body">
            <strong>Print & Play</strong>
            <span>{en ? '3-page PDF: board, 110 chips, rules. Print, cut, play.' : 'PDF 3 страницы: поле, 110 фишек, правила.'}</span>
          </div>
          <div className="l-print-btn">PDF</div>
        </a>
      </section>

      {/* ═══ FAQ — 2 колонки ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'FAQ' : 'Частые вопросы'}</h2>
        <div className="l-faq">
          {[
            [en ? 'How long is a game?' : 'Сколько длится партия?', en ? '5–15 minutes.' : '5–15 минут.'],
            [en ? 'Golden stand?' : 'Золотая стойка?', en ? 'Breaks 5:5 ties.' : 'Решает при 5:5.'],
            [en ? 'Mobile?' : 'Телефон?', en ? 'PWA. Works offline.' : 'PWA. Работает оффлайн.'],
            [en ? 'Swap?' : 'Swap?', en ? 'P2 can take P1\'s first move.' : 'П2 может забрать ход П1.'],
            [en ? 'Balanced?' : 'Баланс?', en ? '52:48. 239K games.' : '52:48. 239K партий.'],
            [en ? 'Free?' : 'Бесплатно?', en ? 'Yes, completely.' : 'Да, полностью.'],
          ].map(([q, a], i) => (
            <div key={i} className="l-faq-item">
              <div className="l-faq-q">{q}</div>
              <div className="l-faq-a">{a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="l-cta">
        <h2>{en ? 'Ready?' : 'Готовы?'}</h2>
        <p>{en ? 'Open beta. New features every week.' : 'Открытая бета. Новые фичи каждую неделю.'}</p>
        <button className="btn primary l-btn-lg" onClick={onPlay}>
          <Icon name="play" size={18} color="#fff" />{en ? 'Start playing' : 'Начать играть'}
        </button>
      </section>
    </div>
  )
}
