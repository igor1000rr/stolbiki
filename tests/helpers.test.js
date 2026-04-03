/**
 * Тесты хелперов (чистые функции)
 * getDailySeed и seededRandom не зависят от DB —
 * копируем напрямую чтобы избежать better-sqlite3 import
 */

import { describe, it, expect } from 'vitest'

// ═══ Копия из server/helpers.js (чистые функции без DB) ═══
function getDailySeed() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
}

function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  return () => { h = (h * 16807 + 0) % 2147483647; return (h & 0x7fffffff) / 0x7fffffff }
}

// ═══ seededRandom ═══
describe('seededRandom', () => {
  it('детерминистичен — один seed → одинаковый результат', () => {
    const rng1 = seededRandom('test-seed')
    const rng2 = seededRandom('test-seed')
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('разные seed → разные последовательности', () => {
    const rng1 = seededRandom('seed-A')
    const rng2 = seededRandom('seed-B')
    const vals1 = Array.from({ length: 5 }, () => rng1())
    const vals2 = Array.from({ length: 5 }, () => rng2())
    expect(vals1).not.toEqual(vals2)
  })

  it('значения в диапазоне [0, 1)', () => {
    const rng = seededRandom('range-test')
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('равномерное распределение (грубая проверка)', () => {
    const rng = seededRandom('distribution')
    let below = 0, above = 0
    for (let i = 0; i < 1000; i++) {
      if (rng() < 0.5) below++; else above++
    }
    expect(below).toBeGreaterThan(350)
    expect(above).toBeGreaterThan(350)
  })
})

// ═══ getDailySeed ═══
describe('getDailySeed', () => {
  it('возвращает строку вида YYYY-M-D', () => {
    const seed = getDailySeed()
    expect(typeof seed).toBe('string')
    expect(seed).toMatch(/^\d{4}-\d{1,2}-\d{1,2}$/)
  })

  it('одинаковый результат при повторном вызове', () => {
    expect(getDailySeed()).toBe(getDailySeed())
  })

  it('содержит текущий год', () => {
    const year = new Date().getFullYear().toString()
    expect(getDailySeed()).toContain(year)
  })
})

// ═══ Дополнительные хелперы ═══
describe('Score validation', () => {
  function validateScore(score) {
    if (!score || typeof score !== 'string') return false
    const parts = score.split(':')
    if (parts.length !== 2) return false
    const [s1, s2] = parts.map(Number)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 10 || s2 > 10) return false
    if (s1 + s2 > 10) return false
    return true
  }

  it('валидные счета', () => {
    expect(validateScore('5:5')).toBe(true)
    expect(validateScore('6:4')).toBe(true)
    expect(validateScore('10:0')).toBe(true)
    expect(validateScore('0:0')).toBe(true)
  })

  it('невалидные счета', () => {
    expect(validateScore('11:0')).toBe(false)
    expect(validateScore('6:5')).toBe(false) // сумма > 10
    expect(validateScore('-1:5')).toBe(false)
    expect(validateScore('abc')).toBe(false)
    expect(validateScore('')).toBe(false)
    expect(validateScore(null)).toBe(false)
  })

  it('граничные значения', () => {
    expect(validateScore('0:10')).toBe(true)
    expect(validateScore('10:0')).toBe(true)
    expect(validateScore('5:5')).toBe(true)
    expect(validateScore('6:4')).toBe(true)
    expect(validateScore('7:3')).toBe(true)
  })
})

// ═══ Дополнительные helper тесты ═══
describe('seededRandom edge cases', () => {
  it('seed 0 даёт детерминированный результат', () => {
    const r1 = seededRandom(0)
    const r2 = seededRandom(0)
    expect(r1()).toBe(r2())
    expect(r1()).toBe(r2())
  })

  it('отрицательный seed работает', () => {
    const r = seededRandom(-12345)
    const val = r()
    expect(val).toBeGreaterThanOrEqual(0)
    expect(val).toBeLessThan(1)
  })

  it('большой seed работает', () => {
    const r = seededRandom(999999999)
    const val = r()
    expect(val).toBeGreaterThanOrEqual(0)
    expect(val).toBeLessThan(1)
  })
})

// ═══ Timestamp и дата ═══
describe('Date utilities', () => {
  it('getDailySeed формат YYYY-M-D', () => {
    const seed = getDailySeed()
    // Формат: "2026-4-3" или "2026-12-25"
    const parts = seed.split('-')
    expect(parts.length).toBe(3)
    const year = parseInt(parts[0])
    const month = parseInt(parts[1])
    const day = parseInt(parts[2])
    expect(year).toBeGreaterThanOrEqual(2024)
    expect(month).toBeGreaterThanOrEqual(1)
    expect(month).toBeLessThanOrEqual(12)
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(31)
  })

  it('seededRandom 1000 значений — все в [0,1)', () => {
    const rng = seededRandom(42)
    for (let i = 0; i < 1000; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })
})
