import { useI18n } from '../engine/i18n'
import Mascot from './Mascot'

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

// SVG-схема переноса
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

// SVG-схема закрытия
function CloseSchema({ lang }) {
  const en = lang === 'en'
  return (
    <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--surface3)', marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 10 }}>
        {en ? 'Completion example' : 'Пример достройки'}
      </div>
      <svg viewBox="0 0 360 155" style={{ width: '100%', maxWidth: 400, display: 'block', margin: '0 auto' }}>
        {/* Левая стойка — До (8 фишек: 5 синих + 3 красных) */}
        <rect x={20} y={15} width={50} height={112} rx={6} fill="none" stroke="var(--surface3)" strokeWidth={1.5} />
        <text x={45} y={10} textAnchor="middle" fontSize={10} fill="var(--ink3)">{en ? 'Before' : 'До'}</text>
        {[0,1,2,3,4].map(i => <rect key={`b${i}`} x={28} y={110 - i*12} width={34} height={9} rx={3} fill="var(--p1)" opacity={0.7} />)}
        {[0,1,2].map(i => <rect key={`r${i}`} x={28} y={50 - i*12} width={34} height={9} rx={3} fill="var(--p2)" opacity={0.7} />)}
        <text x={45} y={145} textAnchor="middle" fontSize={9} fill="var(--ink3)">8/11</text>

        <text x={105} y={70} fontSize={10} fill="var(--gold)">+3</text>
        <line x1={120} y1={80} x2={190} y2={80} stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4,3" />
        <polygon points="190,75 200,80 190,85" fill="var(--gold)" />

        {/* Правая стойка — Закрыта (11 фишек) */}
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

export default function Rules() {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      <Section title={en ? 'Game Rules "Snatch Highrise"' : 'Правила игры «Перехват высотки»'}>
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
          <Bullet>{en ? 'The top group of same-color blocks transfers whole — cannot split' : 'Переносится верхняя группа блоков одного цвета — группа переносится целиком, делить её нельзя'}</Bullet>
          <Bullet>{en ? "Can transfer your blocks and opponent's blocks" : 'Можно переносить свои блоки и блоки соперника'}</Bullet>
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
    </div>
  )
}
