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

      {/* ═══ FEATURES — symmetric 3×2 grid with animated diagrams ═══ */}
      <section className="l-section">
        <h2 className="l-title">{c('landing.features_title', en ? "What's inside" : 'Что внутри')}</h2>
        <div className={`l-feat-grid ${featVis ? 'in' : ''}`} ref={featRef}>
          {[
            { color: '#4a9eff', title: en ? 'AlphaZero AI' : 'AI нейросеть', desc: en ? 'Trained on 239K games via self-play. 4 difficulty levels.' : 'Обучена на 239K партиях. 4 уровня сложности.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g className="l-feat-bars">{[18,32,24,40,28,36,20,44,30,22].map((h,i)=><rect key={i} x={4+i*12} y={48-h} width={8} height={h} rx={2} fill={i%2===0?'#4a9eff':'#ff6066'} opacity={0.7} style={{animationDelay:`${i*0.08}s`}}/>)}</g><text x="60" y="12" textAnchor="middle" fill="#ffc145" fontSize="6">★ 98% win rate</text></svg> },
            { color: '#3dd68c', title: en ? 'Online multiplayer' : 'Онлайн', desc: en ? 'Send a link — play in seconds. No signup. Best-of-3/5.' : 'Ссылка другу — игра через секунды. Без регистрации.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><circle cx="30" cy="24" r="10" fill="none" stroke="#3dd68c" strokeWidth="1.5" opacity="0.5"/><circle cx="90" cy="24" r="10" fill="none" stroke="#4a9eff" strokeWidth="1.5" opacity="0.5"/><line x1="40" y1="24" x2="80" y2="24" stroke="#3dd68c50" strokeWidth="1" strokeDasharray="4 3" className="l-feat-dash"/><circle cx="30" cy="24" r="3" fill="#3dd68c" className="l-feat-pulse"/><circle cx="90" cy="24" r="3" fill="#4a9eff" className="l-feat-pulse" style={{animationDelay:'0.5s'}}/><text x="60" y="44" textAnchor="middle" fill="#3dd68c60" fontSize="7">WebSocket</text></svg> },
            { color: '#ffc145', title: en ? 'Daily puzzles' : 'Головоломки', desc: en ? 'Daily + weekly challenges. 50 puzzles. Leaderboards.' : 'Ежедневные + еженедельные. 50 штук. Лидерборды.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g>{[[20,8,28,20],[40,14,28,20],[60,8,28,20],[80,14,28,20]].map(([x,y,w,h],i)=><rect key={i} x={x} y={y} width={w} height={h} rx={4} fill="none" stroke="#ffc14550" strokeWidth="1" className="l-feat-pop" style={{animationDelay:`${i*0.15}s`}}/>)}<text x="34" y="22" fill="#ffc145" fontSize="14" fontWeight="800" className="l-feat-pop" style={{animationDelay:'0.1s'}}>?</text><text x="74" y="22" fill="#3dd68c" fontSize="14" fontWeight="800" className="l-feat-pop" style={{animationDelay:'0.3s'}}>✓</text></g></svg> },
            { color: '#9b59b6', title: en ? '11 themes + 17 skins' : '11 тем + 17 скинов', desc: en ? 'Sakura, Neon, Retro, Arctic + Glass, Metal, Glow blocks.' : 'Sakura, Neon, Retro, Arctic + Glass, Metal, Glow блоки.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g>{['#4a9eff','#ff00ff','#ff69b4','#00bcd4','#ffc145','#3dd68c','#ff6066'].map((c,i)=><circle key={i} cx={18+i*14} cy={20} r={6} fill={c} opacity={0.7} className="l-feat-pop" style={{animationDelay:`${i*0.08}s`}}/>)}<g>{['Glass','Metal','Glow'].map((t,i)=><text key={i} x={20+i*36} y={40} fill="#ffffff40" fontSize="7" textAnchor="middle">{t}</text>)}</g></g></svg> },
            { color: '#3dd68c', title: 'AI ' + (en ? 'Review' : 'Анализ'), desc: en ? 'Every move rated: excellent → blunder. Accuracy %.' : 'Каждый ход: отличный → грубая ошибка. Accuracy %.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g>{[['✓',12,'#3dd68c'],['✓',30,'#3dd68c'],['○',48,'#ffc145'],['✕',66,'#ff6066'],['✓',84,'#3dd68c'],['✓',102,'#3dd68c']].map(([s,x,c],i)=><g key={i} className="l-feat-pop" style={{animationDelay:`${i*0.1}s`}}><text x={x} y={24} fill={c} fontSize="14" textAnchor="middle" fontWeight="700">{s}</text></g>)}</g><rect x="10" y="36" width="85" height="4" rx="2" fill="#1a1a2e"/><rect x="10" y="36" width="70" height="4" rx="2" fill="#3dd68c80" className="l-feat-grow"/><text x="100" y="40" fill="#3dd68c" fontSize="8" fontWeight="700">82%</text></svg> },
            { color: '#ff6066', title: en ? 'Arena & Progression' : 'Арена и прогресс', desc: en ? 'Tournaments, daily missions, 33 achievements, levels.' : 'Турниры, миссии, 33 ачивки, уровни.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g className="l-feat-bars">{[12,20,32,24,40,16,28,36].map((h,i)=><rect key={i} x={8+i*14} y={44-h} width={10} height={h} rx={2} fill={`hsl(${340+i*8},70%,60%)`} opacity={0.6} style={{animationDelay:`${i*0.06}s`}}/>)}</g><text x="60" y="8" textAnchor="middle" fill="#ffc14580" fontSize="9">🏆 XP ↑</text></svg> },
          ].map((f, i) => (
            <div key={i} className="l-feat-card" style={{ '--i': i, '--color': f.color }}>
              <div className="l-feat-visual">{f.visual}</div>
              <div className="l-feat-title" style={{ color: f.color }}>{f.title}</div>
              <div className="l-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SCREENSHOTS — animated theme previews ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'The game in action' : 'Игра в действии'}</h2>
        <div className={`l-screens ${screensVis ? 'in' : ''}`} ref={screensRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 600, margin: '0 auto' }}>
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
        <div className={`l-download ${dlVis ? 'in' : ''}`} ref={dlRef} className="l-dl-wrap">
          <div className="l-dl-inner">
            <Mascot pose="wave" size={140} large animate={false} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>
                {en ? 'Play on your phone' : 'Играйте на телефоне'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.6, margin: '0 0 20px' }}>
                {en ? 'Same account, same progress, offline AI mode' : 'Тот же аккаунт, тот же прогресс, офлайн-режим с AI'}
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div className="l-dl-btn">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <div><div className="l-dl-sub">Download on the</div><div className="l-dl-name">App Store</div></div>
                  <span className="l-dl-badge">{en ? 'Soon' : 'Скоро'}</span>
                </div>
                <div className="l-dl-btn">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-1.12L20.16 12l-2.44-2L15.45 12.27l2.27 2.27v-.04zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
                  <div><div className="l-dl-sub">GET IT ON</div><div className="l-dl-name">Google Play</div></div>
                  <span className="l-dl-badge">{en ? 'Soon' : 'Скоро'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MASCOT INTRO ═══ */}
      <section className="l-section" style={{ textAlign: 'center' }}>
        <div className={`l-who ${audVis ? 'in' : ''}`} ref={audRef} style={{ maxWidth: 560, margin: '0 auto' }}>
          <Mascot pose="point" size={120} large className="mascot-enter" style={{ display: 'block', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            {en ? 'Meet Snoopy!' : 'Это Снуппи!'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.7, margin: '0 0 20px' }}>
            {en
              ? 'Your building companion. He\'ll celebrate your victories, help you learn the rules, and cheer you on during tough moments. Simple rules, deep strategy — for families, board gamers, and online players alike.'
              : 'Ваш компаньон-строитель. Он празднует победы, помогает учить правила и поддерживает в трудные моменты. Простые правила, глубокая стратегия — для семей, настольщиков и онлайн-игроков.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            {[
              { v: '8+', l: en ? 'age' : 'возраст' },
              { v: '5-15', l: en ? 'min/game' : 'мин/партия' },
              { v: '2', l: en ? 'players' : 'игрока' },
              { v: '0₽', l: en ? 'forever' : 'навсегда' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
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

      {/* ═══ ABOUT + CTA — combined rich ending ═══ */}
      <section className="l-final">
        <div className="l-final-glow" />
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <Mascot pose="celebrate" size={110} large className="mascot-bounce" style={{ display: 'block', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 28, margin: '0 0 10px' }}>{en ? 'Ready to play?' : 'Готовы играть?'}</h2>
          <p style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.7, margin: '0 0 24px' }}>
            {en
              ? 'Open-source project at the intersection of board game design and AI. Neural network trained via self-play on 239K+ games. New features every week.'
              : 'Open-source проект на стыке дизайна настольных игр и AI. Нейросеть обучена через self-play на 239K+ партиях. Новые фичи каждую неделю.'}
          </p>

          <button className="btn primary l-btn-lg l-btn-glow" onClick={onPlay} style={{ marginBottom: 28, fontSize: 16, padding: '14px 40px' }}>
            <Icon name="play" size={18} color="#fff" />{en ? 'Start now' : 'Начать'}
          </button>

          {/* Tech badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {['React', 'Node.js', 'AlphaZero', 'WebSocket', 'SQLite', 'Capacitor'].map(t => (
              <span key={t} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--ink3)' }}>{t}</span>
            ))}
          </div>

          {/* Links row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, color: 'var(--ink3)' }}>
            <a href="https://github.com/igor1000rr/stolbiki" target="_blank" rel="noopener" style={{ color: 'var(--ink3)', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
              GitHub
            </a>
            <span style={{ opacity: 0.3 }}>·</span>
            <a href="https://t.me/igor1000rr" target="_blank" rel="noopener" style={{ color: 'var(--ink3)', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
              Telegram
            </a>
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ opacity: 0.5 }}>v4.2</span>
          </div>
        </div>
      </section>
    </div>
  )
}
