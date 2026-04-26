/**
 * Верхняя узкая панель: кнопки изменения состояния игры + быстрый доступ
 * к настройкам и магазину скинов.
 *
 *   New game | Undo (опц) | Resign (опц) | Offer draw (опц) | ⚙ Settings | 🎨 City Style
 *
 * Высота в 2 раза меньше основных кнопок — чтобы отличались визуально и
 * случайно не нажимались пальцем при игре. Располагаются НАД GameModeBar
 * (текстовая строка с режимом/сложностью), отдельно от игровых действий.
 *
 * 26.04.2026 — апр ревизия по обратной связи Александра:
 *   "Значок настроек(солнышко) сделать как кнопку Settings справа от кнопок
 *    New game и Resign. Значок изменения тем и блоков сделать как кнопку
 *    справа от Settings. Название City Style. И выделить её, сделать
 *    жёлто-золотой, акцент в сторону монетизации."
 *
 * Settings показывается только на native (на desktop есть селекты mode/diff
 * в GameDesktopControls). City Style — на обеих платформах, открывает SkinShop.
 */
export default function GameActionsTop({
  mode, undoStack, gameOver, t, en,
  isNative,
  onNewGame, onUndo, onResign, onOfferDraw,
  onOpenSettings, onOpenCityStyle,
}) {
  return (
    <div className="actions actions-top">
      <button className="btn btn-compact" onClick={onNewGame} title="N">
        {t('game.newGame')}
      </button>

      {mode === 'pvp' && undoStack.length > 0 && !gameOver && (
        <button
          className="btn btn-compact"
          onClick={onUndo}
          style={{ color: 'var(--gold)', borderColor: '#ffc14540' }}
          aria-label="Undo move"
        >↩ Undo</button>
      )}

      {!gameOver && mode !== 'pvp' && mode !== 'spectate-online' && (
        <button
          className="btn btn-compact"
          onClick={onResign}
          style={{ color: 'var(--p2)', borderColor: '#ff606640' }}
        >
          {t('game.resign')}
        </button>
      )}

      {!gameOver && mode === 'online' && (
        <button
          className="btn btn-compact"
          onClick={onOfferDraw}
          style={{ opacity: 0.6 }}
        >
          {t('game.offerDraw')}
        </button>
      )}

      {/* ─── Settings — справа от New Game/Resign. На desktop у нас уже
          есть селекты в GameDesktopControls, поэтому Settings-кнопка
          актуальна только на native, где раньше была шестерня в углу
          MobileGameBar. ─── */}
      {isNative && onOpenSettings && (mode === 'ai' || mode === 'pvp' || mode === 'spectate') && (
        <button
          className="btn btn-compact"
          onClick={onOpenSettings}
          aria-label={en ? 'Settings' : 'Настройки'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/>
          </svg>
          {en ? 'Settings' : 'Настройки'}
        </button>
      )}

      {/* ─── City Style — золотая, открывает магазин скинов. По ТЗ Александра
          "акцент в сторону монетизации". Показывается на обеих платформах
          (на desktop — рядом с настройками, на native — рядом с Settings).
          Скрыта в spectate-режимах (зрителю незачем менять свои скины
          посреди наблюдения). ─── */}
      {onOpenCityStyle && mode !== 'spectate' && mode !== 'spectate-online' && (
        <button
          className="btn btn-compact"
          onClick={onOpenCityStyle}
          aria-label={en ? 'City Style' : 'Стиль города'}
          style={{
            color: '#2a1a00',
            borderColor: 'var(--gold, #ffc145)',
            background: 'linear-gradient(180deg, var(--gold, #ffc145), color-mix(in srgb, var(--gold, #ffc145) 80%, #d68a00 20%))',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            textShadow: '0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <circle cx="11" cy="11" r="2"/>
          </svg>
          {en ? 'City Style' : 'Стиль города'}
        </button>
      )}
    </div>
  )
}
