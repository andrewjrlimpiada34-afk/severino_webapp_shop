import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhilippineMobile, registrationProgress } from './registration.js'

const form = {
  firstName: 'Ana', lastName: 'Cruz', email: 'ANA@example.com', mobile: '0916 435 2483',
  password: 'test-password', confirmPassword: 'test-password', addressLine: '',
  barangay: 'Poblacion', city: 'Manila', province: 'Metro Manila', zip: '1000', country: 'Philippines',
}
const verified = { verified: true, email: 'ana@example.com', challengeId: 'server-challenge' }

test('profile progression requires a valid email and Philippine mobile number', () => {
  assert.equal(registrationProgress({ ...form, email: 'not-an-email' }, verified).furthestStep, 1)
  assert.equal(registrationProgress({ ...form, mobile: '1234' }, verified).furthestStep, 1)
  assert.equal(registrationProgress({ ...form, firstName: ' ' }, verified).furthestStep, 1)
  for (const mobile of ['09164352483', '9164352483', '+639164352483', '639164352483']) {
    assert.equal(normalizePhilippineMobile(mobile), '+639164352483')
  }
})

test('entering an OTP does not unlock security without successful server verification', () => {
  for (const verification of [
    { ...verified, verified: false, code: '123456' },
    { ...verified, challengeId: '' },
    { ...verified, email: 'another@example.com' },
  ]) {
    const progress = registrationProgress(form, verification)
    assert.equal(progress.furthestStep, 2)
    assert.equal(progress.canCreate, false)
  }
})

test('security and required delivery fields block review until valid', () => {
  assert.equal(registrationProgress({ ...form, password: 'short', confirmPassword: 'short' }, verified).furthestStep, 3)
  assert.equal(registrationProgress({ ...form, confirmPassword: 'different' }, verified).furthestStep, 3)
  for (const name of ['barangay', 'city', 'province', 'zip', 'country']) {
    assert.equal(registrationProgress({ ...form, [name]: ' ' }, verified).furthestStep, 4)
  }
  const progress = registrationProgress(form, verified)
  assert.equal(progress.furthestStep, 5)
  assert.equal(progress.canCreate, true)
})

test('editing a verified email invalidates progression and account submission', () => {
  const progress = registrationProgress({ ...form, email: 'new@example.com' }, verified)
  assert.equal(progress.verified, false)
  assert.equal(progress.furthestStep, 2)
  assert.equal(progress.canCreate, false)
})
