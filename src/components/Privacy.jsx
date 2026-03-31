import { useI18n } from '../engine/i18n'

export default function Privacy() {
  const { lang } = useI18n()
  const en = lang === 'en'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
        {en ? 'Privacy Policy' : 'Политика конфиденциальности'}
      </h2>

      <div className="dash-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, marginBottom: 12 }}>
          {en
            ? 'Snatch Highrise respects your privacy. This policy explains what data we collect and how we use it.'
            : 'Snatch Highrise уважает вашу конфиденциальность. Эта политика объясняет какие данные мы собираем и как их используем.'}
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, marginTop: 16 }}>
          {en ? 'Data we collect' : 'Какие данные мы собираем'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>
          {en
            ? 'Username and password (optional, for online play). Game statistics (wins, losses, rating). Game replays for AI training (anonymized).'
            : 'Никнейм и пароль (опционально, для онлайн-игры). Игровая статистика (победы, поражения, рейтинг). Записи партий для обучения AI (анонимизированные).'}
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, marginTop: 16 }}>
          {en ? 'Data storage' : 'Хранение данных'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>
          {en
            ? 'Your data is stored on our server and in your device\'s local storage. You can play without registration — all data stays on your device.'
            : 'Данные хранятся на нашем сервере и в локальном хранилище устройства. Можно играть без регистрации — все данные останутся на устройстве.'}
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, marginTop: 16 }}>
          {en ? 'Third parties' : 'Третьи стороны'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>
          {en
            ? 'We do not sell or share your personal data with third parties. No ads, no trackers.'
            : 'Мы не продаём и не передаём ваши данные третьим лицам. Без рекламы, без трекеров.'}
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, marginTop: 16 }}>
          {en ? 'Contact' : 'Контакты'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8 }}>
          {en ? 'Questions? Contact us at ' : 'Вопросы? Пишите: '}
          <a href="https://t.me/igor1000rr" style={{ color: 'var(--accent)' }}>t.me/igor1000rr</a>
        </p>
      </div>

      <p style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center' }}>
        {en ? 'Last updated: March 2026' : 'Обновлено: март 2026'}
      </p>
    </div>
  )
}
