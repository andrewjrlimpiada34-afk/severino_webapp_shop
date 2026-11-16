import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthEncryptionKey, decryptAuthPayload } from './encryptedAuth.js'
import { encryptAuthPayload, requestEncryptedAuth } from '../../../src/lib/encryptedAuth.js'

test('encrypted credentials survive large Unicode inputs and reject expiry, tampering, and route changes', async (context) => {
  process.env.JWT_SECRET = 'encryption-tests-only-secret'
  const encryption = await createAuthEncryptionKey()
  const credentials = { identifier: 'customer@example.com', password: 'Scent-香り-🌸'.repeat(300) }
  const envelope = await encryptAuthPayload(credentials, encryption, 'POST /api/auth/login')
  const decrypt = (body, method = 'POST', path = '/login') => {
    const req = { body, method, baseUrl: '/api/auth', path }
    const res = { set() {}, status(code) { this.statusCode = code; return this }, json(data) { this.data = data } }
    let accepted = false
    decryptAuthPayload(req, res, () => { accepted = true })
    return { accepted, req, res }
  }

  assert.deepEqual(decrypt(envelope).req.body, credentials)
  const second = await encryptAuthPayload(credentials, encryption, 'POST /api/auth/login')
  assert.notEqual(second.ciphertext, envelope.ciphertext)
  assert.notEqual(second.wrappedKey, envelope.wrappedKey)
  assert.notEqual(second.iv, envelope.iv)
  assert.equal(decrypt(envelope, 'POST', '/register').accepted, false)
  assert.equal(decrypt(envelope, 'PATCH').accepted, false)
  for (const field of ['iv', 'wrappedKey', 'ciphertext', 'keyToken']) {
    const changed = { ...envelope, [field]: `AAAA${envelope[field].slice(4)}` }
    const result = decrypt(changed)
    assert.equal(result.accepted, false)
    assert.equal(result.res.statusCode, 400)
    assert.deepEqual(result.req.body, changed, 'rejected requests never expose decrypted credentials')
  }

  await context.test('expiration is checked using server time', (subtest) => {
    const now = Date.now()
    subtest.mock.method(Date, 'now', () => now + 121000)
    const result = decrypt(envelope)
    assert.equal(result.accepted, false)
    assert.equal(result.res.statusCode, 400)
  })

  await context.test('another replica can unwrap the key token without the issuing process key pair', async () => {
    const replica = await import('./encryptedAuth.js?replica-test')
    const req = { body: envelope, method: 'POST', baseUrl: '/api/auth', path: '/login' }
    replica.decryptAuthPayload(req, { set() {} }, () => {})
    assert.deepEqual(req.body, credentials)
  })
})

test('encryption failures stop password requests before any plaintext can be sent', async (context) => {
  const payload = { identifier: 'customer@example.com', password: 'private-password' }
  const paths = []
  await assert.rejects(requestEncryptedAuth(async (path) => {
    paths.push(path)
    throw new Error('Key service unavailable')
  }, '/api/auth/login', payload), /Key service unavailable/)
  assert.deepEqual(paths, ['/api/auth/encryption-key'])

  await context.test('missing Web Crypto prevents submission', async (subtest) => {
    subtest.mock.getter(globalThis, 'crypto', () => undefined)
    let calls = 0
    await assert.rejects(requestEncryptedAuth(async () => { calls += 1; return {} }, '/api/auth/login', payload), /Web Crypto/)
    assert.equal(calls, 1)
  })

  await context.test('an invalid public key prevents submission', async () => {
    let calls = 0
    await assert.rejects(requestEncryptedAuth(async () => {
      calls += 1
      return { publicKey: {}, keyToken: 'invalid-key' }
    }, '/api/auth/login', payload))
    assert.equal(calls, 1)
  })
})
