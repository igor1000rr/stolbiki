#!/usr/bin/env node
/**
 * Конвертация gpu_weights.json → gpu_weights.bin (Float32 binary)
 * Размер: ~8.1MB JSON → ~3.3MB binary (~800KB gzip)
 *
 * Формат .bin:
 *   [4 байта: кол-во ключей N]
 *   Для каждого ключа:
 *     [2 байта: длина имени ключа]
 *     [N байт: UTF-8 имя ключа]
 *     [4 байта: кол-во float значений M]
 *     [M * 4 байт: Float32 данные]
 *
 * Запуск: node scripts/convert_weights_bin.js
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = resolve(__dirname, '../src/engine/gpu_weights.json')
const outputPath = resolve(__dirname, '../src/engine/gpu_weights.bin')

console.log('Читаем gpu_weights.json...')
const weights = JSON.parse(readFileSync(inputPath, 'utf8'))
const keys = Object.keys(weights)
console.log(`Ключей: ${keys.length}`)

// Подсчёт размера
function flatten(val) {
  if (typeof val === 'number') return [val]
  if (Array.isArray(val)) return val.flat(Infinity)
  throw new Error(`Неожиданный тип: ${typeof val}`)
}

let totalFloats = 0
const entries = []
for (const key of keys) {
  const flat = flatten(weights[key])
  totalFloats += flat.length
  entries.push({ key, data: flat })
}

console.log(`Всего float32: ${totalFloats} (${(totalFloats * 4 / 1024 / 1024).toFixed(1)} MB)`)

// Записываем бинарный файл
const headerSize = 4 // кол-во ключей
let bodySize = 0
for (const { key, data } of entries) {
  bodySize += 2 + Buffer.byteLength(key, 'utf8') + 4 + data.length * 4
}

const buf = Buffer.alloc(headerSize + bodySize)
let offset = 0

// Кол-во ключей
buf.writeUInt32LE(entries.length, offset); offset += 4

for (const { key, data } of entries) {
  // Длина имени ключа
  const keyBuf = Buffer.from(key, 'utf8')
  buf.writeUInt16LE(keyBuf.length, offset); offset += 2
  // Имя ключа
  keyBuf.copy(buf, offset); offset += keyBuf.length
  // Кол-во float
  buf.writeUInt32LE(data.length, offset); offset += 4
  // Float32 данные
  for (const val of data) {
    buf.writeFloatLE(val, offset); offset += 4
  }
}

writeFileSync(outputPath, buf)
const jsonSize = readFileSync(inputPath).length
console.log(`✅ Готово: ${outputPath}`)
console.log(`   JSON: ${(jsonSize / 1024 / 1024).toFixed(1)} MB → BIN: ${(buf.length / 1024 / 1024).toFixed(1)} MB (${Math.round(buf.length / jsonSize * 100)}%)`)
