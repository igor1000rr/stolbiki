/**
 * Batch Self-Play — массовые партии для статистики и поиска стратегий
 * Запуск: node scripts/batch-selfplay.js [count] [mode]
 * mode: random (быстрый), smart (с эвристиками), mcts (с AI)
 */
import { GameState, applyAction, getLegalActions } from '../server/game-engine.js'

const TOTAL = parseInt(process.argv[2]) || 10000
const MODE = process.argv[3] || 'smart'

// ═══ Стратегии ═══
function randomAction(state) {
  const actions = getLegalActions(state)
  return actions[Math.floor(Math.random() * actions.length)]
}

// Умная эвристика — имитирует среднего игрока
function smartAction(state) {
  const actions = getLegalActions(state)
  const p = state.currentPlayer
  
  // Приоритеты:
  // 1. Закрыть стойку своим цветом (перенос или размещение)
  for (const a of actions) {
    if (a.type === 'transfer') {
      const dst = state.stands[a.to]
      const [grpColor, grpSize] = state.topGroup(a.from)
      if (dst.length + grpSize >= 11 && grpColor === p) return a
    }
    if (a.type === 'place') {
      for (const s of a.stands) {
        if (state.stands[s.stand].length + s.count >= 11) return a
      }
    }
  }
  
  // 2. Золотая стойка — приоритет
  for (const a of actions) {
    if (a.type === 'transfer' && a.to === 0) {
      const [grpColor] = state.topGroup(a.from)
      if (grpColor === p) return a
    }
  }
  
  // 3. Перехват — перенос на стойку где враг сверху
  for (const a of actions) {
    if (a.type === 'transfer') {
      const [topColor] = state.topGroup(a.to)
      const [grpColor] = state.topGroup(a.from)
      if (topColor === 1 - p && grpColor === p && state.stands[a.to].length >= 7) return a
    }
  }
  
  // 4. Размещение на стойки где мы доминируем
  const placements = actions.filter(a => a.type === 'place')
  if (placements.length > 0) {
    return placements[Math.floor(Math.random() * placements.length)]
  }
  
  // 5. Случайный
  return actions[Math.floor(Math.random() * actions.length)]
}

// ═══ Партия ═══
function playGame(mode) {
  let state = new GameState()
  let moves = 0
  const maxMoves = 300
  const openings = [] // Первые 3 хода
  
  while (!state.gameOver && moves < maxMoves) {
    const action = mode === 'random' ? randomAction(state) : smartAction(state)
    if (!action) break
    if (moves < 3) openings.push({ action: { type: action.type, ...(action.type === 'transfer' ? { from: action.from, to: action.to } : {}) }, player: state.currentPlayer })
    state = applyAction(state, action)
    moves++
  }
  
  const p0closed = state.countClosed(0)
  const p1closed = state.countClosed(1)
  const winner = p0closed >= 6 ? 0 : p1closed >= 6 ? 1 : p0closed > p1closed ? 0 : p1closed > p0closed ? 1 : -1
  const goldenOwner = state.closed[0] ?? -1
  
  return { winner, moves, p0closed, p1closed, goldenOwner, openings, gameOver: state.gameOver }
}

// ═══ Статистика ═══
const stats = {
  total: 0, p0wins: 0, p1wins: 0, draws: 0,
  totalMoves: 0, minMoves: Infinity, maxMoves: 0,
  goldenP0: 0, goldenP1: 0, goldenNone: 0,
  avgP0closed: 0, avgP1closed: 0,
  openingStats: {},
  closedDist: Array(11).fill(0), // score distribution
  sweeps: 0, // 10-0 или 0-10
  tightGames: 0, // 6-4 или 4-6
}

console.log(`═══ Batch Self-Play: ${TOTAL.toLocaleString()} партий (${MODE}) ═══`)
const startTime = Date.now()
const BATCH = 1000

for (let batch = 0; batch < TOTAL; batch += BATCH) {
  const count = Math.min(BATCH, TOTAL - batch)
  
  for (let i = 0; i < count; i++) {
    const result = playGame(MODE)
    stats.total++
    
    if (result.winner === 0) stats.p0wins++
    else if (result.winner === 1) stats.p1wins++
    else stats.draws++
    
    stats.totalMoves += result.moves
    stats.minMoves = Math.min(stats.minMoves, result.moves)
    stats.maxMoves = Math.max(stats.maxMoves, result.moves)
    
    if (result.goldenOwner === 0) stats.goldenP0++
    else if (result.goldenOwner === 1) stats.goldenP1++
    else stats.goldenNone++
    
    stats.avgP0closed += result.p0closed
    stats.avgP1closed += result.p1closed
    stats.closedDist[result.p0closed]++
    
    if (result.p0closed === 10 || result.p1closed === 10) stats.sweeps++
    if (Math.abs(result.p0closed - result.p1closed) <= 2 && result.gameOver) stats.tightGames++
    
    // Opening tracking
    if (result.openings.length >= 2) {
      const key = result.openings.slice(0, 2).map(o => `${o.action.type}${o.action.from ?? ''}-${o.action.to ?? ''}`).join('→')
      if (!stats.openingStats[key]) stats.openingStats[key] = { wins: 0, losses: 0, total: 0 }
      stats.openingStats[key].total++
      if (result.winner === 0) stats.openingStats[key].wins++
      else stats.openingStats[key].losses++
    }
  }
  
  // Прогресс
  const elapsed = (Date.now() - startTime) / 1000
  const speed = Math.round(stats.total / elapsed)
  const pct = ((stats.total / TOTAL) * 100).toFixed(1)
  process.stdout.write(`\r  ${stats.total.toLocaleString()} / ${TOTAL.toLocaleString()} (${pct}%) — ${speed.toLocaleString()} партий/сек`)
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`\n\n═══ РЕЗУЛЬТАТЫ (${elapsed}с) ═══`)
console.log(`Партий: ${stats.total.toLocaleString()}`)
console.log(`P0 побед: ${stats.p0wins} (${(stats.p0wins/stats.total*100).toFixed(1)}%)`)
console.log(`P1 побед: ${stats.p1wins} (${(stats.p1wins/stats.total*100).toFixed(1)}%)`)
console.log(`Ничьих: ${stats.draws} (${(stats.draws/stats.total*100).toFixed(1)}%)`)
console.log(`\nХоды: avg ${(stats.totalMoves/stats.total).toFixed(1)}, min ${stats.minMoves}, max ${stats.maxMoves}`)
console.log(`Золотая: P0 ${stats.goldenP0} (${(stats.goldenP0/stats.total*100).toFixed(1)}%), P1 ${stats.goldenP1} (${(stats.goldenP1/stats.total*100).toFixed(1)}%), никто ${stats.goldenNone}`)
console.log(`Среднее закрытых: P0 ${(stats.avgP0closed/stats.total).toFixed(2)}, P1 ${(stats.avgP1closed/stats.total).toFixed(2)}`)
console.log(`Разгромы (10-0): ${stats.sweeps} (${(stats.sweeps/stats.total*100).toFixed(1)}%)`)
console.log(`Плотные (±2): ${stats.tightGames} (${(stats.tightGames/stats.total*100).toFixed(1)}%)`)

// Распределение счёта
console.log(`\nРаспределение закрытых P0:`)
stats.closedDist.forEach((c, i) => {
  const bar = '█'.repeat(Math.round(c / stats.total * 100))
  console.log(`  ${i}: ${bar} ${(c/stats.total*100).toFixed(1)}%`)
})

// Топ открытий
const topOpenings = Object.entries(stats.openingStats)
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 10)
console.log(`\nТоп-10 открытий (WR = win rate P0):`)
topOpenings.forEach(([key, data]) => {
  const wr = data.total > 0 ? (data.wins / data.total * 100).toFixed(1) : '0'
  console.log(`  ${key}: ${data.total} партий, WR ${wr}%`)
})
