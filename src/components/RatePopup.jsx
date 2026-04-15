import { markRatingAsked } from '../engine/appstore'

/**
 * Поп-ап "Оцените в Google Play" — показывается на native платформе после
 * shouldAskRating() === true. Родитель отвечает за тайминг показа,
 * компонент отвечает за UI и вызов markRatingAsked() в любой ветке закрытия.
 */
export default function RatePopup({ lang, onClose }) {
  const en = lang === 'en'
  const close = () => { markRatingAsked(); onClose() }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={close}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--gold)"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
          {en ? 'Enjoying Highrise Heist?' : 'Нравится Highrise Heist?'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 20, lineHeight: 1.5 }}>
          {en ? 'Rate us on Google Play! It helps a lot.' : 'Оцените нас в Google Play! Это очень помогает.'}
        </p>
        <button onClick={close} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: 'var(--gold)', color: 'var(--bg)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
          {en ? 'Rate now' : 'Оценить'}
        </button>
        <button onClick={close} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'none', color: 'var(--ink3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          {en ? 'Maybe later' : 'Позже'}
        </button>
      </div>
    </div>
  )
}
