import test from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryStore, withInventoryStock } from './inventoryStore.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 5))
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }
function fixture(loadProducts) {
  const sources = []
  const events = new EventTarget()
  const document = new EventTarget()
  document.visibilityState = 'visible'
  const store = createInventoryStore({
    loadProducts, eventTarget: events, documentTarget: document,
    createSource: () => {
      const handlers = new Map()
      const source = { closed: false, addEventListener: (type, handler) => handlers.set(type, handler),
        close() { this.closed = true }, send: (products) => handlers.get('stock')({ data: JSON.stringify({ products }) }) }
      sources.push(source)
      return source
    },
  })
  return { store, sources, events, document }
}

test('all product components share one stream and one refresh, then release it on unmount', async () => {
  let loads = 0
  const f = fixture(async () => { loads++; return [{ id: 'p1', legacyId: 'old', stock: 14 }] })
  const unsubscribeA = f.store.subscribe(() => {})
  const unsubscribeB = f.store.subscribe(() => {})
  assert.equal(f.sources.length, 1)
  f.sources[0].onopen()
  await flush()
  assert.equal(loads, 1)
  assert.equal(f.store.getSnapshot().get('p1'), 14)
  assert.equal(f.store.getSnapshot().get('old'), 14)
  unsubscribeA()
  await flush()
  assert.equal(f.sources[0].closed, false)
  unsubscribeB()
  await flush()
  assert.equal(f.sources[0].closed, true)
  assert.equal(f.store.getSnapshot().size, 0)
})

test('approval notifications refresh committed stock and do not trust stale event values', async () => {
  let stock = 14
  const f = fixture(async () => [{ id: 'p1', stock }])
  const unsubscribe = f.store.subscribe(() => {})
  f.sources[0].onopen()
  await flush()
  stock = 0
  f.sources[0].send([{ id: 'p1', stock: 14 }])
  await flush()
  assert.equal(f.store.getSnapshot().get('p1'), 0)
  unsubscribe()
  await flush()
})

test('an older HTTP snapshot cannot overwrite a stock change received during the request', async () => {
  const old = deferred()
  let calls = 0
  const f = fixture(() => ++calls === 1 ? old.promise : Promise.resolve([{ id: 'p1', stock: 0 }]))
  const unsubscribe = f.store.subscribe(() => {})
  f.sources[0].onopen()
  await flush()
  f.sources[0].send([{ id: 'p1', stock: 0 }])
  old.resolve([{ id: 'p1', stock: 14 }])
  await flush()
  assert.equal(calls, 2)
  assert.equal(f.store.getSnapshot().get('p1'), 0)
  unsubscribe()
  await flush()
})

test('focus and reconnect resync stock without interval polling or concurrent duplicate reads', async () => {
  let calls = 0
  const read = deferred()
  const f = fixture(() => { calls++; return read.promise })
  const unsubscribe = f.store.subscribe(() => {})
  f.sources[0].onopen()
  f.events.dispatchEvent(new Event('focus'))
  f.document.dispatchEvent(new Event('visibilitychange'))
  await flush()
  assert.equal(calls, 1)
  read.resolve([{ id: 'p1', stock: 6 }])
  await flush()
  assert.equal(f.store.getSnapshot().get('p1'), 6)
  unsubscribe()
  await flush()
})

test('stock overlays preserve product details and do not mutate catalog or cart snapshots', () => {
  const product = { id: 'p1', name: 'Cloudy Scent', price: 300, stock: 14, quantity: 2 }
  const updated = withInventoryStock(product, new Map([['p1', 0]]))
  assert.deepEqual(updated, { ...product, stock: 0 })
  assert.equal(product.stock, 14)
  assert.equal(withInventoryStock(product, new Map()), product)
})
