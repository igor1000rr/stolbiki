/**
 * Тесты античита — верификация результата по moves через движок.
 * Проверяет что накрутка через подмену won/score/turns не проходит.
 */

import { describe, it, expect } from 'vitest'
import { verifyGameFromMoves } from '../server/anticheat.js'
import { GameState, applyAction, getLegalActions } from '../server/game-engine.js'

/** Генерирует валидную партию случайных легальных ходов до gameOver */
function playRandomGame(seed = 1) {
  // Детерминированный Math.random через LCG
  let s = seed
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }

  let gs = new GameState()
  const moves = []
  let safety = 200
  while (!gs.gameOver && safety-- > 0) {
    const legal = getLegalActions(gs)
    if (legal.length === 0) break
    const pick = legal[Math.floor(rand() * legal.length)]
    const player = gs.currentPlayer
    moves.push({ action: pick, player })
    gs = applyAction(gs, pick)
  }
  return { moves, finalState: gs }
}

describe('античит: verifyGameFromMoves', () => {
  it('принимает валидную завершённую партию', () => {
    // Ищем seed который даёт законченную партию (не все seed доводят до gameOver за 200 ходов)
    let v, attempts = 0
    do {
      const { moves, finalState } = playRandomGame(42 + attempts)
      if (!finalState.gameOver) { attempts++; continue }
      v = verifyGameFromMoves(moves)
      break
    } while (attempts < 20)
    expect(v.ok).toBe(true)
    expect([0, 1, -1]).toContain(v.winner)
    expect(v.scoreStr).toMatch(/^\d+:\d+$/)
    expect(v.turns).toBeGreaterThan(0)
  })

  it('отклоняет пустой массив ходов', () => {
    expect(verifyGameFromMoves([]).ok).toBe(false)
  })

  it('отклоняет незавершённую партию (gameOver не достигнут)', () => {
    // Первый легальный ход — партия не закончена
    const gs = new GameState()
    const legal = getLegalActions(gs)
    const v = verifyGameFromMoves([{ action: legal[0], player: 0 }])
    expect(v.ok).toBe(false)
  })

  it('отклоняет нелегальный ход (ставим на несуществующую стойку)', () => {
    const moves = [{ action: { placement: { 99: 5 } }, player: 0 }]
    expect(verifyGameFromMoves(moves).ok).toBe(false)
  })

  it('отклоняет ход без action поля', () => {
    expect(verifyGameFromMoves([{ player: 0 }]).ok).toBe(false)
    expect(verifyGameFromMoves([null]).ok).toBe(false)
    expect(verifyGameFromMoves([{ action: null }]).ok).toBe(false)
  })

  it('отклоняет подмену transfer на невалидный (с несуществующей стойки)', () => {
    // Первый ход первого игрока ещё не создаёт возможность переноса
    const moves = [
      { action: { placement: { 0: 1 } }, player: 0 },
      { action: { transfer: [5, 6], placement: {} }, player: 1 }, // transfer из пустой стойки
    ]
    expect(verifyGameFromMoves(moves).ok).toBe(false)
  })

  it('ловит хак: подмена первого хода на >1 блок (FIRST_TURN_MAX=1)', () => {
    // По правилам первый ход = max 1 блок. Клиент пытается поставить 3.
    const moves = [{ action: { placement: { 5: 3 } }, player: 0 }]
    const v = verifyGameFromMoves(moves)
    expect(v.ok).toBe(false)
  })

  it('возвращает корректный winner и score для победы через закрытие', () => {
    // Генерим партию, проверяем что если finalState.winner === 0,
    // то scoreStr начинается с числа > 0
    for (let seed = 1; seed < 50; seed++) {
      const { moves, finalState } = playRandomGame(seed)
      if (!finalState.gameOver || finalState.winner === null) continue
      const v = verifyGameFromMoves(moves)
      expect(v.ok).toBe(true)
      expect(v.winner).toBe(finalState.winner)
      const [s0, s1] = v.scoreStr.split(':').map(Number)
      if (v.winner === 0) expect(s0).toBeGreaterThanOrEqual(s1)
      if (v.winner === 1) expect(s1).toBeGreaterThanOrEqual(s0)
      return
    }
    throw new Error('Ни один seed не дал законченную партию с определённым победителем')
  })

  it('отклоняет вставку левого хода в середину партии', () => {
    // Берём валидную партию, подменяем один ход в середине на нелегальный
    let good
    for (let seed = 1; seed < 30; seed++) {
      const { moves, finalState } = playRandomGame(seed)
      if (finalState.gameOver && moves.length > 5) { good = moves; break }
    }
    expect(good).toBeDefined()
    const tampered = [...good]
    tampered[Math.floor(tampered.length / 2)] = { action: { placement: { 99: 99 } }, player: 0 }
    expect(verifyGameFromMoves(tampered).ok).toBe(false)
  })
})
