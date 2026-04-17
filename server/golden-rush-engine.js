/**
 * Golden Rush — серверный движок для online-матчей.
 *
 * ТОЧНАЯ КОПИЯ логики из src/game/goldenRushEngine.js (ESM client module).
 * Сервер должен быть authority — валидирует каждый ход клиента.
 *
 * Дублирование неизбежно: клиент в ESM/Vite, сервер в Node ESM, общий импорт
 * через src/game/ не работает т.к. сервер деплоится отдельно на VPS.
 * При изменении правил — править ОБА файла одновременно.
 *
 * Спека: docs/modes/golden-rush.md
 */

export const NUM_STANDS = 9
export const DEFAULT_NUM_PLAYERS = 4
export const MAX_CHIPS = 11
export const MAX_PLACE = 3
export const MAX_PLACE_STANDS = 2
export const CENTER_IDX = 0

export const STAND_META = [
  { type: 'center', slot: null, order: 0 },
  { type: 'arm', slot: 0, order: 1 },
  { type: 'arm', slot: 0, order: 2 },
  { type: 'arm', slot: 1, order: 1 },
  { type: 'arm', slot: 1, order: 2 },
  { type: 'arm', slot: 2, order: 1 },
  { type: 'arm', slot: 2, order: 2 },
  { type: 'arm', slot: 3, order: 1 },
  { type: 'arm', slot: 3, order: 2 },
]

export function getPlayerStands(playerId) {
  return STAND_META
    .map((m, i) => (m.type === 'arm' && m.slot === playerId) ? i : -1)
    .filter(i => i >= 0)
    .sort((a, b) => STAND_META[a].order - STAND_META[b].order)
}

export function getPairedStand(standIdx) {
  const m = STAND_META[standIdx]
  if (m.type !== 'arm') return -1
  for (let i = 0; i < STAND_META.length; i++) {
    if (i === standIdx) continue
    const x = STAND_META[i]
    if (x.type === 'arm' && x.slot === m.slot && x.order !== m.order) return i
  }
  return -1
}

export class GoldenRushState {
  constructor({ numPlayers = DEFAULT_NUM_PLAYERS, mode = 'ffa', teams = null } = {}) {
    this.numPlayers = numPlayers
    this.mode = mode
    this.teams = teams || (mode === '2v2' ? [[0, 2], [1, 3]] : null)
    this.stands = Array.from({ length: NUM_STANDS }, () => [])
    this.closed = {}
    this.currentPlayer = 0
    this.turn = 0
    this.gameOver = false
    this.winner = null
    this.scores = null
    this.eligibleForCenter = []
  }

  copy() {
    const s = new GoldenRushState({ numPlayers: this.numPlayers, mode: this.mode, teams: this.teams })
    s.stands = this.stands.map(st => [...st])
    s.closed = { ...this.closed }
    s.currentPlayer = this.currentPlayer
    s.turn = this.turn
    s.gameOver = this.gameOver
    s.winner = this.winner
    s.scores = this.scores ? [...this.scores] : null
    s.eligibleForCenter = [...this.eligibleForCenter]
    return s
  }

  topGroup(i) {
    const chips = this.stands[i]
    if (!chips.length) return [-1, 0]
    const color = chips[chips.length - 1]
    let count = 0
    for (let j = chips.length - 1; j >= 0; j--) {
      if (chips[j] === color) count++; else break
    }
    return [color, count]
  }

  openStands() {
    const r = []
    for (let i = 0; i < NUM_STANDS; i++) if (!(i in this.closed)) r.push(i)
    return r
  }

  effectiveCap(i) {
    if (i in this.closed) return 0
    const m = STAND_META[i]
    if (m.type === 'arm') {
      if (m.order === 1) return MAX_CHIPS
      const pair = getPairedStand(i)
      return (pair in this.closed) ? MAX_CHIPS : MAX_CHIPS - 1
    }
    return this.eligibleForCenter.length > 0 ? MAX_CHIPS : MAX_CHIPS - 1
  }

  standSpace(i) {
    return Math.max(0, this.effectiveCap(i) - this.stands[i].length)
  }

  /**
   * Сериализация для отправки клиенту. Минимальный объём — только то что нужно для UI.
   */
  serialize() {
    return {
      numPlayers: this.numPlayers,
      mode: this.mode,
      teams: this.teams,
      stands: this.stands,
      closed: this.closed,
      currentPlayer: this.currentPlayer,
      turn: this.turn,
      gameOver: this.gameOver,
      winner: this.winner,
      scores: this.scores,
      eligibleForCenter: this.eligibleForCenter,
    }
  }
}

export function getValidTransfers(state) {
  const transfers = []
  const opens = state.openStands()
  for (const src of opens) {
    const [grpColor, grpSize] = state.topGroup(src)
    if (grpSize === 0) continue
    for (const dst of opens) {
      if (dst === src) continue
      const dstChips = state.stands[dst]
      const [dstTop] = state.topGroup(dst)
      if (dstChips.length > 0 && dstTop !== grpColor) continue
      const newTotal = dstChips.length + grpSize
      const cap = state.effectiveCap(dst)
      if (newTotal > cap && newTotal >= MAX_CHIPS) continue
      transfers.push([src, dst])
    }
  }
  return transfers
}

export function getValidPlacements(state) {
  const available = []
  for (const idx of state.openStands()) {
    const rem = state.standSpace(idx)
    if (rem <= 0) continue
    available.push([idx, Math.min(rem, MAX_PLACE)])
  }
  const placements = [{}]
  for (const [idx, cap] of available) {
    for (let c = 1; c <= Math.min(cap, MAX_PLACE); c++) {
      placements.push({ [idx]: c })
    }
  }
  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const [i1, c1] = available[i]
      const [i2, c2] = available[j]
      for (let a = 1; a <= Math.min(c1, MAX_PLACE - 1); a++) {
        for (let b = 1; b <= Math.min(c2, MAX_PLACE - a); b++) {
          if (a + b <= MAX_PLACE) placements.push({ [i1]: a, [i2]: b })
        }
      }
    }
  }
  return placements
}

function applyTransfer(state, src, dst) {
  const [grpColor, grpSize] = state.topGroup(src)
  state.stands[src] = state.stands[src].slice(0, -grpSize)
  state.stands[dst] = state.stands[dst].concat(Array(grpSize).fill(grpColor))
  if (state.stands[dst].length > MAX_CHIPS) {
    state.stands[dst] = state.stands[dst].slice(state.stands[dst].length - MAX_CHIPS)
  }
}

function applyPlacement(state, placement) {
  const player = state.currentPlayer
  for (const [idx, count] of Object.entries(placement)) {
    const i = +idx
    state.stands[i] = state.stands[i].concat(Array(count).fill(player))
    if (state.stands[i].length > MAX_CHIPS) {
      state.stands[i] = state.stands[i].slice(state.stands[i].length - MAX_CHIPS)
    }
  }
}

function processClosures(state) {
  let changed = true
  while (changed) {
    changed = false
    for (let i = 1; i < NUM_STANDS; i++) {
      if (i in state.closed) continue
      if (state.stands[i].length < MAX_CHIPS) continue
      const m = STAND_META[i]
      if (m.order === 1) {
        state.closed[i] = state.topGroup(i)[0]
        changed = true
      } else {
        const pair = getPairedStand(i)
        if (pair in state.closed) {
          state.closed[i] = state.topGroup(i)[0]
          changed = true
        }
      }
    }
  }
  for (let p = 0; p < state.numPlayers; p++) {
    if (state.eligibleForCenter.includes(p)) continue
    const stands = getPlayerStands(p)
    if (stands.every(s => s in state.closed)) state.eligibleForCenter.push(p)
  }
  if (!(CENTER_IDX in state.closed)
      && state.eligibleForCenter.length > 0
      && state.stands[CENTER_IDX].length >= MAX_CHIPS) {
    state.closed[CENTER_IDX] = state.eligibleForCenter[0]
  }
}

function checkGameOver(state) {
  if (Object.keys(state.closed).length === NUM_STANDS) {
    state.gameOver = true
    state.scores = computeScores(state)
    if (state.mode === 'ffa') {
      let best = -1, bestScore = -Infinity
      for (let p = 0; p < state.numPlayers; p++) {
        if (state.scores[p] > bestScore) { best = p; bestScore = state.scores[p] }
      }
      state.winner = best
    } else {
      const ts = state.teams.map(t => t.reduce((a, p) => a + state.scores[p], 0))
      if (ts[0] === ts[1]) state.winner = -1
      else state.winner = ts[0] > ts[1] ? 0 : 1
    }
  }
}

export function computeScores(state) {
  const scores = Array(state.numPlayers).fill(0)
  for (const st of state.stands) for (const c of st) if (c >= 0 && c < state.numPlayers) scores[c] += 1
  for (let i = 1; i < NUM_STANDS; i++) {
    if (!(i in state.closed)) continue
    const owner = state.closed[i]
    if (owner < 0 || owner >= state.numPlayers) continue
    scores[owner] += STAND_META[i].order === 1 ? 5 : 8
  }
  if (CENTER_IDX in state.closed) {
    const owner = state.closed[CENTER_IDX]
    if (owner >= 0 && owner < state.numPlayers) scores[owner] += 15
  }
  if (state.mode === '2v2' && state.teams) {
    for (const team of state.teams) {
      const bothClosed = team.every(p => getPlayerStands(p).every(s => s in state.closed))
      if (bothClosed) for (const p of team) scores[p] += 5
    }
  }
  return scores
}

export function applyAction(state, action) {
  const ns = state.copy()
  if (action.transfer) applyTransfer(ns, action.transfer[0], action.transfer[1])
  if (action.placement) applyPlacement(ns, action.placement)
  processClosures(ns)
  ns.currentPlayer = (ns.currentPlayer + 1) % ns.numPlayers
  ns.turn++
  checkGameOver(ns)
  return ns
}

/**
 * Проверяет что action легален в заданном состоянии.
 * Возвращает { ok: boolean, reason?: string }.
 * Используется сервером для валидации клиентского хода.
 */
export function validateAction(state, action) {
  if (!action || typeof action !== 'object') return { ok: false, reason: 'bad_action' }
  if (state.gameOver) return { ok: false, reason: 'game_over' }

  const hasT = !!(action.transfer && Array.isArray(action.transfer) && action.transfer.length === 2)
  const hasP = !!(action.placement && typeof action.placement === 'object' && Object.keys(action.placement).length > 0)
  if (!hasT && !hasP) return { ok: false, reason: 'empty_action' }

  if (hasT) {
    const [src, dst] = action.transfer
    if (!Number.isInteger(src) || !Number.isInteger(dst)) return { ok: false, reason: 'transfer_non_int' }
    if (src < 0 || src >= NUM_STANDS || dst < 0 || dst >= NUM_STANDS) return { ok: false, reason: 'transfer_out_of_range' }
    const valid = getValidTransfers(state)
    if (!valid.some(([s, d]) => s === src && d === dst)) return { ok: false, reason: 'transfer_illegal' }
  }

  if (hasP) {
    const temp = state.copy()
    if (hasT) applyTransfer(temp, action.transfer[0], action.transfer[1])

    const keys = Object.keys(action.placement)
    if (keys.length > MAX_PLACE_STANDS) return { ok: false, reason: 'placement_too_many_stands' }
    let total = 0
    for (const k of keys) {
      const idx = +k
      const cnt = action.placement[k]
      if (!Number.isInteger(idx) || idx < 0 || idx >= NUM_STANDS) return { ok: false, reason: 'placement_bad_idx' }
      if (!Number.isInteger(cnt) || cnt < 1 || cnt > MAX_PLACE) return { ok: false, reason: 'placement_bad_count' }
      const space = temp.standSpace(idx)
      if (cnt > space) return { ok: false, reason: 'placement_over_cap' }
      total += cnt
    }
    if (total > MAX_PLACE) return { ok: false, reason: 'placement_over_max' }
  }

  return { ok: true }
}

export function getLegalActions(state) {
  if (state.gameOver) return []
  const actions = []
  const transfers = [null, ...getValidTransfers(state)]
  for (const transfer of transfers) {
    const temp = state.copy()
    if (transfer) applyTransfer(temp, transfer[0], transfer[1])
    for (const placement of getValidPlacements(temp)) {
      if (!transfer && !Object.keys(placement).length) continue
      actions.push({ transfer, placement })
    }
  }
  if (!actions.length) actions.push({})
  return actions
}
