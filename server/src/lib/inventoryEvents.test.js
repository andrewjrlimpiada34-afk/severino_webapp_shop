import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

test('PostgreSQL stock notifications invalidate caches across instances, deduplicate echoes, and release the listener', async (context) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/inventory-events-tests'
  const { getDb, closeDb } = await import('../db/postgres.js')
  const { inventoryEvents, inventoryCache, startInventoryListener, stopInventoryListener } = await import('./inventoryEvents.js')
  const client = new EventEmitter()
  const queries = []
  let released = 0
  client.query = async (sql) => { queries.push(sql); return { rows: [] } }
  client.release = (destroy) => { assert.equal(destroy, true); released++ }
  context.mock.method(getDb(), 'connect', async () => client)
  const events = []
  const onChange = (event) => events.push(event)
  inventoryEvents.on('change', onChange)
  context.after(async () => { stopInventoryListener(); inventoryEvents.off('change', onChange); await closeDb() })
  await startInventoryListener()
  assert.deepEqual(queries, ['LISTEN severino_inventory'])
  assert.equal(events.length, 1, 'listener connection requests a fresh snapshot')
  inventoryCache.set(['stale'])
  const payload = JSON.stringify({ id: 'cross-instance-stock', products: [{ id: 'p1', stock: 0 }] })
  client.emit('notification', { channel: 'severino_inventory', payload })
  client.emit('notification', { channel: 'severino_inventory', payload })
  client.emit('notification', { channel: 'severino_inventory', payload: 'invalid JSON' })
  assert.equal(events.length, 2)
  assert.equal(inventoryCache.get(), null)
  stopInventoryListener()
  assert.equal(released, 1)
})
