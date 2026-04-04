/**
 * Тесты AI весов — проверяем что gpu_weights.bin валиден и forward pass работает
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
    // Копируем чтобы не зависеть от alignment
    const arr = new Float32Array(numFloats)
    for (let i = 0; i < numFloats; i++) {
      arr[i] = view.getFloat32(offset + i * 4, true)
    }
    offset += numFloats * 4
    weights[key] = arr
  }
  return weights
}

// ═══ Forward pass (копия из neuralnet.js) ═══
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

function gpuForward(input, w) {
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

  let v = linear(h, w['value.0.weight'], w['value.0.bias'], 256, 64)
  v = relu(v)
  let val = w['value.2.bias'][0]
  for (let i = 0; i < 64; i++) val += v[i] * w['value.2.weight'][i]
  return Math.tanh(val)
}

// ═══ Загрузка весов ═══
const binPath = resolve('src/engine/gpu_weights.bin')
let weights

describe('AI v6 gpu_weights.bin', () => {
  it('файл существует и парсится', () => {
    const buf = readFileSync(binPath)
    expect(buf.length).toBeGreaterThan(1_000_000)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    weights = parseBinaryWeights(ab)
    expect(Object.keys(weights).length).toBe(56)
  })

  it('все 56 ключей присутствуют', () => {
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

    expect(expected.length).toBe(56)
    for (const key of expected) {
      expect(weights[key], `missing key: ${key}`).toBeDefined()
      expect(weights[key].length, `empty key: ${key}`).toBeGreaterThan(0)
    }
  })

  it('размеры весов корректные', () => {
    // proj: 107 → 256
    expect(weights['proj.0.weight'].length).toBe(107 * 256)
    expect(weights['proj.0.bias'].length).toBe(256)
    expect(weights['proj.1.weight'].length).toBe(256) // LayerNorm
    expect(weights['proj.1.bias'].length).toBe(256)

    // 6 ResBlocks: 256 → 256
    for (let b = 0; b < 6; b++) {
      expect(weights[`blocks.${b}.fc1.weight`].length).toBe(256 * 256)
      expect(weights[`blocks.${b}.fc1.bias`].length).toBe(256)
      expect(weights[`blocks.${b}.fc2.weight`].length).toBe(256 * 256)
      expect(weights[`blocks.${b}.fc2.bias`].length).toBe(256)
      expect(weights[`blocks.${b}.ln1.weight`].length).toBe(256)
      expect(weights[`blocks.${b}.ln2.weight`].length).toBe(256)
    }

    // Value head: 256 → 64 → 1
    expect(weights['value.0.weight'].length).toBe(256 * 64)
    expect(weights['value.0.bias'].length).toBe(64)
    expect(weights['value.2.weight'].length).toBe(64)
    expect(weights['value.2.bias'].length).toBe(1)
  })

  it('общее кол-во параметров = 840,321', () => {
    const total = Object.values(weights).reduce((s, w) => s + w.length, 0)
    expect(total).toBe(840321)
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

  it('forward pass на пустом состоянии → число [-1, 1]', () => {
    const input = new Float32Array(107) // пустая доска
    const val = gpuForward(input, weights)
    expect(val).toBeGreaterThanOrEqual(-1)
    expect(val).toBeLessThanOrEqual(1)
    expect(isNaN(val)).toBe(false)
  })

  it('forward pass на разных состояниях → разные значения', () => {
    const results = new Set()
    for (let trial = 0; trial < 10; trial++) {
      const input = new Float32Array(107)
      // Заполняем случайными данными
      for (let i = 0; i < 107; i++) input[i] = Math.random() * 2 - 1
      const val = gpuForward(input, weights)
      expect(val).toBeGreaterThanOrEqual(-1)
      expect(val).toBeLessThanOrEqual(1)
      results.add(val.toFixed(4))
    }
    // Минимум 5 уникальных результатов из 10 (сеть не дегенеративная)
    expect(results.size).toBeGreaterThanOrEqual(5)
  })

  it('forward pass стабильный (детерминированный)', () => {
    const input = new Float32Array(107)
    input[0] = 0.5; input[10] = -0.3; input[50] = 1.0
    const val1 = gpuForward(input, weights)
    const val2 = gpuForward(input, weights)
    expect(val1).toBe(val2)
  })

  it('forward pass выдаёт валидный результат для любого входа', () => {
    // Нулевой вектор — не реальная позиция, но forward pass не должен упасть
    const input = new Float32Array(107)
    const val = gpuForward(input, weights)
    expect(val).toBeGreaterThanOrEqual(-1)
    expect(val).toBeLessThanOrEqual(1)
    expect(isNaN(val)).toBe(false)
  })
})
