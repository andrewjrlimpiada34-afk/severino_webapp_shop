import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { errorHandler } from '../middleware/error.js'

test('delivery contact checks and profile conflicts preserve account ownership', async (context) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/delivery-contact-test'
  process.env.JWT_SECRET = 'delivery-contact-tests-only-key'
  process.env.NODE_ENV = 'production'
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
  const { getDb, closeDb } = await import('../db/postgres.js')
  const users = [
    { id: 'customer-one', name: 'Ana Cruz', phone: '0917 123 4567', email: 'ana@example.com', role: 'customer' },
    { id: 'customer-two', name: 'Other Customer', phone: '0928-765-4321', email: 'other@example.com', role: 'customer' },
  ]
  const orders = []
  const sales = []
  const queries = []
  let failure
  context.mock.method(getDb(), 'query', async (sql, values = []) => {
    queries.push({ sql, values })
    if (sql.includes('SELECT EXISTS')) {
      if (failure) throw failure
      assert.match(sql, /id <> \$1/)
      assert.match(sql, /ANY\(\$2::text\[\]\)/)
      const registered = users.some((user) => user.id !== values[0] && values[1].includes(user.phone.replace(/[\s-]/g, '')))
      return { rows: [{ registered }] }
    }
    if (sql.startsWith('SELECT * FROM users')) return { rows: users.filter((user) => user.id === values[0]) }
    if (sql.startsWith('UPDATE users')) {
      if (failure) throw failure
      return { rowCount: 1 }
    }
    if (sql.startsWith('SELECT COUNT(*) AS count FROM products')) return { rows: [{ count: 1 }] }
    if (sql.startsWith('SELECT * FROM products')) return { rows: [{ id: 'product-one', name: 'Test Scent', price: 300, stock: 5, active: true }] }
    if (sql.includes('INSERT INTO orders')) {
      const columns = ['id', 'user_id', 'items', 'total', 'status', 'address', 'contact_name', 'phone', 'email', 'payment_method', 'created_at']
      orders.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])))
      return { rowCount: 1 }
    }
    if (sql.startsWith('SELECT * FROM orders')) return { rows: orders.filter((order) => order.id === values[0]) }
    if (sql.startsWith('INSERT INTO sales')) { sales.push(values); return { rowCount: 1 } }
    throw new Error(`Unexpected contact test query: ${sql}`)
  })
  context.mock.method(console, 'error', () => {})
  const { default: userRoutes } = await import('./users.js')
  const { default: orderRoutes } = await import('./orders.js')
  const app = express()
  app.use(express.json())
  app.use('/api/users', userRoutes)
  app.use('/api/orders', orderRoutes)
  app.use(errorHandler)
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await closeDb()
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const token = jwt.sign({ id: 'customer-one', role: 'customer' }, process.env.JWT_SECRET)
  const request = (path, body, method = 'POST', authenticated = true) => fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(3000),
  })
  const lookup = (phone, authenticated = true) => request('/api/users/me/check-delivery-phone', { phone }, 'POST', authenticated)
  const profile = { name: 'Ana Cruz', email: 'ana@example.com', phone: '+639171234567',
    barangay: 'Poblacion', city: 'Manila', province: 'Metro Manila', zip: '1000', country: 'Philippines' }

  await context.test('lookup requires authentication and rejects invalid phones before querying', async () => {
    assert.equal((await lookup('+639287654321', false)).status, 401)
    for (const invalid of ['', '123', 'invalid', null]) assert.equal((await lookup(invalid)).status, 400)
    assert.equal(queries.length, 0)
  })

  await context.test('own phone never prompts; alternate formats find another account without revealing identity', async () => {
    for (const phone of ['0917 123 4567', '+639171234567', '639171234567', '9171234567']) {
      const response = await lookup(phone)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { registeredToAnotherUser: false })
    }
    for (const phone of ['0928-765-4321', '+639287654321', '639287654321', '9287654321']) {
      const response = await lookup(phone)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual(await response.json(), { registeredToAnotherUser: true })
      assert.equal(queries.at(-1).values[0], 'customer-one')
      assert.deepEqual(queries.at(-1).values[1], ['+639287654321', '639287654321', '09287654321', '9287654321'])
    }
    assert.deepEqual(await (await lookup('09998887777')).json(), { registeredToAnotherUser: false })
    assert.equal(queries.some(({ sql }) => sql.startsWith('UPDATE') || sql.includes('INSERT')), false)
  })

  await context.test('lookup failures return an error and a retry can recover', async () => {
    failure = Object.assign(new Error('Simulated database outage'), { code: 'ECONNRESET' })
    const response = await lookup('09287654321')
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { message: 'Internal server error' })
    failure = undefined
    assert.equal((await lookup('09287654321')).status, 200)
  })

  await context.test('account edits report phone and email conflicts without exposing database details', async () => {
    for (const [constraint, text] of [['users_phone_key', 'mobile number'], ['users_email_key', 'email']]) {
      failure = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint })
      const response = await request('/api/users/me', profile, 'PATCH')
      assert.equal(response.status, 409)
      const body = await response.json()
      assert.match(body.message, new RegExp(`This ${text} is already registered to another user`))
      assert.equal(body.message.includes(constraint), false)
    }
    failure = Object.assign(new Error('Unexpected constraint'), { code: '23505', constraint: 'users_pkey' })
    assert.equal((await request('/api/users/me', profile, 'PATCH')).status, 500)
    failure = undefined
    assert.equal((await request('/api/users/me', profile, 'PATCH')).status, 200)
  })

  await context.test('an order may share a delivery contact while both users retain their login details', async () => {
    queries.length = 0
    const before = structuredClone(users)
    const response = await request('/api/orders', {
      items: [{ productId: 'product-one', name: 'Test Scent', quantity: 1, price: 300 }],
      address: 'Poblacion, Manila', contactName: 'Ana Cruz', phone: '+639287654321', email: 'other@example.com', paymentMethod: 'COD',
    })
    assert.equal(response.status, 201)
    const order = await response.json()
    assert.equal(order.userId, 'customer-one')
    assert.equal(order.phone, '+639287654321')
    assert.equal(order.email, 'other@example.com')
    assert.equal(order.status, 'Pending COD')
    assert.equal(orders.length, 1)
    assert.equal(sales.length, 1)
    assert.deepEqual(users, before)
    assert.equal(queries.some(({ sql }) => sql.includes('UPDATE users')), false)
  })
})
