// @vitest-environment happy-dom
/**
 * Frontend smoke-тесты: проверяем что компоненты рендерятся без throw.
 *
 * Цель — поймать регрессии типа «prop потерялся, компонент ломается при mount».
 * Не проверяют визуальный вывод или интеракцию — только факт рендера.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import HintPanel from './HintPanel.jsx'
import SwapPrompt from './SwapPrompt.jsx'
import StreakPopup from './StreakPopup.jsx'
import MobileGameBar from './MobileGameBar.jsx'
import QRCode from './QRCode.jsx'
import Mascot from './Mascot.jsx'
import ConfettiOverlay from './ConfettiOverlay.jsx'
import CookieBanner from './CookieBanner.jsx'
import ModifierBadge from './ModifierBadge.jsx'
import AchievementRarityBadge from './AchievementRarityBadge.jsx'
import TournamentBanner from './TournamentBanner.jsx'
import LazyFallback from './LazyFallback.jsx'
import GameLog from './GameLog.jsx'
import GameTimers from './GameTimers.jsx'
import GameScoreboard from './GameScoreboard.jsx'
import GameReactions from './GameReactions.jsx'
import GameEmojiReactions from './GameEmojiReactions.jsx'

describe('HintPanel smoke', () => {
  it('null hint → ничего не рендерит', () => {
    const { container } = render(<HintPanel hint={null} lang="ru" />)
    expect(container.firstChild).toBeNull()
  })

  it('рендерит hint с explanation lines', () => {
    const hint = { explanation: ['line1', 'line2'] }
    const { getByText } = render(<HintPanel hint={hint} lang="ru" />)
    expect(getByText('line1')).toBeTruthy()
    expect(getByText('line2')).toBeTruthy()
    expect(getByText('Подсказка')).toBeTruthy()
  })

  it('lang=en → заголовок Hint', () => {
    const { getByText } = render(<HintPanel hint={{ explanation: ['x'] }} lang="en" />)
    expect(getByText('Hint')).toBeTruthy()
  })
})

describe('SwapPrompt smoke', () => {
  it('show=false → null', () => {
    const { container } = render(<SwapPrompt show={false} t={k => k} onSwap={() => {}} onDecline={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('show=true → рендерит кнопку Swap', () => {
    const { getByText } = render(<SwapPrompt show={true} t={k => k} onSwap={() => {}} onDecline={() => {}} />)
    expect(getByText('Swap')).toBeTruthy()
  })
})

describe('StreakPopup smoke', () => {
  it('рендерит стрик 3 дня', () => {
    const { container } = render(<StreakPopup lang="ru" streak={3} best={5} />)
    expect(container.textContent).toMatch(/3/)
    expect(container.textContent).toMatch(/дня подряд/)
  })

  it('lang=en → английский текст', () => {
    const { container } = render(<StreakPopup lang="en" streak={7} best={10} />)
    expect(container.textContent).toMatch(/day streak/)
  })

  it('streakXP показывается если задан', () => {
    const { container } = render(<StreakPopup lang="ru" streak={2} best={3} streakXP={50} />)
    expect(container.textContent).toMatch(/\+50/)
  })
})

describe('MobileGameBar smoke', () => {
  it('рендерится без падения с пустыми props', () => {
    expect(() => render(<MobileGameBar />)).not.toThrow()
  })
})

describe('QRCode smoke', () => {
  it('пустой url → не крашится', () => {
    expect(() => render(<QRCode value="" />)).not.toThrow()
  })

  it('валидный url → рендерит img', () => {
    const { container } = render(<QRCode value="https://example.com" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
  })
})

describe('Mascot smoke', () => {
  it('без props → рендерит', () => {
    expect(() => render(<Mascot />)).not.toThrow()
  })
})

describe('ConfettiOverlay smoke', () => {
  it('show=false → не крашится', () => {
    expect(() => render(<ConfettiOverlay show={false} />)).not.toThrow()
  })

  it('show=true → рендерит', () => {
    expect(() => render(<ConfettiOverlay show={true} />)).not.toThrow()
  })
})

describe('CookieBanner smoke', () => {
  it('рендерится без throw', () => {
    expect(() => render(<CookieBanner onAccept={() => {}} onDecline={() => {}} t={k => k} />)).not.toThrow()
  })
})

describe('ModifierBadge smoke', () => {
  it('без props → не крашится', () => {
    expect(() => render(<ModifierBadge />)).not.toThrow()
  })
})

describe('AchievementRarityBadge smoke', () => {
  it('common тема', () => {
    expect(() => render(<AchievementRarityBadge tier="common" percentage={50} lang="ru" />)).not.toThrow()
  })

  it('legendary тема', () => {
    expect(() => render(<AchievementRarityBadge tier="legendary" percentage={0.5} lang="ru" />)).not.toThrow()
  })
})

describe('TournamentBanner smoke', () => {
  it('без props → не крашится', () => {
    expect(() => render(<TournamentBanner t={k => k} />)).not.toThrow()
  })
})

describe('LazyFallback smoke', () => {
  it('рендерится', () => {
    expect(() => render(<LazyFallback />)).not.toThrow()
  })
})

describe('GameLog smoke', () => {
  it('пустой log массив', () => {
    expect(() => render(<GameLog log={[]} />)).not.toThrow()
  })

  it('несколько записей', () => {
    expect(() => render(<GameLog log={['move 1', 'move 2']} />)).not.toThrow()
  })
})

describe('GameTimers smoke', () => {
  it('без props не крашится', () => {
    expect(() => render(<GameTimers timer1={300} timer2={300} />)).not.toThrow()
  })
})

describe('GameScoreboard smoke', () => {
  it('рендерится', () => {
    expect(() => render(<GameScoreboard scores={[0, 0]} totalGames={3} currentGame={1} t={k => k} />)).not.toThrow()
  })
})

describe('GameReactions smoke', () => {
  it('без props не крашится', () => {
    expect(() => render(<GameReactions />)).not.toThrow()
  })
})

describe('GameEmojiReactions smoke', () => {
  it('рендерится с onSend callback', () => {
    expect(() => render(<GameEmojiReactions onSend={() => {}} />)).not.toThrow()
  })
})
