import test from 'node:test'
import assert from 'node:assert/strict'
import { isDeliveryLocality } from './deliveryLocality.js'

test('new addresses must match one Philippine locality hierarchy', () => {
  const address = { country: 'Philippines', province: 'Marinduque', city: 'Boac', barangay: 'Agot', zip: '4900' }
  assert.equal(isDeliveryLocality(address), true)
  for (const patch of [{ city: 'Mogpog' }, { barangay: 'Invented place' }, { province: 'constructor' }, { city: '__proto__' }, { zip: 'ABC1' }, { country: 'Canada' }]) {
    assert.equal(isDeliveryLocality({ ...address, ...patch }), false)
  }
  assert.equal(isDeliveryLocality({ ...address, province: 'Metro Manila', city: 'City of Manila', barangay: 'Barangay 1', zip: '1000' }), true)
})
