import { useI18n } from '../engine/i18n'
import { useContent } from '../engine/content'
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
  const { c } = useContent(lang)

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
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo-full.webp" alt="Snatch Highrise" style={{ width: 'min(280px, 70vw)', height: 'auto' }} />
        </div>
        <h1 className="l-hero-title">
          {c('site.tagline', en ? 'Strategy board game powered by AI' : 'Стратегическая настолка с AI')}
        </h1>
        <p className="l-hero-sub">
          {en
            ? '10 stands. 11 chips each. Infinite depth. Play against a neural network trained on 239K games, challenge friends, or print and play at the table.'
            : '10 стоек. 11 фишек на каждой. Бесконечная глубина. Играйте против нейросети, обученной на 239K партиях, соревнуйтесь с друзьями или распечатайте и играйте за столом.'}
        </p>
        <div className="l-hero-meta">
          <span className="beta-badge">beta</span>
          {c('site.beta_text', en ? 'Open beta — active development' : 'Открытая бета — активная разработка')}
        </div>
        <div className="l-hero-btns">
          <button className="btn primary l-btn-lg l-btn-glow" onClick={onPlay}>
            <Icon name="play" size={18} color="#fff" />{c('landing.play_btn', en ? 'Play free' : 'Играть')}
          </button>
          <button className="btn l-btn-lg" onClick={onTutorial}>
            <Icon name="rules" size={16} />{c('landing.learn_btn', en ? 'Learn in 2 min' : 'Обучение за 2 мин')}
          </button>
        </div>
      </section>

      {/* ═══ NUMBERS — count-up animation ═══ */}
      <section className={`l-numbers ${numVis ? 'in' : ''}`} ref={numRef}>
        <div className="l-num"><span className="l-num-val"><Counter end="239" suffix="K+" /></span><span className="l-num-label">{c('landing.stat_games', en ? 'games analyzed' : 'партий')}</span></div>
        <div className="l-num-sep" />
        <div className="l-num"><span className="l-num-val"><Counter end="97" suffix="%" /></span><span className="l-num-label">{c('landing.stat_winrate', en ? 'AI win rate' : 'винрейт AI')}</span></div>
        <div className="l-num-sep" />
        <div className="l-num"><span className="l-num-val">50:50</span><span className="l-num-label">{c('landing.stat_balance', en ? 'balance' : 'баланс')}</span></div>
      </section>

      {/* ═══ STEPS — staggered reveal with animated line ═══ */}
      <section className="l-section">
        <h2 className="l-title">{c('landing.steps_title', en ? 'Learn in 3 steps' : 'Научитесь за 3 шага')}</h2>
        <div className={`l-steps ${stepVis ? 'in' : ''}`} ref={stepRef}>
          <div className="l-steps-line" />
          {[
            { n: '01', t: c('landing.step1_title', en ? 'Place' : 'Ставьте'), d: c('landing.step1_desc', en ? 'Up to 3 chips on max 2 stands per turn. First move is always 1 chip.' : 'До 3 фишек на 2 стойки за ход. Первый ход — 1 фишка.') },
            { n: '02', t: c('landing.step2_title', en ? 'Transfer' : 'Переносите'), d: c('landing.step2_desc', en ? 'Move your top chip group to another stand. The key tactical move that decides games.' : 'Переместите верхнюю группу фишек. Ключевой тактический приём, решающий партии.') },
            { n: '03', t: c('landing.step3_title', en ? 'Close' : 'Закрывайте'), d: c('landing.step3_desc', en ? 'At 11 chips a stand closes. Top color = owner. First to close 6 of 10 wins!' : 'При 11 фишках стойка закрывается. Цвет сверху = владелец. Закройте 6 из 10!') },
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
        <h2 className="l-title">{c('landing.features_title', en ? "What's inside" : 'Что внутри')}</h2>

        <div className={`l-showcase ${featVis ? 'in' : ''}`} ref={featRef}>
          {/* AI — full-width hero banner */}
          <div className="l-ai-banner">
            <div className="l-ai-glow" />
            <div className="l-ai-top">
              <Icon name="ai" size={24} color="#4a9eff" />
              <h3>{c('landing.ai_title', en ? 'AlphaZero AI' : 'AI на базе AlphaZero')}</h3>
            </div>
            <p className="l-ai-desc">{en
              ? 'Neural network trained via GPU self-play. Three difficulty levels from casual to grandmaster. The AI learns from every game it plays against itself.'
              : 'Нейросеть обучена через self-play на GPU. Три уровня сложности. AI учится на каждой партии с самим собой.'}</p>
            <div className="l-ai-metrics">
              {[
                { v: '1243', l: en ? 'iterations' : 'итераций' },
                { v: '0.169', l: 'loss' },
                { v: '98%', l: en ? 'win rate' : 'винрейт' },
                { v: '4', l: en ? 'levels' : 'уровня' },
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
              <div className="l-split-bar" style={{ background: 'var(--green)' }} />
              <div>
                <div className="l-split-head"><Icon name="online" size={18} color="#3dd68c" /><h4>{c('landing.online_title', en ? 'Online multiplayer' : 'Онлайн мультиплеер')}</h4></div>
                <p>{c('landing.online_desc', en ? 'Send a link to a friend — start playing in seconds. No signup. Best-of-3 and best-of-5 series.' : 'Ссылка другу — играйте через секунды. Без регистрации. Серии 3/5.')}</p>
              </div>
            </div>
            <div className="l-split-line" />
            <div className="l-split-item">
              <div className="l-split-bar" style={{ background: 'var(--gold)' }} />
              <div>
                <div className="l-split-head"><Icon name="puzzle" size={18} color="#ffc145" /><h4>{c('landing.puzzles_title', en ? 'Daily puzzles' : 'Головоломки')}</h4></div>
                <p>{c('landing.puzzles_desc', en ? 'New challenge every day. Harder one weekly. Bank of 50 with leaderboards.' : 'Новая задача каждый день. Сложная — каждую неделю. 50 штук с лидербордами.')}</p>
              </div>
            </div>
          </div>

          {/* Three extras — plain text rows */}
          <div className="l-extras">
            {[
              { icon: 'trainer', c: 'var(--green)', t: en ? 'AI Game Review' : 'AI Анализ', d: en ? 'Post-game analysis: every move rated excellent→blunder. Accuracy %.' : 'Анализ каждого хода: отличный → грубая ошибка. Accuracy %.' },
              { icon: 'chart', c: 'var(--accent)', t: en ? 'Puzzle Rush' : 'Puzzle Rush', d: en ? '3 min, max puzzles. +10/-15 sec. Leaderboard.' : '3 мин тайм-аттак. +10/-15 сек. Рейтинг.' },
              { icon: 'theme', c: 'var(--gold)', t: en ? '11 themes + 17 skins' : '11 тем + 17 скинов', d: en ? 'Sakura, Neon, Retro, Arctic + Glass, Metal, Glow chips.' : 'Sakura, Neon, Retro, Arctic + Glass, Metal, Glow фишки.' },
              { icon: 'rules', c: 'var(--p1)', t: en ? '5 lessons' : '5 уроков', d: en ? 'Interactive board: basics → transfer → golden → closing → strategy.' : 'Интерактивная доска: основы → перенос → золотая → закрытие → стратегия.' },
              { icon: 'chart', c: 'var(--p2)', t: en ? 'Live Arena' : 'Турниры', d: en ? 'Swiss system, 4 rounds, auto-pairing. XP for top 3.' : 'Swiss system, 4 раунда, auto-pairing. XP для топ-3.' },
              { icon: 'online', c: 'var(--purple)', t: en ? 'XP & Streaks' : 'XP и Стрики', d: en ? 'Daily missions, login streaks, 33 achievements, level-up.' : 'Ежедневные миссии, стрики, 33 ачивки, уровни.' },
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

      {/* ═══ AUDIENCE — big vibrant blocks ═══ */}
      <section className="l-section">
        <div className={`l-who ${audVis ? 'in' : ''}`} ref={audRef}>
          {[
            { c: 'var(--gold)', bg: 'rgba(255,193,69,0.06)', border: 'rgba(255,193,69,0.15)',
              icon: 'star', num: '8+', t: en ? 'Families' : 'Семьи',
              d: en ? 'Simple rules, deep strategy. Perfect for game nights with kids.' : 'Простые правила, глубокая стратегия. Идеально для вечеров с детьми.' },
            { c: 'var(--green)', bg: 'rgba(61,214,140,0.06)', border: 'rgba(61,214,140,0.15)',
              icon: 'trophy', num: '50:50', t: en ? 'Board gamers' : 'Настольщики',
              d: en ? 'Original mechanics. Mathematically verified balance on 239K games.' : 'Оригинальная механика. Баланс математически проверен на 239K партиях.' },
            { c: 'var(--p1)', bg: 'rgba(74,158,255,0.06)', border: 'rgba(74,158,255,0.15)',
              icon: 'online', num: '0s', t: en ? 'Online players' : 'Онлайн',
              d: en ? 'No signup needed. Share a link and play instantly from any device.' : 'Без регистрации. Отправьте ссылку — играйте с любого устройства.' },
          ].map((a, i) => (
            <div key={i} className="l-who-block" style={{ '--i': i, background: a.bg, borderColor: a.border }}>
              <div className="l-who-num" style={{ color: a.c }}>{a.num}</div>
              <div className="l-who-content">
                <div className="l-who-head" style={{ color: a.c }}>
                  <Icon name={a.icon} size={16} color={a.c} />
                  <strong>{a.t}</strong>
                </div>
                <p>{a.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PRINT & PLAY — accent banner ═══ */}
      <section className="l-section">
        <a href="/print-and-play.pdf" target="_blank" className="l-print-banner">
          <div className="l-print-bg" />
          <div className="l-print-inner">
            <div className="l-print-left">
              <div className="l-print-icon-wrap">
                <Icon name="download" size={28} color="#fff" />
              </div>
            </div>
            <div className="l-print-text">
              <strong>Print & Play</strong>
              <span>{en
                ? 'Download a 3-page PDF with the game board, 110 chips to cut out, and full rules. Everything you need to play at the table.'
                : 'Скачайте PDF на 3 страницы: игровое поле, 110 фишек для вырезания и полные правила. Всё для игры за столом.'}</span>
            </div>
            <div className="l-print-cta">
              <span>{en ? 'Download' : 'Скачать'}</span>
              <Icon name="arrow" size={16} color="#fff" />
            </div>
          </div>
        </a>
      </section>

      {/* ═══ FAQ — numbered, with colors ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'Questions' : 'Вопросы'}</h2>
        <div className={`l-qa ${faqVis ? 'in' : ''}`} ref={faqRef}>
          {[
            [en ? 'How long is a game?' : 'Сколько длится партия?', en ? '5-15 minutes depending on skill. Blitz mode available.' : '5-15 минут. Есть блиц-режим.'],
            [en ? 'What is the golden stand?' : 'Зачем золотая стойка?', en ? 'Breaks 5:5 ties. Controlling it is key strategy.' : 'Решает при 5:5. Контроль — ключевая стратегия.'],
            [en ? 'Works on mobile?' : 'Работает на телефоне?', en ? 'Yes — PWA. Add to home screen, play offline.' : 'Да — PWA. Добавьте на экран, играйте оффлайн.'],
            [en ? 'How does Swap work?' : 'Что такое Swap?', en ? 'After P1 places first chip, P2 can steal their position.' : 'После первого хода П1, П2 может забрать позицию.'],
            [en ? 'Is it balanced?' : 'Это сбалансировано?', en ? '50:50 balance. Confirmed across 239K games.' : '50:50 баланс. Проверено на 239K партиях.'],
            [en ? 'Is it free?' : 'Бесплатно?', en ? 'Completely. No ads, no paywalls. Open source.' : 'Полностью. Без рекламы. Open source.'],
          ].map(([q, a], i) => (
            <div key={i} className="l-qa-row" style={{ '--i': i }}>
              <div className="l-qa-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="l-qa-body">
                <div className="l-qa-q">{q}</div>
                <div className="l-qa-a">{a}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ABOUT ═══ */}
      <section className="l-section" style={{ borderTop: '1px solid var(--surface2)', paddingTop: 48 }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="l-title">{c('landing.about_title', en ? 'About the project' : 'О проекте')}</h2>
          <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.75, marginBottom: 20 }}>
            {c('landing.about_text', en
              ? 'Snatch Highrise is an open-source research project exploring the intersection of board game design and AI. The neural network was trained from scratch using self-play (AlphaZero approach) across 239K+ games. The game is designed for balance: 50:50 between first and second player, verified by statistical analysis.'
              : 'Перехват высотки — open-source исследовательский проект на стыке дизайна настольных игр и AI. Нейросеть обучена с нуля через self-play (подход AlphaZero) на 239K+ партиях. Игра спроектирована для баланса: 50:50 между первым и вторым игроком, подтверждено статистическим анализом.')}
          </p>
        </div>
      </section>

      {/* ═══ CTA — gradient dramatic ═══ */}
      <section className="l-final">
        <div className="l-final-glow" />
        <h2>{en ? 'Ready to play?' : 'Готовы играть?'}</h2>
        <p>{en ? 'Open beta — we ship new features every week.' : 'Открытая бета — новые фичи каждую неделю.'}</p>
        <button className="btn primary l-btn-lg l-btn-glow" onClick={onPlay}>
          <Icon name="play" size={18} color="#fff" />{en ? 'Start now' : 'Начать'}
        </button>
      </section>
    </div>
  )
}
