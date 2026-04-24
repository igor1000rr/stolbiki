import { useEffect } from 'react'
import { useI18n } from '../engine/i18n'
import Mascot from './Mascot'

// FAQ schema для страницы правил. Инжектится только когда /rules активен —
// раньше блок висел в index.html и применялся ко всем 28 страницам, что
// нарушает гайдлайны Google (FAQ schema должна быть на странице где есть
// собственно FAQ-контент).
const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is Highrise Heist?', acceptedAnswer: { '@type': 'Answer', text: 'A strategy board game with AI powered by AlphaZero-style neural network. Classic mode for 2 players plus Golden Rush for 4 players on a 9-stand cross. Free, no ads. Play against AI, online PvP or offline with friends.' } },
    { '@type': 'Question', name: 'How do I play?', acceptedAnswer: { '@type': 'Answer', text: 'Place blocks on 10 stands and transfer stacks of up to 11 blocks to complete highrises. The player who claims the majority of stands wins. Full rules at /rules.' } },
    { '@type': 'Question', name: 'What is Golden Rush?', acceptedAnswer: { '@type': 'Answer', text: 'A 4-player mode on a 9-stand cross layout. Each player owns two stands (near and far); close both to qualify for the golden center (+15 points, FIFO). Supports 2v2 team play and 4-FFA. Online with matchmaking or hot-seat on a single device.' } },
    { '@type': 'Question', name: 'Is it free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, completely free with no ads. In-game bricks currency is earned by playing and unlocks cosmetic skins.' } },
    { '@type': 'Question', name: 'Can I play offline?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. The game works as a Progressive Web App — install it and play against AI even without internet.' } },
    { '@type': 'Question', name: 'Do I need an account?', acceptedAnswer: { '@type': 'Answer', text: 'No, you can play as a guest. Sign up to save stats, compete in ranked matches, and join the global leaderboard.' } },
    { '@type': 'Question', name: 'Is there a mobile app?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Android app is available, iOS coming soon. The web version also installs as a PWA on any device.' } },
  ],
}

function Section({ title, children }) {
  return (
    <div className="dash-card" style={{ marginBottom: 16, padding: '20px 24px' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>{title}</h3>
      <div>{children}</div>
    </div>
  )
}

function Bullet({ children, color = 'var(--ink3)' }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '4px 0' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, marginTop: 7, flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7 }}>{children}</span>
    </div>
  )
}

function TransferSchema({ lang }) {
  const en = lang === 'en'
  return (
    <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--surface3)', marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', marginBottom: 10 }}>
        {en ? 'Transfer example' : 'Пример переноса'}
      </div>
      <svg viewBox="0 0 360 130" style={{ width: '100%', maxWidth: 400, display: 'block', margin: '0 auto' }}>
        <rect x={40} y={20} width={50} height={95} rx={6} fill="none" stroke="var(--surface3)" strokeWidth={1.5} />
        <text x={65} y={14} textAnchor="middle" fontSize={11} fill="var(--ink3)">A</text>
        {[0,1,2].map(i => <rect key={`a${i}`} x={48} y={91 - i*14} width={34} height={11} rx={4} fill="var(--p1)" opacity={0.9} />)}
        {[0,1,2].map(i => <rect key={`r${i}`} x={48} y={49 - i*14} width={34} height={11} rx={4} fill="var(--p2)" opacity={0.9} />)}
        <path d="M 86 20 C 96 20, 96 56, 86 56" stroke="var(--gold)" strokeWidth={1.5} fill="none" />
        <text x={103} y={42} fontSize={9} fill="var(--gold)">{en ? 'top group' : 'группа'}</text>
        <line x1={140} y1={65} x2={210} y2={65} stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4,3" />
        <polygon points="210,60 220,65 210,70" fill="var(--gold)" />
        <rect x={240} y={20} width={50} height={95} rx={6} fill="none" stroke="var(--green)" strokeWidth={1.5} />
        <text x={265} y={14} textAnchor="middle" fontSize={11} fill="var(--ink3)">B</text>
        {[0,1,2].map(i => <rect key={`g${i}`} x={248} y={91 - i*14} width={34} height={11} rx={4} fill="var(--p2)" opacity={0.5} strokeDasharray="3,2" stroke="var(--p2)" />)}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink3)', marginTop: 8 }}>
        {en ? '3 red blocks transfer from A to B as a group' : '3 красных блока переносятся со стойки A на B целиком'}
      </div>
    </div>
  )
}

function CloseSchema({ lang }) {
  const en = lang === 'en'
  return (
    <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--surface3)', marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 10 }}>
        {en ? 'Completion example' : 'Пример достройки'}
      </div>
      <svg viewBox="0 0 360 155" style={{ width: '100%', maxWidth: 400, display: 'block', margin: '0 auto' }}>
        <rect x={20} y={15} width={50} height={112} rx={6} fill="none" stroke="var(--surface3)" strokeWidth={1.5} />
        <text x={45} y={10} textAnchor="middle" fontSize={10} fill="var(--ink3)">{en ? 'Before' : 'До'}</text>
        {[0,1,2,3,4].map(i => <rect key={`b${i}`} x={28} y={110 - i*12} width={34} height={9} rx={3} fill="var(--p1)" opacity={0.7} />)}
        {[0,1,2].map(i => <rect key={`r${i}`} x={28} y={50 - i*12} width={34} height={9} rx={3} fill="var(--p2)" opacity={0.7} />)}
        <text x={45} y={145} textAnchor="middle" fontSize={9} fill="var(--ink3)">8/11</text>

        <text x={105} y={70} fontSize={10} fill="var(--gold)">+3</text>
        <line x1={120} y1={80} x2={190} y2={80} stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4,3" />
        <polygon points="190,75 200,80 190,85" fill="var(--gold)" />

        <rect x={210} y={15} width={50} height={112} rx={6} fill="rgba(61,214,140,0.08)" stroke="var(--green)" strokeWidth={1.5} />
        <text x={235} y={10} textAnchor="middle" fontSize={10} fill="var(--green)">{en ? 'Complete' : 'Достроена'}</text>
        {Array.from({length: 11}).map((_, i) => <rect key={`f${i}`} x={218} y={113 - i*9} width={34} height={6} rx={2} fill={i >= 8 ? 'var(--p2)' : 'var(--p1)'} opacity={0.5} />)}
        <text x={235} y={145} textAnchor="middle" fontSize={9} fill="var(--green)">11/11</text>

        <text x={300} y={70} fontSize={10} fill="var(--ink2)">{en ? 'Owner:' : 'Владелец:'}</text>
        <rect x={285} y={78} width={34} height={10} rx={3} fill="var(--p2)" opacity={0.8} />
        <text x={302} y={102} textAnchor="middle" fontSize={9} fill="var(--p2-light)">{en ? 'top color' : 'верхний цвет'}</text>
      </svg>
    </div>
  )
}

function GoldenRushSchema({ lang }) {
  const en = lang === 'en'
  return (
    <div style={{ padding: 16, background: 'rgba(255,193,69,0.04)', borderRadius: 12, border: '1px solid rgba(255,193,69,0.2)', marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#ffc145', marginBottom: 10 }}>
        {en ? 'Board layout — 4 players on a cross' : 'Поле — 4 игрока на кресте'}
      </div>
      <svg viewBox="0 0 240 240" style={{ width: '100%', maxWidth: 280, display: 'block', margin: '0 auto' }}>
        <line x1="60" y1="60" x2="180" y2="180" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <line x1="180" y1="60" x2="60" y2="180" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        <circle cx="120" cy="120" r="40" fill="rgba(255,193,69,0.1)" />

        {[
          { x: 60,  y: 60,  color: '#4a9eff', order: 1, label: 'P1' },
          { x: 30,  y: 120, color: '#4a9eff', order: 2 },
          { x: 180, y: 60,  color: '#ff6066', order: 1, label: 'P2' },
          { x: 210, y: 120, color: '#ff6066', order: 2 },
          { x: 180, y: 180, color: '#3dd68c', order: 1, label: 'P3' },
          { x: 120, y: 210, color: '#3dd68c', order: 2 },
          { x: 60,  y: 180, color: '#e040fb', order: 1, label: 'P4' },
          { x: 120, y: 30,  color: '#e040fb', order: 2 },
        ].map((s, i) => (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r="18" fill="#0a0a18" stroke={s.color} strokeWidth="1.5" opacity="0.9" />
            <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={s.color}>{s.order}</text>
            {s.label && <text x={s.x + (s.x < 120 ? -24 : 24)} y={s.y - 20} textAnchor="middle" fontSize="9" fill={s.color} fontWeight="700">{s.label}</text>}
          </g>
        ))}

        <circle cx="120" cy="120" r="24" fill="#2a2420" stroke="#ffc145" strokeWidth="2" />
        <text x="120" y="128" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffc145">★</text>
      </svg>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink3)', marginTop: 8, lineHeight: 1.6 }}>
        {en
          ? 'Each player owns stand «1» (near) and «2» (far). Close «1» first, then «2». The center is shared.'
          : 'У каждого игрока своя стойка «1» (ближняя) и «2» (дальняя). Сначала замыкается «1», потом «2». Центр — общий.'}
      </div>
    </div>
  )
}

export default function Rules() {
  const { lang } = useI18n()
  const en = lang === 'en'

  // Инжектим FAQPage JSON-LD при монтировании /rules, убираем при размонтировании.
  // Prerender zachватит в HTML страницы /rules и /en/rules — там теперь legit
  // FAQ schema, а не на всех 28 URL как раньше.
  useEffect(() => {
    let script = document.getElementById('seo-faq')
    if (!script) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = 'seo-faq'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(FAQ_LD)
    return () => {
      const el = document.getElementById('seo-faq')
      if (el) el.remove()
    }
  }, [])

  const goTab = (id) => window.dispatchEvent(new CustomEvent('stolbiki-go-tab', { detail: id }))

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      <Section title={en ? 'Game Rules "Highrise Heist"' : 'Правила игры «Перехват высотки»'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <Mascot pose="point" size={64} animate={false} />
          <div>
            <Bullet>{en ? 'Strategic board game for two players' : 'Стратегическая настольная игра для двух игроков'}</Bullet>
            <Bullet>{en ? 'The player who controls more highrises wins' : 'Побеждает игрок, который контролирует больше высоток к концу игры'}</Bullet>
          </div>
        </div>
      </Section>

      <Section title={en ? 'Setup' : 'Подготовка'}>
        <Bullet>{en ? '10 stands on the table: 1 golden (★) and 9 regular' : '10 стоек на столе: 1 золотая (★) и 9 обычных'}</Bullet>
        <Bullet>{en ? 'First move — 1 block is placed, second player can swap colors' : 'Первый ход — ставится 1 блок, второй игрок может поменяться цветами'}</Bullet>
      </Section>

      <Section title={en ? 'Turn' : 'Ход'}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 16 }}>
          {en ? "A player's turn consists of two phases, executed in order:" : 'Ход игрока состоит из двух фаз, которые выполняются по порядку:'}
        </p>

        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(74,158,255,0.04)', border: '1px solid rgba(74,158,255,0.12)', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--p1)', marginBottom: 8 }}>
            {en ? '1. Transfer' : '1. Перемещение блоков'}
          </div>
          <Bullet>{en ? 'Can make one transfer or skip this action' : 'Можно сделать один перенос или пропустить действие'}</Bullet>
          <Bullet>{en ? 'Top blocks of the same color transfer as a group — cannot split' : 'Переносятся верхние блоки одного цвета — группа переносится целиком, делить её нельзя'}</Bullet>
          <Bullet>{en ? "Can transfer your own and opponent's blocks" : 'Можно переносить свои и чужие блоки'}</Bullet>
          <Bullet>{en ? 'Target: empty stand or stand with same color on top' : 'Куда: на пустую стойку или на блоки такого же цвета сверху'}</Bullet>
          <Bullet>{en ? 'Max 11 blocks per stand, excess removed from the game' : 'На стойке не может быть больше 11 блоков, остальные убираются из игры'}</Bullet>
        </div>

        <TransferSchema lang={lang} />

        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(240,96,64,0.04)', border: '1px solid rgba(240,96,64,0.12)', marginTop: 20, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
            {en ? '2. Placement' : '2. Установка блоков'}
          </div>
          <Bullet>{en ? '1 to 3 blocks per turn' : 'От 1 до 3 блоков за ход'}</Bullet>
          <Bullet>{en ? 'On max 2 stands' : 'Максимум на 2 стойки'}</Bullet>
        </div>
      </Section>

      <Section title={en ? 'Completing Highrises' : 'Завершение строительства'}>
        <Bullet>{en ? 'A highrise can only be completed by transferring a group of your color blocks' : 'Высотку можно достроить только переносом группы блоков своего цвета'}</Bullet>
        <Bullet>{en ? 'When only 2 stands remain, you can complete by placement' : 'Установкой можно достроить, когда осталось 2 стойки'}</Bullet>
        <Bullet>{en ? 'If a stand has 11 blocks, it is complete: no more blocks allowed' : 'Если на стойке 11 блоков, высотка достроена: ставить и переносить блоки нельзя'}</Bullet>
        <Bullet>{en ? 'Only one highrise can be completed per turn' : 'За ход можно достроить только одну высотку'}</Bullet>
        <Bullet color="var(--green)">{en ? 'Owner = player whose block is on top' : 'Высотка принадлежит игроку, чей блок установлен на вершине'}</Bullet>
        <CloseSchema lang={lang} />
      </Section>

      <Section title={en ? 'Victory' : 'Победа'}>
        <Bullet>{en ? 'The player who controls more highrises wins' : 'Побеждает игрок, достроивший больше высоток'}</Bullet>
        <Bullet color="var(--gold)">{en ? 'At 5:5 the golden highrise (★) owner wins' : 'При счёте 5:5 побеждает владелец золотой высотки (★)'}</Bullet>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div style={{ textAlign: 'center', padding: 16, background: 'rgba(61,214,140,0.06)', borderRadius: 12, border: '1px solid rgba(61,214,140,0.15)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>6+</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{en ? 'highrises = victory' : 'высоток = победа'}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: 'rgba(255,190,48,0.06)', borderRadius: 12, border: '1px solid rgba(255,190,48,0.15)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>5:5</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{en ? 'golden stand decides' : 'золотая ★ решает'}</div>
          </div>
        </div>
      </Section>

      <Section title={en ? 'Keyboard Shortcuts' : 'Горячие клавиши'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['Enter', en ? 'Confirm move' : 'Подтвердить ход'],
            ['Esc', en ? 'Cancel transfer' : 'Отмена переноса'],
            ['N', en ? 'New game' : 'Новая игра'],
            ['Z', en ? 'Undo (PvP)' : 'Отмена хода (PvP)'],
          ].map(([k, d]) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <kbd style={{ padding: '3px 10px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--surface3)',
                fontSize: 12, fontFamily: 'monospace', color: 'var(--ink)' }}>{k}</kbd>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>{d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={en ? 'Golden Rush — 4-player mode' : 'Golden Rush — режим на 4 игрока'}>
        <Bullet>{en ? '9 stands in a cross layout (1 center + 8 arms, two per player)' : '9 стоек крестом (1 центральная + 8 «рук», по две у каждого игрока)'}</Bullet>
        <Bullet>{en ? 'Each player owns stand «order=1» (near) and «order=2» (far) of their color' : 'У каждого игрока своя стойка «order=1» (ближняя) и «order=2» (дальняя) своего цвета'}</Bullet>
        <Bullet color="#ffc145">{en ? 'Key rule: you cannot close «order=2» while «order=1» is still open' : 'Ключевое правило: дальнюю нельзя замкнуть пока ближняя открыта'}</Bullet>
        <Bullet>{en ? 'Close both your stands → you join the queue for the golden center' : 'Замкнул обе свои стойки → встаёшь в очередь на золотой центр'}</Bullet>
        <Bullet color="#ffc145">{en ? 'First in queue captures the center (+15 points, FIFO)' : 'Первый в очереди замыкает центр (+15 очков, FIFO)'}</Bullet>

        <GoldenRushSchema lang={lang} />

        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface3)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {en ? 'Scoring' : 'Очки'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
            {[
              { v: '+1', l: en ? 'per block' : 'за блок', c: 'var(--ink2)' },
              { v: '+5', l: en ? 'order=1 close' : 'закрытие «1»', c: 'var(--p1)' },
              { v: '+8', l: en ? 'order=2 close' : 'закрытие «2»', c: 'var(--p2)' },
              { v: '+15', l: en ? 'center' : 'центр', c: '#ffc145' },
              { v: '+5', l: en ? '2v2 team bonus' : 'тимбонус 2v2', c: 'var(--green)' },
            ].map((x, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: x.c }}>{x.v}</div>
                <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface3)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {en ? 'Rewards (online only)' : 'Награды (только онлайн)'}
          </div>
          <Bullet color="var(--green)">{en ? '+2 🧱 for participating' : '+2 🧱 за участие'}</Bullet>
          <Bullet color="var(--green)">{en ? '+10 🧱 for winning' : '+10 🧱 за победу'}</Bullet>
          <Bullet color="var(--green)">{en ? '+3 🧱 for capturing the center' : '+3 🧱 за взятие центра'}</Bullet>
          <Bullet color="var(--coral)">{en ? 'Resign mid-game = 0 bricks' : 'Сдался — 0 кирпичей'}</Bullet>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button
            onClick={() => goTab('goldenrush-online')}
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 700,
              background: '#ffc145', color: '#1a1a2e', border: 'none',
              borderRadius: 8, cursor: 'pointer',
            }}
          >
            {en ? 'Play online (2v2 / 4-FFA)' : 'Играть онлайн (2v2 / 4-FFA)'}
          </button>
          <button
            onClick={() => goTab('goldenrush')}
            style={{
              padding: '10px 18px', fontSize: 13,
              background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--ink4)', borderRadius: 8, cursor: 'pointer',
            }}
          >
            {en ? 'Hot-seat demo' : 'Hot-seat демо'}
          </button>
          <button
            onClick={() => goTab('goldenrush-top')}
            style={{
              padding: '10px 18px', fontSize: 13,
              background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--ink4)', borderRadius: 8, cursor: 'pointer',
            }}
          >
            {en ? 'Leaderboard' : 'Лидерборд'}
          </button>
        </div>
      </Section>
    </div>
  )
}
