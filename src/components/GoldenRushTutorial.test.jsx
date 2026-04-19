// @vitest-environment happy-dom
/**
 * Компонентные тесты для GoldenRushTutorial.
 * Использует @testing-library/react + happy-dom через per-file pragma.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GoldenRushTutorial from './GoldenRushTutorial.jsx'

afterEach(() => cleanup())

describe('GoldenRushTutorial — базовый рендер', () => {
  it('renders first step by default (RU)', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    expect(screen.getByText(/Твоё поле/)).toBeTruthy()
  })

  it('shows step counter "1 / 4" on first step', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    expect(screen.getByText(/Golden Rush.*1.*\/.*4/)).toBeTruthy()
  })

  it('shows «next» button (RU label) but no «back» on first step', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    expect(screen.getByText('Дальше')).toBeTruthy()
    expect(screen.queryByText('←')).toBe(null)
  })

  it('EN mode renders English labels', () => {
    render(<GoldenRushTutorial lang="en" onClose={() => {}} />)
    expect(screen.getByText(/Your board/)).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })
})

describe('GoldenRushTutorial — навигация', () => {
  it('clicking Next advances to step 2', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    fireEvent.click(screen.getByText('Дальше'))
    expect(screen.getByText(/У тебя две стойки/)).toBeTruthy()
    expect(screen.getByText(/2.*\/.*4/)).toBeTruthy()
  })

  it('clicking Next twice advances to step 3 (queue)', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    fireEvent.click(screen.getByText('Дальше'))
    fireEvent.click(screen.getByText('Дальше'))
    // Заголовок: "Замкнул обе — вставай в очередь на центр"
    expect(screen.getByText(/Замкнул обе/)).toBeTruthy()
  })

  it('Back button (←) appears from step 2+', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    fireEvent.click(screen.getByText('Дальше'))
    expect(screen.getByText('←')).toBeTruthy()
  })

  it('Back button returns to previous step', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    fireEvent.click(screen.getByText('Дальше'))
    fireEvent.click(screen.getByText('Дальше'))
    expect(screen.getByText(/3.*\/.*4/)).toBeTruthy()
    fireEvent.click(screen.getByText('←'))
    expect(screen.getByText(/2.*\/.*4/)).toBeTruthy()
    expect(screen.getByText(/У тебя две стойки/)).toBeTruthy()
  })

  it('step indices stay in bounds — no underflow past step 1', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    expect(screen.queryByText('←')).toBe(null)
    expect(screen.getByText(/1.*\/.*4/)).toBeTruthy()
  })
})

describe('GoldenRushTutorial — последний шаг и onClose', () => {
  it('on last step Next button text changes to «Понятно, искать матч» (RU)', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText(/Дальше|Понятно/))
    expect(screen.getByText(/Понятно, искать матч/)).toBeTruthy()
  })

  it('on last step Next text is «Got it, find match» (EN)', () => {
    render(<GoldenRushTutorial lang="en" onClose={() => {}} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText(/Next|Got it/))
    expect(screen.getByText(/Got it, find match/)).toBeTruthy()
  })

  it('clicking final Next fires onClose', () => {
    const onClose = vi.fn()
    render(<GoldenRushTutorial lang="ru" onClose={onClose} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText(/Дальше/))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(/Понятно, искать матч/))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('X close button fires onClose', () => {
    const onClose = vi.fn()
    render(<GoldenRushTutorial lang="ru" onClose={onClose} />)
    const closeBtn = screen.getByLabelText('close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<GoldenRushTutorial lang="ru" onClose={onClose} />)
    const backdrop = container.firstChild
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('modal body click does NOT fire onClose (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<GoldenRushTutorial lang="ru" onClose={onClose} />)
    fireEvent.click(screen.getByText(/Твоё поле/))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('GoldenRushTutorial — SVG схема', () => {
  it('step 1 (без schema) — схема не рендерится', () => {
    const { container } = render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    expect(container.querySelector('svg')).toBe(null)
  })

  it('step 2+ рендерит SVG схему', () => {
    const { container } = render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    fireEvent.click(screen.getByText('Дальше'))
    expect(container.querySelector('svg')).not.toBe(null)
  })

  it('star (★) renders in schema as center marker', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    fireEvent.click(screen.getByText('Дальше'))
    expect(screen.getByText('★')).toBeTruthy()
  })
})

describe('GoldenRushTutorial — шаги и контент', () => {
  it('all 4 RU steps have unique titles', () => {
    const titles = new Set()
    const { unmount } = render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    titles.add(screen.getByRole('heading', { level: 3 }).textContent)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText(/Дальше|Понятно/))
      titles.add(screen.getByRole('heading', { level: 3 }).textContent)
    }
    expect(titles.size).toBe(4)
    unmount()
  })

  it('last step mentions rewards (+15 центр)', () => {
    render(<GoldenRushTutorial lang="ru" onClose={() => {}} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText(/Дальше/))
    expect(screen.getByText(/\+15/)).toBeTruthy()
  })
})
