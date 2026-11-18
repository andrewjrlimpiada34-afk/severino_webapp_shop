import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { hasTestDatabase, useTestDatabase } from './testDatabase.js'

test(
  'checkout, fulfillment, payment, refunds, and access controls against PostgreSQL',
  {
    skip:
      !hasTestDatabase &&
      'Set TEST_DATABASE_URL or TEST_PGLITE_MODULE for database integration tests.'
  },
  async (context) => {
    const database = await useTestDatabase(context)
    const customer = '111111111111111111111111'
    const other = '222222222222222222222222'
    const administrator = 'aaaaaaaaaaaaaaaaaaaaaaaa'
    const productId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
    await database.query(
      `INSERT INTO users(id,name,email,phone,role,verified) VALUES ($1,'Customer','customer@example.com','+639171234567','customer',TRUE),($2,'Other customer','other@example.com','+639181234567','customer',TRUE),($3,'Administrator','admin@example.com',NULL,'admin',TRUE)`,
      [customer, other, administrator]
    )
    await database.query(
      `INSERT INTO products(id,name,price,stock,active) VALUES ($1,'Test fragrance',350.25,2,TRUE)`,
      [productId]
    )
    const { migrateEnhancements } =
      await import('../../scripts/migrate-enhancements.js')
    assert.equal(await migrateEnhancements(), true)
    assert.equal(await migrateEnhancements(), false)
    const {
      createOrder,
      updateOrderItemStatus,
      cancelOrder,
      returnOrderItem,
      serializeOrder
    } = await import('./orders.js')
    const { recordPayment, getCollectedSales } = await import('./payments.js')
    const { getSalesSummary } = await import('./inventory.js')
    const { inventoryEvents } = await import('../lib/inventoryEvents.js')
    const events = []
    const onEvent = (event) => events.push(event)
    inventoryEvents.on('change', onEvent)
    context.after(() => inventoryEvents.off('change', onEvent))
    const payload = (userId = customer, checkoutKey = crypto.randomUUID()) => ({
      userId,
      checkoutKey,
      items: [{ productId, quantity: 1, price: 0.01, name: 'Tampered name' }],
      address: 'Agot, Boac, Marinduque, 4900, Philippines',
      contactName: 'Customer',
      phone: '+639171234567',
      email: 'delivery@example.com',
      paymentMethod: 'COD',
      fromCart: false,
      notes: ''
    })
    let first
    await context.test(
      'checkout takes current database prices, reserves once, and retains the original response on retries',
      async () => {
        const data = payload()
        first = await createOrder(data)
        assert.equal(first.total, 350.25)
        assert.equal(first.items[0].name, 'Test fragrance')
        assert.match(first.reference, /^SV-[A-F0-9]{20}$/)
        assert.equal((await createOrder(data)).id, first.id)
        await assert.rejects(
          createOrder({ ...data, notes: 'Changed after submission' }),
          /already used/
        )
        const stock = (
          await database.query(
            'SELECT stock,reserved_stock FROM products WHERE id=$1',
            [productId]
          )
        ).rows[0]
        assert.deepEqual(stock, { stock: 2, reserved_stock: 1 })
        assert.equal(
          (
            await database.query(
              "SELECT COUNT(*)::int AS count FROM inventory_logs WHERE action='reserve'"
            )
          ).rows[0].count,
          1
        )
        assert.equal((await getSalesSummary()).revenue, 0)
        assert.equal(events.length, 1)
        const safe = serializeOrder(first)
        assert.equal(safe.id, first.reference)
        assert.equal(safe.userId, undefined)
        assert.equal(safe.requestFingerprint, undefined)
      }
    )
    await context.test(
      'a failure after order insertion rolls back stock, order items, and inventory logs',
      async (subtest) => {
        const { getDb } = await import('./postgres.js')
        const connect = getDb().connect.bind(getDb())
        subtest.mock.method(getDb(), 'connect', async () => {
          const connection = await connect()
          return {
            release: () => connection.release(),
            query: (sql, values) => {
              if (sql.includes('pg_notify'))
                throw new Error('Simulated inventory notification failure')
              return connection.query(sql, values)
            }
          }
        })
        await assert.rejects(
          createOrder(payload(other)),
          /notification failure/
        )
        assert.equal(
          (await database.query('SELECT COUNT(*)::int AS count FROM orders'))
            .rows[0].count,
          1
        )
        assert.equal(
          (
            await database.query(
              'SELECT reserved_stock FROM products WHERE id=$1',
              [productId]
            )
          ).rows[0].reserved_stock,
          1
        )
        assert.equal(
          (
            await database.query(
              "SELECT COUNT(*)::int AS count FROM inventory_logs WHERE action='reserve'"
            )
          ).rows[0].count,
          1
        )
        assert.equal(events.length, 1)
      }
    )
    await context.test(
      'competing checkout attempts cannot exceed available stock',
      async () => {
        const results = await Promise.allSettled([
          createOrder(payload(other)),
          createOrder(payload(other))
        ])
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1
        )
        assert.equal(
          results.filter((result) => result.status === 'rejected').length,
          1
        )
        const stock = (
          await database.query(
            'SELECT stock,reserved_stock FROM products WHERE id=$1',
            [productId]
          )
        ).rows[0]
        assert.deepEqual(stock, { stock: 2, reserved_stock: 2 })
      }
    )
    await context.test(
      'repeated-product rows and unknown products cannot bypass stock validation',
      async () => {
        await assert.rejects(
          createOrder({
            ...payload(),
            items: [
              { productId, quantity: 1 },
              { productId, quantity: 1 }
            ]
          }),
          /stock/
        )
        await assert.rejects(
          createOrder({
            ...payload(),
            items: [{ productId: 'missing', quantity: 1 }]
          }),
          /unavailable/
        )
        assert.equal(
          (await database.query('SELECT COUNT(*)::int AS count FROM orders'))
            .rows[0].count,
          2
        )
      }
    )
    await context.test(
      'cancellation releases a pending reservation once and enforces ownership',
      async () => {
        assert.equal(await cancelOrder(first.reference, other), null)
        const cancelled = await cancelOrder(first.reference, customer)
        assert.equal(cancelled.status, 'Cancelled')
        await cancelOrder(first.reference, customer)
        assert.equal(
          (
            await database.query(
              'SELECT reserved_stock FROM products WHERE id=$1',
              [productId]
            )
          ).rows[0].reserved_stock,
          1
        )
        assert.equal(
          (
            await database.query(
              "SELECT COUNT(*)::int AS count FROM inventory_logs WHERE action='release'"
            )
          ).rows[0].count,
          1
        )
      }
    )
    let shipped
    await context.test(
      'approval keeps the reservation and dispatch deducts physical stock once',
      async () => {
        shipped = await createOrder(payload())
        const key = shipped.items[0].itemId
        await assert.rejects(
          updateOrderItemStatus(
            shipped.id,
            key,
            'To Receive',
            null,
            administrator
          ),
          /Complete/
        )
        await updateOrderItemStatus(
          shipped.id,
          key,
          'Approved',
          null,
          administrator
        )
        assert.equal(
          (
            await database.query('SELECT stock FROM products WHERE id=$1', [
              productId
            ])
          ).rows[0].stock,
          2
        )
        await updateOrderItemStatus(
          shipped.id,
          key,
          'To Ship',
          null,
          administrator
        )
        shipped = await updateOrderItemStatus(
          shipped.id,
          key,
          'To Receive',
          null,
          administrator
        )
        await updateOrderItemStatus(
          shipped.id,
          key,
          'To Receive',
          null,
          administrator
        )
        assert.deepEqual(
          (
            await database.query(
              'SELECT stock,reserved_stock FROM products WHERE id=$1',
              [productId]
            )
          ).rows[0],
          { stock: 1, reserved_stock: 1 }
        )
        assert.equal((await getSalesSummary()).revenue, 0)
        assert.ok(shipped.items[0].stockDeductedAt)
      }
    )
    const payment = {
      kind: 'collection',
      status: 'Paid',
      amount: 350.25,
      method: 'COD',
      reference: 'COLLECTION-001',
      reason: 'Collected at handover',
      requestKey: crypto.randomUUID(),
      collectionVerified: true
    }
    await context.test(
      'verified collection drives sales and repeated confirmation has one effect',
      async () => {
        await assert.rejects(
          recordPayment(
            shipped.id,
            { ...payment, collectionVerified: false },
            administrator
          ),
          /actual collection/
        )
        const paid = await recordPayment(shipped.id, payment, administrator)
        assert.equal(paid.paymentStatus, 'Paid')
        await recordPayment(shipped.id, payment, administrator)
        await assert.rejects(
          recordPayment(
            shipped.id,
            { ...payment, requestKey: crypto.randomUUID() },
            administrator
          ),
          /already been confirmed/
        )
        assert.equal((await getSalesSummary()).revenue, 350.25)
        assert.equal((await getCollectedSales()).length, 1)
        assert.equal(
          (
            await database.query(
              "SELECT COUNT(*)::int AS count FROM payments WHERE status='Paid'"
            )
          ).rows[0].count,
          1
        )
      }
    )
    await context.test(
      'partial and full refunds adjust collections without restoring stock',
      async () => {
        const refund = {
          ...payment,
          kind: 'refund',
          amount: 100,
          reference: 'REFUND-001',
          reason: 'Partial refund',
          requestKey: crypto.randomUUID()
        }
        assert.equal(
          (await recordPayment(shipped.id, refund, administrator))
            .paymentStatus,
          'Partially Refunded'
        )
        await recordPayment(shipped.id, refund, administrator)
        assert.equal((await getSalesSummary()).revenue, 250.25)
        await assert.rejects(
          recordPayment(
            shipped.id,
            { ...refund, amount: 300, requestKey: crypto.randomUUID() },
            administrator
          ),
          /exceeds/
        )
        const full = await recordPayment(
          shipped.id,
          {
            ...refund,
            amount: 250.25,
            reference: 'REFUND-002',
            requestKey: crypto.randomUUID()
          },
          administrator
        )
        assert.equal(full.paymentStatus, 'Refunded')
        assert.equal((await getSalesSummary()).revenue, 0)
        assert.equal(
          (
            await database.query('SELECT stock FROM products WHERE id=$1', [
              productId
            ])
          ).rows[0].stock,
          1
        )
      }
    )
    await context.test(
      'accepted returned goods restore inventory once using the return reference',
      async () => {
        const requestKey = crypto.randomUUID()
        await returnOrderItem(
          shipped.id,
          shipped.items[0].itemId,
          1,
          requestKey,
          administrator
        )
        await returnOrderItem(
          shipped.id,
          shipped.items[0].itemId,
          1,
          requestKey,
          administrator
        )
        await assert.rejects(
          returnOrderItem(
            shipped.id,
            shipped.items[0].itemId,
            1,
            crypto.randomUUID(),
            administrator
          ),
          /exceeds/
        )
        assert.equal(
          (
            await database.query('SELECT stock FROM products WHERE id=$1', [
              productId
            ])
          ).rows[0].stock,
          2
        )
      }
    )
    await context.test(
      'addresses enforce customer ownership and orders preserve their delivery snapshot',
      async () => {
        const { saveAddress, deleteAddress, listAddresses } =
          await import('./addresses.js')
        const address = {
          label: 'Work',
          name: 'Work recipient',
          phone: '+639181234567',
          addressLine: 'Original street',
          barangay: 'Poblacion',
          city: 'Boac',
          province: 'Marinduque',
          zip: '4900',
          country: 'Philippines',
          isDefault: true
        }
        const saved = await saveAddress(customer, address)
        assert.equal((await listAddresses(customer))[0].isDefault, true)
        assert.equal(await saveAddress(other, address, saved.id), null)
        await assert.rejects(
          createOrder({ ...payload(other), addressId: saved.id }),
          /your saved addresses/
        )
        const order = await createOrder({ ...payload(), addressId: saved.id })
        await saveAddress(
          customer,
          { ...address, addressLine: 'Changed street' },
          saved.id
        )
        await deleteAddress(customer, saved.id)
        const { getOrderById } = await import('./orders.js')
        assert.equal(
          (await getOrderById(order.id)).addressSnapshot.addressLine,
          'Original street'
        )
      }
    )
    await context.test(
      'HTTP endpoints reject customer payment actions, forged roles, and another customer order',
      async () => {
        const { default: routes } = await import('../routes/orders.js')
        const { errorHandler } = await import('../middleware/error.js')
        const app = express()
        app.use(express.json())
        app.use('/api/orders', routes)
        app.use(errorHandler)
        const server = await new Promise((done) => {
          const instance = app.listen(0, '127.0.0.1', () => done(instance))
        })
        try {
          const token = jwt.sign(
            { id: other, role: 'admin' },
            process.env.JWT_SECRET
          )
          const request = (path, method, body) =>
            fetch(
              `http://127.0.0.1:${server.address().port}/api/orders${path}`,
              {
                method,
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
              }
            )
          assert.equal(
            (await request(`/${shipped.reference}/payments`, 'POST', payment))
              .status,
            403
          )
          assert.equal(
            (await request(`/${shipped.reference}/cancel`, 'PATCH', {})).status,
            404
          )
          assert.equal(
            (
              await request('/', 'POST', {
                ...payload(other),
                items: [{ productId, quantity: 0.5 }]
              })
            ).status,
            400
          )
        } finally {
          server.closeAllConnections()
          await new Promise((done) => server.close(done))
        }
      }
    )
    await context.test(
      'cart checkout consumes purchased quantities once and preserves the remaining cart',
      async () => {
        const { createProduct } = await import('./products.js')
        const { createCart, updateCart, getCartByUserId } =
          await import('./carts.js')
        const product = await createProduct(
          {
            name: 'Second fragrance',
            price: 320.5,
            stock: 4,
            notes: 'Fresh scent',
            active: true
          },
          administrator
        )
        await createCart(customer)
        await updateCart(customer, [
          { productId: product.id, quantity: 3 },
          { productId, quantity: 1 }
        ])
        const data = {
          ...payload(),
          fromCart: true,
          items: [{ productId: product.id, quantity: 2 }]
        }
        const created = await createOrder(data)
        assert.equal(created.total, 641)
        await createOrder(data)
        assert.deepEqual((await getCartByUserId(customer)).items, [
          { productId: product.id, quantity: 1 },
          { productId, quantity: 1 }
        ])
      }
    )
  }
)
