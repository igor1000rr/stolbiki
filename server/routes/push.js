/**
 * Web Push API — subscribe / unsubscribe / VAPID public key
 *
 * Эндпоинты:
 *   GET  /api/push/vapid-public-key       публичный ключ для PushManager.subscribe()
 *   POST /api/push/subscribe              { subscription }  сохранить подписку юзера
 *   POST /api/push/unsubscribe            { endpoint }      удалить подписку
 *   POST /api/push/test                   (admin)           отправить тест-уведомление себе
 */

import { Router } from 'express'
import { auth } from '../middleware.js'
import {
  isPushConfigured,
  getVapidPublicKey,
  saveSubscription,
  deleteSubscription,
  sendPushTo,
} from '../push-helpers.js'

const router = Router()

router.get('/vapid-public-key', (req, res) => {
  if (!isPushConfigured()) {
    return res.json({ configured: false, publicKey: null })
  }
  res.set('Cache-Control', 'public, max-age=3600')
  res.json({ configured: true, publicKey: getVapidPublicKey() })
})

router.post('/subscribe', auth, (req, res) => {
  if (!isPushConfigured()) return res.status(503).json({ error: 'Push не настроен' })
  const { subscription } = req.body || {}
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'subscription required (endpoint + keys.p256dh + keys.auth)' })
  }
  try {
    saveSubscription(req.user.id, subscription, req.headers['user-agent'])
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message || 'invalid subscription' })
  }
})

router.post('/unsubscribe', auth, (req, res) => {
  const { endpoint } = req.body || {}
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
  deleteSubscription(req.user.id, endpoint)
  res.json({ ok: true })
})

router.post('/test', auth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'admin only' })
  if (!isPushConfigured()) return res.status(503).json({ error: 'Push не настроен' })
  const result = await sendPushTo(req.user.id, {
    title: 'Highrise Heist',
    body: 'Тестовое уведомление',
    url: 'https://highriseheist.com/',
  })
  res.json({ ok: true, ...result })
})

export default router
