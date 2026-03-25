import { useI18n } from '../engine/i18n'

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

// SVG-схема переноса (статичная)
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
        {en ? '3 red chips transfer from A to B as a group' : '3 красные фишки переносятся со стойки A на B целиком'}
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
        {en ? 'Closing example' : 'Пример закрытия'}
      </div>
      <svg viewBox="0 0 360 130" style={{ width: '100%', maxWidth: 400, display: 'block', margin: '0 auto' }}>
        <rect x={20} y={20} width={50} height={95} rx={6} fill="none" stroke="var(--surface3)" strokeWidth={1.5} />
        <text x={45} y={14} textAnchor="middle" fontSize={10} fill="var(--ink3)">{en ? 'Before' : 'До'}</text>
        {[0,1,2,3,4].map(i => <rect key={`b${i}`} x={28} y={92 - i*12} width={34} height={9} rx={3} fill="var(--p1)" opacity={0.7} />)}
        {[0,1,2].map(i => <rect key={`r${i}`} x={28} y={32 - i*12 + 20} width={34} height={9} rx={3} fill="var(--p2)" opacity={0.7} />)}
        <text x={45} y={126} textAnchor="middle" fontSize={9} fill="var(--ink3)">8/11</text>

        <text x={105} y={55} fontSize={10} fill="var(--gold)">+3</text>
        <line x1={120} y1={65} x2={190} y2={65} stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4,3" />
        <polygon points="190,60 200,65 190,70" fill="var(--gold)" />

        <rect x={210} y={20} width={50} height={95} rx={6} fill="rgba(61,214,140,0.08)" stroke="var(--green)" strokeWidth={1.5} />
        <text x={235} y={14} textAnchor="middle" fontSize={10} fill="var(--green)">{en ? 'Closed' : 'Закрыта'}</text>
        {Array.from({length: 11}).map((_, i) => <rect key={`f${i}`} x={218} y={103 - i*7.5} width={34} height={6} rx={2} fill={i >= 8 ? 'var(--p2)' : 'var(--p1)'} opacity={0.5} />)}
        <text x={235} y={126} textAnchor="middle" fontSize={9} fill="var(--green)">11/11</text>

        <text x={300} y={55} fontSize={10} fill="var(--ink2)">{en ? 'Owner:' : 'Владелец:'}</text>
        <rect x={285} y={62} width={34} height={10} rx={3} fill="var(--p2)" opacity={0.8} />
        <text x={302} y={86} textAnchor="middle" fontSize={9} fill="var(--p2-light)">{en ? 'top color' : 'верхний цвет'}</text>
      </svg>
    </div>
  )
}

export default function Rules() {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      <Section title={en ? 'Game Rules "Stacks"' : 'Правила игры «Стойки»'}>
        <Bullet>{en ? 'Strategic board game for two players' : 'Стратегическая настольная игра для двух игроков'}</Bullet>
        <Bullet>{en ? 'Players compete for control of stands' : 'Игроки соревнуются за контроль стоек'}</Bullet>
        <Bullet>{en ? 'A stand belongs to a player if their chip is on top (the stand is considered closed)' : 'Стойка принадлежит игроку, если фишка его цвета установлена на вершине (стойка считается закрытой)'}</Bullet>
        <Bullet>{en ? 'The player who closed more stands wins' : 'Побеждает игрок, который закрыл больше стоек к концу игры'}</Bullet>
        <Bullet color="var(--gold)">{en ? 'If both players closed 5 stands, the golden stand owner wins' : 'Если оба игрока закрыли по 5 стоек, победителем становится игрок, закрывший золотую стойку'}</Bullet>
      </Section>

      <Section title={en ? 'Turn' : 'Ход'}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.7, marginBottom: 16 }}>
          {en ? "A player's turn consists of two phases, executed in order:" : 'Ход игрока состоит из двух фаз, которые выполняются по порядку:'}
        </p>

        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(74,158,255,0.04)', border: '1px solid rgba(74,158,255,0.12)', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--p1)', marginBottom: 8 }}>
            {en ? 'Phase 1: Transfer' : 'Фаза 1: Перенос'}
          </div>
          <Bullet>{en ? 'Can make one transfer or skip this action' : 'Можно сделать один перенос или пропустить это действие'}</Bullet>
          <Bullet>{en ? 'The top continuous group of same-color chips transfers from one stand to another' : 'Переносится верхняя непрерывная группа фишек одного цвета с одной стойки на другую'}</Bullet>
          <Bullet>{en ? 'The group transfers whole — cannot split' : 'Группа переносится целиком — делить нельзя'}</Bullet>
          <Bullet>{en ? 'Can transfer your chips and opponent\'s chips' : 'Можно переносить свои фишки и фишки соперника'}</Bullet>
          <Bullet>{en ? 'Target: empty stand or stand with same color on top' : 'Куда: на пустую стойку или на фишки такого же цвета сверху'}</Bullet>
          <Bullet>{en ? 'Max 11 chips on a stand. If more after transfer — excess removed' : 'На стойке максимум 11 фишек. Если после переноса больше 11 — лишние удаляются из игры'}</Bullet>
        </div>

        <TransferSchema lang={lang} />

        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(240,96,64,0.04)', border: '1px solid rgba(240,96,64,0.12)', marginTop: 20, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
            {en ? 'Phase 2: Placement' : 'Фаза 2: Установка'}
          </div>
          <Bullet>{en ? 'After transfer, the player places their chips' : 'После переноса игрок может поставить свои фишки'}</Bullet>
          <Bullet>{en ? 'Can place 1 to 3 chips per turn' : 'Можно поставить от 1 до 3 фишек за ход'}</Bullet>
          <Bullet>{en ? 'Chips can be placed on max 2 stands' : 'Фишки можно поставить максимум на 2 стойки'}</Bullet>
          <Bullet color="var(--gold)">{en ? 'First move of the game — only 1 chip' : 'Первый ход игры — только 1 фишка'}</Bullet>
        </div>
      </Section>

      <Section title={en ? 'Closing Stands' : 'Закрытие стоек'}>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(61,214,140,0.04)', border: '1px solid rgba(61,214,140,0.12)', marginBottom: 14 }}>
          <Bullet>{en ? 'A stand can only be closed by transfer (with one exception)' : 'Стойку можно закрыть только переносом (кроме исключения)'}</Bullet>
          <Bullet>{en ? 'After transfer the stand reaches 11 chips — it closes' : 'После переноса стойка достигает 11 фишек → закрывается'}</Bullet>
          <Bullet>{en ? 'Owner = color of the top group' : 'Владелец = цвет верхней группы'}</Bullet>
          <Bullet>{en ? 'Excess chips are removed' : 'Лишние фишки удаляются'}</Bullet>
        </div>
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,190,48,0.04)', border: '1px solid rgba(255,190,48,0.12)', marginBottom: 14, fontSize: 13, color: 'var(--ink2)' }}>
          <b style={{ color: 'var(--gold)' }}>{en ? 'Exception: ' : 'Исключение: '}</b>
          {en ? 'When only 2 stands remain open, you can close a stand by placement (filling to 11).' : 'Когда осталось только 2 открытых стойки, можно закрыть стойку установкой (заполнив до 11).'}
        </div>
        <CloseSchema lang={lang} />
      </Section>

      <Section title={en ? 'First Move Balance' : 'Баланс первого хода'}>
        <Bullet>{en ? 'Needed to balance the first player\'s advantage' : 'Баланс нужен, чтобы уравновесить преимущество первого игрока'}</Bullet>
        <Bullet>{en ? 'In the first turn, only 1 chip can be placed' : 'В первый ход можно поставить только 1 фишку'}</Bullet>
        <Bullet>{en ? 'After that, the second player can: play their color OR swap colors' : 'После этого второй игрок может: играть своим цветом или поменяться цветами'}</Bullet>
      </Section>

      <Section title={en ? 'Victory' : 'Победа'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ textAlign: 'center', padding: 16, background: 'rgba(61,214,140,0.06)', borderRadius: 12, border: '1px solid rgba(61,214,140,0.15)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>6+</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{en ? 'stands = victory' : 'стоек = победа'}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: 'rgba(255,190,48,0.06)', borderRadius: 12, border: '1px solid rgba(255,190,48,0.15)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>5:5</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{en ? 'golden stand decides' : 'золотая стойка решает'}</div>
          </div>
        </div>
      </Section>

      <Section title={en ? 'Strategy' : 'Стратегия'}>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 12, fontStyle: 'italic' }}>
          {en ? 'Data based on AI research · 239K+ games analyzed' : 'Данные предоставлены на основании AI-исследования · 239K+ партий'}
        </p>
        {(en ? [
          'Golden stand is priority #1. 77% of ties are decided by golden.',
          'Transfer is the key mechanic. Most stands close via transfer.',
          'Swap rule. If P1 placed on golden — consider swap.',
          'Control. Early capture of 3-4 stands = strategic advantage.',
          'Diversify. Place on different stands — don\'t stack all in one.',
        ] : [
          'Золотая стойка — приоритет №1. 77% ничьих решает золотая.',
          'Перенос — главная механика. Большинство стоек закрываются переносом.',
          'Swap. Если П1 поставил на золотую — рассмотрите swap.',
          'Контроль. Ранний захват 3-4 стоек = стратегическое преимущество.',
          'Разнообразие. Ставьте на разные стойки — не складывайте все в одну.',
        ]).map((t, i) => <Bullet key={i}>{t}</Bullet>)}
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
