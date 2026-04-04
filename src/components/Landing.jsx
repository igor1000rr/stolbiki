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
            { color: '#4a9eff', title: en ? 'AlphaZero AI' : 'AI нейросеть', desc: en ? 'Trained on 10M games. 5 difficulty levels.' : 'Обучена на 10M партиях. 5 уровней сложности.',
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

      {/* ═══ MOBILE APP ═══ */}
      <section className="l-section">
        <div className={`l-download ${dlVis ? 'in' : ''}`} ref={dlRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center', padding: '40px 36px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface3)' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{en ? 'Coming soon' : 'Скоро'}</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.2 }}>
              {en ? 'Play anywhere' : 'Играйте где угодно'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 16 }}>
              {en
                ? 'Your account, rating, achievements and friends — all synced. AI works offline, no internet needed. Push notifications when a friend challenges you.'
                : 'Ваш аккаунт, рейтинг, ачивки и друзья — всё синхронизировано. AI работает офлайн, интернет не нужен. Пуш-уведомления когда друг бросает вызов.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {(en ? ['Offline AI','Cloud sync','Push alerts','All 11 themes'] : ['Офлайн AI','Облачная синхронизация','Пуш-уведомления','Все 11 тем']).map((t,i) => (
                <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(74,158,255,0.1)', color: '#4a9eff', fontWeight: 500 }}>{t}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="l-dl-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div><div className="l-dl-sub">Download on the</div><div className="l-dl-name">App Store</div></div>
                <span className="l-dl-badge">{en ? 'Soon' : 'Скоро'}</span>
              </div>
              <div className="l-dl-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm.91-1.12L20.16 12l-2.44-2L15.45 12.27l2.27 2.27v-.04zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/></svg>
                <div><div className="l-dl-sub">GET IT ON</div><div className="l-dl-name">Google Play</div></div>
                <span className="l-dl-badge">{en ? 'Soon' : 'Скоро'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 180 340" width="180" style={{ filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.5))' }}>
              {/* Корпус */}
              <rect x="16" y="8" width="148" height="324" rx="28" fill="#1a1a2e" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
              {/* Боковые кнопки */}
              <rect x="14" y="80" width="2" height="24" rx="1" fill="rgba(255,255,255,0.08)"/>
              <rect x="14" y="120" width="2" height="40" rx="1" fill="rgba(255,255,255,0.08)"/>
              <rect x="164" y="100" width="2" height="32" rx="1" fill="rgba(255,255,255,0.08)"/>
              {/* Экран */}
              <rect x="22" y="16" width="136" height="308" rx="22" fill="#0a0a12"/>
              {/* Dynamic Island */}
              <rect x="66" y="22" width="48" height="16" rx="8" fill="#1a1a2e"/>
              <circle cx="82" cy="30" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
              {/* Статус бар */}
              <text x="38" y="34" fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="600">9:41</text>
              <g transform="translate(134,27)">
                <rect x="0" y="0" width="10" height="6" rx="1" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
                <rect x="1" y="1" width="7" height="4" rx="0.5" fill="rgba(61,214,140,0.6)"/>
                <rect x="10" y="1.5" width="1.5" height="3" rx="0.5" fill="rgba(255,255,255,0.3)"/>
              </g>
              {/* Контент — игровое поле */}
              <text x="90" y="62" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" opacity="0.7">SNATCH HIGHRISE</text>
              <text x="90" y="75" textAnchor="middle" fill="var(--accent)" fontSize="6" opacity="0.5">vs Snappy · Easy</text>
              {/* Счёт */}
              <text x="65" y="96" textAnchor="middle" fill="#4a9eff" fontSize="18" fontWeight="800">4</text>
              <text x="90" y="94" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="12">:</text>
              <text x="115" y="96" textAnchor="middle" fill="#ff6066" fontSize="18" fontWeight="800">3</text>
              {/* Игровое поле — 10 столбиков */}
              <rect x="30" y="108" width="120" height="140" rx="10" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
              {[0,1,2,3,4,5,6,7,8,9].map(i => <rect key={i} className="l-bar-wave" x={36+i*11} y={228-[35,55,45,70,40,60,50,72,42,58][i]} width={7} height={[35,55,45,70,40,60,50,72,42,58][i]} rx={2} fill={i%2===0?'#4a9eff':'#ff6066'} opacity="0.75" style={{animationDelay:`${i*0.12}s`,transformOrigin:`${36+i*11+3.5}px 228px`}}/>)}
              {/* Буквы стоек */}
              {['★','A','B','C','D','E','F','G','H','I'].map((l,i) => <text key={i} x={39.5+i*11} y={242} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="5">{l}</text>)}
              {/* Кнопки внизу */}
              <rect x="42" y="258" width="36" height="18" rx="6" fill="rgba(74,158,255,0.15)" stroke="#4a9eff40" strokeWidth="0.5"/>
              <text x="60" y="270" textAnchor="middle" fill="#4a9eff" fontSize="6" fontWeight="600">{en?'Confirm':'Ход'}</text>
              <rect x="84" y="258" width="26" height="18" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
              <text x="97" y="270" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="6">{en?'New':'Новая'}</text>
              {/* Home indicator */}
              <rect x="70" y="312" width="40" height="4" rx="2" fill="rgba(255,255,255,0.15)"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ═══ PRINT & PLAY + ABOUT ═══ */}
      <section className="l-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <a href="/print-and-play.pdf" target="_blank" style={{ textDecoration: 'none', display: 'block', padding: '36px 28px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface3)', transition: 'border-color 0.3s, transform 0.3s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,214,140,0.4)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = '' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <svg viewBox="0 0 160 80" width="180">
                {/* Поле */}
                <rect x="10" y="5" width="60" height="70" rx="8" fill="#0d0d14" stroke="#3dd68c" strokeWidth="1" opacity="0.4"/>
                {[0,1,2,3,4,5,6,7,8].map(i => <rect key={i} className="l-bar-wave" x={16+i*6} y={60-[18,28,22,32,20,30,24,34,26][i]} width={4} height={[18,28,22,32,20,30,24,34,26][i]} rx={1.5} fill={i%2===0?'#4a9eff':'#ff6066'} opacity="0.7" style={{animationDelay:`${i*0.1}s`,transformOrigin:`${16+i*6+2}px 60px`}}/>)}
                {/* Блоки */}
                <g transform="translate(85,10)">
                  {[0,1,2].map(r => [0,1,2,3,4].map(c => <rect key={`${r}-${c}`} x={c*13} y={r*13} width={11} height={11} rx={2.5}
                    fill={(r+c)%2===0?'#4a9eff18':'#ff606618'} stroke={(r+c)%2===0?'#4a9eff35':'#ff606635'} strokeWidth="0.5"
                    className="l-feat-pulse" style={{animationDelay:`${(r*5+c)*0.1}s`}}/>))}
                  <text x="32" y="55" textAnchor="middle" fill="#3dd68c80" fontSize="6">110 {en?'blocks':'блоков'}</text>
                </g>
                {/* Стрелка */}
                <path d="M80 68 L80 78" stroke="#3dd68c" strokeWidth="2" strokeDasharray="3 2" className="l-feat-dash"/>
                <path d="M76 76 L80 80 L84 76" fill="none" stroke="#3dd68c" strokeWidth="1.5" className="l-feat-pulse"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#3dd68c', marginBottom: 10 }}>Print & Play</h3>
              <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 16 }}>
                {en
                  ? 'Free PDF with game board, 110 blocks and rules. Print, cut, play!'
                  : 'Бесплатный PDF с полем, 110 блоками и правилами. Распечатай, вырежи, играй!'}
              </p>
              <span style={{ fontSize: 15, color: '#3dd68c', fontWeight: 700 }}>{en ? 'Download PDF' : 'Скачать PDF'} →</span>
            </div>
          </a>

          <div style={{ padding: '36px 28px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <svg viewBox="0 0 160 80" width="180">
                {/* Два игрока */}
                <circle cx="50" cy="30" r="14" fill="none" stroke="#4a9eff" strokeWidth="1" opacity="0.3"/>
                <circle cx="50" cy="30" r="5" fill="#4a9eff" className="l-feat-pulse"/>
                <circle cx="110" cy="30" r="14" fill="none" stroke="#ff6066" strokeWidth="1" opacity="0.3"/>
                <circle cx="110" cy="30" r="5" fill="#ff6066" className="l-feat-pulse" style={{animationDelay:'0.5s'}}/>
                {/* Связь */}
                <line x1="64" y1="30" x2="96" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 3" className="l-feat-dash"/>
                <circle className="l-packet" cx="64" cy="30" r="2.5" fill="#ffc145"/>
                {/* Сердце */}
                <g transform="translate(68,52)">
                  <path className="l-heart-beat" d="M12 18 C8 14 2 11 2 7 C2 4 4 2 7 2 C9 2 11 4 12 6 C13 4 15 2 17 2 C20 2 22 4 22 7 C22 11 16 14 12 18Z" fill="#ffc14540" stroke="#ffc14560" strokeWidth="0.5"/>
                </g>
                {/* Подписи */}
                <text x="50" y="55" textAnchor="middle" fill="#4a9eff80" fontSize="6">{en?'you':'вы'}</text>
                <text x="110" y="55" textAnchor="middle" fill="#ff606680" fontSize="6">Snappy</text>
                <text x="80" y="76" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6">{en?'made with love':'сделано с душой'}</text>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffc145', marginBottom: 10 }}>{en ? 'Indie project' : 'Инди-проект'}</h3>
              <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7 }}>
                {en
                  ? 'Built by 2 people who love board games. No ads, no paywalls. Free to play, supported by the community.'
                  : 'Создан двумя людьми, которые любят настольные игры. Без рекламы и платных стен. Бесплатная игра при поддержке сообщества.'}
              </p>
            </div>
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
        {/* Animated background elements */}
        <svg viewBox="0 0 800 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.15 }}>
          {[...Array(20)].map((_, i) => <rect key={i} className="l-bar-wave" x={40+i*38} y={350-[60,100,80,120,70,110,90,130,75,105,85,115,65,125,95,135,72,108,88,118][i]} width={12} height={[60,100,80,120,70,110,90,130,75,105,85,115,65,125,95,135,72,108,88,118][i]} rx={3} fill={i%2===0?'#4a9eff':'#ff6066'} style={{animationDelay:`${i*0.15}s`,transformOrigin:`${40+i*38+6}px 350px`}}/>)}
          {[0,1,2,3,4,5].map(i => <circle key={i} className="l-feat-pulse" cx={80+i*130} cy={30+i*15} r={4} fill={['#3dd68c','#ffc145','#e040fb','#4a9eff','#ff6066','#3dd68c'][i]} style={{animationDelay:`${i*0.5}s`}}/>)}
        </svg>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Mascot pose="celebrate" size={120} large className="mascot-bounce" style={{ display: 'block', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 36, margin: '0 0 12px', fontWeight: 800 }}>{en ? 'Ready to play?' : 'Готовы играть?'}</h2>
          <p style={{ fontSize: 15, color: 'var(--ink3)', lineHeight: 1.7, margin: '0 auto 32px', maxWidth: 480 }}>
            {en
              ? 'Join a community of strategy lovers. AI trained on 10M+ games is waiting.'
              : 'Присоединяйтесь к сообществу любителей стратегий. AI, обученный на 10M+ партиях, ждёт вас.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <button className="btn primary" onClick={onPlay} style={{ fontSize: 18, padding: '16px 52px', borderRadius: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 0 40px rgba(59,184,168,0.3), 0 8px 24px rgba(0,0,0,0.3)' }}>
              <Icon name="play" size={20} color="#fff" />{en ? 'Play free' : 'Играть бесплатно'}
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 36, flexWrap: 'wrap' }}>
            {[
              { val: '10M+', label: en ? 'games analyzed' : 'партий', color: '#4a9eff' },
              { val: '50:50', label: en ? 'perfect balance' : 'баланс', color: '#3dd68c' },
              { val: '33', label: en ? 'achievements' : 'ачивки', color: '#ffc145' },
              { val: '11', label: en ? 'themes' : 'тем', color: '#e040fb' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Social */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { name: 'Reddit', url: 'https://reddit.com/r/boardgames', color: '#ff6066' },
              { name: 'Telegram', url: 'https://t.me/igor1000rr', color: '#4a9eff' },
              { name: 'TikTok', url: 'https://tiktok.com', color: '#e040fb' },
              { name: 'BGG', url: 'https://boardgamegeek.com', color: '#ffc145' },
            ].map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener" style={{
                fontSize: 12, padding: '7px 16px', borderRadius: 8,
                background: `${s.color}10`, border: `1px solid ${s.color}30`, color: s.color,
                textDecoration: 'none', fontWeight: 600, transition: 'transform 0.2s, background 0.2s'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = `${s.color}25` }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = `${s.color}10` }}>
                {s.name}
              </a>
            ))}
          </div>

          {/* Tech */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12, opacity: 0.4 }}>
            {['React', 'Node.js', 'AlphaZero', 'WebSocket', 'SQLite', 'Capacitor'].map(t => (
              <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--ink3)' }}>{t}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', opacity: 0.3 }}>v4.6.2</div>
        </div>
      </section>
    </div>
  )
}
