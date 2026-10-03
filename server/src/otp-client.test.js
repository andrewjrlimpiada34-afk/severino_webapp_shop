import test from 'node:test'
import assert from 'node:assert/strict'
import { callOtp, proxyOtp } from './otp-client.js'

test('Python OTP bridge preserves responses and uses backend authentication', async () => {
  process.env.OTP_SERVICE_URL = 'https://otp.example.com/'
  process.env.OTP_SERVICE_KEY = 'test-key'
  const originalFetch = global.fetch
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://otp.example.com/otp/send')
      assert.equal(options.headers.Authorization, 'Bearer test-key')
      assert.deepEqual(JSON.parse(options.body), { email: 'a@example.com', clientIp: '127.0.0.1' })
      return { status: 429, json: async () => ({ message: 'Please wait before requesting another OTP.' }) }
    }
    const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    await proxyOtp('/otp/send')({ body: { email: 'a@example.com', clientIp: 'spoofed' }, ip: '127.0.0.1' }, res)
    assert.equal(res.code, 429)
    assert.equal(res.body.message, 'Please wait before requesting another OTP.')
    global.fetch = async () => { throw new Error('connection refused') }
    assert.equal((await callOtp('/otp/verify', {})).status, 502)
    delete process.env.OTP_SERVICE_URL
    assert.equal((await callOtp('/otp/send', {})).status, 503)
  } finally {
    global.fetch = originalFetch
    delete process.env.OTP_SERVICE_KEY
  }
})
