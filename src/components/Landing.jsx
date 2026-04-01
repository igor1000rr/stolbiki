import { useI18n } from '../engine/i18n'
import { useContent } from '../engine/content'
import { useRef, useEffect, useState } from 'react'
import Icon from './Icon'
import Mascot from './Mascot'

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
  const [screensRef, screensVis] = useReveal()
  const [audRef, audVis] = useReveal()
  const [dlRef, dlVis] = useReveal()
  const [faqRef, faqVis] = useReveal()

  return (
    <div className="landing">

      {/* ═══ HERO ═══ */}
      <section className={`l-hero ${heroVis ? 'in' : ''}`} ref={heroRef}>
        <div className="l-hero-glow" />
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo-full.webp" alt="Snatch Highrise" style={{ width: 'min(280px, 70vw)', height: 'auto' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center', flex: '1 1 auto', maxWidth: 520 }}>
            <h1 className="l-hero-title">
              {c('site.tagline', en ? 'Strategy board game powered by AI' : 'Стратегическая настолка с AI')}
            </h1>
            <p className="l-hero-sub">
              {en
                ? '10 stands. 11 blocks each. Infinite depth. Play against a neural network trained on 239K games, challenge friends, or print and play at the table.'
                : '10 стоек. 11 блоков на каждой. Бесконечная глубина. Играйте против нейросети, обученной на 239K партиях, соревнуйтесь с друзьями или распечатайте и играйте за столом.'}
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
          </div>
          <Mascot pose="hero" size={160} large className="mascot-enter l-hero-mascot" />
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
            { n: '01', t: c('landing.step1_title', en ? 'Place' : 'Ставьте'), d: c('landing.step1_desc', en ? 'Up to 3 blocks on max 2 stands per turn. First move — 1 block.' : 'До 3 блоков на 2 стойки за ход. Первый ход — 1 блок.') },
            { n: '02', t: c('landing.step2_title', en ? 'Transfer' : 'Переносите'), d: c('landing.step2_desc', en ? 'Move the top group of blocks. The key tactical move that decides games.' : 'Переместите верхнюю группу блоков. Ключевой тактический приём, решающий партии.') },
            { n: '03', t: c('landing.step3_title', en ? 'Complete' : 'Закрывайте'), d: c('landing.step3_desc', en ? 'At 11 blocks the highrise is complete. Top color = owner. Complete 6 of 10!' : 'При 11 блоках высотка построена. Цвет сверху = владелец. Достройте 6 из 10!') },
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

      {/* ═══ FEATURES — bento grid ═══ */}
      <section className="l-section">
        <h2 className="l-title">{c('landing.features_title', en ? "What's inside" : 'Что внутри')}</h2>

        <div className={`l-bento ${featVis ? 'in' : ''}`} ref={featRef}>

          {/* AI — главная карточка */}
          <div className="l-bento-card l-bento-ai">
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 30%, rgba(74,158,255,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,158,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="ai" size={20} color="#4a9eff" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{en ? 'AlphaZero AI' : 'AI на базе AlphaZero'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{en ? 'GPU neural network' : 'Нейросеть на GPU'}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6, margin: '0 0 16px' }}>{en
                ? 'Trained via self-play on 239K games. Four difficulty levels from casual to grandmaster.'
                : 'Обучена на 239K партиях через self-play. Четыре уровня сложности от новичка до гроссмейстера.'}</p>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { v: '239K', l: en ? 'games' : 'партий' },
                  { v: '0.169', l: 'loss' },
                  { v: '98%', l: en ? 'win rate' : 'винрейт' },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#4a9eff', lineHeight: 1 }}>{m.v}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Online */}
          <div className="l-bento-card l-bento-online">
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(61,214,140,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(61,214,140,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon name="online" size={18} color="#3dd68c" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{en ? 'Online' : 'Онлайн'}</div>
              <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>{en ? 'Link to a friend — play in seconds. No signup needed.' : 'Ссылка другу — играйте через секунды. Без регистрации.'}</p>
            </div>
          </div>

          {/* Puzzles */}
          <div className="l-bento-card l-bento-puzzles">
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 80%, rgba(255,193,69,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,193,69,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon name="puzzle" size={18} color="#ffc145" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{en ? 'Puzzles' : 'Головоломки'}</div>
              <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>{en ? 'Daily + weekly challenges. 50 puzzles with leaderboards.' : 'Ежедневные + еженедельные задачи. 50 штук с лидербордами.'}</p>
            </div>
          </div>

          {/* Themes */}
          <div className="l-bento-card l-bento-themes">
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(155,89,182,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {['#4a9eff', '#ff00ff', '#ff69b4', '#00bcd4', '#ffc145'].map((c, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: 6, background: c, opacity: 0.7 }} />
                ))}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>11 {en ? 'themes' : 'тем'} + 17 {en ? 'skins' : 'скинов'}</div>
              <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>Sakura, Neon, Retro, Arctic + Glass, Metal, Glow</p>
            </div>
          </div>

          {/* Game Review */}
          <div className="l-bento-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(61,214,140,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trainer" size={14} color="#3dd68c" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>AI {en ? 'Review' : 'Анализ'}</div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>{en ? 'Every move rated. Accuracy %.' : 'Оценка каждого хода. Accuracy %.'}</p>
          </div>

          {/* Rush */}
          <div className="l-bento-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,96,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chart" size={14} color="#ff6066" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Puzzle Rush</div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>{en ? '3 min blitz. +10/−15 sec.' : '3 мин блиц. +10/−15 сек.'}</p>
          </div>

          {/* Lessons */}
          <div className="l-bento-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(74,158,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="rules" size={14} color="#4a9eff" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>5 {en ? 'lessons' : 'уроков'}</div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>{en ? 'Interactive board tutorials.' : 'Интерактивные уроки на доске.'}</p>
          </div>

          {/* Arena + XP */}
          <div className="l-bento-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(155,89,182,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chart" size={14} color="#9b59b6" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{en ? 'Arena & XP' : 'Арена и XP'}</div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5, margin: 0 }}>{en ? 'Tournaments, missions, 33 achievements.' : 'Турниры, миссии, 33 ачивки.'}</p>
          </div>
        </div>
      </section>

      {/* ═══ SCREENSHOTS — animated theme previews ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'The game in action' : 'Игра в действии'}</h2>
        <div className={`l-screens ${screensVis ? 'in' : ''}`} ref={screensRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { theme: 'Dark', gradient: 'linear-gradient(160deg, #12121e 0%, #1a1a30 100%)', accent: '#4a9eff', accent2: '#ff6066', glow: '#4a9eff30', desc: en ? 'Classic dark theme' : 'Классическая тёмная' },
            { theme: 'Neon', gradient: 'linear-gradient(160deg, #08081a 0%, #18003a 100%)', accent: '#ff00ff', accent2: '#00ffaa', glow: '#ff00ff30', desc: en ? 'Cyberpunk neon' : 'Киберпанк неон' },
            { theme: 'Sakura', gradient: 'linear-gradient(160deg, #1e0e18 0%, #2a1028 100%)', accent: '#ff69b4', accent2: '#ffb7d5', glow: '#ff69b430', desc: en ? 'Cherry blossom' : 'Сакура' },
            { theme: 'Arctic', gradient: 'linear-gradient(160deg, #0a1620 0%, #0c2030 100%)', accent: '#00bcd4', accent2: '#80deea', glow: '#00bcd430', desc: en ? 'Frozen depths' : 'Ледяная' },
          ].map((s, i) => (
            <div key={i} className="l-theme-card" style={{ '--accent': s.accent, '--accent2': s.accent2, '--glow': s.glow, '--i': i, background: s.gradient, borderRadius: 16, padding: '20px 16px 16px', border: `1px solid ${s.accent}18`, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
              onClick={onPlay}>
              {/* Фоновое свечение */}
              <div style={{ position: 'absolute', top: '30%', left: '50%', width: 200, height: 200, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${s.glow}, transparent 70%)`, pointerEvents: 'none' }} />
              {/* Анимированная доска */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: 4, height: 120, alignItems: 'flex-end', marginBottom: 14 }}>
                {Array.from({ length: 10 }, (_, j) => {
                  const blocks = [5,3,7,2,8,4,6,1,5,3][j]
                  const isGolden = j === 0
                  return (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 2, width: 20 }}>
                      {/* Основание стойки */}
                      <div style={{ width: 20, height: 3, borderRadius: 1, background: `${s.accent}30` }} />
                      {/* Блоки с анимацией появления */}
                      {Array.from({ length: blocks }, (_, k) => {
                        const isP1 = (j + k) % 3 !== 0
                        return (
                          <div key={k} className="l-theme-block" style={{
                            width: 16, height: 8, borderRadius: 3,
                            background: isP1 ? s.accent : s.accent2,
                            opacity: 0.85,
                            boxShadow: `0 0 6px ${isP1 ? s.accent : s.accent2}40`,
                            animationDelay: `${0.3 + i * 0.15 + j * 0.04 + k * 0.03}s`,
                          }} />
                        )
                      })}
                      {/* Звезда для золотой */}
                      {isGolden && <div style={{ fontSize: 10, color: '#ffc145', lineHeight: 1, marginTop: 2, textShadow: '0 0 8px #ffc14580' }}>★</div>}
                    </div>
                  )
                })}
              </div>
              {/* Название темы */}
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: s.accent, letterSpacing: '-0.3px' }}>{s.theme}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--ink3)' }}>
          {en ? '+ 7 more themes and 17 skins in the Skin Shop' : '+ ещё 7 тем и 17 скинов в магазине'}
        </div>
      </section>

      {/* ═══ DOWNLOAD ═══ */}
      <section className="l-section">
        <div className={`l-download ${dlVis ? 'in' : ''}`} ref={dlRef} style={{ textAlign: 'center', padding: '40px 24px', background: 'radial-gradient(ellipse at center, rgba(74,158,255,0.06) 0%, transparent 70%)', borderRadius: 24, border: '1px solid rgba(74,158,255,0.08)' }}>
          <Mascot pose="wave" size={120} large className="mascot-enter" style={{ display: 'block', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            {en ? 'Play on your phone' : 'Играйте на телефоне'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 400 }}>
            {en ? 'Same account, same progress, offline AI mode' : 'Тот же аккаунт, тот же прогресс, офлайн-режим с AI'}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* App Store button */}
            <div style={{ width: 180, padding: '14px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #1a1a2e, #222240)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1, marginBottom: 2 }}>Download on the</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>App Store</div>
                </div>
              </div>
              <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(74,158,255,0.2)', color: 'var(--p1)', fontWeight: 600 }}>{en ? 'Soon' : 'Скоро'}</div>
            </div>
            {/* Google Play button */}
            <div style={{ width: 180, padding: '14px 20px', borderRadius: 14, background: 'linear-gradient(135deg, #1a1a2e, #222240)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-1.12L20.16 12l-2.44-2L15.45 12.27l2.27 2.27v-.04zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1, marginBottom: 2 }}>GET IT ON</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>Google Play</div>
                </div>
              </div>
              <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(61,214,140,0.2)', color: 'var(--green)', fontWeight: 600 }}>{en ? 'Soon' : 'Скоро'}</div>
            </div>
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
                ? 'Download a 3-page PDF with the game board, 110 blocks to cut out, and full rules. Everything you need to play at the table.'
                : 'Скачайте PDF на 3 страницы: игровое поле, 110 блоков для вырезания и полные правила. Всё для игры за столом.'}</span>
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
            [en ? 'How does Swap work?' : 'Что такое Swap?', en ? 'After P1 places first block, P2 can steal their position.' : 'После первого хода П1, П2 может забрать позицию.'],
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
        <Mascot pose="celebrate" size={100} large className="mascot-bounce" style={{ marginBottom: 12 }} />
        <h2>{en ? 'Ready to play?' : 'Готовы играть?'}</h2>
        <p>{en ? 'Open beta — we ship new features every week.' : 'Открытая бета — новые фичи каждую неделю.'}</p>
        <button className="btn primary l-btn-lg l-btn-glow" onClick={onPlay}>
          <Icon name="play" size={18} color="#fff" />{en ? 'Start now' : 'Начать'}
        </button>
      </section>
    </div>
  )
}
