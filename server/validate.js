// @ts-check
/**
 * Валидация и санитизация входных данных
 * Используется во всех POST/PUT endpoints
 */

/** Удаляет HTML-теги и опасные символы. @param {unknown} str */
export function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim()
}

/** Валидация строки с ограничением длины. @param {unknown} val @param {number} [maxLen] */
export function str(val, maxLen = 200) {
  if (typeof val !== 'string') return null
  const clean = sanitize(val)
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean
}

/** Валидация числа в диапазоне. @param {unknown} val @param {number} [min] @param {number} [max] */
export function num(val, min = 0, max = Infinity) {
  const n = Number(val)
  if (isNaN(n)) return null
  return Math.max(min, Math.min(max, n))
}

/** Валидация slug (буквы, цифры, дефис). @param {unknown} val */
export function slug(val) {
  if (typeof val !== 'string') return null
  return val.replace(/[^a-z0-9_-]/gi, '').slice(0, 100) || null
}

/** Валидация username. @param {unknown} val */
export function username(val) {
  if (typeof val !== 'string') return null
  const clean = val.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_.-]/g, '').slice(0, 30)
  return clean.length >= 2 ? clean : null
}

// Sync с PASSWORD_MIN из routes/auth.js (8 символов, NIST 800-63B).
// Раньше тут было 6 — рассинхрон с auth.js где уже 8.
/** Валидация password. @param {unknown} val */
export function password(val) {
  if (typeof val !== 'string') return null
  return val.length >= 8 && val.length <= 100 ? val : null
}
