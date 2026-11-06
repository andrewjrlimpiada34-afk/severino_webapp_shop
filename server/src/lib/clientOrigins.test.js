import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cors from 'cors'
import { createCorsOptions, getClientOrigins, getPrimaryClientOrigin, normalizeClientOrigin } from './clientOrigins.js'
import { errorHandler } from '../middleware/error.js'

const frontend = 'https://severino-webapp-shop.vercel.app'

test('trusted frontend configuration normalizes URLs and preserves the first OAuth redirect origin', () => {
  const env = { NODE_ENV: 'production', CLIENT_ORIGIN: ` "${frontend}/login" ,${frontend}/, https://shop.example.com/ ` }
  assert.deepEqual(getClientOrigins(env), [frontend, 'https://shop.example.com'])
  assert.equal(getPrimaryClientOrigin(env), frontend)
  for (const invalid of ['*', 'https://*.vercel.app', 'null', 'javascript:alert(1)', 'https://user:password@example.com']) {
    assert.equal(normalizeClientOrigin(invalid), '')
  }
  assert.deepEqual(getClientOrigins({}), ['http://localhost:5173'])
  assert.deepEqual(getClientOrigins({ NODE_ENV: 'production' }), [])
  assert.equal(getPrimaryClientOrigin({ NODE_ENV: 'production' }), '/')
})

test('credentialed CORS permits configured frontends and rejects other sites and unlisted previews', async (context) => {
  const logs = []
  context.mock.method(console, 'error', (entry) => logs.push(entry))
  const app = express()
  app.use(cors(createCorsOptions({ NODE_ENV: 'production', CLIENT_ORIGIN: `${frontend}/,https://shop.example.com` })))
  app.get('/api/products', (req, res) => res.json([]))
  app.use(errorHandler)
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const url = `http://127.0.0.1:${server.address().port}/api/products`
  const request = (origin, options = {}) => fetch(url, {
    ...options, headers: { ...(origin ? { Origin: origin } : {}), ...options.headers }, signal: AbortSignal.timeout(3000),
  })

  for (const origin of [frontend, 'https://shop.example.com']) {
    const response = await request(origin)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin)
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true')
    assert.match(response.headers.get('Vary'), /Origin/)
  }
  const preflight = await request(frontend, { method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type',
  } })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), frontend)
  assert.match(preflight.headers.get('Access-Control-Allow-Methods'), /PATCH/)
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /content-type/)

  for (const origin of ['https://evil.vercel.app', 'https://severino-webapp-shop-preview.vercel.app', `${frontend}.evil.com`, `${frontend}/path`, 'null']) {
    const response = await request(origin)
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
    assert.deepEqual(await response.json(), { message: 'Not allowed by CORS' })
    assert.equal(logs.at(-1).origin, origin)
  }
  assert.equal((await request()).status, 200, 'health checks and server clients without Origin still work')
})

test('production without an explicit frontend allowlist refuses browser origins', () => {
  const options = createCorsOptions({ NODE_ENV: 'production' })
  options.origin(frontend, (error) => assert.equal(error.statusCode, 403))
  options.origin(undefined, (error, allowed) => {
    assert.equal(error, null)
    assert.equal(allowed, true)
  })
})
