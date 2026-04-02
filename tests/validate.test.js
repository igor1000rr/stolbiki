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
describe('password', () => {
  it('допускает 6+ символов', () => {
    expect(password('123456')).toBe('123456')
    expect(password('abcdefgh')).toBe('abcdefgh')
  })

  it('null если < 6 символов', () => {
    expect(password('12345')).toBeNull()
    expect(password('abc')).toBeNull()
    expect(password('')).toBeNull()
  })

  it('null если > 100 символов', () => {
    expect(password('a'.repeat(101))).toBeNull()
  })

  it('допускает ровно 6 и ровно 100', () => {
    expect(password('a'.repeat(6))).toBe('a'.repeat(6))
    expect(password('a'.repeat(100))).toBe('a'.repeat(100))
  })

  it('null для не-строк', () => {
    expect(password(123456)).toBeNull()
    expect(password(null)).toBeNull()
  })

  it('не модифицирует спецсимволы в пароле', () => {
    expect(password('P@ss!w0rd#')).toBe('P@ss!w0rd#')
  })
})
