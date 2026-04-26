import { isGpuReady } from '../engine/neuralnet'

/**
 * GameModeBar — текстовая строка под игровыми кнопками с режимом игры,
 * сложностью и активными модификаторами. По обратной связи Александра
 * (апр 2026):
 *
 *   "Сложность сейчас записывается отдельно слева. Предлагаю режим игры
 *    и сложность записать посередине экрана под кнопками тем же шрифтом.
 *    Формат Player vs AI • Medium. Получится примерно у кнопки Settings,
 *    игрок поймёт, что там можно будет менять. Ну и значки модификаторов
 *    в этой же строке будут появляться".
 *
 * Заменил старый MobileGameBar (бейдж сложности слева + кнопка шестерни).
 * Теперь шестерня — отдельная кнопка Settings в GameActionsTop, а здесь
 * только описание текущего состояния партии. Кликабельность строки тоже
 * открывает Settings — ещё один способ дотянуться.
 *
 * Не показывается в online-режиме — там режим/сложность не редактируются
 * локальным игроком. Вместо этого выше доски рендерится GameOnlineBanners.
 */
export default function GameModeBar({
  mode, difficulty, modifiers, lang, t, en,
  onSettingsOpen,
}) {
  if (mode === 'online' || mode === 'spectate-online') return null

  // Mode label
  const modeLabel =
    mode === 'pvp'      ? (en ? 'Player vs Player' : 'Игрок vs Игрок') :
    mode === 'spectate' ? (en ? 'AI vs AI' : 'AI vs AI') :
                          (en ? 'Player vs AI' : 'Игрок vs AI')

  // Difficulty label — только для AI-режима
  const diffLabel = mode === 'ai'
    ? (difficulty >= 1500 ? (en ? 'Hardcore' : 'Хардкор') :
       difficulty >= 800  ? (en ? 'Extreme'  : 'Экстрим') :
       difficulty >= 400  ? t('game.hard')   :
       difficulty >= 150  ? t('game.medium') : t('game.easy'))
    : null

  return (
    <div
      onClick={onSettingsOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSettingsOpen?.() } }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 12px',
        margin: '4px 0 8px',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--ink2)',         /* как у New Game — Александр просил темнее */
        cursor: onSettingsOpen ? 'pointer' : 'default',
        flexWrap: 'wrap',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'opacity 0.15s',
      }}
      title={en ? 'Tap to change' : 'Нажми чтобы изменить'}
    >
      <span>{modeLabel}</span>
      {diffLabel && (
        <>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>{diffLabel}</span>
          {isGpuReady() && (
            <span style={{
              fontSize: 9, color: 'var(--green)',
              padding: '1px 5px', borderRadius: 4,
              background: 'rgba(61,214,140,0.1)',
              border: '1px solid rgba(61,214,140,0.2)',
            }}>GPU</span>
          )}
        </>
      )}

      {/* Активные модификаторы — Fog / 2x Transfer / Auto-pass.
          Стиль одинаковый для всех, но цвет своего бейджа. Убран жирный шрифт
          ради соответствия стилю строки. */}
      {(modifiers.fog || modifiers.doubleTransfer || modifiers.blitz) && (
        <span style={{ opacity: 0.4 }}>•</span>
      )}
      {modifiers.fog && (
        <span style={{
          fontSize: 11, color: '#4a9eff',
          padding: '1px 6px', borderRadius: 4,
          background: 'rgba(74,158,255,0.1)',
        }}>🌫 {en ? 'Fog' : 'Туман'}</span>
      )}
      {modifiers.doubleTransfer && (
        <span style={{
          fontSize: 11, color: '#9b59b6',
          padding: '1px 6px', borderRadius: 4,
          background: 'rgba(155,89,182,0.1)',
        }}>⇄×2</span>
      )}
      {modifiers.blitz && (
        <span style={{
          fontSize: 11, color: '#ff9800',
          padding: '1px 6px', borderRadius: 4,
          background: 'rgba(255,152,0,0.1)',
        }}>⚡ {en ? 'Blitz' : 'Блиц'}</span>
      )}

      {/* Подсказка ⚙ — намёк что строка кликабельна. На native откроется
          MobileSettingsSheet; на desktop callback может быть пустым (есть
          селекты в GameDesktopControls), тогда скрываем подсказку. */}
      {onSettingsOpen && (
        <span style={{ opacity: 0.35, fontSize: 11, marginLeft: 2 }}>⚙</span>
      )}
    </div>
  )
}
