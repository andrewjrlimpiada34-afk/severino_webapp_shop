import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextOrderStatus, getOrderItemStatus, summarizeOrderStatus } from './orderWorkflow.js'

test('approval is required before shipping and the workflow advances one step at a time', () => {
  assert.equal(getNextOrderStatus('Pending COD'), 'Approved')
  assert.equal(getNextOrderStatus('Approved'), 'To Ship')
  assert.equal(getNextOrderStatus('To Ship'), 'To Receive')
  assert.equal(getNextOrderStatus('To Receive'), 'To Review')
  for (const status of ['To Review', 'Cancelled', 'Removed', 'Unknown']) assert.equal(getNextOrderStatus(status), null)
})

test('partial approval keeps the parent pending until all remaining items progress', () => {
  const items = (statuses) => statuses.map((trackingStatus) => ({ trackingStatus }))
  assert.equal(summarizeOrderStatus(items(['Approved', 'Pending COD'])), 'Pending COD')
  assert.equal(summarizeOrderStatus(items(['Approved', 'Cancelled'])), 'Approved')
  assert.equal(summarizeOrderStatus(items(['To Ship', 'To Receive'])), 'To Ship')
  assert.equal(summarizeOrderStatus(items(['Cancelled', 'Cancelled'])), 'Cancelled')
  assert.equal(summarizeOrderStatus(items(['To Review', 'Cancelled'])), 'To Review')
  assert.equal(getOrderItemStatus({ status: 'Cancelled' }, { trackingStatus: 'Approved' }), 'Cancelled')
  assert.equal(getOrderItemStatus({ status: 'Pending COD' }, { trackingStatus: 'Unknown' }), 'Unknown')
})
