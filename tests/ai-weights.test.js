/**
 * Тесты AI весов v7 — проверяем gpu_weights.bin:
 *   - Парсинг бинарного формата
 *   - Value forward pass (как раньше)
 *   - Policy forward pass (новое)
 *   - Backward compatibility с v6 (56 ключей, без policy)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ═══ Парсинг бинарного формата (копия из neuralnet.js) ═══
function parseBinaryWeights(buffer) {
  const view = new DataView(buffer)
  let offset = 0
  const numKeys = view.getUint32(offset, true); offset += 4
  const weights = {}
  const decoder = new TextDecoder()

  for (let k = 0; k < numKeys; k++) {
    const keyLen = view.getUint16(offset, true); offset += 2
    const keyBytes = new Uint8Array(buffer, offset, keyLen)
    const key = decoder.decode(keyBytes); offset += keyLen
    const numFloats = view.getUint32(offset, true); offset += 4
    const arr = new Float32Array(numFloats)
    for (let i = 0; i < numFloats; i++) {
      arr[i] = view.getFloat32(offset + i * 4, true)
    }
    offset += numFloats * 4
    weights[key] = arr
  }
  return weights
}

// ═══ Math utils ═══
function linear(x, w, b, inF, outF) {
  const out = new Float32Array(outF)
  for (let o = 0; o < outF; o++) {
    let s = b[o]
    for (let i = 0; i < inF; i++) s += x[i] * w[o * inF + i]
    out[o] = s
  }
  return out
}

function layerNorm(x, g, b, n) {
  let mean = 0, variance = 0
  for (let i = 0; i < n; i++) mean += x[i]
  mean /= n
  for (let i = 0; i < n; i++) variance += (x[i] - mean) ** 2
  variance /= n
  const std = Math.sqrt(variance + 1e-5)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = g[i] * ((x[i] - mean) / std) + b[i]
  return out
}

function relu(x) {
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? x[i] : 0
  return out
}

function add(a, b) {
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i]
  return out
}

function dotProduct(a, b, n) {
  let sum = 0
  for (let i = 0; i < n; i++) sum += a[i] * b[i]
  return sum
}

// ═══ Forward: backbone + value ═══
function gpuBackbone(input, w) {
  let h = linear(input, w['proj.0.weight'], w['proj.0.bias'], 107, 256)
  h = layerNorm(h, w['proj.1.weight'], w['proj.1.bias'], 256)
  h = relu(h)

  for (let b = 0; b < 6; b++) {
    const p = `blocks.${b}`
    let r = linear(h, w[`${p}.fc1.weight`], w[`${p}.fc1.bias`], 256, 256)
    r = layerNorm(r, w[`${p}.ln1.weight`], w[`${p}.ln1.bias`], 256)
    r = relu(r)
    r = linear(r, w[`${p}.fc2.weight`], w[`${p}.fc2.bias`], 256, 256)
    r = layerNorm(r, w[`${p}.ln2.weight`], w[`${p}.ln2.bias`], 256)
    h = relu(add(h, r))
  }
  return h
}

function valueFromTrunk(trunk, w) {
  let v = linear(trunk, w['value.0.weight'], w['value.0.bias'], 256, 64)
  v = relu(v)
  let val = w['value.2.bias'][0]
  for (let i = 0; i < 64; i++) val += v[i] * w['value.2.weight'][i]
  return Math.tanh(val)
}

function gpuForward(input, w) {
  const trunk = gpuBackbone(input, w)
  return valueFromTrunk(trunk, w)
}

// ═══ Forward: policy ═══
function policyForward(trunk, actionFeats, w) {
  // Policy context: Linear(256→64) + ReLU
  let ctx = linear(trunk, w['policy_ctx.0.weight'], w['policy_ctx.0.bias'], 256, 64)
  ctx = relu(ctx)
  // Action embedding: Linear(35→64)
  const embed = linear(actionFeats, w['action_enc.weight'], w['action_enc.bias'], 35, 64)
  // Dot product
  return dotProduct(ctx, embed, 64)
}

// ═══ Загрузка весов ═══
const binPath = resolve('src/engine/gpu_weights.bin')
let weights
let hasPolicyHead = false

// Количество ключей зависит от версии: 56 (v6) или 60 (v7)
const V6_KEYS = 56
const V7_KEYS = 60

describe('AI gpu_weights.bin', () => {
  it('файл существует и парсится', () => {
    const buf = readFileSync(binPath)
    expect(buf.length).toBeGreaterThan(1_000_000)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    weights = parseBinaryWeights(ab)
    const numKeys = Object.keys(weights).length
    expect([V6_KEYS, V7_KEYS]).toContain(numKeys)
    hasPolicyHead = numKeys === V7_KEYS
  })

  it('все backbone + value ключи присутствуют (56 ключей)', () => {
    const expected = ['proj.0.weight', 'proj.0.bias', 'proj.1.weight', 'proj.1.bias']
    for (let b = 0; b < 6; b++) {
      for (const layer of ['fc1', 'fc2']) {
        expected.push(`blocks.${b}.${layer}.weight`, `blocks.${b}.${layer}.bias`)
      }
      for (const ln of ['ln1', 'ln2']) {
        expected.push(`blocks.${b}.${ln}.weight`, `blocks.${b}.${ln}.bias`)
      }
    }
    expected.push('value.0.weight', 'value.0.bias', 'value.2.weight', 'value.2.bias')

    expect(expected.length).toBe(V6_KEYS)
    for (const key of expected) {
      expect(weights[key], `missing key: ${key}`).toBeDefined()
      expect(weights[key].length, `empty key: ${key}`).toBeGreaterThan(0)
    }
  })

  it('размеры backbone + value весов корректные', () => {
    expect(weights['proj.0.weight'].length).toBe(107 * 256)
    expect(weights['proj.0.bias'].length).toBe(256)
    expect(weights['proj.1.weight'].length).toBe(256)
    expect(weights['proj.1.bias'].length).toBe(256)

    for (let b = 0; b < 6; b++) {
      expect(weights[`blocks.${b}.fc1.weight`].length).toBe(256 * 256)
      expect(weights[`blocks.${b}.fc1.bias`].length).toBe(256)
      expect(weights[`blocks.${b}.fc2.weight`].length).toBe(256 * 256)
      expect(weights[`blocks.${b}.fc2.bias`].length).toBe(256)
      expect(weights[`blocks.${b}.ln1.weight`].length).toBe(256)
      expect(weights[`blocks.${b}.ln2.weight`].length).toBe(256)
    }

    expect(weights['value.0.weight'].length).toBe(256 * 64)
    expect(weights['value.0.bias'].length).toBe(64)
    expect(weights['value.2.weight'].length).toBe(64)
    expect(weights['value.2.bias'].length).toBe(1)
  })

  it('policy head ключи (если v7)', () => {
    if (!hasPolicyHead) return // Пропускаем для v6

    const policyKeys = [
      'policy_ctx.0.weight', 'policy_ctx.0.bias',
      'action_enc.weight', 'action_enc.bias',
    ]
    for (const key of policyKeys) {
      expect(weights[key], `missing policy key: ${key}`).toBeDefined()
    }
    // Размеры policy head
    expect(weights['policy_ctx.0.weight'].length).toBe(256 * 64)
    expect(weights['policy_ctx.0.bias'].length).toBe(64)
    expect(weights['action_enc.weight'].length).toBe(35 * 64)
    expect(weights['action_enc.bias'].length).toBe(64)
  })

  it('общее кол-во параметров', () => {
    const total = Object.values(weights).reduce((s, w) => s + w.length, 0)
    if (hasPolicyHead) {
      // v7: 840,321 + 256*64+64 + 35*64+64 = 840,321 + 16,448 + 2,304 = 859,073
      expect(total).toBe(859073)
    } else {
      // v6: 840,321
      expect(total).toBe(840321)
    }
  })

  it('веса не содержат NaN или Infinity', () => {
    for (const [key, arr] of Object.entries(weights)) {
      for (let i = 0; i < arr.length; i++) {
        if (isNaN(arr[i]) || !isFinite(arr[i])) {
          throw new Error(`${key}[${i}] = ${arr[i]}`)
        }
      }
    }
  })

  it('value forward pass на пустом состоянии → число [-1, 1]', () => {
    const input = new Float32Array(107)
    const val = gpuForward(input, weights)
    expect(val).toBeGreaterThanOrEqual(-1)
    expect(val).toBeLessThanOrEqual(1)
    expect(isNaN(val)).toBe(false)
  })

  it('value forward pass на разных состояниях → разные значения', () => {
    const results = new Set()
    for (let trial = 0; trial < 10; trial++) {
      const input = new Float32Array(107)
      for (let i = 0; i < 107; i++) input[i] = Math.random() * 2 - 1
      const val = gpuForward(input, weights)
      expect(val).toBeGreaterThanOrEqual(-1)
      expect(val).toBeLessThanOrEqual(1)
      results.add(val.toFixed(4))
    }
    expect(results.size).toBeGreaterThanOrEqual(5)
  })

  it('value forward pass детерминированный', () => {
    const input = new Float32Array(107)
    input[0] = 0.5; input[10] = -0.3; input[50] = 1.0
    const val1 = gpuForward(input, weights)
    const val2 = gpuForward(input, weights)
    expect(val1).toBe(val2)
  })

  it('policy forward pass → конечное число (если v7)', () => {
    if (!hasPolicyHead) return

    const input = new Float32Array(107)
    input[0] = 0.5; input[10] = 0.3
    const trunk = gpuBackbone(input, weights)

    // Action: transfer [0]→[1], place 2 chips on stand 3
    const actionFeats = new Float32Array(35)
    actionFeats[1] = 1.0   // has_transfer
    actionFeats[2] = 1.0   // src=0
    actionFeats[13] = 1.0  // dst=1
    actionFeats[22] = 0.2  // group_size
    actionFeats[27] = 0.67 // stand 3 = 2 chips / 3
    actionFeats[34] = 0.67 // total = 2/3

    const logit = policyForward(trunk, actionFeats, weights)
    expect(isNaN(logit)).toBe(false)
    expect(isFinite(logit)).toBe(true)
  })

  it('policy различает разные ходы (если v7)', () => {
    if (!hasPolicyHead) return

    const input = new Float32Array(107)
    for (let i = 0; i < 107; i++) input[i] = Math.random() * 0.5
    const trunk = gpuBackbone(input, weights)

    const logits = []
    for (let trial = 0; trial < 10; trial++) {
      const af = new Float32Array(35)
      // Разные ходы
      af[1] = trial < 5 ? 1.0 : 0.0
      af[2 + (trial % 10)] = 1.0
      af[12 + ((trial + 3) % 10)] = 1.0
      af[24 + (trial % 10)] = (trial + 1) / 10
      af[34] = (trial + 1) / 10

      logits.push(policyForward(trunk, af, weights))
    }

    // Хотя бы 3 различных logit'а
    const unique = new Set(logits.map(l => l.toFixed(3)))
    expect(unique.size).toBeGreaterThanOrEqual(3)
  })

  it('policy softmax суммируется в 1 (если v7)', () => {
    if (!hasPolicyHead) return

    const input = new Float32Array(107)
    for (let i = 0; i < 107; i++) input[i] = Math.random()
    const trunk = gpuBackbone(input, weights)

    const K = 5
    const logits = new Float32Array(K)
    for (let j = 0; j < K; j++) {
      const af = new Float32Array(35)
      af[24 + j] = 1.0
      af[34] = 1 / 3
      logits[j] = policyForward(trunk, af, weights)
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

    const total = priors.reduce((a, b) => a + b, 0)
    expect(Math.abs(total - 1.0)).toBeLessThan(1e-5)
  })
})
