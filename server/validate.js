/**
 * Валидация и санитизация входных данных
 * Используется во всех POST/PUT endpoints
 */

// Удаляет HTML-теги и опасные символы
export function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim()
}

// Валидация строки с ограничением длины
export function str(val, maxLen = 200) {
  if (typeof val !== 'string') return null
  const clean = sanitize(val)
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean
}

// Валидация числа в диапазоне
export function num(val, min = 0, max = Infinity) {
  const n = Number(val)
  if (isNaN(n)) return null
  return Math.max(min, Math.min(max, n))
}

// Валидация slug (буквы, цифры, дефис)
export function slug(val) {
  if (typeof val !== 'string') return null
  return val.replace(/[^a-z0-9_-]/gi, '').slice(0, 100) || null
}

// Валидация username
export function username(val) {
  if (typeof val !== 'string') return null
  const clean = val.replace(/[^a-zA-Zа-яА-ЯёЁ0-9_.-]/g, '').slice(0, 30)
  return clean.length >= 2 ? clean : null
}

// Валидация password (мин 6 символов — синхронизировано с routes/auth.js)
export function password(val) {
  if (typeof val !== 'string') return null
  return val.length >= 6 && val.length <= 100 ? val : null
}
