/**
 * Integration-тесты для /api/friends/* и /api/users/* — только auth-проверки.
 * Без реальных friend-флоу (требует 2 юзеров + взаимного состояния в DB).
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'

let counter = 0
function uniqueName(prefix = 'sc') {
  return `${prefix}_${Date.now().toString(36).slice(-6)}_${counter++}`
}

async function makeUser() {
  const username = uniqueName()
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' })
  if (res.status !== 200) throw new Error(`register failed: ${res.status}`)
  return { token: res.body.token }
}

describe('GET /api/friends', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/friends')
    expect(res.status).toBe(401)
  })

  it('200 с token (пустой список для нового юзера)', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/friends').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/friends/request', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/friends/request').send({ username: 'somebody' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/friends/remove', () => {
  it('401 без auth', async () => {
    const res = await request(app).post('/api/friends/remove').send({ username: 'somebody' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/friends/challenges', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/friends/challenges')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/friends/challenges').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/users/search', () => {
  it('401 без auth', async () => {
    const res = await request(app).get('/api/users/search?q=admin')
    expect(res.status).toBe(401)
  })

  it('200 с token', async () => {
    const { token } = await makeUser()
    const res = await request(app).get('/api/users/search?q=zz').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
