/**
 * Тесты skin-helpers.js — pure-функции работы со скинами.
 * Без БД, без сети — чистая логика.
 */

import { describe, it, expect } from 'vitest'
import { detectSkinCollision } from './skin-helpers.js'

describe('detectSkinCollision — Snappy Block detection', () => {
  describe('positive cases (collision detected)', () => {
    it('оба игрока имеют одинаковый blocks → true', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_neon' },
        { blocks: 'blocks_neon' }
      )).toBe(true)
    })

    it('оба используют legacy chipStyle с одним значением → true', () => {
      expect(detectSkinCollision(
        { chipStyle: 'classic' },
        { chipStyle: 'classic' }
      )).toBe(true)
    })

    it('один игрок blocks, другой chipStyle → совпадает по сравнению значений', () => {
      // Backward-compat: новый клиент шлёт blocks: 'blocks_classic',
      // старый chipStyle: 'classic' — это РАЗНЫЕ значения, поэтому false.
      // А если оба шлют 'classic' (один в blocks, другой в chipStyle) — то true.
      expect(detectSkinCollision(
        { blocks: 'classic' },
        { chipStyle: 'classic' }
      )).toBe(true)
    })

    it('blocks важнее chipStyle при наличии обоих (приоритет нового ключа)', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_neon', chipStyle: 'old_value' },
        { blocks: 'blocks_neon', chipStyle: 'different_old' }
      )).toBe(true)
    })

    it('игнорирует stands и background', () => {
      // Александр явно сказал — Snappy реагирует на блоки. Совпадающие
      // стенды/фоны не должны триггерить маскота.
      expect(detectSkinCollision(
        { blocks: 'blocks_classic', stands: 'stands_marble', background: 'bg_city_day' },
        { blocks: 'blocks_classic', stands: 'stands_obsidian', background: 'bg_city_night' }
      )).toBe(true)
    })
  })

  describe('negative cases (no collision)', () => {
    it('разные blocks → false', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_neon' },
        { blocks: 'blocks_glass' }
      )).toBe(false)
    })

    it('разные chipStyle → false', () => {
      expect(detectSkinCollision(
        { chipStyle: 'classic' },
        { chipStyle: 'flat' }
      )).toBe(false)
    })

    it('одинаковые stands но разные blocks → false (Александр про блоки)', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_neon', stands: 'stands_marble' },
        { blocks: 'blocks_glass', stands: 'stands_marble' }
      )).toBe(false)
    })

    it('одинаковые background но разные blocks → false', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_classic', background: 'bg_city_night' },
        { blocks: 'blocks_metal', background: 'bg_city_night' }
      )).toBe(false)
    })
  })

  describe('edge cases (defensive)', () => {
    it('null skinsA → false (не падает)', () => {
      expect(detectSkinCollision(null, { blocks: 'blocks_neon' })).toBe(false)
    })

    it('null skinsB → false', () => {
      expect(detectSkinCollision({ blocks: 'blocks_neon' }, null)).toBe(false)
    })

    it('оба null → false', () => {
      expect(detectSkinCollision(null, null)).toBe(false)
    })

    it('undefined inputs → false', () => {
      expect(detectSkinCollision(undefined, undefined)).toBe(false)
    })

    it('пустые объекты → false (нет blocks/chipStyle)', () => {
      expect(detectSkinCollision({}, {})).toBe(false)
    })

    it('один игрок без blocks/chipStyle → false', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_neon' },
        { stands: 'stands_marble' } // нет blocks/chipStyle
      )).toBe(false)
    })

    it('пустые строки blocks → false (falsy → || переключается на chipStyle, тоже undefined)', () => {
      expect(detectSkinCollision(
        { blocks: '' },
        { blocks: '' }
      )).toBe(false)
    })

    it('blocks=null fallback на chipStyle', () => {
      expect(detectSkinCollision(
        { blocks: null, chipStyle: 'classic' },
        { blocks: null, chipStyle: 'classic' }
      )).toBe(true)
    })
  })

  describe('реалистичные сценарии', () => {
    it('два новичка с дефолтным classic → коллизия (типичный matchmaking)', () => {
      // Большинство юзеров играют с blocks_classic — частая ситуация.
      expect(detectSkinCollision(
        { blocks: 'blocks_classic', stands: 'stands_classic', background: 'bg_city_night' },
        { blocks: 'blocks_classic', stands: 'stands_classic', background: 'bg_city_day' }
      )).toBe(true)
    })

    it('старый клиент vs новый клиент — оба classic', () => {
      // Старый клиент шлёт chipStyle, новый — blocks. Если значения совпадают,
      // то коллизия должна детектиться даже через границу формата.
      expect(detectSkinCollision(
        { chipStyle: 'classic', standStyle: 'classic' },             // старый
        { blocks: 'classic', stands: 'stands_classic' }              // новый, но legacy id
      )).toBe(true)
    })

    it('премиум скин против дефолтного — нет коллизии', () => {
      expect(detectSkinCollision(
        { blocks: 'blocks_neon' },
        { blocks: 'blocks_classic' }
      )).toBe(false)
    })
  })
})
