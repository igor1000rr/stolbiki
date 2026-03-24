import { useI18n } from '../engine/i18n'
import { useRef, useEffect, useState } from 'react'
import Icon from './Icon'

// Scroll-triggered animation hook
function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

// Animated counter
function Counter({ end, suffix = '', duration = 1200 }) {
  const [val, setVal] = useState(0)
  const [ref, visible] = useReveal()
  useEffect(() => {
    if (!visible) return
    const num = parseInt(String(end).replace(/\D/g, ''))
    if (!num) { setVal(end); return }
    const start = Date.now()
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(num * ease))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible])
  return <span ref={ref}>{typeof end === 'string' && end.includes('K') ? `${val}K+` : val}{suffix}</span>
}

export default function Landing({ onPlay, onTutorial, publicStats }) {
  const { lang } = useI18n()
  const en = lang === 'en'

  // Per-section reveal refs
  const [heroRef, heroVis] = useReveal(0.1)
  const [numRef, numVis] = useReveal()
  const [stepRef, stepVis] = useReveal()
  const [featRef, featVis] = useReveal(0.1)
  const [audRef, audVis] = useReveal()
  const [faqRef, faqVis] = useReveal()

  return (
    <div className="landing">

      {/* ═══ HERO — animated bars grow in ═══ */}
      <section className={`l-hero ${heroVis ? 'in' : ''}`} ref={heroRef}>
        <div className="l-hero-glow" />
        <div className="l-hero-visual">
          {[7, 11, 9, 11, 6, 8, 10, 11, 5, 7].map((h, i) => (
            <div key={i} className="l-bar" style={{
              '--h': `${h * 8}%`, '--delay': `${i * 0.06}s`,
              background: i === 0 ? 'var(--gold)' : i % 3 === 0 ? 'var(--p2)' : 'var(--p1)',
              opacity: h === 11 ? 0.9 : 0.25 + (h / 11) * 0.45,
            }} />
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
          <button className="btn primary l-btn-lg l-btn-glow" onClick={onPlay}>
            <Icon name="play" size={18} color="#fff" />{en ? 'Play free' : 'Играть'}
          </button>
          <button className="btn l-btn-lg" onClick={onTutorial}>
            <Icon name="rules" size={16} />{en ? 'Learn in 2 min' : 'Обучение за 2 мин'}
          </button>
        </div>
      </section>

      {/* ═══ NUMBERS — count-up animation ═══ */}
      <section className={`l-numbers ${numVis ? 'in' : ''}`} ref={numRef}>
        <div className="l-num"><span className="l-num-val"><Counter end="239" suffix="K+" /></span><span className="l-num-label">{en ? 'games analyzed' : 'партий'}</span></div>
        <div className="l-num-sep" />
        <div className="l-num"><span className="l-num-val"><Counter end="97" suffix="%" /></span><span className="l-num-label">{en ? 'AI win rate' : 'винрейт AI'}</span></div>
        <div className="l-num-sep" />
        <div className="l-num"><span className="l-num-val">52:48</span><span className="l-num-label">{en ? 'balance' : 'баланс'}</span></div>
      </section>

      {/* ═══ STEPS — staggered reveal with animated line ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'Learn in 3 steps' : 'Научитесь за 3 шага'}</h2>
        <div className={`l-steps ${stepVis ? 'in' : ''}`} ref={stepRef}>
          <div className="l-steps-line" />
          {[
            { n: '01', t: en ? 'Place' : 'Ставьте', d: en ? 'Up to 3 chips on max 2 stands per turn. First move is always 1 chip.' : 'До 3 фишек на 2 стойки за ход. Первый ход — 1 фишка.' },
            { n: '02', t: en ? 'Transfer' : 'Переносите', d: en ? 'Move your top chip group to another stand. The key tactical move that decides games.' : 'Переместите верхнюю группу фишек. Ключевой тактический приём, решающий партии.' },
            { n: '03', t: en ? 'Close' : 'Закрывайте', d: en ? 'At 11 chips a stand closes. Top color = owner. First to close 6 of 10 wins!' : 'При 11 фишках стойка закрывается. Цвет сверху = владелец. Закройте 6 из 10!' },
          ].map((s, i) => (
            <div key={i} className="l-step" style={{ '--i': i }}>
              <div className="l-step-n">{s.n}</div>
              <div className="l-step-body">
                <div className="l-step-t">{s.t}</div>
                <div className="l-step-d">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES — editorial showcase, NO grid cards ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'What\'s inside' : 'Что внутри'}</h2>

        <div className={`l-showcase ${featVis ? 'in' : ''}`} ref={featRef}>
          {/* AI — full-width hero banner */}
          <div className="l-ai-banner">
            <div className="l-ai-glow" />
            <div className="l-ai-top">
              <Icon name="ai" size={24} color="#4a9eff" />
              <h3>{en ? 'AlphaZero AI' : 'AI на базе AlphaZero'}</h3>
            </div>
            <p className="l-ai-desc">{en
              ? 'Neural network trained via GPU self-play. Three difficulty levels from casual to grandmaster. The AI learns from every game it plays against itself.'
              : 'Нейросеть обучена через self-play на GPU. Три уровня сложности. AI учится на каждой партии с самим собой.'}</p>
            <div className="l-ai-metrics">
              {[
                { v: '1146', l: en ? 'iterations' : 'итераций' },
                { v: '0.098', l: 'loss' },
                { v: '97%', l: en ? 'win rate' : 'винрейт' },
                { v: '3', l: en ? 'levels' : 'уровня' },
              ].map((m, i) => (
                <div key={i} className="l-ai-metric">
                  <span className="l-ai-mv">{m.v}</span>
                  <span className="l-ai-ml">{m.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Online + Puzzles — split by vertical divider */}
          <div className="l-split">
            <div className="l-split-item">
              <div className="l-split-bar" style={{ background: '#3dd68c' }} />
              <div>
                <div className="l-split-head"><Icon name="online" size={18} color="#3dd68c" /><h4>{en ? 'Online multiplayer' : 'Онлайн мультиплеер'}</h4></div>
                <p>{en ? 'Send a link to a friend — start playing in seconds. No signup. Best-of-3 and best-of-5 series.' : 'Ссылка другу — играйте через секунды. Без регистрации. Серии 3/5.'}</p>
              </div>
            </div>
            <div className="l-split-line" />
            <div className="l-split-item">
              <div className="l-split-bar" style={{ background: '#ffc145' }} />
              <div>
                <div className="l-split-head"><Icon name="puzzle" size={18} color="#ffc145" /><h4>{en ? 'Daily puzzles' : 'Головоломки'}</h4></div>
                <p>{en ? 'New challenge every day. Harder one weekly. Bank of 50 with leaderboards.' : 'Новая задача каждый день. Сложная — каждую неделю. 50 штук с лидербордами.'}</p>
              </div>
            </div>
          </div>

          {/* Three extras — plain text rows */}
          <div className="l-extras">
            {[
              { icon: 'trainer', c: '#9b59b6', t: en ? 'Trainer' : 'Тренер', d: en ? 'AI evaluates every move. Position strength bar in real-time.' : 'AI оценивает каждый ход. Шкала силы позиции.' },
              { icon: 'chart', c: '#f06040', t: en ? 'Opening book' : 'Книга дебютов', d: en ? 'Heatmaps, strategies, analytics from 239K games.' : 'Тепловые карты, стратегии из 239K партий.' },
              { icon: 'theme', c: '#00bcd4', t: en ? '4 themes + PWA' : '4 темы + PWA', d: en ? 'Dark, neon, wood, light. Works offline. Home screen.' : 'Тёмная, неон, дерево, светлая. Оффлайн.' },
            ].map((f, i) => (
              <div key={i} className="l-extra" style={{ '--i': i }}>
                <div className="l-extra-dot" style={{ background: f.c, boxShadow: f.c + '40 0 0 6px' }} />
                <Icon name={f.icon} size={16} color={f.c} />
                <strong>{f.t}</strong>
                <span className="l-extra-sep" />
                <span>{f.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AUDIENCE — side by side with animation ═══ */}
      <section className="l-section">
        <div className={`l-audience ${audVis ? 'in' : ''}`} ref={audRef}>
          <div className="l-audience-text">
            <h2>{en ? 'For everyone' : 'Для всех'}</h2>
            <p>{en
              ? 'Simple rules make it accessible for families. Deep strategy keeps experts coming back. Works anywhere — desktop, mobile, or printed at the table.'
              : 'Простые правила — для семей. Глубокая стратегия — для экспертов. Работает везде — компьютер, телефон или распечатка на столе.'}</p>
            <button className="btn primary" onClick={onPlay} style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="play" size={16} color="#fff" />{en ? 'Try now' : 'Попробовать'}
            </button>
          </div>
          <div className="l-audience-cards">
            {[
              { c: '#ffc145', t: en ? 'Families' : 'Семьи', d: en ? 'Ages 8+. Perfect for game nights.' : 'Возраст 8+. Идеально для вечеров.' },
              { c: '#3dd68c', t: en ? 'Board gamers' : 'Настольщики', d: en ? 'Original mechanics. Balance 52:48.' : 'Оригинальная механика. Баланс 52:48.' },
              { c: '#4a9eff', t: en ? 'Online players' : 'Онлайн-игроки', d: en ? 'Play via link or train with AI.' : 'Играйте по ссылке или с AI.' },
            ].map((a, i) => (
              <div key={i} className="l-aud-card" style={{ '--i': i, '--c': a.c }}>
                <div className="l-aud-marker" style={{ background: `linear-gradient(135deg, ${a.c}, ${a.c}80)` }} />
                <div className="l-aud-body">
                  <strong>{a.t}</strong>
                  <span>{a.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRINT & PLAY ═══ */}
      <section className="l-section">
        <a href="/print-and-play.pdf" target="_blank" className="l-print">
          <div className="l-print-icon"><Icon name="download" size={24} color="var(--accent)" /></div>
          <div className="l-print-body">
            <strong>Print & Play</strong>
            <span>{en ? '3-page PDF: board, 110 chips, full rules' : 'PDF на 3 страницы: поле, 110 фишек, правила'}</span>
          </div>
          <div className="l-print-arrow"><Icon name="arrow" size={20} color="var(--ink3)" /></div>
        </a>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'FAQ' : 'Частые вопросы'}</h2>
        <div className={`l-faq ${faqVis ? 'in' : ''}`} ref={faqRef}>
          {[
            [en ? 'How long is a game?' : 'Сколько длится партия?', en ? '5–15 minutes depending on skill level.' : '5–15 минут в зависимости от уровня.'],
            [en ? 'What is the golden stand?' : 'Зачем золотая стойка?', en ? 'Breaks 5:5 ties. Its owner wins.' : 'Решает при счёте 5:5. Владелец побеждает.'],
            [en ? 'Works on mobile?' : 'Работает на телефоне?', en ? 'Yes. PWA — add to home screen, play offline.' : 'Да. PWA — добавьте на экран, играйте оффлайн.'],
            [en ? 'How does Swap work?' : 'Что такое Swap?', en ? 'After P1\'s first move, P2 can take their position.' : 'После первого хода П1, П2 может забрать его позицию.'],
            [en ? 'Is it balanced?' : 'Игра сбалансирована?', en ? '52:48 first-move advantage. Confirmed on 239K games.' : '52:48 в пользу первого хода. Проверено на 239K партиях.'],
            [en ? 'Is it free?' : 'Это бесплатно?', en ? 'Completely free. No ads. Open source.' : 'Полностью бесплатно. Без рекламы. Open source.'],
          ].map(([q, a], i) => (
            <div key={i} className="l-faq-item" style={{ '--i': i }}>
              <div className="l-faq-q">{q}</div>
              <div className="l-faq-a">{a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="l-cta">
        <div className="l-cta-glow" />
        <h2>{en ? 'Ready to play?' : 'Готовы играть?'}</h2>
        <p>{en ? 'Open beta — new features ship every week. Follow the blog.' : 'Открытая бета — новые фичи каждую неделю. Следите в блоге.'}</p>
        <button className="btn primary l-btn-lg l-btn-glow" onClick={onPlay}>
          <Icon name="play" size={18} color="#fff" />{en ? 'Start playing' : 'Начать играть'}
        </button>
      </section>
    </div>
  )
}
