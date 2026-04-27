import { describe, it, expect } from 'vitest'
import { sanitize, str, num, slug, username, password } from './validate.js'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert(1)</script>hello')).toBe('alert(1)hello')
  })
  it('strips unsafe quote/angle chars', () => {
    expect(sanitize(`test<>"'\`end`)).toBe('testend')
  })
  it('trims whitespace', () => {
    expect(sanitize('   hello   ')).toBe('hello')
  })
  it('returns empty string for non-strings', () => {
    expect(sanitize(null)).toBe('')
    expect(sanitize(undefined)).toBe('')
    expect(sanitize(123)).toBe('')
    expect(sanitize({})).toBe('')
  })
  it('preserves cyrillic and emoji', () => {
    expect(sanitize('Привет 🎉')).toBe('Привет 🎉')
  })
})

describe('str', () => {
  it('returns null for non-strings', () => {
    expect(str(null)).toBe(null)
    expect(str(undefined)).toBe(null)
    expect(str(42)).toBe(null)
  })
  it('truncates to maxLen', () => {
    expect(str('abcdefgh', 5)).toBe('abcde')
  })
  it('applies sanitize', () => {
    expect(str('<b>hi</b>', 50)).toBe('hi')
  })
  it('default maxLen is 200', () => {
    const long = 'a'.repeat(300)
    expect(str(long).length).toBe(200)
  })
})

describe('num', () => {
  it('returns null for NaN inputs', () => {
    expect(num('abc')).toBe(null)
    expect(num(undefined)).toBe(null)
    expect(num(NaN)).toBe(null)
  })
  it('clamps to [min, max]', () => {
    expect(num(5, 0, 10)).toBe(5)
    expect(num(-3, 0, 10)).toBe(0)
    expect(num(50, 0, 10)).toBe(10)
  })
  it('accepts string numbers', () => {
    expect(num('42', 0, 100)).toBe(42)
  })
  it('defaults [0, Infinity]', () => {
    expect(num(-5)).toBe(0)
    expect(num(99999)).toBe(99999)
  })
  it('accepts 0 at lower bound (not confused with null)', () => {
    expect(num(0, 0, 10)).toBe(0)
  })
  it('handles floats', () => {
    expect(num('3.14', 0, 10)).toBe(3.14)
  })
})

describe('slug', () => {
  it('keeps latin alphanumerics, underscore, dash', () => {
    expect(slug('my-slug_123')).toBe('my-slug_123')
  })
  it('strips special chars', () => {
    expect(slug('hello@world!')).toBe('helloworld')
  })
  it('returns null if only strips to empty', () => {
    expect(slug('!!!')).toBe(null)
    expect(slug('')).toBe(null)
  })
  it('returns null for non-strings', () => {
    expect(slug(null)).toBe(null)
    expect(slug(42)).toBe(null)
  })
  it('truncates to 100 chars', () => {
    expect(slug('a'.repeat(200)).length).toBe(100)
  })
})

describe('username', () => {
  it('accepts cyrillic + latin + digits + dot/dash/underscore', () => {
    expect(username('Igor_123')).toBe('Igor_123')
    expect(username('Игорь.Сухоцкий')).toBe('Игорь.Сухоцкий')
  })
  it('strips spaces and special chars', () => {
    expect(username('hello world!!!')).toBe('helloworld')
  })
  it('rejects too short (<2 chars after cleanup)', () => {
    expect(username('!')).toBe(null)
    expect(username('a')).toBe(null)
    expect(username('')).toBe(null)
  })
  it('truncates to 30 chars', () => {
    expect(username('a'.repeat(40)).length).toBe(30)
  })
  it('returns null for non-strings', () => {
    expect(username(null)).toBe(null)
    expect(username(123)).toBe(null)
  })
})

describe('password', () => {
  it('accepts 8+ chars (NIST 800-63B минимум)', () => {
    expect(password('secret123')).toBe('secret123')
    expect(password('12345678')).toBe('12345678')
  })
  it('rejects too short (<8)', () => {
    expect(password('1234567')).toBe(null)
    expect(password('123456')).toBe(null)
    expect(password('12345')).toBe(null)
    expect(password('')).toBe(null)
  })
  it('rejects too long (>100)', () => {
    expect(password('a'.repeat(101))).toBe(null)
    expect(password('a'.repeat(100))).toBe('a'.repeat(100))
  })
  it('returns null for non-strings', () => {
    expect(password(null)).toBe(null)
    expect(password(12345678)).toBe(null)
  })
  it('does not sanitize (passwords can have special chars)', () => {
    expect(password('<html>pa$$word&')).toBe('<html>pa$$word&')
  })
})
