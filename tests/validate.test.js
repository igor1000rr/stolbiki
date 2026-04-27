/**
 * Тесты модуля валидации
 * Покрытие: sanitize, str, num, slug, username, password
 */

import { describe, it, expect } from 'vitest'
import { sanitize, str, num, slug, username, password } from '../server/validate.js'

// ═══ sanitize ═══
describe('sanitize', () => {
  it('удаляет HTML теги', () => {
    expect(sanitize('<script>alert(1)</script>')).toBe('alert(1)')
    expect(sanitize('<b>bold</b>')).toBe('bold')
    expect(sanitize('hello <img src=x onerror=alert(1)>')).toBe('hello')
  })

  it('удаляет опасные символы', () => {
    expect(sanitize('test<>"\'')).toBe('test')
    expect(sanitize('test`cmd`')).toBe('testcmd')
  })

  it('тримит пробелы', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })

  it('возвращает пустую строку для не-строк', () => {
    expect(sanitize(null)).toBe('')
    expect(sanitize(undefined)).toBe('')
    expect(sanitize(123)).toBe('')
    expect(sanitize({})).toBe('')
  })

  it('пропускает безопасный текст', () => {
    expect(sanitize('Привет мир')).toBe('Привет мир')
    expect(sanitize('hello-world_123')).toBe('hello-world_123')
  })
})

// ═══ str ═══
describe('str', () => {
  it('обрезает по maxLen', () => {
    expect(str('abcde', 3)).toBe('abc')
    expect(str('ab', 3)).toBe('ab')
  })

  it('по умолчанию maxLen = 200', () => {
    const long = 'a'.repeat(250)
    expect(str(long).length).toBe(200)
  })

  it('санитизирует', () => {
    expect(str('<b>test</b>')).toBe('test')
  })

  it('null для не-строк', () => {
    expect(str(null)).toBeNull()
    expect(str(123)).toBeNull()
  })
})

// ═══ num ═══
describe('num', () => {
  it('парсит числа', () => {
    expect(num('42')).toBe(42)
    expect(num(3.14)).toBe(3.14)
    expect(num('0')).toBe(0)
  })

  it('ограничивает диапазон', () => {
    expect(num(150, 0, 100)).toBe(100)
    expect(num(-5, 0, 100)).toBe(0)
    expect(num(50, 0, 100)).toBe(50)
  })

  it('null для не-числовых', () => {
    expect(num('abc')).toBeNull()
    expect(num(NaN)).toBeNull()
    expect(num(undefined)).toBeNull()
  })

  it('работает с отрицательными', () => {
    expect(num(-10, -100, 100)).toBe(-10)
    expect(num(-200, -100, 100)).toBe(-100)
  })
})

// ═══ slug ═══
describe('slug', () => {
  it('оставляет буквы цифры дефис подчёркивание', () => {
    expect(slug('hello-world_123')).toBe('hello-world_123')
  })

  it('удаляет спецсимволы', () => {
    expect(slug('hello world!')).toBe('helloworld')
    expect(slug('тест@#$%')).toBeNull() // Кириллица удаляется → пусто → null
  })

  it('обрезает до 100 символов', () => {
    expect(slug('a'.repeat(150)).length).toBe(100)
  })

  it('null для пустого результата', () => {
    expect(slug('!!!@@@')).toBeNull()
    expect(slug('')).toBeNull()
  })

  it('null для не-строк', () => {
    expect(slug(123)).toBeNull()
    expect(slug(null)).toBeNull()
  })
})

// ═══ username ═══
describe('username', () => {
  it('допускает латиницу', () => {
    expect(username('Player1')).toBe('Player1')
  })

  it('допускает кириллицу', () => {
    expect(username('Игрок')).toBe('Игрок')
    expect(username('ёЁ')).toBe('ёЁ')
  })

  it('допускает точку дефис подчёркивание', () => {
    expect(username('user.name')).toBe('user.name')
    expect(username('user-name')).toBe('user-name')
    expect(username('user_name')).toBe('user_name')
  })

  it('удаляет спецсимволы', () => {
    expect(username('user@hack')).toBe('userhack')
    expect(username('user<script>')).toBe('userscript')
  })

  it('null если < 2 символов', () => {
    expect(username('a')).toBeNull()
    expect(username('')).toBeNull()
  })

  it('обрезает до 30 символов', () => {
    expect(username('a'.repeat(50)).length).toBe(30)
  })

  it('null для не-строк', () => {
    expect(username(123)).toBeNull()
    expect(username(null)).toBeNull()
  })
})

// ═══ password ═══
// Минимум 8 символов — sync с PASSWORD_MIN из routes/auth.js (NIST 800-63B)
describe('password', () => {
  it('допускает 8+ символов', () => {
    expect(password('12345678')).toBe('12345678')
    expect(password('abcdefgh')).toBe('abcdefgh')
  })

  it('null если < 8 символов', () => {
    expect(password('1234567')).toBeNull()
    expect(password('123456')).toBeNull()
    expect(password('abc')).toBeNull()
    expect(password('')).toBeNull()
  })

  it('null если > 100 символов', () => {
    expect(password('a'.repeat(101))).toBeNull()
  })

  it('допускает ровно 8 и ровно 100', () => {
    expect(password('a'.repeat(8))).toBe('a'.repeat(8))
    expect(password('a'.repeat(100))).toBe('a'.repeat(100))
  })

  it('null для не-строк', () => {
    expect(password(12345678)).toBeNull()
    expect(password(null)).toBeNull()
  })

  it('не модифицирует спецсимволы в пароле', () => {
    expect(password('P@ss!w0rd#')).toBe('P@ss!w0rd#')
  })
})

// ═══ Edge cases ═══
describe('Edge cases', () => {
  it('sanitize: nested tags', () => {
    expect(sanitize('<<script>>')).toBe('')
    expect(sanitize('<div<div>>')).toBe('')
  })

  it('sanitize: unicode сохраняется', () => {
    expect(sanitize('Привет 世界 🎮')).toBe('Привет 世界 🎮')
  })

  it('str: пустая строка', () => {
    expect(str('')).toBe('')
    expect(str('   ')).toBe('')
  })

  it('num: Infinity и -Infinity', () => {
    expect(num(Infinity, 0, 100)).toBe(100)
    expect(num(-Infinity, 0, 100)).toBe(0)
  })

  it('username: ровно 2 символа (минимум)', () => {
    expect(username('ab')).toBe('ab')
    expect(username('яя')).toBe('яя')
  })

  it('slug: смешанный регистр сохраняется', () => {
    expect(slug('Hello-World')).toBe('Hello-World')
  })

  it('password: пробелы допускаются', () => {
    expect(password('pass word 123')).toBe('pass word 123')
  })
})

// ═══ Комбинированные edge cases ═══
describe('Combined validation', () => {
  it('sanitize → str pipeline (сохраняет текст, удаляет теги)', () => {
    const raw = '<b>Hello</b> World <script>evil</script>'
    const s = str(sanitize(raw), 50)
    expect(s).toBe('Hello World evil') // sanitize удаляет теги, но сохраняет текст внутри
    expect(s.includes('<')).toBe(false)
  })

  it('username с HTML — strip теги, сохранить текст', () => {
    // sanitize в username удаляет <>, оставляет текст
    expect(username('<script>admin')).toBe('scriptadmin')
  })

  it('username с пробелами — trim', () => {
    expect(username('  test  ')).toBe('test')
  })

  it('num с NaN → null', () => {
    expect(num(NaN, 5, 100)).toBeNull() // NaN не число → null
  })

  it('str с числом → null (ожидает строку)', () => {
    expect(str(12345)).toBeNull() // typeof 12345 !== 'string'
  })

  it('slug допускает цифры в начале', () => {
    expect(slug('123-abc')).toBe('123-abc')
  })

  it('slug с пробелами → strip (не null)', () => {
    expect(slug('hello world')).toBe('helloworld') // пробелы удаляются
  })
})

// ═══ Boundary stress ═══
describe('Boundary stress', () => {
  it('str с длинным input → обрезается', () => {
    const long = 'a'.repeat(500)
    const result = str(long, 100)
    expect(result.length).toBeLessThanOrEqual(100)
  })

  it('sanitize с 1000 тегов', () => {
    const malicious = '<b>'.repeat(500) + 'text' + '</b>'.repeat(500)
    const result = sanitize(malicious)
    expect(result.includes('<')).toBe(false)
    expect(result).toContain('text')
  })

  it('username обрезается до 30 символов', () => {
    expect(username('a'.repeat(30))).toBe('a'.repeat(30))
    expect(username('a'.repeat(50)).length).toBe(30) // truncated
  })

  it('slug с дефисами и цифрами', () => {
    expect(slug('v4-4-update-2026')).toBe('v4-4-update-2026')
  })

  it('num с граничными значениями', () => {
    expect(num(0, 0, 100)).toBe(0)
    expect(num(100, 0, 100)).toBe(100)
    expect(num(50.5, 0, 100)).toBe(50.5)
  })
})

// ═══ Security edge cases ═══
describe('Security edge cases', () => {
  it('sanitize: script с атрибутами', () => {
    expect(sanitize('<script src="evil.js">alert(1)</script>')).toBe('alert(1)')
    expect(sanitize('<img onerror="alert(1)" src=x>')).toBe('')
  })

  it('sanitize: HTML entities не декодируются', () => {
    const result = sanitize('&lt;script&gt;')
    expect(result).toBe('&lt;script&gt;')
  })

  it('str: null → null', () => {
    expect(str(null)).toBeNull()
    expect(str(undefined)).toBeNull()
  })

  it('password: unicode допускается', () => {
    expect(password('пароль123')).toBe('пароль123')
  })
})

// ═══ Injection attacks ═══
describe('Injection attacks', () => {
  it('sanitize: SQL injection attempt', () => {
    const result = sanitize("'; DROP TABLE users; --")
    expect(result).not.toContain('<')
    expect(typeof result).toBe('string')
  })

  it('username: path traversal stripped to safe chars', () => {
    const result = username('../../../etc/passwd')
    expect(result).not.toContain('/')
    expect(result).not.toContain('\\')
  })

  it('slug: special chars stripped', () => {
    const result = slug('hello<>world')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('str: very long input truncated', () => {
    const input = 'x'.repeat(10000)
    const result = str(input, 200)
    expect(result.length).toBeLessThanOrEqual(200)
  })
})
