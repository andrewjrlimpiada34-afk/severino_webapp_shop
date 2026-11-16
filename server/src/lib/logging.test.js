import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import morgan from 'morgan'
import { accessLogFormat, logError } from './logging.js'
import { errorHandler } from '../middleware/error.js'

const sensitive = {
  identifier: 'private-customer@example.test',
  phone: '+639001234567',
  password: 'Private-password-123!',
  currentPassword: 'Old-password-123!',
  newPassword: 'New-password-123!',
  code: '846291',
  token: 'private-session-token',
  cookie: 'private-session-cookie',
  apiKey: 'private-provider-key',
  iv: 'private-iv-value',
  wrappedKey: 'private-wrapped-key',
  keyToken: 'private-key-token',
  ciphertext: 'private-encrypted-payload',
  databaseUrl: 'postgresql://private-user:private-pass@db.example.test/private-db',
}

const assertNoSensitiveValues = (value) => {
  const serialized = JSON.stringify(value)
  for (const secret of Object.values(sensitive)) assert.equal(serialized.includes(secret), false)
}

test('error logging emits only approved metadata in development and production', (context) => {
  const logs = []
  context.mock.method(console, 'error', (...args) => logs.push(args))
  const environment = process.env.NODE_ENV
  context.after(() => {
    if (environment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = environment
  })

  const error = Object.assign(new Error(JSON.stringify(sensitive)), {
    code: 'ECONNRESET',
    body: sensitive,
    cause: new Error(sensitive.password),
  })
  for (const mode of ['development', 'production']) {
    process.env.NODE_ENV = mode
    logError('request_failed', error, { method: 'POST', status: 500, ...sensitive })
    assert.deepEqual(logs.at(-1), [{ event: 'request_failed', method: 'POST', status: 500, code: 'ECONNRESET' }])
    logError('request_failed', { code: sensitive.apiKey }, { method: sensitive.password, status: sensitive.code })
    assert.deepEqual(logs.at(-1), [{ event: 'request_failed' }])
  }
  assertNoSensitiveValues(logs)
})

test('HTTP access and error logs exclude URLs, query strings, headers, bodies, and parser fragments', async (context) => {
  const errorLogs = []
  const accessLogs = []
  context.mock.method(console, 'error', (...args) => errorLogs.push(args))
  const app = express()
  app.use(morgan(accessLogFormat, { stream: { write: (entry) => accessLogs.push(entry) } }))
  app.use(express.json())
  app.post('/api/auth/log-test/:identifier', (req, res, next) => {
    next(Object.assign(new Error(JSON.stringify({ body: req.body, headers: req.headers, url: req.originalUrl })), {
      code: 'ECONNRESET',
    }))
  })
  app.use(errorHandler)
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  const url = `http://127.0.0.1:${server.address().port}/api/auth/log-test/${encodeURIComponent(sensitive.identifier)}?token=${sensitive.token}`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sensitive.token}`,
    Cookie: `token=${sensitive.cookie}`,
    Origin: `https://${sensitive.apiKey}.example.test`,
  }
  const failed = await fetch(url, { method: 'POST', headers, body: JSON.stringify(sensitive) })
  assert.equal(failed.status, 500)
  assert.deepEqual(await failed.json(), { message: 'Internal server error' })
  const malformed = await fetch(url, { method: 'POST', headers, body: `{"password":"${sensitive.password}" broken}` })
  assert.equal(malformed.status, 400)
  assert.deepEqual(await malformed.json(), { message: 'Invalid JSON request body' })
  assert.equal(accessLogs.length, 2)
  assert.equal(errorLogs.length, 2)
  for (const entry of accessLogs) assert.match(entry, /^POST (400|500) - [\d.]+ ms\n$/)
  assert.deepEqual(errorLogs[0], [{ event: 'request_failed', method: 'POST', status: 500, code: 'ECONNRESET' }])
  assertNoSensitiveValues({ errorLogs, accessLogs })
})

test('streaming failures delegate a safe error to the Express final handler', (context) => {
  const logs = []
  context.mock.method(console, 'error', (...args) => logs.push(args))
  const error = Object.assign(new Error(JSON.stringify(sensitive)), { code: 'ECONNRESET' })
  let forwarded
  errorHandler(error, { method: 'GET' }, { headersSent: true }, (safeError) => { forwarded = safeError })
  assert.notEqual(forwarded, error)
  assert.equal(forwarded.message, 'Response stream failed')
  assert.equal(forwarded.stack, 'Response stream failed')
  assertNoSensitiveValues({ logs, forwarded })
})

test('email provider failures omit provider responses and raw exceptions from logs', async (context) => {
  const logs = []
  context.mock.method(console, 'error', (...args) => logs.push(args))
  process.env.PROMAILER_API_URL = 'https://mailer.example.test/send'
  process.env.PROMAILER_API_KEY = sensitive.apiKey
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    message: JSON.stringify(sensitive),
    ...sensitive,
  }), { status: 502 }))
  const { send_mail, send_otp } = await import('../mailer.js')
  for (const send of [send_mail, send_otp]) {
    const result = await send({ to: sensitive.identifier, subject: 'Verification', text: sensitive.code })
    assert.equal(result.success, false)
  }
  assert.deepEqual(logs.map(([entry]) => entry.event), [
    'email_provider_failed', 'email_send_failed', 'email_provider_failed', 'otp_email_send_failed',
  ])
  assertNoSensitiveValues(logs)
})
