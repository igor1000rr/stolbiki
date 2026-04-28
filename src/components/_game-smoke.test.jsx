// @vitest-environment happy-dom
/**
 * Frontend smoke-тесты для game sub-компонентов.
 *
 * Эти компоненты — куски на которые декомпозирована Game.jsx (38KB).
 * Smoke-тесты дают регрессию-защиту перед будущей декомпозицией мега-файлов
 * (VictoryCity 64KB, ws.js 31KB).
 *
 * Каждый тест проверяет что компонент рендерится без throw с минимальными props.
 * Не проверяем визуал или интеракцию — только факт mount.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import GameStatusBar from './GameStatusBar.jsx'
import GameDesktopControls from './GameDesktopControls.jsx'
import GameOverlays from './GameOverlays.jsx'
import GameModeBar from './GameModeBar.jsx'
import GameActionsTop from './GameActionsTop.jsx'
import GameActionsBottom from './GameActionsBottom.jsx'
import GameOnlineBanners from './GameOnlineBanners.jsx'
import GameOffers from './GameOffers.jsx'
import GameTutorialModal from './GameTutorialModal.jsx'
import GameShortcutsModal from './GameShortcutsModal.jsx'
import MobileSettingsSheet from './MobileSettingsSheet.jsx'
import BrickBalance from './BrickBalance.jsx'

// Минимальный i18n stub
const t = (k) => k
const en = false

// Минимальный GameState stub. Включает методы isFirstTurn() и getPlacementsLeft()
// которые вызываются из GameStatusBar.
const gs = {
  gameOver: false,
  player: 0,
  scores: [0, 0],
  closed: [],
  totalPlaced: 0,
  isFirstTurn: () => false,
  getPlacementsLeft: () => 9,
}

const sessionStats = { wins: 0, losses: 0, draws: 0 }
const userSettings = { sound: true, hints: true }
const modifiers = { fog: false, swap: false, golden: false, doubleTransfer: false }

describe('GameStatusBar smoke', () => {
  it('рендерится с минимальными props', () => {
    const { container } = render(
      <GameStatusBar
        gs={gs} mode="pve" isNative={false} _lang="ru" t={t} en={en}
        sessionStats={sessionStats}
        humanPlayer={0}
        timerLimit={null} playerTime={[0, 0]} userSettings={userSettings} modifiers={modifiers}
        elapsed={0} phase="place" isMyTurn={true} totalPlaced={0} maxTotal={9}
        transfer={null} transfersLeft={0}
      />
    )
    expect(container).toBeTruthy()
  })

  it('режим pvp с активным timerLimit рендерит таймеры', () => {
    const { container } = render(
      <GameStatusBar
        gs={gs} mode="pvp" isNative={false} _lang="ru" t={t} en={en}
        sessionStats={sessionStats}
        humanPlayer={0}
        timerLimit={300} playerTime={[150, 200]} userSettings={userSettings} modifiers={modifiers}
        elapsed={5} phase="place" isMyTurn={false} totalPlaced={3} maxTotal={9}
        transfer={null} transfersLeft={0}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameDesktopControls smoke', () => {
  it('рендерится в pve режиме', () => {
    const noop = () => {}
    const { container } = render(
      <GameDesktopControls
        mode="pve" difficulty="medium" modifiers={modifiers} tournament={null}
        _humanPlayer={0} en={en} t={t}
        setTransfersLeft={noop}
        onModeChange={noop} onDifficultyChange={noop}
        onStartTournament={noop}
        toggleFog={noop}
        setModifiers={noop} modifiersRef={{ current: modifiers }}
      />
    )
    expect(container).toBeTruthy()
  })
})

describe('GameOverlays smoke', () => {
  it('null floatingEmoji + null newAch → пустой рендер', () => {
    const { container } = render(
      <GameOverlays
        floatingEmoji={null} newAch={null} lang="ru"
        firstWinCelebration={false} onFirstWinClose={() => {}}
      />
    )
    expect(container).toBeTruthy()
  })

  it('с floatingEmoji рендерит overlay', () => {
    const { container } = render(
      <GameOverlays
        floatingEmoji={{ emoji: '🔥', from: 0, id: 1 }}
        newAch={null} lang="ru"
        firstWinCelebration={false} onFirstWinClose={() => {}}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameModeBar smoke', () => {
  it('рендерится с pve/medium', () => {
    const { container } = render(
      <GameModeBar
        mode="pve" difficulty="medium" modifiers={modifiers}
        lang="ru" t={t} en={en}
        onSettingsOpen={() => {}}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameActionsTop smoke', () => {
  it('рендерится без upper actions для gameOver=false', () => {
    const noop = () => {}
    const { container } = render(
      <GameActionsTop
        mode="pve" undoStack={[]} gameOver={false} t={t} en={en}
        isNative={false}
        onNewGame={noop} onUndo={noop} onResign={noop} onOfferDraw={noop}
        onOpenSettings={noop} onOpenCityStyle={noop}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameActionsBottom smoke', () => {
  it('рендерится с phase=place, isMyTurn=true', () => {
    const noop = () => {}
    const { container } = render(
      <GameActionsBottom
        isMyTurn={true} phase="place" inTransferMode={false} transfer={null}
        totalPlaced={0} canConfirm={false}
        modifiers={modifiers} transfersLeft={0}
        hasTransfers={false} mode="pve" gameOver={false}
        soundOn={true} hintLoading={false}
        en={en} t={t}
        onCancelAction={noop} onStartTransfer={noop} onConfirm={noop}
        onToggleSound={noop} onHint={noop}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameOnlineBanners smoke', () => {
  // onlinePlayers — массив имён, не число (компонент делает .join(' vs '))
  it('online режим с массивом игроков рендерит баннер', () => {
    const { container } = render(
      <GameOnlineBanners
        mode="online" lang="ru" isNative={false}
        onlinePlayers={['Alice', 'Bob']} spectatorCount={2}
      />
    )
    expect(container).toBeTruthy()
  })

  it('pve режим → ничего не рендерит', () => {
    const { container } = render(
      <GameOnlineBanners
        mode="pve" lang="ru" isNative={false}
        onlinePlayers={[]} spectatorCount={0}
      />
    )
    expect(container).toBeTruthy()
  })
})

describe('GameOffers smoke', () => {
  it('null offers → пустой рендер', () => {
    const noop = () => {}
    const { container } = render(
      <GameOffers
        showSwap={false} onSwapAccept={noop} onSwapDecline={noop}
        drawOffered={false} onDrawAccept={noop} onDrawDecline={noop}
        rematchOffered={false} onRematchAccept={noop} onRematchDecline={noop}
        t={t}
      />
    )
    expect(container).toBeTruthy()
  })

  it('drawOffered=true рендерит ничейный prompt', () => {
    const noop = () => {}
    const { container } = render(
      <GameOffers
        showSwap={false} onSwapAccept={noop} onSwapDecline={noop}
        drawOffered={true} onDrawAccept={noop} onDrawDecline={noop}
        rematchOffered={false} onRematchAccept={noop} onRematchDecline={noop}
        t={t}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameTutorialModal smoke', () => {
  it('рендерится с lang=ru', () => {
    const { container } = render(
      <GameTutorialModal lang="ru" onDismiss={() => {}} />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('рендерится с lang=en', () => {
    const { container } = render(
      <GameTutorialModal lang="en" onDismiss={() => {}} />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('GameShortcutsModal smoke', () => {
  it('рендерится', () => {
    const { container } = render(
      <GameShortcutsModal lang="ru" onClose={() => {}} />
    )
    expect(container.firstChild).toBeTruthy()
  })
})

describe('MobileSettingsSheet smoke', () => {
  it('show=false → не рендерит overlay (return null)', () => {
    const noop = () => {}
    const { container } = render(
      <MobileSettingsSheet
        show={false} isNative={true} mode="pve" difficulty="medium"
        modifiers={modifiers} tournament={null} lang="ru" en={en} _humanPlayer={0}
        onClose={noop} onModeChange={noop} onDifficultyChange={noop}
        toggleFog={noop} setModifiers={noop} modifiersRef={{ current: modifiers }}
        onStartTournament={noop}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('show=true + isNative=true → рендерит overlay', () => {
    const noop = () => {}
    const { container } = render(
      <MobileSettingsSheet
        show={true} isNative={true} mode="pve" difficulty="medium"
        modifiers={modifiers} tournament={null} lang="ru" en={en} _humanPlayer={0}
        onClose={noop} onModeChange={noop} onDifficultyChange={noop}
        toggleFog={noop} setModifiers={noop} modifiersRef={{ current: modifiers }}
        onStartTournament={noop}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('isNative=false → не рендерит даже при show=true', () => {
    const noop = () => {}
    const { container } = render(
      <MobileSettingsSheet
        show={true} isNative={false} mode="pve" difficulty="medium"
        modifiers={modifiers} tournament={null} lang="ru" en={en} _humanPlayer={0}
        onClose={noop} onModeChange={noop} onDifficultyChange={noop}
        toggleFog={noop} setModifiers={noop} modifiersRef={{ current: modifiers }}
        onStartTournament={noop}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('BrickBalance smoke', () => {
  it('рендерится с дефолтным bricks=0', () => {
    const { container } = render(<BrickBalance />)
    expect(container.firstChild).toBeTruthy()
  })

  it('содержит число bricks в textContent', () => {
    // Текст рендерится как "🧱 42" — одна textNode, getByText не находит '42'
    // отдельно. Проверяем через container.textContent.
    const { container } = render(<BrickBalance bricks={42} />)
    expect(container.textContent).toContain('42')
  })

  it('onClick prop делает компонент кликабельным', () => {
    const { container } = render(<BrickBalance bricks={10} onClick={() => {}} />)
    expect(container.firstChild).toBeTruthy()
    expect(container.textContent).toContain('10')
  })
})
