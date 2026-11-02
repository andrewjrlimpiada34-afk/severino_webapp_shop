import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'

test('authentication routes validate input, protect credentials, and preserve the Python OTP contract', async (context) => {
  // Use an intercepted pool; never connect to a real database or send an email.
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/auth-test'
  process.env.JWT_SECRET = 'auth-tests-only-secret'
  process.env.NODE_ENV = 'production'
  process.env.OTP_SERVICE_URL = 'https://otp.example.com'
  process.env.OTP_SERVICE_KEY = 'backend-only-test-key'
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
  delete process.env.GOOGLE_CLIENT_ID

  const { getDb, closeDb } = await import('../db/postgres.js')
  const { default: authRoutes } = await import('./auth.js')
  const password = 'test-password'
  const users = [{ id: 'customer-one', name: 'Ana Cruz', email: 'ana@example.com', phone: '+639164352483',
    password_hash: await bcrypt.hash(password, 4), role: 'customer', verified: true, preferred_theme: 'Olive' }]
  const queries = []
  context.mock.method(getDb(), 'query', async (sql, values) => {
    queries.push(sql)
    const column = sql.match(/WHERE (email|phone|id) = \$1/)
    if (column) return { rows: users.filter((user) => user[column[1]] === values[0]) }
    if (sql.includes('INSERT INTO users')) {
      const columns = ['id', 'name', 'email', 'phone', 'password_hash', 'role', 'verified', 'address', 'address_line',
        'barangay', 'city', 'province', 'zip', 'country', 'backup_address', 'profile_image', 'preferred_theme', 'created_at']
      users.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])))
      return { rows: [], rowCount: 1 }
    }
    throw new Error('Unexpected database query in auth test')
  })

  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRoutes)
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  const base = `http://127.0.0.1:${server.address().port}/api/auth`
  const httpFetch = globalThis.fetch
  const post = (path, body) => httpFetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await closeDb()
  })

  await context.test('malformed identifiers are rejected before database access, including missing legacy email', async () => {
    for (const body of [{}, { email: '' }, { identifier: 'name@' }, { identifier: '12345' }]) {
      const response = await post('/login', { ...body, password })
      assert.equal(response.status, 400)
    }
    assert.equal(queries.length, 0)
  })

  await context.test('successful email and mobile logins return safe user data and secure cookies', async () => {
    for (const body of [{ identifier: ' ANA@example.com ' }, { identifier: '0916 435 2483' }, { email: 'ana@example.com' }]) {
      const response = await post('/login', { ...body, password })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      const cookie = response.headers.get('Set-Cookie')
      assert.match(cookie, /HttpOnly/)
      assert.match(cookie, /Secure/)
      assert.match(cookie, /SameSite=None/)
      const data = await response.json()
      assert.equal(data.requires2fa, false)
      assert.equal(data.user.id, 'customer-one')
      assert.equal(data.user.preferredTheme, 'Olive')
      assert.equal(data.user.passwordHash, undefined)
      assert.equal(data.user.password, undefined)
      assert.equal(data.token, undefined)
    }
    assert.equal(queries.length, 3, 'existing users do not trigger default admin provisioning')
  })

  await context.test('unknown accounts, wrong passwords, and unverified accounts use the same failure', async () => {
    const failures = []
    failures.push(await post('/login', { identifier: 'missing@example.com', password }))
    failures.push(await post('/login', { identifier: 'ana@example.com', password: 'wrong-password' }))
    users[0].verified = false
    failures.push(await post('/login', { identifier: 'ana@example.com', password }))
    users[0].verified = true
    const bodies = []
    for (const response of failures) {
      assert.equal(response.status, 401)
      assert.equal(response.headers.get('Set-Cookie'), null)
      bodies.push(await response.json())
    }
    assert.deepEqual(bodies[0], bodies[1])
    assert.deepEqual(bodies[1], bodies[2])
  })

  await context.test('OTP forwarding retains endpoints, payloads, server-only authentication, and failures', async (subtest) => {
    const calls = []
    subtest.mock.method(globalThis, 'fetch', async (url, options) => {
      const body = JSON.parse(options.body)
      calls.push({ url, body })
      assert.equal(options.headers.Authorization, 'Bearer backend-only-test-key')
      assert.equal(body.clientIp, '127.0.0.1')
      return new Response(JSON.stringify(url.endsWith('/otp/send')
        ? { challengeId: 'test-challenge', message: 'OTP sent to email' }
        : { message: 'Invalid or expired OTP' }), { status: url.endsWith('/otp/send') ? 200 : 400 })
    })
    const sent = await post('/otp/send', { email: 'new@example.com' })
    assert.deepEqual(await sent.json(), { challengeId: 'test-challenge', message: 'OTP sent to email' })
    const verified = await post('/otp/verify', { challengeId: 'test-challenge', code: '123456' })
    assert.equal(verified.status, 400)
    assert.deepEqual(await verified.json(), { message: 'Invalid or expired OTP' })
    assert.deepEqual(calls.map(({ url }) => url), ['https://otp.example.com/otp/send', 'https://otp.example.com/otp/verify'])
    assert.deepEqual(calls[1].body, { challengeId: 'test-challenge', code: '123456', clientIp: '127.0.0.1' })
  })

  await context.test('registration requires verified, matching, unexpired Python proof before creating an account', async (subtest) => {
    const form = { name: 'New Customer', email: 'new@example.com', password, phone: '09171234567',
      barangay: 'Poblacion', city: 'Manila', province: 'Metro Manila', zip: '1000', country: 'Philippines',
      verificationId: 'test-challenge' }
    let proof = { id: 'test-challenge', email: form.email, type: 'register', verifiedAt: new Date().toISOString(), expiresAt: Date.now() + 300000 }
    const calls = []
    subtest.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) })
      return new Response(JSON.stringify(url.endsWith('/otp/inspection') ? proof : { success: true }), { status: 200 })
    })
    for (const changes of [{ verifiedAt: null }, { expiresAt: 0 }, { email: 'someone@example.com' }, { type: 'other' }]) {
      const original = proof
      proof = { ...proof, ...changes }
      assert.equal((await post('/register', form)).status, 403)
      proof = original
    }
    assert.equal(users.length, 1)
    assert.equal((await post('/register', form)).status, 201)
    assert.equal(users.length, 2)
    assert.notEqual(users[1].password_hash, password)
    assert.equal(await bcrypt.compare(password, users[1].password_hash), true)
    assert.deepEqual(calls.at(-1), { url: 'https://otp.example.com/otp/consume', body: { challengeId: 'test-challenge' } })
  })

  await context.test('repeated failed logins are rate limited with a readable response', async () => {
    let response
    for (let attempt = 0; attempt < 16; attempt += 1) {
      response = await post('/login', { identifier: 'malformed', password })
      if (response.status === 429) break
    }
    assert.equal(response.status, 429)
    assert.match((await response.json()).message, /Too many sign-in attempts/)
  })
})
