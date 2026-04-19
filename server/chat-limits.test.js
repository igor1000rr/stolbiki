import { describe, it, expect, beforeEach } from 'vitest'
import { canChatNow, muteUser, unmuteUser, listMuted, RATE_LIMIT_WINDOW_MS } from './chat-limits.js'
import { db } from './db.js'

function createUser() {
  const uname = `ct_${Math.random().toString(36).slice(2, 10)}`
  const info = db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, '')`).run(uname)
  return info.lastInsertRowid
}

describe('canChatNow — guard', () => {
  it('returns no_user for falsy userId', () => {
    expect(canChatNow(0)).toEqual({ allowed: false, reason: 'no_user' })
    expect(canChatNow(null)).toEqual({ allowed: false, reason: 'no_user' })
    expect(canChatNow(undefined)).toEqual({ allowed: false, reason: 'no_user' })
  })
})

describe('canChatNow — rate limit', () => {
  it('first call allowed for fresh user', () => {
    const id = createUser()
    const r = canChatNow(id)
    expect(r.allowed).toBe(true)
  })

  it('immediate second call rate-limited', () => {
    const id = createUser()
    canChatNow(id) // first call
    const r = canChatNow(id)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('rate_limit')
    expect(r.retryAfterMs).toBeGreaterThan(0)
    expect(r.retryAfterMs).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_MS)
  })
})

describe('muteUser / canChatNow — muted state', () => {
  it('muted user gets reason=muted with until timestamp', () => {
    const id = createUser()
    const until = muteUser(id, 60) // 60 min
    const r = canChatNow(id)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('muted')
    expect(r.until).toBe(until)
    expect(r.until).toBeGreaterThan(Date.now())
  })

  it('muteUser with 0 minutes defaults to ≈100 years', () => {
    const id = createUser()
    const until = muteUser(id, 0)
    const yearsFromNow = (until - Date.now()) / (365 * 86400 * 1000)
    expect(yearsFromNow).toBeGreaterThan(50) // по факту 100
  })

  it('muteUser with negative minutes also = long permanent', () => {
    const id = createUser()
    const until = muteUser(id, -1)
    expect(until - Date.now()).toBeGreaterThan(86400000 * 1000) // >1000 дней
  })

  it('mute overrides rate_limit window (muted wins)', () => {
    const id = createUser()
    canChatNow(id) // срабатывает rate-limit
    muteUser(id, 60) // ещё мьютим
    const r = canChatNow(id)
    expect(r.reason).toBe('muted') // muted выигрывает
  })
})

describe('unmuteUser', () => {
  it('removes mute status', () => {
    const id = createUser()
    muteUser(id, 60)
    expect(canChatNow(id).reason).toBe('muted')
    unmuteUser(id)
    const r = canChatNow(id)
    expect(r.allowed).toBe(true)
  })
})

describe('listMuted', () => {
  it('returns only currently muted users', () => {
    const a = createUser()
    const b = createUser()
    const c = createUser()
    muteUser(a, 60)
    muteUser(b, 60)
    // c не мьютед
    const muted = listMuted()
    const ids = muted.map(m => m.id)
    expect(ids).toContain(a)
    expect(ids).toContain(b)
    expect(ids).not.toContain(c)
  })

  it('does not include users whose mute expired', () => {
    const a = createUser()
    // Ставим уже истекший mute вручную
    db.prepare('UPDATE users SET chat_muted_until = ? WHERE id = ?').run(Date.now() - 1000, a)
    const muted = listMuted()
    expect(muted.map(m => m.id)).not.toContain(a)
  })
})
