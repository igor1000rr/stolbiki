import { useI18n } from '../engine/i18n'
import '../css/landing.css'
import { useContent } from '../engine/content'
import { useRef, useEffect, useState, lazy, Suspense } from 'react'
import Icon from './Icon'
import Mascot from './Mascot'
import { APP_VERSION } from '../version'

const LandingCity3D = lazy(() => import('./LandingCity3D'))

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

export default function Landing({ onPlay, onTutorial, publicStats, installPrompt, go }) {
  const { lang } = useI18n()
  const en = lang === 'en'
  const { c } = useContent(lang)

  const [heroRef, heroVis] = useReveal(0.1)
  const [cityRef, cityVis] = useReveal(0.1)
  const [stepRef, stepVis] = useReveal()
  const [grRef, grVis] = useReveal(0.1)
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
          <img src="/logo-full.webp" alt="Highrise Heist" style={{ width: 'min(280px, 70vw)', height: 'auto' }} />
        </div>
        <h1 className="l-hero-title">
          {c('site.tagline', en ? 'Strategy board game with AI' : 'Стратегическая настольная игра с AI')}
        </h1>
        <p className="l-hero-sub" style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink2)', marginBottom: 8 }}>
          {en ? 'Sneaky raccoons build highrises and snatch them from others.' : 'Хитрые еноты строят высотки и перехватывают их у других.'}
        </p>
        <p className="l-hero-sub">
          {en
            ? '10 highrises. 11 blocks each. Many strategies. Play with friends or against a trained neural network.'
            : '10 высоток. 11 блоков на каждой. Множество стратегий. Играйте с друзьями или против обученной нейросети.'}
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
          {publicStats && (publicStats.onlinePlayers > 0 || publicStats.todayGames > 0 || publicStats.totalUsers > 10) && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11, color: 'var(--ink3)' }}>
              {publicStats.onlinePlayers > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
                  {publicStats.onlinePlayers} {en ? 'online' : 'онлайн'}
                </span>
              )}
              {publicStats.todayGames > 0 && <span>{publicStats.todayGames} {en ? 'games today' : 'партий сегодня'}</span>}
              {publicStats.totalUsers > 10 && <span>{publicStats.totalUsers} {en ? 'players' : 'игроков'}</span>}
            </div>
          )}
        </div>
      </section>

      {/* ═══ 3D VICTORY CITY PREVIEW ═══ */}
      <section className={`l-section ${cityVis ? 'in' : ''}`} ref={cityRef} style={{ paddingTop: 8 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700,
            color: '#ff9800', textTransform: 'uppercase', letterSpacing: 2,
            marginBottom: 8,
          }}>
            {en ? 'In 3D' : 'В 3D'}
          </div>
          <h2 className="l-title" style={{ margin: '0 0 8px' }}>
            {en ? 'Your future City of Victories 🏙' : 'Ваш будущий Город побед 🏙'}
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--ink3)',
            margin: '0 auto', maxWidth: 480, lineHeight: 1.6,
          }}>
            {en
              ? 'Every win becomes a skyscraper. Skin color, AI difficulty and golden victories all shape your city. Drag to rotate.'
              : 'Каждая победа — небоскрёб. Цвет скина, сложность AI и золотые победы формируют твой город. Тащи чтобы покрутить.'}
          </p>
        </div>
        {cityVis && (
          <Suspense fallback={
            <div style={{
              maxWidth: 780, margin: '0 auto', minHeight: 240, borderRadius: 14,
              background: 'linear-gradient(180deg, #06060f 0%, #0a0a18 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink3)', fontSize: 12,
            }}>
              {en ? 'Loading 3D…' : 'Загружаю 3D…'}
            </div>
          }>
            <LandingCity3D />
          </Suspense>
        )}
      </section>

      {/* ═══ STEPS ═══ */}
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

      {/* ═══ GOLDEN RUSH ═══ */}
      <section className={`l-section ${grVis ? 'in' : ''}`} ref={grRef}>
        <div style={{
          padding: 'clamp(28px, 5vw, 48px)',
          background: 'linear-gradient(135deg, rgba(255,193,69,0.06) 0%, rgba(255,193,69,0.02) 100%)',
          border: '1px solid rgba(255,193,69,0.2)',
          borderRadius: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 'clamp(20px, 4vw, 36px)',
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              display: 'inline-block', fontSize: 10, fontWeight: 700,
              color: '#ffc145', textTransform: 'uppercase', letterSpacing: 2,
              marginBottom: 8,
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(255,193,69,0.12)',
              border: '1px solid rgba(255,193,69,0.25)',
            }}>
              NEW · 4 {en ? 'players' : 'игрока'}
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, margin: '0 0 12px', color: 'var(--ink)', lineHeight: 1.15 }}>
              {en ? 'Golden Rush' : 'Golden Rush'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.65, marginBottom: 16 }}>
              {en
                ? '9 stands in a cross. 4 players, each owns two — near and far. Close both to qualify for the golden center (+15 points, FIFO).'
                : '9 стоек крестом. 4 игрока, у каждого две — ближняя и дальняя. Замкни обе — встаёшь в очередь на золотой центр (+15 очков, первым пришёл — первым забрал).'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {(en
                ? ['2v2 teams', '4-FFA', 'Matchmaking', 'Team chat', 'Bricks reward']
                : ['2v2 команды', '4-FFA', 'Матчмейкинг', 'Тим-чат', 'Кирпичи за матч']
              ).map((tag, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(255,193,69,0.08)',
                  color: '#ffc145',
                  border: '1px solid rgba(255,193,69,0.2)',
                  fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                onClick={() => go?.('goldenrush-online')}
                style={{
                  padding: '10px 20px', fontSize: 14, fontWeight: 700,
                  background: '#ffc145', color: '#1a1a2e', border: 'none',
                  borderRadius: 10, cursor: 'pointer',
                  boxShadow: '0 0 24px rgba(255,193,69,0.3)',
                }}
              >
                {en ? 'Play online' : 'Играть онлайн'}
              </button>
              <button
                className="btn"
                onClick={() => go?.('goldenrush')}
                style={{ padding: '10px 20px', fontSize: 14 }}
              >
                {en ? 'Hot-seat (4 friends)' : 'Hot-seat (4 друга)'}
              </button>
            </div>
          </div>

          {/* SVG — схема креста 9 стоек */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 240 240" style={{ width: '100%', maxWidth: 260, aspectRatio: '1/1' }}>
              {/* Диагональные линии */}
              <line x1="60" y1="60" x2="180" y2="180" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="180" y1="60" x2="60" y2="180" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

              {/* Center glow */}
              <circle cx="120" cy="120" r="40" fill="rgba(255,193,69,0.12)" />

              {/* Arms — 4 игрока × 2 стойки */}
              {[
                { x: 60,  y: 60,  color: '#4a9eff', order: 1 },  // P0 top-left
                { x: 30,  y: 120, color: '#4a9eff', order: 2 },
                { x: 180, y: 60,  color: '#ff6066', order: 1 },  // P1 top-right
                { x: 210, y: 120, color: '#ff6066', order: 2 },
                { x: 180, y: 180, color: '#3dd68c', order: 1 },  // P2 bottom-right
                { x: 120, y: 210, color: '#3dd68c', order: 2 },
                { x: 60,  y: 180, color: '#e040fb', order: 1 },  // P3 bottom-left
                { x: 120, y: 30,  color: '#e040fb', order: 2 },
              ].map((s, i) => (
                <g key={i} className="l-skin-dot" style={{ animationDelay: `${i * 0.12}s` }}>
                  <circle cx={s.x} cy={s.y} r="18" fill="#0a0a18" stroke={s.color} strokeWidth="1.5" opacity="0.9" />
                  <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={s.color}>{s.order}</text>
                </g>
              ))}

              {/* Центр — золотая */}
              <circle cx="120" cy="120" r="24" fill="#2a2420" stroke="#ffc145" strokeWidth="2" />
              <text x="120" y="128" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffc145">★</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="l-section">
        <h2 className="l-title">{c('landing.features_title', en ? "What's inside" : 'Что внутри')}</h2>
        <div className={`l-feat-grid ${featVis ? 'in' : ''}`} ref={featRef}>
          {[
            { color: '#4a9eff', title: en ? 'AlphaZero AI' : 'AI нейросеть', desc: en ? 'Trained on 10M games. 5 difficulty levels + Fog, Double transfer, Auto-pass mods.' : 'Обучена на 10M партиях. 5 уровней + моды: туман, двойной перенос, авто-пас.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{[18,32,24,40,28,36,20,44,30,22].map((h,i)=><rect key={i} className="l-bar-wave" x={4+i*12} y={48-h} width={8} height={h} rx={2} fill={i%2===0?'#4a9eff':'#ff6066'} style={{animationDelay:`${i*0.15}s`,transformOrigin:`${4+i*12+4}px 48px`}}/>)}</svg> },
            { color: '#3dd68c', title: en ? 'Online' : 'Онлайн', desc: en ? 'Link to a friend — play in seconds. Clubs, global chat, leaderboards.' : 'Ссылка другу — игра за секунды. Клубы 🦝, глобальный чат, лидерборды.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><circle cx="30" cy="24" r="10" fill="none" stroke="#3dd68c" strokeWidth="1.5" opacity="0.5"/><circle cx="90" cy="24" r="10" fill="none" stroke="#4a9eff" strokeWidth="1.5" opacity="0.5"/><line x1="40" y1="24" x2="80" y2="24" stroke="#3dd68c50" strokeWidth="1" strokeDasharray="4 3" className="l-feat-dash"/><circle cx="30" cy="24" r="3" fill="#3dd68c" className="l-feat-pulse"/><circle cx="90" cy="24" r="3" fill="#4a9eff" className="l-feat-pulse" style={{animationDelay:'0.5s'}}/><circle className="l-packet" cx="30" cy="24" r="2" fill="#ffc145"/></svg> },
            { color: '#ffc145', title: en ? 'Puzzles' : 'Головоломки', desc: en ? 'Daily + weekly. 50 puzzles. Leaderboards.' : 'Ежедневные + еженедельные. 50 штук. Лидерборды.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><g>{[[25,6,28,22],[50,6,28,22],[75,6,28,22]].map(([x,y,w,h],i)=><rect key={i} x={x} y={y} width={w} height={h} rx={4} fill="none" stroke="#ffc14540" strokeWidth="1"/>)}<text className="l-puzzle-q" x="39" y="22" fill="#ffc145" fontSize="16" fontWeight="800" textAnchor="middle">?</text><text className="l-puzzle-a" x="64" y="22" fill="#3dd68c" fontSize="16" fontWeight="800" textAnchor="middle">✓</text><text className="l-puzzle-q" x="89" y="22" fill="#ffc145" fontSize="16" fontWeight="800" textAnchor="middle" style={{animationDelay:'1.5s'}}>?</text></g><rect x="25" y="36" width="70" height="3" rx="1.5" fill="#1a1a2e"/><rect className="l-puzzle-bar" x="25" y="36" width="0" height="3" rx="1.5" fill="#ffc14580"/></svg> },
            { color: '#9b59b6', title: en ? '11 themes + skins' : '11 тем + скины', desc: en ? 'Free: Dark, Forest, Light. Paid: Ocean, Royal, Sakura, Neon + 17 block & stand skins.' : 'Бесплатно: Dark, Forest, Light. Платно: Ocean, Royal, Sakura, Neon + 17 скинов.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{['#4a9eff','#ff00ff','#ff69b4','#00bcd4','#ffc145','#3dd68c','#ff6066'].map((c,i)=><circle key={i} className="l-skin-dot" cx={18+i*14} cy={20} r={6} fill={c} style={{animationDelay:`${i*0.2}s`}}/>)}</svg> },
            { color: '#3dd68c', title: en ? 'AI Review' : 'AI Анализ', desc: en ? 'Every move: excellent → blunder. Accuracy %.' : 'Каждый ход: отличный → грубая ошибка. Accuracy %.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{[['✓','#3dd68c'],['✓','#3dd68c'],['○','#ffc145'],['✕','#ff6066'],['✓','#3dd68c'],['✓','#3dd68c']].map(([s,c],i)=><text key={i} className="l-review-mark" x={12+i*20} y={22} fill={c} fontSize="14" textAnchor="middle" fontWeight="700" style={{animationDelay:`${i*0.3}s`}}>{s}</text>)}<rect x="10" y="34" width="100" height="4" rx="2" fill="#1a1a2e"/><rect className="l-review-bar" x="10" y="34" width="0" height="4" rx="2" fill="#3dd68c80"/></svg> },
            { color: '#ff6066', title: en ? 'Arena & Battle Pass' : 'Арена и Battle Pass', desc: en ? 'Tournaments, 30 seasonal quests, missions, 33 achievements, XP levels.' : 'Турниры, 30 квестов в сезоне, миссии, 33 ачивки, уровни XP.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">{[12,20,32,24,40,16,28,36].map((h,i)=><rect key={i} className="l-bar-wave" x={8+i*14} y={48-h} width={10} height={h} rx={2} fill={`hsl(${340+i*8},70%,60%)`} style={{animationDelay:`${i*0.12}s`,transformOrigin:`${8+i*14+5}px 48px`}}/>)}</svg> },
            { color: '#ff9800', title: en ? 'City of Victories 🏙' : 'Город побед 🏙', desc: en ? 'Every win builds a skyscraper in your profile. Color = skin used in that game.' : 'Каждая победа — здание в профиле. Цвет = скин из той партии.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg">
                {[[20,38,6,2,'#4a9eff'],[38,32,8,3,'#ff6066'],[58,36,5,2,'#9b59b6'],[76,28,10,4,'#00e5ff'],[96,34,7,2,'#ffc145']].map(([bx,by,w,floors,color],bi) =>
                  Array.from({length:floors}).map((_,fi) => (
                    <rect key={`${bi}-${fi}`} x={bx} y={by-fi*4} width={w} height={3} rx={0.5} fill={color} opacity={0.7+fi*0.05} style={{animationDelay:`${(bi*floors+fi)*0.08}s`}} className="l-bar-wave"/>
                  ))
                )}
              </svg> },
            { color: '#e040fb', title: en ? 'Share & Bricks 🧱' : 'Шер и кирпичи 🧱', desc: en ? 'Share story cards. Earn bricks per win. Buy skins, themes, unlock cosmetics.' : 'Share-картинки 1080×1920. Кирпичи за победы. Покупай скины и темы.',
              visual: <svg viewBox="0 0 120 48" className="l-feat-svg"><rect x="30" y="8" width="60" height="32" rx="6" fill="none" stroke="#e040fb40" strokeWidth="1.5"/><text x="60" y="22" fontSize="10" fill="#e040fb" textAnchor="middle" fontWeight="700">6 : 4</text><text x="60" y="34" fontSize="7" fill="#e040fb80" textAnchor="middle">+25 ELO</text><circle className="l-feat-pulse" cx="105" cy="14" r="4" fill="#3dd68c" style={{animationDelay:'0.3s'}}/><text x="105" y="32" fontSize="8" fill="#ffc14580" textAnchor="middle">🧱+3</text></svg> },
          ].map((f, i) => (
            <div key={i} className="l-feat-card" style={{ '--i': i, '--color': f.color }}>
              <div className="l-feat-visual">{f.visual}</div>
              <div className="l-feat-title" style={{ color: f.color }}>{f.title}</div>
              <div className="l-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SCREENSHOTS ═══ */}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.p1 }}>{s.theme}</div>
                  {i > 0 && <div style={{ fontSize: 9, color: 'var(--gold)', opacity: 0.7 }}>🧱</div>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--ink3)' }}>
          {en ? '🆓 Dark, Forest, Light — free  ·  🧱 6 more themes for bricks' : '🆓 Dark, Forest, Light — бесплатно  ·  🧱 ещё 6 тем за кирпичи'}
        </div>
      </section>

      {/* ═══ MOBILE APP ═══ */}
      <section className="l-section" id="mobile-app-section">
        <div className={`l-download ${dlVis ? 'in' : ''}`} ref={dlRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center', padding: '40px 36px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface3)' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Android</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.2 }}>
              {en ? 'Play anywhere' : 'Играйте где угодно'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 16 }}>
              {en
                ? 'Android app available via Capacitor. Full cloud sync, offline AI, push notifications.'
                : 'Приложение для Android уже готово. Синхронизация, офлайн AI, пуш-уведомления.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {(en ? ['Offline AI','Cloud sync','Push alerts','All 11 themes'] : ['Офлайн AI','Облачная синхронизация','Пуш-уведомления','Все 11 тем']).map((t,i) => (
                <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(61,214,140,0.1)', color: '#3dd68c', fontWeight: 500 }}>{t}</span>
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
              <rect x="16" y="8" width="148" height="324" rx="28" fill="#1a1a2e" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
              <rect x="14" y="80" width="2" height="24" rx="1" fill="rgba(255,255,255,0.08)"/>
              <rect x="14" y="120" width="2" height="40" rx="1" fill="rgba(255,255,255,0.08)"/>
              <rect x="164" y="100" width="2" height="32" rx="1" fill="rgba(255,255,255,0.08)"/>
              <rect x="22" y="16" width="136" height="308" rx="22" fill="#0a0a12"/>
              <rect x="66" y="22" width="48" height="16" rx="8" fill="#1a1a2e"/>
              <circle cx="82" cy="30" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
              <text x="38" y="34" fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="600">9:41</text>
              <text x="90" y="62" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" opacity="0.7">HIGHRISE HEIST</text>
              <text x="90" y="75" textAnchor="middle" fill="var(--accent)" fontSize="6" opacity="0.5">vs Snappy · Easy</text>
              <text x="65" y="96" textAnchor="middle" fill="#4a9eff" fontSize="18" fontWeight="800">4</text>
              <text x="90" y="94" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="12">:</text>
              <text x="115" y="96" textAnchor="middle" fill="#ff6066" fontSize="18" fontWeight="800">3</text>
              <rect x="30" y="108" width="120" height="140" rx="10" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
              {[0,1,2,3,4,5,6,7,8,9].map(i => <rect key={i} x={36+i*11} y={228-[35,55,45,70,40,60,50,72,42,58][i]} width={7} height={[35,55,45,70,40,60,50,72,42,58][i]} rx={2} fill={i%2===0?'#4a9eff':'#ff6066'} opacity="0.75"/>)}
              {['★','A','B','C','D','E','F','G','H','I'].map((l,i) => <text key={i} x={39.5+i*11} y={242} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="5">{l}</text>)}
              <rect x="42" y="258" width="36" height="18" rx="6" fill="rgba(74,158,255,0.15)" stroke="#4a9eff40" strokeWidth="0.5"/>
              <text x="60" y="270" textAnchor="middle" fill="#4a9eff" fontSize="6" fontWeight="600">{en?'Confirm':'Ход'}</text>
              <rect x="84" y="258" width="26" height="18" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
              <text x="97" y="270" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="6">{en?'New':'Новая'}</text>
              <rect x="70" y="312" width="40" height="4" rx="2" fill="rgba(255,255,255,0.15)"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ═══ PRINT & PLAY + ABOUT ═══ */}
      <section className="l-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          <a href="/print-and-play.pdf" target="_blank" style={{ textDecoration: 'none', display: 'block', padding: '36px 28px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface3)', transition: 'border-color 0.3s, transform 0.3s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,214,140,0.4)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = '' }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#3dd68c', marginBottom: 10 }}>Print & Play</h3>
              <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 16 }}>
                {en ? 'Free PDF with game board, 110 blocks and rules. Print, cut, play!' : 'Бесплатный PDF с полем, 110 блоками и правилами. Распечатай, вырежь, играй!'}
              </p>
              <span style={{ fontSize: 15, color: '#3dd68c', fontWeight: 700 }}>{en ? 'Download PDF' : 'Скачать PDF'} →</span>
            </div>
          </a>

          <div style={{ padding: '36px 28px', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface3)' }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffc145', marginBottom: 10 }}>{en ? 'Indie project' : 'Инди-проект'}</h3>
              <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7 }}>
                {en
                  ? 'Built by 2 people who love board games. No ads. Free to play — skins and themes for bricks earned in-game.'
                  : 'Создан двумя людьми, которые любят настольные игры. Без рекламы. Бесплатная игра — скины и темы за внутриигровые кирпичи.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="l-section">
        <h2 className="l-title">{en ? 'Questions' : 'Вопросы'}</h2>
        <div className={`l-qa ${faqVis ? 'in' : ''}`} ref={faqRef}>
          {[
            [en ? 'Is it free?' : 'Бесплатно?',
             en ? 'Yes. No ads, no paywalls. The game is free. Optional cosmetics (themes, block skins) are purchased with bricks earned by winning.' : 'Да. Без рекламы и платных стен. Игра бесплатна. Косметика (темы, скины блоков) покупается за кирпичи — внутриигровую валюту, которую зарабатываешь победами.'],
            [en ? 'How long is a game?' : 'Сколько длится партия?',
             en ? '5-15 minutes depending on skill. Blitz mode, modifiers (Fog, Double transfer, Auto-pass) available.' : '5-15 минут в зависимости от уровня. Есть блиц-режим и геймплейные моды: туман войны, ×2 перенос, авто-пас.'],
            [en ? 'What is the golden stand?' : 'Зачем золотая стойка?',
             en ? 'Breaks 5:5 ties. Controlling it is key strategy.' : 'Решает при счёте 5:5. Контроль над ней — ключевая стратегия.'],
            [en ? 'What is Golden Rush?' : 'Что такое Golden Rush?',
             en ? 'A 4-player mode on a 9-stand cross. Hot-seat (one device, 4 players) or online with matchmaking in 2v2 or 4-FFA. Each match gives you bricks: +2 for participating, +10 for winning, +3 for capturing the center.' : 'Режим на 4 игроков — крест из 9 стоек. Hot-seat (одно устройство, 4 игрока) или онлайн с матчмейкингом в 2v2 или 4-FFA. Каждый матч даёт кирпичи: +2 за участие, +10 за победу, +3 за взятие центра.'],
            [en ? 'What is City of Victories?' : 'Что такое Город побед?',
             en ? 'Every win adds a building to your profile. Building color reflects the block skin you used in that game. Visit your profile to see your city grow in 3D.' : 'Каждая победа добавляет здание в профиль. Цвет здания = скин блоков в той партии. Смотри как растёт твой город в 3D прямо в профиле.'],
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

      {/* ═══ CTA ═══ */}
      <section className="l-final">
        <div className="l-final-glow" />
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Mascot pose="celebrate" size={120} large className="mascot-bounce" style={{ display: 'block', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 36, margin: '0 0 12px', fontWeight: 800 }}>{en ? 'Ready to play?' : 'Готовы играть?'}</h2>
          <p style={{ fontSize: 15, color: 'var(--ink3)', lineHeight: 1.7, margin: '0 auto 32px', maxWidth: 480 }}>
            {en ? 'An indie game made with love. No ads, no paywalls. Just pure strategy.' : 'Инди-игра, сделанная с душой. Без рекламы и платных стен. Чистая стратегия.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <button className="btn primary" onClick={onPlay} style={{ fontSize: 18, padding: '16px 52px', borderRadius: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 0 40px rgba(59,184,168,0.3), 0 8px 24px rgba(0,0,0,0.3)' }}>
              <Icon name="play" size={20} color="#fff" />{en ? 'Play free' : 'Играть бесплатно'}
            </button>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)', marginBottom: 12 }}>{en ? 'Join us:' : 'Присоединяйтесь:'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {[
                { name: 'Telegram', url: 'https://t.me/igor1000rr', color: '#4a9eff' },
                { name: 'TikTok', url: 'https://tiktok.com/@highriseheist', color: '#e040fb' },
                { name: 'Reddit', url: 'https://reddit.com/r/boardgames', color: '#ff6066' },
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
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink3)', opacity: 0.3 }}>v{APP_VERSION}</div>
        </div>
      </section>
    </div>
  )
}
