/**
 * Все три offer-баннера в одном месте:
 * - swap prompt (единственный тур-1 когда доступен swap)
 * - draw offer (противник предложил ничью)
 * - rematch offer (после партии, противник предложил новую партию)
 *
 * Вся логика реакции на кнопки снаружи — через callback'и.
 */
export default function GameOffers({
  // swap prompt
  showSwap, onSwapAccept, onSwapDecline,
  // draw
  drawOffered, onDrawAccept, onDrawDecline,
  // rematch
  rematchOffered, onRematchAccept, onRematchDecline,
  // i18n
  t,
}) {
  return (
    <>
      {showSwap && (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            {t('game.swapQuestion')}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={onSwapAccept}
              style={{ borderColor: 'var(--purple)', color: 'var(--purple)', padding: '10px 20px' }}
            >
              Swap
            </button>
            <button
              className="btn"
              onClick={onSwapDecline}
              style={{ fontSize: 12, padding: '10px 16px' }}
            >
              {t('game.noContinue')}
            </button>
          </div>
        </div>
      )}

      {drawOffered && (
        <div style={{
          textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(155,89,182,0.08)', borderRadius: 10,
          border: '1px solid rgba(155,89,182,0.2)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            {t('game.drawOfferReceived')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={onDrawAccept}
              style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
            >
              {t('game.accept')}
            </button>
            <button className="btn" onClick={onDrawDecline} style={{ fontSize: 12 }}>
              {t('game.decline')}
            </button>
          </div>
        </div>
      )}

      {rematchOffered && (
        <div style={{
          textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(61,214,140,0.08)', borderRadius: 10,
          border: '1px solid rgba(61,214,140,0.2)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>
            {t('game.rematchOffer')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              className="btn"
              onClick={onRematchAccept}
              style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
            >
              {t('game.accept')}
            </button>
            <button className="btn" onClick={onRematchDecline} style={{ fontSize: 12 }}>
              {t('game.decline')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
