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

export default function Landing({ onPlay, onTutorial, publicStats, installPrompt }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const { c } = useContent(lang)

  // Per-section reveal refs
  const [heroRef, heroVis] = useReveal(0.1)
  const [numRef, numVis] = useReveal()
  const [stepRef, stepVis] = useReveal()
  const [featRef, featVis] = useReveal(0.1)
  const [screensRef, screensVis] = useReveal()
  
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
            ? '10 stands. 11 blocks each. Infinite depth. Play against a neural network trained on 10M games, challenge friends, or print and play at the table.'
            : '10 стоек. 11 блоков на каждой. Бесконечная глубина. Играйте против нейросети, обученной на 10M партиях, соревнуйтесь с друзьями или распечатайте и играйте за столом.'}
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
          {installPrompt && (
            <button className="btn l-btn-lg" onClick={() => { installPrompt.prompt(); installPrompt.userChoice.then(() => {}) }}
              style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
              <Icon name="download" size={16} />{en ? 'Install app' : 'Установить'}
            </button>
          )}
          {publicStats && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11, color: 'var(--ink3)' }}>
              {publicStats.onlinePlayers > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
                  {publicStats.onlinePlayers} {en ? 'online' : 'онлайн'}
                </span>
              )}
              {publicStats.todayGames > 0 && <span>{publicStats.todayGames} {en ? 'games today' : 'партий сегодня'}</span>}
              <span>{publicStats.totalUsers} {en ? 'players' : 'игроков'}</span>
            </div>
          )}
        </div>
      </section>

      {/* ═══ NUMBERS — count-up animation ═══ */}
      <section className={`l-numbers ${numVis ? 'in' : ''}`} ref={numRef}>
        <div className="l-num"><span className="l-num-val"><Counter end="10" suffix="M+" /></span><span className="l-num-label">{c('landing.stat_games', en ? 'games analyzed' : 'партий')}</span></div>
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
            { color: '#4a9eff', title: en ? 'AlphaZero AI' : 'AI нейросеть', desc: en ? 'Trained on 10M games. 4 difficulty levels.' : 'Обучена на 10M партиях. 4 уровня сложности.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{[18,32,24,40,28,36,20,44,30,22].map((h,i)=><rect key={i} className="l-bar-wave" x={4+i*12} y={48-h} width={8} height={h} rx={2} fill={i%2===0?'#4a9eff':'#ff6066'} style={{animationDelay:`${i*0.15}s`,transformOrigin:`${4+i*12+4}px 48px`}}/>)}</svg> },
            { color: '#3dd68c', title: en ? 'Online' : 'Онлайн', desc: en ? 'Link to a friend — play in seconds. No signup.' : 'Ссылка другу — игра через секунды. Без регистрации.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><circle cx="30" cy="24" r="10" fill="none" stroke="#3dd68c" strokeWidth="1.5" opacity="0.5"/><circle cx="90" cy="24" r="10" fill="none" stroke="#4a9eff" strokeWidth="1.5" opacity="0.5"/><line x1="40" y1="24" x2="80" y2="24" stroke="#3dd68c50" strokeWidth="1" strokeDasharray="4 3" className="l-feat-dash"/><circle cx="30" cy="24" r="3" fill="#3dd68c" className="l-feat-pulse"/><circle cx="90" cy="24" r="3" fill="#4a9eff" className="l-feat-pulse" style={{animationDelay:'0.5s'}}/><circle className="l-packet" cx="30" cy="24" r="2" fill="#ffc145"/></svg> },
            { color: '#ffc145', title: en ? 'Puzzles' : 'Головоломки', desc: en ? 'Daily + weekly. 50 puzzles. Leaderboards.' : 'Ежедневные + еженедельные. 50 штук. Лидерборды.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g>{[[25,6,28,22],[50,6,28,22],[75,6,28,22]].map(([x,y,w,h],i)=><rect key={i} x={x} y={y} width={w} height={h} rx={4} fill="none" stroke="#ffc14540" strokeWidth="1"/>)}<text className="l-puzzle-q" x="39" y="22" fill="#ffc145" fontSize="16" fontWeight="800" textAnchor="middle">?</text><text className="l-puzzle-a" x="64" y="22" fill="#3dd68c" fontSize="16" fontWeight="800" textAnchor="middle">✓</text><text className="l-puzzle-q" x="89" y="22" fill="#ffc145" fontSize="16" fontWeight="800" textAnchor="middle" style={{animationDelay:'1.5s'}}>?</text></g><rect x="25" y="36" width="70" height="3" rx="1.5" fill="#1a1a2e"/><rect className="l-puzzle-bar" x="25" y="36" width="0" height="3" rx="1.5" fill="#ffc14580"/></svg> },
            { color: '#9b59b6', title: en ? '11 themes + 17 skins' : '11 тем + 17 скинов', desc: en ? 'Sakura, Neon, Retro, Arctic + Glass, Metal, Glow.' : 'Sakura, Neon, Retro, Arctic + Glass, Metal, Glow.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{['#4a9eff','#ff00ff','#ff69b4','#00bcd4','#ffc145','#3dd68c','#ff6066'].map((c,i)=><circle key={i} className="l-skin-dot" cx={18+i*14} cy={20} r={6} fill={c} style={{animationDelay:`${i*0.2}s`}}/>)}</svg> },
            { color: '#3dd68c', title: 'AI ' + (en ? 'Review' : 'Анализ'), desc: en ? 'Every move: excellent → blunder. Accuracy %.' : 'Каждый ход: отличный → грубая ошибка. Accuracy %.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{[['✓','#3dd68c'],['✓','#3dd68c'],['○','#ffc145'],['✕','#ff6066'],['✓','#3dd68c'],['✓','#3dd68c']].map(([s,c],i)=><text key={i} className="l-review-mark" x={12+i*20} y={22} fill={c} fontSize="14" textAnchor="middle" fontWeight="700" style={{animationDelay:`${i*0.3}s`}}>{s}</text>)}<rect x="10" y="34" width="100" height="4" rx="2" fill="#1a1a2e"/><rect className="l-review-bar" x="10" y="34" width="0" height="4" rx="2" fill="#3dd68c80"/></svg> },
            { color: '#ff6066', title: en ? 'Arena & XP' : 'Арена и прогресс', desc: en ? 'Tournaments, missions, 33 achievements, levels.' : 'Турниры, миссии, 33 ачивки, уровни.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{[12,20,32,24,40,16,28,36].map((h,i)=><rect key={i} className="l-bar-wave" x={8+i*14} y={48-h} width={10} height={h} rx={2} fill={`hsl(${340+i*8},70%,60%)`} style={{animationDelay:`${i*0.12}s`,transformOrigin:`${8+i*14+5}px 48px`}}/>)}</svg> },
            { color: '#ff9800', title: en ? 'Challenge friends' : 'Вызов друзьям', desc: en ? 'Challenge a friend directly. Room created instantly.' : 'Вызовите друга на дуэль. Комната создаётся мгновенно.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><text x="35" y="30" fontSize="24" className="l-feat-pulse">⚔️</text><circle cx="20" cy="24" r="8" fill="none" stroke="#ff980060" strokeWidth="1.5"/><circle cx="100" cy="24" r="8" fill="none" stroke="#ff980060" strokeWidth="1.5"/><line x1="28" y1="24" x2="92" y2="24" stroke="#ff980030" strokeWidth="1" strokeDasharray="4 3" className="l-feat-dash"/></svg> },
            { color: '#e040fb', title: en ? 'Share & Invite' : 'Делись и приглашай', desc: en ? 'Share result cards. Invite friends — earn XP.' : 'Карточки результатов. Пригласи друзей — получи XP.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><rect x="30" y="8" width="60" height="32" rx="6" fill="none" stroke="#e040fb40" strokeWidth="1.5"/><text x="60" y="22" fontSize="10" fill="#e040fb" textAnchor="middle" fontWeight="700">6 : 4</text><text x="60" y="34" fontSize="7" fill="#e040fb80" textAnchor="middle">+25 ELO</text><circle className="l-feat-pulse" cx="105" cy="14" r="4" fill="#3dd68c" style={{animationDelay:'0.3s'}}/><text x="105" y="32" fontSize="8" fill="#3dd68c80" textAnchor="middle">+XP</text></svg> },
          ].map((f, i) => (
            <div key={i} className="l-feat-card" style={{ '--i': i, '--color': f.color }}>
              <div className="l-feat-visual">{f.visual}</div>
              <div className="l-feat-title" style={{ color: f.color }}>{f.title}</div>
              <div className="l-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SCREENSHOTS — 6 тем, блоки ставятся по одному ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'The game in action' : 'Игра в действии'}</h2>
        <div className={`l-screens ${screensVis ? 'in' : ''}`} ref={screensRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {[
            { theme: 'Dark', bg: '#0c0c12', surface: '#1a1a2a', p1: '#4a9eff', p2: '#ff6066' },
            { theme: 'Neon', bg: '#05050a', surface: '#0f0f22', p1: '#00e5ff', p2: '#ff3090' },
            { theme: 'Sakura', bg: '#1a0e14', surface: '#2e1824', p1: '#f48fb1', p2: '#4fc3f7' },
            { theme: 'Retro', bg: '#0a0a00', surface: '#1a1a06', p1: '#76ff03', p2: '#ff6e40' },
            { theme: 'Arctic', bg: '#0a1520', surface: '#122436', p1: '#80d8ff', p2: '#ff8a80' },
            { theme: 'Sunset', bg: '#1a0e1e', surface: '#2e1a32', p1: '#ffa726', p2: '#ab47bc' },
          ].map((s, i) => {
            // Генерируем "партию" — фиксированные высоты стоек для каждой темы
            const heights = [[3,5,2,7,4,6,1,5,3,4],[4,2,6,3,7,5,2,4,6,3],[5,3,4,6,2,7,4,3,5,2],[2,6,3,5,7,4,6,2,3,5],[6,4,5,2,3,7,5,4,2,6],[3,7,4,5,2,6,3,5,4,7]][i]
            return (
              <div key={i} className="l-theme-card" style={{ '--i': i, background: s.bg, borderRadius: 14, padding: '16px 12px 12px', border: `1px solid ${s.p1}15`, cursor: 'pointer', overflow: 'hidden' }}
                onClick={onPlay}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 3, height: 90, alignItems: 'flex-end', marginBottom: 10 }}>
                  {heights.map((blocks, j) => (
                    <div key={j} style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1.5, width: 16 }}>
                      <div style={{ width: 16, height: 2, borderRadius: 1, background: s.surface }} />
                      {Array.from({ length: blocks }, (_, k) => (
                        <div key={k} className="l-block-place" style={{
                          width: 13, height: 7, borderRadius: 2, margin: '0 auto',
                          background: (j + k) % 3 !== 0 ? s.p1 : s.p2,
                          animationDelay: `${0.3 + i * 0.3 + j * 0.12 + k * 0.08}s`,
                        }} />
                      ))}
                      {j === 0 && <div style={{ fontSize: 7, color: '#ffc145', textAlign: 'center', lineHeight: 1 }}>★</div>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.p1 }}>{s.theme}</div>
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--ink3)' }}>
          {en ? '+ 5 more themes, 8 block skins, 9 stand skins' : '+ ещё 5 тем, 8 скинов блоков, 9 скинов стоек'}
        </div>
      </section>

      {/* ═══ DOWNLOAD + FEATURES ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'Get the game' : 'Получить игру'}</h2>
        <div className={`l-feat-grid ${dlVis ? 'in' : ''}`} ref={dlRef} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {/* Mobile app */}
          <div className="l-feat-card" style={{ '--i': 0, '--color': '#4a9eff' }}>
            <div className="l-feat-visual">
              <svg viewBox="0 0 120 48" className="l-feat-svg">
                <rect x="42" y="2" width="36" height="44" rx="6" fill="none" stroke="#4a9eff" strokeWidth="1.5" opacity="0.4"/>
                <rect x="46" y="8" width="28" height="30" rx="2" fill="#4a9eff10" stroke="#4a9eff30" strokeWidth="0.5"/>
                {[0,1,2,3,4].map(i => <rect key={i} className="l-bar-wave" x={49+i*5} y={32-[8,14,10,16,12][i]} width={3} height={[8,14,10,16,12][i]} rx={1} fill="#4a9eff" opacity="0.6" style={{animationDelay:`${i*0.15}s`,transformOrigin:`${49+i*5+1.5}px 32px`}}/>)}
                <circle cx="60" cy="42" r="2" fill="#4a9eff" className="l-feat-pulse"/>
                <circle cx="18" cy="12" r="6" fill="none" stroke="#3dd68c40" strokeWidth="1"/>
                <circle cx="18" cy="12" r="2.5" fill="#3dd68c" className="l-feat-pulse" style={{animationDelay:'0.3s'}}/>
                <path d="M18 20 L18 36" stroke="#3dd68c30" strokeWidth="1" strokeDasharray="3 2" className="l-feat-dash"/>
                <text x="18" y="42" fill="#3dd68c80" fontSize="6" textAnchor="middle">sync</text>
                <circle cx="102" cy="12" r="6" fill="none" stroke="#ffc14540" strokeWidth="1"/>
                <circle cx="102" cy="12" r="2.5" fill="#ffc145" className="l-feat-pulse" style={{animationDelay:'0.6s'}}/>
                <text x="102" y="42" fill="#ffc14580" fontSize="6" textAnchor="middle">offline</text>
              </svg>
            </div>
            <div className="l-feat-title" style={{ color: '#4a9eff' }}>{en ? 'Mobile app' : 'Мобильное приложение'}</div>
            <div className="l-feat-desc">{en ? 'Same account. Offline AI. Coming to App Store & Google Play.' : 'Тот же аккаунт. Офлайн AI. Скоро в App Store и Google Play.'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
              <div className="l-dl-btn" style={{ padding: '6px 12px', fontSize: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div><div className="l-dl-name" style={{fontSize:10}}>iOS</div></div>
                <span className="l-dl-badge">{en ? 'Soon' : 'Скоро'}</span>
              </div>
              <div className="l-dl-btn" style={{ padding: '6px 12px', fontSize: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-1.12L20.16 12l-2.44-2L15.45 12.27l2.27 2.27v-.04zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
                <div><div className="l-dl-name" style={{fontSize:10}}>Android</div></div>
                <span className="l-dl-badge">{en ? 'Soon' : 'Скоро'}</span>
              </div>
            </div>
          </div>

          {/* Print & Play */}
          <a href="/print-and-play.pdf" target="_blank" className="l-feat-card" style={{ '--i': 1, '--color': '#3dd68c', textDecoration: 'none', cursor: 'pointer' }}>
            <div className="l-feat-visual">
              <svg viewBox="0 0 120 48" className="l-feat-svg">
                <rect x="30" y="2" width="28" height="36" rx="3" fill="none" stroke="#3dd68c" strokeWidth="1.5" opacity="0.3"/>
                <rect x="62" y="6" width="28" height="36" rx="3" fill="none" stroke="#3dd68c" strokeWidth="1.5" opacity="0.2"/>
                {[0,1,2,3].map(i => <line key={i} x1={36} y1={10+i*6} x2={50} y2={10+i*6} stroke="#3dd68c" strokeWidth="1" opacity={0.5-i*0.1}/>)}
                <rect x="66" y="12" width="20" height="14" rx="2" fill="#3dd68c10" stroke="#3dd68c40" strokeWidth="0.5"/>
                {[0,1,2,3,4].map(i => <rect key={i} className="l-bar-wave" x={68+i*4} y={24-[6,10,8,12,7][i]} width={2} height={[6,10,8,12,7][i]} rx={1} fill="#3dd68c" opacity="0.5" style={{animationDelay:`${i*0.2}s`,transformOrigin:`${68+i*4+1}px 24px`}}/>)}
                <path d="M44 38 L44 46" stroke="#3dd68c" strokeWidth="2" className="l-feat-dash"/>
                <path d="M40 44 L44 48 L48 44" fill="none" stroke="#3dd68c" strokeWidth="1.5" className="l-feat-pulse"/>
              </svg>
            </div>
            <div className="l-feat-title" style={{ color: '#3dd68c' }}>Print & Play</div>
            <div className="l-feat-desc">{en ? 'PDF: game board, 110 blocks, full rules. Print and play at the table!' : 'PDF: игровое поле, 110 блоков, правила. Распечатай и играй!'}</div>
          </a>

          {/* Free & indie */}
          <div className="l-feat-card" style={{ '--i': 2, '--color': '#ffc145' }}>
            <div className="l-feat-visual">
              <svg viewBox="0 0 120 48" className="l-feat-svg">
                <path d="M40 6 L54 6 C58 6 60 8 60 12 L60 36 C60 40 58 42 54 42 L40 42 C36 42 34 40 34 36 L34 12 C34 8 36 6 40 6Z" fill="none" stroke="#ffc145" strokeWidth="1" opacity="0.2"/>
                <text x="47" y="28" fill="#ffc145" fontSize="20" fontWeight="800" textAnchor="middle" opacity="0.8" className="l-feat-pulse">$0</text>
                <path d="M12 20 L22 14 L22 26 Z" fill="#ff606680" className="l-feat-pulse" style={{animationDelay:'0.2s'}}/>
                <line x1="12" y1="20" x2="22" y2="20" stroke="#ff606640" strokeWidth="3"/>
                <text x="17" y="36" fill="#ff606060" fontSize="5" textAnchor="middle">no ads</text>
                <circle cx="97" cy="16" r="8" fill="none" stroke="#e040fb40" strokeWidth="1"/>
                <circle cx="97" cy="16" r="3" fill="#e040fb" className="l-feat-pulse" style={{animationDelay:'0.5s'}}/>
                <circle cx="105" cy="32" r="6" fill="none" stroke="#3dd68c40" strokeWidth="1"/>
                <circle cx="105" cy="32" r="2" fill="#3dd68c" className="l-feat-pulse" style={{animationDelay:'0.8s'}}/>
                <text x="101" y="44" fill="#3dd68c60" fontSize="5" textAnchor="middle">indie</text>
              </svg>
            </div>
            <div className="l-feat-title" style={{ color: '#ffc145' }}>{en ? 'Free. No ads. Indie.' : 'Бесплатно. Без рекламы.'}</div>
            <div className="l-feat-desc">{en ? 'Made by 2 people with love. No paywalls, no tracking. Pure strategy.' : 'Сделано двумя людьми с душой. Без стен, без трекинга. Чистая стратегия.'}</div>
          </div>
        </div>
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
            [en ? 'Is it balanced?' : 'Это сбалансировано?', en ? '50:50 balance. Confirmed across 10M games.' : '50:50 баланс. Проверено на 10M партиях.'],
            [en ? 'Is it free?' : 'Бесплатно?', en ? 'Completely free. No ads, no paywalls.' : 'Полностью. Без рекламы, без подвохов.'],
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
              ? 'Project at the intersection of board game design and AI. Neural network trained via self-play on 10M+ games. New features every week.'
              : 'Проект на стыке дизайна настольных игр и AI. Нейросеть обучена через self-play на 10M+ партиях. Новые фичи каждую неделю.'}
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
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, color: 'var(--ink3)', flexWrap: 'wrap' }}>
            <a href="https://t.me/igor1000rr" target="_blank" rel="noopener" style={{ color: 'var(--ink3)', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
              Telegram
            </a>
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ opacity: 0.5 }}>v4.3</span>
          </div>
        </div>
      </section>
    </div>
  )
}
