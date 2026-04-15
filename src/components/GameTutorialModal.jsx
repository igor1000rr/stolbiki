const isNative = !!window.Capacitor?.isNativePlatform?.()

/**
 * Онбординговая модалка "Как играть". Показывается один раз при первом заходе.
 * Вынесена из Game.jsx ради распила.
 */
export default function GameTutorialModal({ lang, onDismiss }) {
  const en = lang === 'en'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isNative ? 12 : 20, overflowY: 'auto' }}
      onClick={onDismiss}>
      <div style={{ maxWidth: 420, width: '100%', background: 'var(--surface)', borderRadius: 16, padding: isNative ? '20px 16px' : '28px 24px', border: '1px solid var(--surface3)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', margin: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: isNative ? 10 : 16 }}>
          <img src="/logo-text.webp" alt="Highrise Heist" style={{ width: 180, height: 'auto', marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{en ? 'How to play' : 'Как играть'}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.9 }}>
          {en ? <>
            <p><b style={{ color: 'var(--p1-light)' }}>1.</b> <b>Click stands</b> to place blocks (up to 3 on 2 stands)</p>
            <p><b style={{ color: 'var(--p1-light)' }}>2.</b> <b>Transfer</b> — hold a stand to start transfer, tap destination</p>
            <p><b style={{ color: 'var(--p1-light)' }}>3.</b> <b>Completing</b> — stand with 11 blocks is complete. Top group color = owner</p>
            <p><b style={{ color: 'var(--gold)' }}>★</b> <b>Golden stand</b> breaks 5:5 ties</p>
            <p>Close <b>6+ stands</b> out of 10 to win</p>
          </> : <>
            <p><b style={{ color: 'var(--p1-light)' }}>1.</b> <b>Кликайте на стойки</b> чтобы ставить блоки (до 3 на 2 стойки)</p>
            <p><b style={{ color: 'var(--p1-light)' }}>2.</b> <b>Перенос</b> — удержите стойку (long press) → тапните цель</p>
            <p><b style={{ color: 'var(--p1-light)' }}>3.</b> <b>Достройка</b> — высотка с 11 блоками достроена. Цвет верхней группы = владелец</p>
            <p><b style={{ color: 'var(--gold)' }}>★</b> <b>Золотая стойка</b> решает при ничьей 5:5</p>
            <p>Достройте <b>6+ высоток</b> из 10 чтобы победить</p>
          </>}
        </div>
        <button className="btn primary" onClick={onDismiss} style={{ width: '100%', marginTop: 16, padding: '12px 0' }}>
          {en ? "Got it, let's play!" : 'Понятно, играем!'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--ink3)' }}>
          {en ? 'Detailed rules — Rules tab' : 'Подробные правила — вкладка «Правила»'}
        </div>
      </div>
    </div>
  )
}
