import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient } from './apiClient.js'

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('concurrent private reads share one request, return isolated objects, and do not cache completed data', async () => {
  const response = deferred()
  const calls = []
  const client = createApiClient({ baseUrl: 'https://api.example.com', fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return response.promise
  } })
  const first = client.request('/api/auth/me')
  const second = client.request('/api/auth/me')
  assert.equal(calls.length, 1)
  response.resolve(json({ id: 'user-one', name: 'Ana' }))
  const [a, b] = await Promise.all([first, second])
  a.name = 'Edited locally'
  assert.equal(b.name, 'Ana')
  assert.equal(calls[0].options.headers['Content-Type'], undefined)
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.cache, 'no-store')
  // A new fetch needs a new Response body.
  const client2 = createApiClient({ baseUrl: '', fetchImpl: async () => {
    calls.push({})
    return json({ id: 'user-one' })
  } })
  await client2.request('/api/users/me')
  await client2.request('/api/users/me')
  assert.equal(calls.length, 3)
})

test('public reads expire, allow fresh pricing reads, and cannot be mutated through a caller', async () => {
  let clock = 100
  let calls = 0
  const client = createApiClient({ baseUrl: '', now: () => clock, fetchImpl: async () => json([{ price: ++calls }]) })
  const first = await client.request('/api/products', { cacheTtl: 1000 })
  first[0].price = 999
  assert.equal((await client.request('/api/products', { cacheTtl: 1000 }))[0].price, 1)
  assert.equal((await client.request('/api/products', { cacheTtl: 1000, fresh: true }))[0].price, 2)
  clock = 1101
  assert.equal((await client.request('/api/products', { cacheTtl: 1000 }))[0].price, 3)
})

test('writes invalidate cached public data and send JSON only when there is a body', async () => {
  const calls = []
  const client = createApiClient({ baseUrl: '', fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return json({ calls: calls.length })
  } })
  await client.request('/api/products', { cacheTtl: 1000 })
  await client.request('/api/products/p1', { method: 'PATCH', body: JSON.stringify({ stock: 3 }) })
  await client.request('/api/products', { cacheTtl: 1000 })
  assert.equal(calls.length, 3)
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json')
  await client.request('/api/auth/logout', { method: 'POST' })
  assert.equal(calls[3].options.headers['Content-Type'], undefined)
})

test('logout/account switching prevents an older response from being reused or repopulating the cache', async () => {
  const old = deferred()
  let calls = 0
  const client = createApiClient({ baseUrl: '', fetchImpl: async () => {
    calls += 1
    return calls === 1 ? old.promise : json({ id: 'new-user' })
  } })
  const first = client.request('/api/users/me', { cacheTtl: 1000 })
  client.clearCache()
  const second = client.request('/api/users/me', { cacheTtl: 1000 })
  assert.equal((await second).id, 'new-user')
  old.resolve(json({ id: 'old-user' }))
  await first
  assert.equal((await client.request('/api/users/me', { cacheTtl: 1000 })).id, 'new-user')
  assert.equal(calls, 2)
})

test('failed reads can be retried and preserve the server error status/message', async () => {
  let calls = 0
  const client = createApiClient({ baseUrl: '', fetchImpl: async () => {
    calls += 1
    return calls === 1 ? json({ message: 'Please wait before requesting another OTP.' }, 429) : json({ ok: true })
  } })
  await assert.rejects(client.request('/api/public/banners', { cacheTtl: 1000 }), {
    message: 'Please wait before requesting another OTP.', status: 429,
  })
  assert.deepEqual(await client.request('/api/public/banners', { cacheTtl: 1000 }), { ok: true })
  assert.equal(calls, 2)
})

test('multipart uploads preserve browser-generated boundaries and invalidate reads', async () => {
  const calls = []
  const client = createApiClient({ baseUrl: '', fetchImpl: async (url, options) => {
    calls.push({ url, options })
    return json({ ok: true })
  } })
  await client.request('/api/public/banners', { cacheTtl: 1000 })
  await client.upload('/api/uploads/image', new Blob(['image'], { type: 'image/png' }))
  assert.equal(calls[1].options.headers, undefined)
  assert.equal(calls[1].options.body.get('image').name, 'upload.jpg')
  await client.request('/api/public/banners', { cacheTtl: 1000 })
  assert.equal(calls.length, 3)
})
