import test from 'node:test'
import assert from 'node:assert/strict'
import { groupActiveOrdersByAddress, hasActiveOrderItems } from './ordersByAddress.js'

const address = '123 Sample Street, Paye, Mogpog, Marinduque, 4901, Philippines'
const order = (id, statuses, extra = {}) => ({
  id, address, status: 'Pending COD',
  items: statuses.map((trackingStatus, index) => ({ itemId: `${id}-${index}`, trackingStatus, quantity: 1, price: 300 })),
  ...extra,
})

test('three placed orders with two item-level cancellations count as one active order', () => {
  const orders = [order('active', ['Pending COD']), order('cancelled-one', ['Cancelled']), order('cancelled-two', ['Cancelled'])]
  const before = structuredClone(orders)
  assert.deepEqual(groupActiveOrdersByAddress(orders), [{ country: 'Philippines', province: 'Marinduque', city: 'Mogpog', barangay: 'Paye', count: 1 }])
  assert.deepEqual(orders, before, 'cancelled orders and their original statuses remain available for the history table')
})

test('partially cancelled and multi-item orders count once regardless of quantities', () => {
  const mixed = order('mixed', ['Cancelled', 'To Ship', 'To Receive'])
  mixed.items[1].quantity = 7
  assert.equal(groupActiveOrdersByAddress([mixed])[0].count, 1)
  assert.equal(hasActiveOrderItems(order('review-and-pending', ['To Review', 'Pending COD'])), true)
})

test('fully cancelled, removed, review-ready, completed, and empty orders do not count as active', () => {
  const orders = [
    order('cancelled', ['Cancelled', 'Cancelled']),
    order('removed-items', ['Removed']),
    order('review-ready', ['To Review', 'Cancelled']),
    order('completed', ['Completed']),
    order('empty', []),
    order('unknown', ['Unknown']),
  ]
  assert.deepEqual(groupActiveOrdersByAddress(orders), [])
})

test('whole-order cancellation or removal overrides stale active item statuses', () => {
  for (const status of ['Cancelled', 'Canceled', 'Removed', ' cancelled ']) {
    assert.equal(hasActiveOrderItems(order('closed', ['Pending COD', 'To Ship'], { status })), false)
  }
})

test('legacy items fall back to the parent status while explicit item status takes precedence', () => {
  for (const status of ['Pending', 'Pending COD', 'Verified', 'To Ship', 'To Receive', ' to   ship ']) {
    assert.equal(hasActiveOrderItems(order('legacy', [undefined, ' '], { status })), true, status)
  }
  assert.equal(hasActiveOrderItems(order('review', [undefined], { status: 'To Review' })), false)
  assert.equal(hasActiveOrderItems(order('explicit-review', ['To Review'], { status: 'Pending COD' })), false)
  assert.equal(hasActiveOrderItems({ status: 'Pending COD' }), false)
})

test('active orders group and sort by address without adding locations containing only cancellations', () => {
  const groups = groupActiveOrdersByAddress([
    order('paye-one', ['To Ship']),
    order('paye-two', ['To Receive']),
    order('other', ['Pending COD'], { address: 'Poblacion, Boac, Marinduque, 4900, Philippines' }),
    order('cancelled-location', ['Cancelled'], { address: 'Torrijos, Torrijos, Marinduque, 4903, Philippines' }),
  ])
  assert.deepEqual(groups.map(({ city, count }) => ({ city, count })), [{ city: 'Boac', count: 1 }, { city: 'Mogpog', count: 2 }])
})
