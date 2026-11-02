import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceOrderItem } from './orderProgress.js'

test('order progression uses the protected endpoint without relying on a response version marker', async () => {
  const calls = []
  const updated = { id: 'order-1', items: [{ trackingStatus: 'Approved', stockDeductedAt: '2026-11-03' }] }
  const result = await advanceOrderItem(async (path, options) => { calls.push({ path, options }); return updated }, 'order-1', '0-product-1', 'Approved')
  assert.equal(result, updated)
  assert.deepEqual(calls, [{ path: '/api/orders/order-1/items/0-product-1/progress', options: { method: 'PATCH', body: '{"status":"Approved"}' } }])
})

test('an older backend produces an actionable error and never falls back to its unsafe status route', async () => {
  const calls = []
  await assert.rejects(advanceOrderItem(async (path) => {
    calls.push(path)
    throw Object.assign(new Error('Request failed. Please try again.'), { status: 404 })
  }, 'o1', 'i1', 'Approved'), /latest Node backend.*Render/)
  assert.deepEqual(calls, ['/api/orders/o1/items/i1/progress'])
})

test('missing items and stock conflicts retain the server explanation', async () => {
  for (const [status, message] of [[404, 'Order item no longer exists. Refresh orders.'], [409, 'Insufficient stock. Refresh inventory before approving this item.']]) {
    const failure = Object.assign(new Error(message), { status })
    await assert.rejects(advanceOrderItem(async () => { throw failure }, 'o1', 'i1', 'Approved'), (error) => error === failure && error.message === message)
  }
})
