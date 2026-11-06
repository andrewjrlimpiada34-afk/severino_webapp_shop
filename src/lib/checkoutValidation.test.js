import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutErrors, checkoutStepFields, firstInvalidCheckoutStep, normalizeCheckout } from './checkoutValidation.js'

const valid = { name: 'Ana Cruz', addressLine: '', barangay: 'Poblacion', city: 'Boac', province: 'Marinduque', zip: '4900', country: 'Philippines', mobile: '09171234567', email: 'ana@example.com', notes: '' }

test('each required checkout field must contain a value before its step is complete', () => {
  for (const [step, fields] of checkoutStepFields.entries()) {
    for (const field of fields) {
      const form = { ...valid, [field]: '   ' }
      assert.ok(checkoutErrors(form)[field], field)
      assert.equal(firstInvalidCheckoutStep(form), step, field)
    }
  }
})

test('optional street address and delivery notes do not block checkout', () => {
  assert.equal(firstInvalidCheckoutStep(valid), -1)
  assert.equal(firstInvalidCheckoutStep({ ...valid, addressLine: '   ', notes: '   ' }), -1)
})

test('checkout rejects invalid contact details and names rejected by the profile API', () => {
  for (const email of ['ana', 'ana@', 'ana@example', 'a..b@example.com']) assert.ok(checkoutErrors({ ...valid, email }).email)
  for (const mobile of ['123', '0917123456', 'not-a-number']) assert.ok(checkoutErrors({ ...valid, mobile }).mobile)
  assert.ok(checkoutErrors({ ...valid, name: 'A' }).name)
  for (const field of ['barangay', 'city', 'province', 'country']) assert.ok(checkoutErrors({ ...valid, [field]: 'A' })[field])
  assert.ok(checkoutErrors({ ...valid, zip: '12' }).zip)
})

test('final confirmation trims values and normalizes contact details', () => {
  const normalized = normalizeCheckout({ ...valid, name: ' Ana Cruz ', mobile: '0917 123 4567', email: ' ANA@EXAMPLE.COM ', country: ' Philippines ' })
  assert.equal(normalized.name, 'Ana Cruz')
  assert.equal(normalized.mobile, '+639171234567')
  assert.equal(normalized.email, 'ana@example.com')
  assert.equal(normalized.country, 'Philippines')
  assert.equal(firstInvalidCheckoutStep(normalized), -1)
})
