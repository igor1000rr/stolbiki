/**
 * Тесты для чистых utility-функций из admin/_utils.jsx: ago, fmtNum, fmtUptime.
 * Стили и React-компоненты покрывать не имеет смысла — только чистые formatters.
 */

import { describe, it, expect } from 'vitest'
import { ago, fmtNum, fmtUptime } from './_utils.jsx'

describe('ago', () => {
  it('returns «—» for null/undefined', () => {
    expect(ago(null)).toBe('—')
    expect(ago(undefined)).toBe('—')
    expect(ago('')).toBe('—')
  })

  it('«только что» для свежего timestamp (<60с)', () => {
    // Date(dateStr + 'Z') — нужен YYYY-MM-DD HH:mm:ss без TZ суффикса
    const now = new Date()
    const s = now.toISOString().slice(0, 19).replace('T', ' ')
    expect(ago(s)).toBe('только что')
  })

  it('«Xм назад» для timestamp 10 минут назад', () => {
    const d = new Date(Date.now() - 10 * 60 * 1000)
    const s = d.toISOString().slice(0, 19).replace('T', ' ')
    expect(ago(s)).toMatch(/10м\sназад/)
  })

  it('«Xч назад» для timestamp 2 часа назад', () => {
    const d = new Date(Date.now() - 2 * 3600 * 1000)
    const s = d.toISOString().slice(0, 19).replace('T', ' ')
    expect(ago(s)).toMatch(/2ч\sназад/)
  })

  it('«Xд назад» для timestamp 3 дня назад', () => {
    const d = new Date(Date.now() - 3 * 86400 * 1000)
    const s = d.toISOString().slice(0, 19).replace('T', ' ')
    expect(ago(s)).toMatch(/3д\sназад/)
  })

  it('date format для timestamp старше 30 дней', () => {
    const d = new Date(Date.now() - 100 * 86400 * 1000)
    const s = d.toISOString().slice(0, 19).replace('T', ' ')
    const out = ago(s)
    // Должен быть дата формата "DD.MM.YYYY"
    expect(out).toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/)
  })
})

describe('fmtNum', () => {
  it('returns small numbers as-is', () => {
    expect(fmtNum(0)).toBe('0')
    expect(fmtNum(1)).toBe('1')
    expect(fmtNum(42)).toBe('42')
    expect(fmtNum(999)).toBe('999')
  })

  it('1000+ → K suffix with 1 decimal', () => {
    expect(fmtNum(1000)).toBe('1.0K')
    expect(fmtNum(1500)).toBe('1.5K')
    expect(fmtNum(12345)).toBe('12.3K')
    expect(fmtNum(999999)).toBe('1000.0K')
  })

  it('1_000_000+ → M suffix with 1 decimal', () => {
    expect(fmtNum(1000000)).toBe('1.0M')
    expect(fmtNum(1500000)).toBe('1.5M')
    expect(fmtNum(12345678)).toBe('12.3M')
  })

  it('boundary exactness 1000 and 1_000_000', () => {
    // 999 < 1000 → "999"
    expect(fmtNum(999)).toBe('999')
    // 1000 → "1.0K"
    expect(fmtNum(1000)).toBe('1.0K')
    // 999999 < 1M → "1000.0K"
    expect(fmtNum(999999)).toBe('1000.0K')
    // 1_000_000 → "1.0M"
    expect(fmtNum(1000000)).toBe('1.0M')
  })
})

describe('fmtUptime', () => {
  it('seconds only → Xм format (всегда минуты даже для 30 сек)', () => {
    expect(fmtUptime(30)).toBe('0м')
    expect(fmtUptime(60)).toBe('1м')
    expect(fmtUptime(120)).toBe('2м')
  })

  it('hours → Xч Yм format', () => {
    expect(fmtUptime(3600)).toBe('1ч 0м')
    expect(fmtUptime(3660)).toBe('1ч 1м')
    expect(fmtUptime(7320)).toBe('2ч 2м')
  })

  it('days → Xд Yч format (no minutes)', () => {
    expect(fmtUptime(86400)).toBe('1д 0ч')
    expect(fmtUptime(86400 + 3600)).toBe('1д 1ч')
    expect(fmtUptime(86400 * 3 + 7200)).toBe('3д 2ч')
  })

  it('boundary: 59мин = "59м", 60мин = "1ч 0м"', () => {
    expect(fmtUptime(59 * 60)).toBe('59м')
    expect(fmtUptime(60 * 60)).toBe('1ч 0м')
  })

  it('boundary: 23ч = "23ч Xм", 24ч = "1д 0ч"', () => {
    expect(fmtUptime(23 * 3600)).toBe('23ч 0м')
    expect(fmtUptime(24 * 3600)).toBe('1д 0ч')
  })
})
