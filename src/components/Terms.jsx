import { useI18n } from '../engine/i18n'

export default function Terms() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const S = { h3: { fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, marginTop: 20 }, p: { fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, marginBottom: 8 } }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
        {en ? 'Terms of Service' : 'Условия использования'}
      </h2>
      <div className="dash-card" style={{ padding: '24px 28px', marginBottom: 16 }}>
        <p style={S.p}>{en
          ? 'By using Highrise Heist ("the game") you agree to these terms.'
          : 'Используя Highrise Heist («игру»), вы соглашаетесь с этими условиями.'}</p>

        <h3 style={S.h3}>{en ? '1. The game' : '1. Игра'}</h3>
        <p style={S.p}>{en
          ? 'Highrise Heist is a free-to-play strategy board game. We provide the game "as is" without warranties. We may update, modify, or discontinue the game at any time.'
          : 'Highrise Heist — бесплатная стратегическая настольная игра. Мы предоставляем игру «как есть» без гарантий. Мы можем обновлять, изменять или прекращать работу игры в любое время.'}</p>

        <h3 style={S.h3}>{en ? '2. Accounts' : '2. Аккаунты'}</h3>
        <p style={S.p}>{en
          ? 'Registration is optional. If you create an account, you are responsible for keeping your credentials secure. We may suspend or delete accounts that violate these terms. You must be at least 13 years old (16 in the EU) to create an account.'
          : 'Регистрация не обязательна. Если вы создаёте аккаунт, вы отвечаете за безопасность своих данных. Мы можем приостановить или удалить аккаунты, нарушающие условия. Для создания аккаунта нужно быть старше 13 лет (16 в ЕС).'}</p>

        <h3 style={S.h3}>{en ? '3. Fair play' : '3. Честная игра'}</h3>
        <p style={S.p}>{en
          ? 'You agree not to: use bots or automated tools in online games, exploit bugs or vulnerabilities, harass other players, create multiple accounts to manipulate ratings, reverse-engineer the AI or game engine for commercial purposes.'
          : 'Вы обязуетесь не: использовать ботов в онлайн-играх, эксплуатировать баги, оскорблять других игроков, создавать множественные аккаунты для манипуляции рейтингом, реверс-инжинирить AI или движок в коммерческих целях.'}</p>

        <h3 style={S.h3}>{en ? '4. Content' : '4. Контент'}</h3>
        <p style={S.p}>{en
          ? 'Highrise Heist, its AI, game engine, artwork, and mascot (Snappy) are our intellectual property. The Print & Play PDF is provided for personal, non-commercial use. Game replays may be used by us for AI training (anonymized).'
          : 'Highrise Heist, AI, движок, графика и маскот (Снуппи) — наша интеллектуальная собственность. Print & Play PDF предоставляется для личного некоммерческого использования. Записи партий могут использоваться для обучения AI (анонимизированно).'}</p>

        <h3 style={S.h3}>{en ? '5. Limitation of liability' : '5. Ограничение ответственности'}</h3>
        <p style={S.p}>{en
          ? 'The game is provided free of charge. We are not liable for any damages arising from use of the game, including but not limited to data loss, service interruptions, or inaccurate AI analysis.'
          : 'Игра предоставляется бесплатно. Мы не несём ответственности за убытки от использования игры, включая потерю данных, перебои в работе или неточности AI анализа.'}</p>

        <h3 style={S.h3}>{en ? '6. Changes' : '6. Изменения'}</h3>
        <p style={S.p}>{en
          ? 'We may update these terms. Continued use constitutes acceptance.'
          : 'Мы можем обновлять эти условия. Продолжение использования означает согласие.'}</p>

        <h3 style={S.h3}>{en ? '7. Contact' : '7. Контакты'}</h3>
        <p style={S.p}>
          <a href="https://t.me/igor1000rr" style={{ color: 'var(--accent)' }}>t.me/igor1000rr</a>
        </p>
      </div>
      <p style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center' }}>
        {en ? 'Last updated: April 2026' : 'Обновлено: апрель 2026'}
      </p>
    </div>
  )
}
