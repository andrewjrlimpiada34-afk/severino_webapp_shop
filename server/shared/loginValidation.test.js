import test from 'node:test'
import assert from 'node:assert/strict'
import { loginErrors, normalizeEmail, normalizeLoginIdentifier } from './loginValidation.js'

test('login rejects missing and malformed identifiers and normalizes supported email/mobile formats', () => {
  for (const value of ['', ' ', 'name@', 'not-an-email', '12345', 'a..b@example.com', 'a@@example.com', 'a b@example.com', null, 123]) {
    assert.equal(normalizeLoginIdentifier(value), '', String(value))
    assert.ok(loginErrors(value, 'valid-password').identifier)
  }
  assert.equal(normalizeEmail('  Ana.Cruz+shop@EXAMPLE.COM '), 'ana.cruz+shop@example.com')
  for (const value of ['0916 435 2483', '9164352483', '+639164352483', '639164352483']) {
    assert.equal(normalizeLoginIdentifier(value), '+639164352483')
  }
  assert.equal(loginErrors('ana@example.com', '').password, 'Enter your password.')
  assert.ok(loginErrors('ana@example.com', 'short').password)
  assert.deepEqual(loginErrors('ana@example.com', 'valid-password'), { identifier: '', password: '' })
})
