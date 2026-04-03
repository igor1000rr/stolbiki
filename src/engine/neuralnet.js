/**
 * Нейросеть для оценки позиции в браузере
 * 
 * GPU-сеть: ResNet 107→256→[6 ResBlocks]→64→1 (840,321 params)
 *   - gpu_weights.bin (~3.3MB, ~800KB gzip) — binary Float32
 *   - gpu_weights.bin (~3.2MB, ~800KB gzip) — binary формат
 * CPU-сеть: MLP 73→64→64→1 (8,961 params) — fallback
 *   - net_weights.json (179KB), 239K партий
 * 
 * GPU грузится LAZY — только при выборе сложности Hard+.
 * CPU грузится сразу при импорте.
 */

import { GOLDEN_STAND, MAX_CHIPS } from './game.js'

let cpuWeights = null
let gpuWeights = null
let loadingCpu = null
let loadingGpu = null
let useGpu = false

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
    // Копируем чтобы не зависеть от ArrayBuffer alignment
    weights[key] = new Float32Array(data)
  }
  return weights
}

// ═══ Загрузка ═══

/** Загружает CPU-сеть (вызывается автоматически при импорте) */
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

/** Загружает GPU-сеть (вызывается при выборе Hard+ сложности) */
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

// ═══ Кодирование: CPU (73 фичи) ═══

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

// ═══ Кодирование: GPU (107 фич) — копия Python encode_state ═══

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

// ═══ Forward: CPU (MLP 73→64→64→1) ═══

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

// ═══ Forward: GPU (ResNet 107→256→6×ResBlock→64→1) ═══

function evaluateGpu(state) {
  if (!gpuWeights) return evaluateCpu(state)
  const w = gpuWeights
  const x = encodeStateGpu(state, state.currentPlayer)

  // proj: Linear(107→256) + LayerNorm(256) + ReLU
  let h = linear(x, w['proj.0.weight'], w['proj.0.bias'], 107, 256)
  h = layerNorm(h, w['proj.1.weight'], w['proj.1.bias'], 256)
  h = relu(h)

  // 6 × ResBlock
  for (let b = 0; b < 6; b++) {
    const p = `blocks.${b}`
    let out = linear(h, w[`${p}.fc1.weight`], w[`${p}.fc1.bias`], 256, 256)
    out = layerNorm(out, w[`${p}.ln1.weight`], w[`${p}.ln1.bias`], 256)
    out = relu(out)
    out = linear(out, w[`${p}.fc2.weight`], w[`${p}.fc2.bias`], 256, 256)
    out = layerNorm(out, w[`${p}.ln2.weight`], w[`${p}.ln2.bias`], 256)
    for (let i = 0; i < 256; i++) out[i] += h[i] // skip connection
    h = relu(out)
  }

  // value: Linear(256→64) + ReLU + Linear(64→1) + Tanh
  let v = linear(h, w['value.0.weight'], w['value.0.bias'], 256, 64)
  v = relu(v)
  let val = w['value.2.bias'][0]
  for (let i = 0; i < 64; i++) val += v[i] * w['value.2.weight'][i]
  return Math.tanh(val)
}

// ═══ API ═══

export function evaluate(state) {
  return useGpu ? evaluateGpu(state) : evaluateCpu(state)
}

export const encodeState = encodeStateCpu
