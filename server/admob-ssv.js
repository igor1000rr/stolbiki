/**
 * AdMob Server-Side Verification (SSV) — реальная ECDSA-проверка подписи Google.
 *
 * Документация:
 * https://developers.google.com/admob/android/ssv / .../ios/ssv
 *
 * Алгоритм:
 *   1) Google публикует публичные ECDSA-ключи на
 *      https://www.gstatic.com/admob/reward/verifier-keys.json
 *      Формат: { keys: [{ keyId: number, pem: string, base64: string }] }
 *   2) Приходит GET-запрос вида:
 *      /ssv?ad_network=...&ad_unit=...&reward_amount=...&reward_item=...&timestamp=...&transaction_id=...&user_id=...&custom_data=...&signature=SIG&key_id=KID
 *   3) signature и key_id — ВСЕГДА последние два параметра в query.
 *   4) Верифицируем SHA-256 ECDSA P-256 над query-string без последних двух параметров.
 *
 * Секретов на стороне сервера НЕ НУЖНО — все ключи публичные.
 */

import crypto from 'node:crypto'

const KEYS_URL = process.env.ADMOB_SSV_KEYS_URL || 'https://www.gstatic.com/admob/reward/verifier-keys.json'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 часов

let keysCache = null
let keysCacheAt = 0
let keysInFlight = null

async function fetchVerifierKeys() {
  if (keysInFlight) return keysInFlight
  keysInFlight = (async () => {
    try {
      const res = await fetch(KEYS_URL, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`keys fetch failed: HTTP ${res.status}`)
      const data = await res.json()
      if (!data?.keys || !Array.isArray(data.keys)) throw new Error('invalid keys response shape')
      keysCache = data.keys
      keysCacheAt = Date.now()
      return keysCache
    } finally {
      keysInFlight = null
    }
  })()
  return keysInFlight
}

async function getKeyByKeyId(keyId, { allowRefetch = true } = {}) {
  if (!keysCache || Date.now() - keysCacheAt > CACHE_TTL_MS) {
    try { await fetchVerifierKeys() } catch (e) {
      if (!keysCache) throw e // нечем верифицировать
      // есть старый кеш — используем его как fallback
      console.warn('[admob-ssv] keys refresh failed, using stale cache:', e.message)
    }
  }
  const numericKid = Number(keyId)
  let found = keysCache?.find(k => Number(k.keyId) === numericKid)
  if (!found && allowRefetch) {
    // Ключ не найден — мог быть впервые добавлен. Одна попытка рефреша.
    keysCacheAt = 0
    return getKeyByKeyId(keyId, { allowRefetch: false })
  }
  return found || null
}

function base64UrlToBuffer(s) {
  if (typeof s !== 'string') return null
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  try { return Buffer.from(padded + pad, 'base64') } catch { return null }
}

/**
 * Извлекает canonical query string для проверки подписи.
 * signature и key_id по спецификации AdMob — ВСЕГДА два последних параметра,
 * их нужно отбросить и верифицировать оставшуюся часть.
 */
export function extractCanonicalQuery(originalUrl) {
  if (typeof originalUrl !== 'string') return null
  const qIdx = originalUrl.indexOf('?')
  if (qIdx === -1) return null
  const qs = originalUrl.slice(qIdx + 1)
  // Ищем '&signature=' — всё до него и есть каноническая часть
  const sigIdx = qs.indexOf('&signature=')
  if (sigIdx === -1) return null
  return qs.slice(0, sigIdx)
}

/**
 * Проверяет AdMob SSV подпись.
 * @param {Object} opts
 * @param {string} opts.originalUrl  — req.originalUrl целиком (с query string)
 * @param {string} opts.signature    — base64url, напрямую из req.query.signature
 * @param {string|number} opts.keyId — req.query.key_id
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function verifyAdmobSsv({ originalUrl, signature, keyId }) {
  if (!signature || !keyId) return { ok: false, reason: 'missing_signature_or_key_id' }

  const canonical = extractCanonicalQuery(originalUrl)
  if (!canonical) return { ok: false, reason: 'invalid_query_string' }

  const sigBuf = base64UrlToBuffer(signature)
  if (!sigBuf || sigBuf.length === 0) return { ok: false, reason: 'invalid_signature_encoding' }

  let key
  try { key = await getKeyByKeyId(keyId) } catch (e) {
    return { ok: false, reason: 'keys_unavailable: ' + e.message }
  }
  if (!key?.pem) return { ok: false, reason: 'unknown_key_id' }

  try {
    const verifier = crypto.createVerify('sha256')
    verifier.update(canonical)
    verifier.end()
    const ok = verifier.verify(key.pem, sigBuf) // DER ECDSA по умолчанию
    return ok ? { ok: true } : { ok: false, reason: 'signature_mismatch' }
  } catch (e) {
    return { ok: false, reason: 'verify_error: ' + e.message }
  }
}

/**
 * Только для тестов / health-check: сразу подтянуть кеш ключей.
 */
export async function warmupKeys() {
  try { await fetchVerifierKeys(); return true } catch { return false }
}
