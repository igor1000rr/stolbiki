/**
 * Сбор данных реальных партий для дообучения нейросети.
 * 
 * Каждый ход записывается как пара (state, action).
 * После партии — результат (winner) проставляется во все записи.
 * 
 * Хранение: localStorage (до подключения сервера)
 * Формат: совместим с Python train.py (state → encode, value = ±1)
 */

const STORAGE_KEY = 'stolbiki_training_data'
const MAX_GAMES = 200 // Максимум партий в localStorage

// ─── Текущая партия ───
let currentGame = null

export function startRecording() {
  currentGame = {
    moves: [],
    startedAt: Date.now(),
    mode: 'unknown',  // 'ai' | 'pvp'
    difficulty: 0,
  }
}

export function setGameMeta(mode, difficulty) {
  if (currentGame) {
    currentGame.mode = mode
    currentGame.difficulty = difficulty
  }
}

/**
 * Записывает ход: состояние → действие
 * @param {object} state - GameState перед ходом
 * @param {object} action - { transfer, placement, swap }
 * @param {number} player - 0 или 1
 */
export function recordMove(state, action, player) {
  if (!currentGame) return
  
  // Компактное представление состояния
  const stateData = {
    stands: state.stands.map(s => [...s]),
    closed: { ...state.closed },
    turn: state.turn,
    player: player,
  }
  
  // Компактное действие
  const actionData = {}
  if (action.swap) actionData.swap = true
  if (action.transfer) actionData.transfer = action.transfer
  if (action.placement) {
    const pl = {}
    for (const [k, v] of Object.entries(action.placement)) {
      if (v > 0) pl[k] = v
    }
    if (Object.keys(pl).length) actionData.placement = pl
  }
  
  currentGame.moves.push({ state: stateData, action: actionData, player })
}

/**
 * Завершает партию — записывает результат
 * @param {number} winner - 0 или 1
 * @param {number[]} finalScore - [p1_closed, p2_closed]
 */
export function finishRecording(winner, finalScore) {
  if (!currentGame || currentGame.moves.length === 0) {
    currentGame = null
    return
  }
  
  const game = {
    ...currentGame,
    winner,
    finalScore,
    finishedAt: Date.now(),
    totalMoves: currentGame.moves.length,
  }
  
  currentGame = null
  saveGame(game)
}

export function cancelRecording() {
  currentGame = null
}

// ─── Хранение (in-memory кеш + localStorage sync) ───

let _cache = null

function getGames() {
  if (_cache) return _cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    _cache = raw ? JSON.parse(raw) : []
  } catch { _cache = [] }
  return _cache
}

function persistGames(games) {
  _cache = games
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
  } catch {
    try {
      const trimmed = games.slice(Math.floor(games.length / 2))
      _cache = trimmed
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {}
  }
}

function saveGame(game) {
  const games = [...getGames(), game]
  while (games.length > MAX_GAMES) games.shift()
  persistGames(games)
  syncToServer(game)
}

async function syncToServer(game) {
  try {
    const token = localStorage.getItem('stolbiki_token')
    if (!token) return
    await fetch(('/api/training'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        gameData: { moves: game.moves, finalScore: game.finalScore },
        winner: game.winner,
        totalMoves: game.totalMoves,
        mode: game.mode,
        difficulty: game.difficulty,
      }),
    })
  } catch {}
}

/**
 * Экспорт данных для обучения (вызывается из админки)
 * @returns {{ games: number, moves: number, data: object[] }}
 */
export function exportTrainingData() {
  const games = getGames()
  const totalMoves = games.reduce((a, g) => a + (g.moves?.length || 0), 0)
  return { games: games.length, moves: totalMoves, data: games }
}

/**
 * Конвертирует в формат для Python train.py
 * Каждый ход → (encoded_state, value)
 * value = +1 если игрок этого хода победил, -1 если проиграл
 */
export function exportForTraining() {
  const { data } = exportTrainingData()
  const samples = []
  
  for (const game of data) {
    if (game.winner === undefined || game.winner < 0) continue
    
    for (const move of (game.moves || [])) {
      samples.push({
        state: move.state,
        action: move.action,
        value: move.player === game.winner ? 1 : -1,
      })
    }
  }
  
  return samples
}

export function clearTrainingData() {
  _cache = []
  localStorage.removeItem(STORAGE_KEY)
}

export function getTrainingStats() {
  const games = getGames()
  const totalMoves = games.reduce((a, g) => a + (g.moves?.length || 0), 0)
  const aiGames = games.filter(g => g.mode === 'ai').length
  const pvpGames = games.filter(g => g.mode === 'pvp').length
  const byDifficulty = {}
  games.filter(g => g.mode === 'ai').forEach(g => {
    const d = g.difficulty || 0
    byDifficulty[d] = (byDifficulty[d] || 0) + 1
  })
  return { games: games.length, moves: totalMoves, aiGames, pvpGames, byDifficulty }
}
