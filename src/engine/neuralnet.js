/**
 * Нейросеть v7 для оценки позиции + policy priors в браузере
 *
 * GPU-сеть v7: ResNet 107→256×6 + Value(64→1) + Policy(ctx 64 + action_enc 35→64)
 *   - ~859K params, gpu_weights.bin (~3.4MB, ~850KB gzip) — binary Float32
 * CPU-сеть: MLP 73→64→64→1 (8,961 params) — fallback (только value)
 *
 * Policy head: candidate scoring через dot product
 *   - policy_ctx: backbone → Linear(256,64) → ReLU → 64-dim context
 *   - action_enc: Linear(35,64) — проекция action features
 *   - logit = dot(policy_ctx, action_enc(action_features))
 *
 * GPU грузится LAZY — только при выборе сложности Hard+.
 */

import { GOLDEN_STAND, MAX_CHIPS } from './game.js'

let cpuWeights = null
let gpuWeights = null
let loadingCpu = null
let loadingGpu = null
let useGpu = false

// Размер вектора фич хода (синхронизирован с Python encode_action)
export const ACTION_FEAT_SIZE = 35

// ═══ Парсинг binary формата ═══

function parseBinaryWeights(buffer) {
  const view = new DataView(buffer)
  let offset = 0
  const numKeys = view.getUint32(offset, true); offset += 4
  const weights = {}
  const decoder = new TextDecoder()

  for (let k = 0; k < numKeys; k++) {
    const keyLen = view.getUint16(offset, true); offset += 2
    const key = decoder.decode(new Uint8Array(buffer, offset, keyLen)); offset += keyLen
    const numFloats = view.getUint32(offset, true); offset += 4
    const data = new Float32Array(buffer, offset, numFloats); offset += numFloats * 4
    weights[key] = new Float32Array(data)
  }
  return weights
}

// ═══ Загрузка ═══

export async function loadWeights() {
  if (!cpuWeights && !loadingCpu) {
    loadingCpu = fetch(new URL('./net_weights.json', import.meta.url))
      .then(r => r.json())
      .then(data => { cpuWeights = data })
      .catch(() => {})
  }
  await loadingCpu
  return cpuWeights
}

export async function loadGpuWeights() {
  if (gpuWeights) return gpuWeights
  if (loadingGpu) { await loadingGpu; return gpuWeights }

  loadingGpu = (async () => {
    try {
      const res = await fetch(new URL('./gpu_weights.bin', import.meta.url))
      if (res.ok) {
        const buf = await res.arrayBuffer()
        gpuWeights = parseBinaryWeights(buf)
        useGpu = true
      }
    } catch {}
  })()

  await loadingGpu
  return gpuWeights
}

export function isReady() { return !!(gpuWeights || cpuWeights) }
export function isGpuReady() { return !!gpuWeights }

/** Проверка: есть ли policy head в весах */
export function hasPolicyHead() {
  return !!gpuWeights && 'policy_ctx.0.weight' in gpuWeights
}

// ═══ Кодирование: State CPU (73 фичи) ═══

function encodeStateCpu(state, player) {
  const opp = 1 - player
  const vec = []
  for (let i = 0; i < state.numStands; i++) {
    const chips = state.stands[i]
    const cMe = chips.filter(c => c === player).length / MAX_CHIPS
    const cOpp = chips.filter(c => c === opp).length / MAX_CHIPS
    const [topColor, topSize] = state.topGroup(i)
    const tc = topColor === -1 ? 0.5 : topColor === player ? 1.0 : 0.0
    const isClosed = (i in state.closed) ? 1.0 : 0.0
    const closedBy = (i in state.closed) ? (state.closed[i] === player ? 1.0 : -1.0) : 0.0
    vec.push(cMe, cOpp, tc, topSize / MAX_CHIPS, isClosed, closedBy, i === GOLDEN_STAND ? 1.0 : 0.0)
  }
  vec.push(state.turn / 100.0, (state.countClosed(player) - state.countClosed(opp)) / state.numStands, state.numOpen() / state.numStands)
  return vec
}

// ═══ Кодирование: State GPU (107 фич) ═══

function encodeStateGpu(state, player) {
  const opp = 1 - player
  const f = []
  for (let i = 0; i < state.numStands; i++) {
    const chips = state.stands[i]
    const total = chips.length
    const [tc, ts] = state.topGroup(i)
    f.push(
      total / 11.0,
      chips.filter(c => c === player).length / 11.0,
      chips.filter(c => c === opp).length / 11.0,
      ts / 11.0,
      tc === player ? 1.0 : 0.0,
      tc === opp ? 1.0 : 0.0,
      (i in state.closed) ? 1.0 : 0.0,
      state.closed[i] === player ? 1.0 : 0.0,
      i === 0 ? 1.0 : 0.0,
      Math.max(0, 11 - total) / 11.0
    )
  }
  const mc = state.countClosed(player), oc = state.countClosed(opp)
  f.push(mc / 5, oc / 5, (mc - oc) / 5, state.numOpen() / 10, state.turn / 100,
    state.swapAvailable ? 1.0 : 0.0, state.canCloseByPlacement() ? 1.0 : 0.0)
  return f
}

// ═══ Кодирование: Action (35 фич) — зеркало Python encode_action ═══

/**
 * Кодирование хода в вектор фич для policy head.
 *
 * [0]:     swap
 * [1]:     has_transfer
 * [2-11]:  src one-hot (10)
 * [12-21]: dst one-hot (10)
 * [22]:    transfer group_size / 11
 * [23]:    is_closing (transfer заполняет стойку до 11+)
 * [24-33]: placement count per stand / 3 (10)
 * [34]:    total_placed / 3
 */
export function encodeAction(state, action) {
  const f = new Float32Array(ACTION_FEAT_SIZE)
  if (action.swap) {
    f[0] = 1.0
    return f
  }
  if (action.transfer) {
    const [src, dst] = action.transfer
    f[1] = 1.0
    f[2 + src] = 1.0
    f[12 + dst] = 1.0
    const [, gs] = state.topGroup(src)
    f[22] = gs / 11.0
    if (state.stands[dst].length + gs >= MAX_CHIPS) {
      f[23] = 1.0
    }
  }
  if (action.placement) {
    let total = 0
    for (const [standIdx, count] of Object.entries(action.placement)) {
      f[24 + (+standIdx)] = count / 3.0
      total += count
    }
    f[34] = total / 3.0
  }
  return f
}

// ═══ Математика ═══

function linear(x, w, b, inSize, outSize) {
  const y = new Float32Array(outSize)
  for (let j = 0; j < outSize; j++) {
    let sum = b[j]
    const off = j * inSize
    for (let i = 0; i < inSize; i++) sum += x[i] * w[off + i]
    y[j] = sum
  }
  return y
}

function layerNorm(x, weight, bias, size) {
  let mean = 0
  for (let i = 0; i < size; i++) mean += x[i]
  mean /= size
  let v = 0
  for (let i = 0; i < size; i++) v += (x[i] - mean) * (x[i] - mean)
  v /= size
  const s = Math.sqrt(v + 1e-5)
  const y = new Float32Array(size)
  for (let i = 0; i < size; i++) y[i] = (x[i] - mean) / s * weight[i] + bias[i]
  return y
}

function relu(x) { for (let i = 0; i < x.length; i++) if (x[i] < 0) x[i] = 0; return x }

function dotProduct(a, b, size) {
  let sum = 0
  for (let i = 0; i < size; i++) sum += a[i] * b[i]
  return sum
}

// ═══ Forward: CPU (MLP 73→64→64→1) — только value ═══

function evaluateCpu(state) {
  if (!cpuWeights) return 0
  const x = encodeStateCpu(state, state.currentPlayer)
  const a1 = new Float32Array(64)
  for (let j = 0; j < 64; j++) {
    let sum = cpuWeights.b1[j]
    for (let i = 0; i < 73; i++) sum += x[i] * cpuWeights.w1[i][j]
    a1[j] = sum > 0 ? sum : 0
  }
  const a2 = new Float32Array(64)
  for (let j = 0; j < 64; j++) {
    let sum = cpuWeights.b2[j]
    for (let i = 0; i < 64; i++) sum += a1[i] * cpuWeights.w2[i][j]
    a2[j] = sum > 0 ? sum : 0
  }
  let sum = cpuWeights.b3[0]
  for (let i = 0; i < 64; i++) sum += a2[i] * cpuWeights.w3[i][0]
  return Math.tanh(sum)
}

// ═══ Forward: GPU backbone (ResNet 107→256×6→trunk 256-dim) ═══

function gpuBackbone(state) {
  if (!gpuWeights) return null
  const w = gpuWeights
  const x = encodeStateGpu(state, state.currentPlayer)

  let h = linear(x, w['proj.0.weight'], w['proj.0.bias'], 107, 256)
  h = layerNorm(h, w['proj.1.weight'], w['proj.1.bias'], 256)
  h = relu(h)

  for (let b = 0; b < 6; b++) {
    const p = `blocks.${b}`
    let out = linear(h, w[`${p}.fc1.weight`], w[`${p}.fc1.bias`], 256, 256)
    out = layerNorm(out, w[`${p}.ln1.weight`], w[`${p}.ln1.bias`], 256)
    out = relu(out)
    out = linear(out, w[`${p}.fc2.weight`], w[`${p}.fc2.bias`], 256, 256)
    out = layerNorm(out, w[`${p}.ln2.weight`], w[`${p}.ln2.bias`], 256)
    for (let i = 0; i < 256; i++) out[i] += h[i]
    h = relu(out)
  }
  return h
}

// ═══ Forward: Value head (trunk→64→1) ═══

function valueFromTrunk(trunk) {
  const w = gpuWeights
  let v = linear(trunk, w['value.0.weight'], w['value.0.bias'], 256, 64)
  v = relu(v)
  let val = w['value.2.bias'][0]
  for (let i = 0; i < 64; i++) val += v[i] * w['value.2.weight'][i]
  return Math.tanh(val)
}

// ═══ Forward: Policy context (trunk→Linear(256,64)→ReLU→64-dim) ═══

function policyContextFromTrunk(trunk) {
  const w = gpuWeights
  let ctx = linear(trunk, w['policy_ctx.0.weight'], w['policy_ctx.0.bias'], 256, 64)
  ctx = relu(ctx)
  return ctx
}

// ═══ Forward: Action encoding (35→64) ═══

function actionEmbed(actionFeats) {
  const w = gpuWeights
  return linear(actionFeats, w['action_enc.weight'], w['action_enc.bias'], ACTION_FEAT_SIZE, 64)
}

// ═══ GPU: value only (backward-совместимый) ═══

function evaluateGpu(state) {
  const trunk = gpuBackbone(state)
  if (!trunk) return evaluateCpu(state)
  return valueFromTrunk(trunk)
}

// ═══ GPU: полный evaluate с policy ═══

/**
 * Полная оценка позиции: value + policy priors для кандидатов.
 * Backbone прогоняется ОДИН раз для value + policy context.
 *
 * @param {GameState} state — текущее состояние
 * @param {Array} candidateActions — массив {transfer, placement, swap}
 * @returns {{value: number, priors: Float32Array}} — value ∈ [-1,1], priors — softmax вероятности
 */
function evaluateGpuFull(state, candidateActions) {
  const trunk = gpuBackbone(state)
  if (!trunk) return null

  const value = valueFromTrunk(trunk)

  if (!hasPolicyHead() || !candidateActions || candidateActions.length === 0) {
    return { value, priors: null }
  }

  const ctx = policyContextFromTrunk(trunk)
  const K = candidateActions.length
  const logits = new Float32Array(K)

  for (let j = 0; j < K; j++) {
    const af = encodeAction(state, candidateActions[j])
    const embed = actionEmbed(af)
    logits[j] = dotProduct(ctx, embed, 64)
  }

  // Softmax
  let maxL = -Infinity
  for (let j = 0; j < K; j++) if (logits[j] > maxL) maxL = logits[j]
  let sumExp = 0
  const priors = new Float32Array(K)
  for (let j = 0; j < K; j++) {
    priors[j] = Math.exp(logits[j] - maxL)
    sumExp += priors[j]
  }
  for (let j = 0; j < K; j++) priors[j] /= sumExp

  return { value, priors }
}

// ═══ API ═══

/** Value-only оценка (backward-совместимая) */
export function evaluate(state) {
  return useGpu ? evaluateGpu(state) : evaluateCpu(state)
}

/**
 * Полная оценка: value + policy priors для PUCT MCTS.
 * Возвращает null если GPU-сеть не загружена.
 */
export function evaluateFull(state, candidateActions) {
  if (!useGpu) return null
  return evaluateGpuFull(state, candidateActions)
}

export const encodeState = encodeStateCpu
