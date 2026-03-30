/**
 * Нейросеть для оценки позиции в браузере
 * Архитектура: MLP 73→64→64→1 (ReLU + Tanh)
 * Обучена на 239K+ партий self-play (AlphaZero подход)
 * Веса: analysis/final_net.npz → net_weights.json (8,961 параметров)
 */

import { GOLDEN_STAND, MAX_CHIPS } from './game.js'

let weights = null
let loadingPromise = null

/**
 * Загрузка весов нейросети (lazy, один раз)
 */
export async function loadWeights() {
  if (weights) return weights
  if (loadingPromise) return loadingPromise

  loadingPromise = fetch(new URL('./net_weights.json', import.meta.url))
    .then(r => r.json())
    .then(data => {
      weights = {
        w1: data.w1, b1: data.b1,  // 73×64, 64
        w2: data.w2, b2: data.b2,  // 64×64, 64
        w3: data.w3, b3: data.b3,  // 64×1,  1
      }
      return weights
    })

  return loadingPromise
}

/**
 * Синхронная проверка готовности
 */
export function isReady() {
  return weights !== null
}

/**
 * Кодирование состояния игры в вектор (73 элемента)
 * Точная копия Python encode_state() из analysis/game.py
 */
export function encodeState(state, player) {
  const opp = 1 - player
  const vec = []

  for (let i = 0; i < state.numStands; i++) {
    const chips = state.stands[i]
    const cMe = chips.filter(c => c === player).length / MAX_CHIPS
    const cOpp = chips.filter(c => c === opp).length / MAX_CHIPS

    const [topColor, topSize] = state.topGroup(i)
    let tc
    if (topColor === -1) tc = 0.5
    else if (topColor === player) tc = 1.0
    else tc = 0.0

    const isClosed = (i in state.closed) ? 1.0 : 0.0
    let closedBy = 0.0
    if (i in state.closed) {
      closedBy = state.closed[i] === player ? 1.0 : -1.0
    }

    const isGolden = i === GOLDEN_STAND ? 1.0 : 0.0

    vec.push(cMe, cOpp, tc, topSize / MAX_CHIPS, isClosed, closedBy, isGolden)
  }

  vec.push(state.turn / 100.0)
  vec.push((state.countClosed(player) - state.countClosed(opp)) / state.numStands)
  vec.push(state.numOpen() / state.numStands)

  return vec
}

/**
 * Forward pass: MLP 73→64(ReLU)→64(ReLU)→1(Tanh)
 * Возвращает оценку позиции от -1 (проигрыш) до +1 (выигрыш)
 */
export function evaluate(state) {
  if (!weights) return 0

  const player = state.currentPlayer
  const x = encodeState(state, player)

  // Layer 1: z1 = x @ w1 + b1, a1 = relu(z1)
  const a1 = new Float32Array(64)
  for (let j = 0; j < 64; j++) {
    let sum = weights.b1[j]
    for (let i = 0; i < 73; i++) {
      sum += x[i] * weights.w1[i][j]
    }
    a1[j] = sum > 0 ? sum : 0  // ReLU
  }

  // Layer 2: z2 = a1 @ w2 + b2, a2 = relu(z2)
  const a2 = new Float32Array(64)
  for (let j = 0; j < 64; j++) {
    let sum = weights.b2[j]
    for (let i = 0; i < 64; i++) {
      sum += a1[i] * weights.w2[i][j]
    }
    a2[j] = sum > 0 ? sum : 0  // ReLU
  }

  // Layer 3: z3 = a2 @ w3 + b3, out = tanh(z3)
  let sum = weights.b3[0]
  for (let i = 0; i < 64; i++) {
    sum += a2[i] * weights.w3[i][0]
  }

  return Math.tanh(sum)
}
