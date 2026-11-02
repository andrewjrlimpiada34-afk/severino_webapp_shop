import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

test('approval and delivery APIs enforce ordering, atomic stock deductions, and live stock notifications', async (context) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/order-workflow-tests'
  process.env.JWT_SECRET = 'workflow-tests-only-key'
  const { getDb, closeDb } = await import('./postgres.js')
  const { inventoryEvents, inventoryCache } = await import('../lib/inventoryEvents.js')
  let state
  let notificationsFail = false
  let queue = Promise.resolve()
  const events = []
  const onChange = (event) => events.push(event)
  inventoryEvents.on('change', onChange)
  const item = (id, quantity = 14, trackingStatus = 'Pending COD', productId = 'p1') => ({ itemId: id, productId, quantity, price: 300, name: 'Cloudy Scent', trackingStatus, trackingEvents: [] })
  const reset = (items = [item('i1')]) => {
    events.length = 0
    notificationsFail = false
    state = {
      products: [{ id: 'p1', legacy_id: 'cloudy-old', name: 'Cloudy Scent', price: 300, stock: 14, active: true }, { id: 'p2', name: 'Other scent', price: 300, stock: 1, active: true }],
      orders: [{ id: 'o1', user_id: 'customer', items: JSON.stringify(items), status: 'Pending COD', total: 4200 }],
    }
  }
  reset()

  const query = async (data, sql, values = []) => {
    if (sql.startsWith('SELECT * FROM orders')) return { rows: data.orders.filter((order) => !sql.includes('WHERE') || order.id === values[0]).map((row) => ({ ...row })) }
    if (sql.startsWith('SELECT COUNT(*) AS count FROM products')) return { rows: [{ count: data.products.length }] }
    if (sql.includes('CROSS JOIN LATERAL')) return { rows: [] }
    if (sql.startsWith('SELECT * FROM products') || sql.startsWith('SELECT id, legacy_id FROM products')) return { rows: data.products.filter((product) => !sql.includes('WHERE') || product.id === values[0] || product.legacy_id === values[0]).map((row) => ({ ...row })) }
    if (sql.startsWith('UPDATE products SET stock = stock -')) {
      assert.match(sql, /stock >= \$3 RETURNING/)
      const product = data.products.find((entry) => entry.id === values[1])
      if (!product || product.stock < values[2]) return { rows: [], rowCount: 0 }
      product.stock -= values[0]
      return { rows: [{ ...product }], rowCount: 1 }
    }
    if (sql.startsWith('UPDATE orders SET items')) {
      const order = data.orders.find((entry) => entry.id === values[2])
      order.items = values[0]
      order.status = values[1]
      return { rows: [], rowCount: 1 }
    }
    if (sql.startsWith('UPDATE orders SET status')) {
      data.orders.find((entry) => entry.id === values[1]).status = values[0]
      return { rows: [], rowCount: 1 }
    }
    if (sql.includes('pg_notify')) {
      if (notificationsFail) throw new Error('Simulated notification write failure')
      return { rows: [] }
    }
    throw new Error(`Unexpected workflow test query: ${sql}`)
  }

  // A serialized, rollback-capable pool double; no real database is contacted.
  context.mock.method(getDb(), 'query', (sql, values) => query(state, sql, values))
  context.mock.method(getDb(), 'connect', async () => {
    let unlock
    const previous = queue
    queue = new Promise((resolve) => { unlock = resolve })
    await previous
    const draft = structuredClone(state)
    return {
      query: async (sql, values) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
        if (sql === 'COMMIT') { state = draft; return { rows: [] } }
        if (sql.startsWith('SELECT * FROM orders')) assert.match(sql, /FOR UPDATE$/)
        return query(draft, sql, values)
      },
      release: unlock,
    }
  })
  const { default: ordersRoutes } = await import('../routes/orders.js')
  const { default: productRoutes } = await import('../routes/products.js')
  const app = express()
  app.use(express.json())
  app.use('/api/orders', ordersRoutes)
  app.use('/api/products', productRoutes)
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    return res.status(error.statusCode || 500).json({ message: error.message })
  })
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  const base = `http://127.0.0.1:${server.address().port}`
  const admin = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET)
  const customer = jwt.sign({ id: 'customer', role: 'customer' }, process.env.JWT_SECRET)
  const request = (url, status, token = admin, method = 'PATCH') => fetch(`${base}${url}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: method === 'DELETE' ? undefined : JSON.stringify({ status }),
  })
  const change = (status, id = 'i1') => request(`/api/orders/o1/items/${id}/progress`, status)
  context.after(async () => {
    inventoryEvents.off('change', onChange)
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await closeDb()
  })

  await context.test('future steps are rejected before approval and invalid statuses are rejected', async () => {
    reset()
    for (const status of ['To Ship', 'To Receive', 'To Review']) assert.equal((await change(status)).status, 409)
    assert.equal((await change('Anything')).status, 400)
    assert.equal(state.products[0].stock, 14)
    assert.equal(JSON.parse(state.orders[0].items)[0].trackingStatus, 'Pending COD')
    assert.equal(events.length, 0)
    assert.equal((await request('/api/orders/o1/items/i1/progress', 'Approved', customer)).status, 403)
    assert.equal((await request('/api/orders/o1/items/i1/status', 'To Ship')).status, 409)
  })

  await context.test('approval deducts 14 to zero once, notifies open stock streams, and invalidates inventory cache', async () => {
    reset()
    const abort = new AbortController()
    const stream = await fetch(`${base}/api/products/stock-events`, { signal: abort.signal })
    assert.equal(stream.headers.get('Content-Type').startsWith('text/event-stream'), true)
    const reader = stream.body.getReader()
    await reader.read() // connected comment
    inventoryCache.set(['stale'])
    const approved = await change('Approved')
    assert.equal(approved.status, 200)
    const data = await approved.json()
    assert.equal(data.items[0].trackingStatus, 'Approved')
    assert.ok(data.items[0].stockDeductedAt)
    assert.equal(data.items[0].stockDeductedQuantity, 14)
    assert.equal(state.products[0].stock, 0)
    assert.equal(inventoryCache.get(), null)
    const notification = await Promise.race([reader.read(), new Promise((_, reject) => setTimeout(() => reject(new Error('Missing stock event')), 2000).unref())])
    assert.match(new TextDecoder().decode(notification.value), /"stock":0/)
    abort.abort()
    assert.equal((await change('Approved')).status, 200)
    assert.equal(events.length, 1)
    assert.equal(state.products[0].stock, 0)
    const storefront = await fetch(`${base}/api/products/p1`)
    assert.equal(storefront.headers.get('Cache-Control'), 'no-store')
    assert.equal((await storefront.json()).stock, 0)
  })

  await context.test('later steps advance progressively, cannot go backward, and never deduct again', async () => {
    assert.equal((await change('To Review')).status, 409)
    for (const status of ['To Ship', 'To Receive', 'To Review']) assert.equal((await change(status)).status, 200)
    assert.equal((await change('To Ship')).status, 409)
    assert.equal(state.products[0].stock, 0)
    assert.equal(events.length, 1)
    assert.equal((await request('/api/orders/o1', undefined, admin, 'DELETE')).status, 200)
    assert.equal(state.products[0].stock, 0, 'archiving is not a restock')
    assert.equal((await change('Approved')).status, 409)
  })

  await context.test('partial orders allow cancellation only for the still-pending item', async () => {
    reset([item('i1', 2), item('i2', 3)])
    assert.equal((await change('Approved')).status, 200)
    assert.equal(state.orders[0].status, 'Pending COD')
    assert.equal((await request('/api/orders/o1/items/i1/cancel', undefined, customer)).status, 409)
    assert.equal((await request('/api/orders/o1/items/i2/cancel', undefined, customer)).status, 200)
    assert.equal((await request('/api/orders/o1/items/i2/cancel', undefined, customer)).status, 200)
    assert.equal(state.orders[0].status, 'Approved')
    assert.equal(state.products[0].stock, 12)
    assert.equal((await change('Approved', 'i2')).status, 409)
  })

  await context.test('whole-order approval skips cancelled items and rolls everything back if stock is insufficient', async () => {
    reset([item('i1', 14), item('i2', 2, 'Pending COD', 'p2')])
    assert.equal((await request('/api/orders/o1/verify')).status, 409)
    assert.equal(state.products[0].stock, 14)
    assert.equal(state.products[1].stock, 1)
    assert.equal(state.orders[0].status, 'Pending COD')
    assert.equal(events.length, 0)
    reset([item('i1', 14), item('i2', 100, 'Cancelled')])
    assert.equal((await request('/api/orders/o1/verify')).status, 200)
    assert.equal(state.products[0].stock, 0)
    assert.equal(JSON.parse(state.orders[0].items)[1].trackingStatus, 'Cancelled')
  })

  await context.test('transaction failure leaves stock and approval unchanged without publishing an event', async () => {
    reset()
    notificationsFail = true
    assert.equal((await change('Approved')).status, 500)
    assert.equal(state.products[0].stock, 14)
    assert.equal(state.orders[0].status, 'Pending COD')
    assert.equal(events.length, 0)
  })

  await context.test('simultaneous approvals cannot deduct the same item twice or oversell another order', async () => {
    reset()
    const duplicate = await Promise.all([change('Approved'), change('Approved')])
    assert.deepEqual(duplicate.map((response) => response.status), [200, 200])
    assert.equal(state.products[0].stock, 0)
    assert.equal(events.length, 1)
    reset()
    state.orders.push({ ...state.orders[0], id: 'o2', items: JSON.stringify([item('i2')]) })
    const responses = await Promise.all([change('Approved'), request('/api/orders/o2/items/i2/status', 'Approved')])
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409])
    assert.equal(state.products[0].stock, 0)
  })

  await context.test('older shipped records progress without unverified retroactive stock deductions', async () => {
    reset([item('i1', 14, 'To Ship')])
    assert.equal((await change('To Receive')).status, 200)
    assert.equal(state.products[0].stock, 14)
    assert.equal((await change('Approved')).status, 409)
    assert.equal(events.length, 0)
  })
})
