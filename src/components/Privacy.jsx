import { useI18n } from '../engine/i18n'

export default function Privacy() {
  const { lang } = useI18n()
  const en = lang === 'en'
  const S = { h3: { fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, marginTop: 20 }, p: { fontSize: 13, color: 'var(--ink2)', lineHeight: 1.8, marginBottom: 8 } }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
        {en ? 'Privacy Policy' : 'Политика конфиденциальности'}
      </h2>
      <div className="dash-card" style={{ padding: '24px 28px', marginBottom: 16 }}>
        <p style={S.p}>{en
          ? 'Snatch Highrise ("we", "the game") respects your privacy. This policy explains what data we collect, how we use it, and your rights.'
          : 'Snatch Highrise («мы», «игра») уважает вашу конфиденциальность. Эта политика объясняет какие данные мы собираем, как используем и какие у вас права.'}</p>

        <h3 style={S.h3}>{en ? '1. Data we collect' : '1. Какие данные мы собираем'}</h3>
        <p style={S.p}>{en
          ? 'Account data (optional): username, email, password hash. Game data: statistics, rating, replays, achievements. Technical data: IP address, user-agent, session ID. Analytics: Yandex Metrika (page views, session duration, device type — anonymized). You can play without registration — no personal data is collected.'
          : 'Аккаунт (опционально): никнейм, email, хеш пароля. Игровые данные: статистика, рейтинг, записи партий, ачивки. Технические данные: IP-адрес, user-agent, ID сессии. Аналитика: Яндекс Метрика (просмотры, длительность, устройство — анонимно). Можно играть без регистрации — данные не собираются.'}</p>

        <h3 style={S.h3}>{en ? '2. Cookies and tracking' : '2. Cookies и отслеживание'}</h3>
        <p style={S.p}>{en
          ? 'Authentication cookies (JWT token). Preference cookies (theme, language, sound). Yandex Metrika — third-party analytics by Yandex LLC. Collects anonymized usage data. Opt out: https://yandex.com/support/metrica/general/opt-out.html. Our built-in analytics collects page views and game events. We do NOT use advertising cookies.'
          : 'Cookies авторизации (JWT токен). Cookies настроек (тема, язык, звук). Яндекс Метрика — сторонняя аналитика от Яндекс. Анонимные данные. Отказ: https://yandex.com/support/metrica/general/opt-out.html. Встроенная аналитика: просмотры и события. Рекламных cookies НЕТ.'}</p>

        <h3 style={S.h3}>{en ? '3. Data retention' : '3. Сроки хранения'}</h3>
        <p style={S.p}>{en
          ? 'Account data: until you delete your account. Game replays: anonymized, stored indefinitely for AI training. Analytics events: 90 days. Error reports: 30 days. Server located in Russia.'
          : 'Аккаунт: до удаления. Записи партий: анонимизированы, бессрочно для AI. Аналитика: 90 дней. Ошибки: 30 дней. Сервер в России.'}</p>

        <h3 style={S.h3}>{en ? '4. Your rights (GDPR/CCPA)' : '4. Ваши права (GDPR/CCPA)'}</h3>
        <p style={S.p}>{en
          ? 'Access: export all data as JSON (Profile → Account). Delete: permanently delete account and all data (Profile → Account). Rectify: change username or email. Withdraw consent: stop using the service. Lodge a complaint with a supervisory authority.'
          : 'Доступ: экспорт всех данных в JSON (Профиль → Аккаунт). Удаление: полное удаление аккаунта (Профиль → Аккаунт). Исправление: изменить никнейм или email. Отзыв согласия: прекратить использование. Жалоба в надзорный орган.'}</p>

        <h3 style={S.h3}>{en ? '5. Children\'s privacy' : '5. Дети'}</h3>
        <p style={S.p}>{en
          ? 'We do not knowingly collect data from children under 13 (under 16 in the EU). Children can play without registration. If you believe a child provided personal data, contact us — we will delete it immediately.'
          : 'Мы не собираем данные детей младше 13 лет (16 в ЕС). Дети могут играть без регистрации. Если ребёнок предоставил данные — свяжитесь с нами, удалим немедленно.'}</p>

        <h3 style={S.h3}>{en ? '6. Third parties' : '6. Третьи стороны'}</h3>
        <p style={S.p}>{en
          ? 'We do NOT sell personal data. Data shared only with Yandex Metrika (anonymous analytics). No ads, no social trackers, no data brokers.'
          : 'Мы НЕ продаём данные. Данные только: Яндекс Метрика (анонимно). Без рекламы, без трекеров соцсетей, без брокеров.'}</p>

        <h3 style={S.h3}>{en ? '7. Security' : '7. Безопасность'}</h3>
        <p style={S.p}>{en
          ? 'Passwords hashed with bcrypt. HTTPS only. WebSocket validation. Rate limiting. No system is 100% secure.'
          : 'Пароли: bcrypt. Только HTTPS. Валидация WebSocket. Rate limiting. 100% безопасность не гарантируется.'}</p>

        <h3 style={S.h3}>{en ? '8. Contact' : '8. Контакты'}</h3>
        <p style={S.p}>
          {en ? 'Privacy questions: ' : 'Вопросы: '}
          <a href="https://t.me/igor1000rr" style={{ color: 'var(--accent)' }}>t.me/igor1000rr</a>
        </p>
      </div>
      <p style={{ fontSize: 10, color: 'var(--ink3)', textAlign: 'center' }}>
        {en ? 'Last updated: April 2026' : 'Обновлено: апрель 2026'}
      </p>
    </div>
  )
}
