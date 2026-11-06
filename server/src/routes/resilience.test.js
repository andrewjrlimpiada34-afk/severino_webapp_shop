import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { asyncRoute } from '../lib/asyncRoute.js'
import { createCorsOptions } from '../lib/clientOrigins.js'
import { errorHandler } from '../middleware/error.js'

test('async route failures reach Express middleware once, including synchronous throws', async () => {
  for (const handler of [() => { throw new Error('sync failure') }, async () => { throw new Error('async failure') }]) {
    const errors = []
    await asyncRoute(handler)({}, {}, (error) => errors.push(error))
    assert.equal(errors.length, 1)
    assert.match(errors[0].message, /failure/)
  }
})

test('database outages return HTTP errors without taking down other API requests or expiring valid sessions', async (context) => {
  // Only an intercepted pool is used. No production database, orders, or OAuth service are touched.
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/resilience-test'
  process.env.JWT_SECRET = 'resilience-tests-only-secret'
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_ORIGIN = 'https://severino-webapp-shop.vercel.app/,https://shop.example.com'
  process.env.GOOGLE_CLIENT_ID = 'test-client'
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
  process.env.GOOGLE_REDIRECT_URL = 'https://api.example.com/api/auth/google/callback'

  const { getDb, closeDb } = await import('../db/postgres.js')
  let databaseFailing = true
  context.mock.method(getDb(), 'query', async () => {
    if (databaseFailing) throw Object.assign(new Error('Simulated database outage'), { code: 'ECONNRESET' })
    return { rows: [{ id: 'customer-one', name: 'Test Customer', role: 'customer', verified: true }], rowCount: 1 }
  })
  const logs = []
  context.mock.method(console, 'error', (entry) => logs.push(entry))
  context.mock.method(passport, 'authenticate', (strategy, options, callback) => (req, res, next) => {
    assert.equal(strategy, 'google')
    callback(null, { emails: [{ value: 'test@example.com' }], _json: { email_verified: true } })
  })

  const app = express()
  app.use(cors(createCorsOptions()))
  app.use(express.json())
  app.use(cookieParser())
  for (const name of ['public', 'products', 'auth', 'users', 'cart', 'reviews', 'admin', 'orders', 'feedback']) {
    const { default: routes } = await import(`./${name}.js`)
    app.use(`/api/${name}`, routes)
  }
  app.get('/alive', (req, res) => res.json({ status: 'ok' }))
  app.use(errorHandler)
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await closeDb()
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const token = jwt.sign({ id: 'customer-one', role: 'admin' }, process.env.JWT_SECRET)
  const request = (path, options = {}) => fetch(`${base}${path}`, {
    ...options, headers: { Origin: 'https://severino-webapp-shop.vercel.app', Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(3000),
  })
  const failures = [
    ...['login-popup', 'login-announcement', 'banner-stories', 'banners', 'hero-image', 'featured-banners'].map((path) => [`/api/public/${path}`]),
    ['/api/products'], ['/api/auth/me'], ['/api/users/me'], ['/api/cart'], ['/api/reviews/product-one'], ['/api/admin/inventory'],
    ['/api/users/me', { method: 'PATCH', body: JSON.stringify({ name: 'Test Customer', phone: '09171234567', email: 'test@example.com',
      barangay: 'Poblacion', city: 'Manila', province: 'Metro Manila', zip: '1000', country: 'Philippines' }) }],
    ['/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'product-one', quantity: 1, price: 300 }],
      address: 'Poblacion, Manila', contactName: 'Test Customer', phone: '09171234567', email: 'test@example.com', paymentMethod: 'COD' }) }],
    ['/api/feedback'],
    ['/api/auth/google/callback?state=test-state', { redirect: 'manual', headers: { Cookie: 'oauth_state=test-state' } }],
  ]
  for (const [path, options] of failures) {
    await context.test(`${options?.method || 'GET'} ${path} handles database rejection`, async () => {
      const response = await request(path, options)
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), { message: 'Internal server error' })
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://severino-webapp-shop.vercel.app')
      assert.equal(response.headers.get('Set-Cookie')?.includes('token=;') || false, path.includes('google/callback'))
      assert.equal(logs.at(-1).code, 'ECONNRESET')
      assert.equal((await request('/alive')).status, 200)
    })
  }
  databaseFailing = false
  const recovered = await request('/api/auth/me')
  assert.equal(recovered.status, 200)
  assert.equal((await recovered.json()).id, 'customer-one')
  const invalid = await request('/api/auth/me', { headers: { Authorization: 'Bearer invalid-token' } })
  assert.equal(invalid.status, 401, 'invalid tokens still fail authentication')
  const oauth = await request('/api/auth/google/callback?state=test-state', {
    redirect: 'manual', headers: { Cookie: 'oauth_state=test-state' },
  })
  assert.equal(oauth.status, 302)
  assert.equal(oauth.headers.get('Location'), 'https://severino-webapp-shop.vercel.app')
})
