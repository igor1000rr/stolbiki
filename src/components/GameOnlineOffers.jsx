/**
 * Баннеры предложений в online-режиме: ничья во время партии и рематч после неё.
 */
export default function GameOnlineOffers({
  drawOffered, rematchOffered, gs, mode, t,
  onDrawAccept, onDrawDecline,
  onRematchAccept, onRematchDecline,
}) {
  return (
    <>
      {drawOffered && !gs.gameOver && mode === 'online' && (
        <div style={{
          textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(155,89,182,0.08)', borderRadius: 10,
          border: '1px solid rgba(155,89,182,0.2)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{t('game.drawOfferReceived')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={onDrawAccept} style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>{t('game.accept')}</button>
            <button className="btn" onClick={onDrawDecline} style={{ fontSize: 12 }}>{t('game.decline')}</button>
          </div>
        </div>
      )}

      {rematchOffered && gs.gameOver && mode === 'online' && (
        <div style={{
          textAlign: 'center', margin: '8px 0', padding: '10px 16px',
          background: 'rgba(61,214,140,0.08)', borderRadius: 10,
          border: '1px solid rgba(61,214,140,0.2)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>{t('game.rematchOffer')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={onRematchAccept} style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>{t('game.accept')}</button>
            <button className="btn" onClick={onRematchDecline} style={{ fontSize: 12 }}>{t('game.decline')}</button>
          </div>
        </div>
      )}
    </>
  )
}
