import test from 'node:test'
import assert from 'node:assert/strict'
import { hasTestDatabase, useTestDatabase } from './testDatabase.js'

test(
  'enhancement migration rolls back shortages and preserves legacy stock evidence',
  { skip: !hasTestDatabase && 'Set TEST_DATABASE_URL or TEST_PGLITE_MODULE.' },
  async (context) => {
    const database = await useTestDatabase(context)
    const user = '111111111111111111111111'
    const product = 'bbbbbbbbbbbbbbbbbbbbbbbb'
    await database.query(
      "INSERT INTO users(id,name,email,role,verified,barangay,city,province,zip,country) VALUES ($1,'Legacy customer','LEGACY@example.com','customer',TRUE,'Poblacion','Boac','Marinduque','4900','Philippines')",
      [user]
    )
    await database.query(
      "INSERT INTO products(id,name,price,stock) VALUES ($1,'Legacy scent',300,1)",
      [product]
    )
    const insertOrder = (id, status, items) =>
      database.query(
        "INSERT INTO orders(id,user_id,items,total,status,address,contact_name,phone,email,payment_method) VALUES ($1,$2,$3,600,$4,'Old delivery address','Legacy customer','+639171234567','legacy@example.com','COD')",
        [id, user, JSON.stringify(items), status]
      )
    await insertOrder('222222222222222222222222', 'Pending COD', [
      { productId: product, quantity: 2, price: 300, name: 'Old product name' }
    ])
    await insertOrder('333333333333333333333333', 'Approved', [
      {
        productId: product,
        quantity: 1,
        price: 300,
        stockDeductedAt: '2026-01-01T00:00:00Z',
        stockDeductedQuantity: 1
      }
    ])
    await insertOrder('444444444444444444444444', 'To Receive', [
      { productId: product, quantity: 1, price: 300 }
    ])
    const { migrateEnhancements } =
      await import('../../scripts/migrate-enhancements.js')
    await assert.rejects(migrateEnhancements(), /reconciliation/)
    assert.equal(
      (
        await database.query(
          "SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='products' AND column_name='reserved_stock'"
        )
      ).rows[0].count,
      0
    )
    await database.query('UPDATE products SET stock=2 WHERE id=$1', [product])
    assert.equal(await migrateEnhancements(), true)
    assert.equal(await migrateEnhancements(), false)
    assert.deepEqual(
      (
        await database.query(
          'SELECT stock,reserved_stock FROM products WHERE id=$1',
          [product]
        )
      ).rows[0],
      { stock: 2, reserved_stock: 2 }
    )
    assert.equal(
      (await database.query('SELECT COUNT(*)::int AS count FROM order_items'))
        .rows[0].count,
      3
    )
    const { rows: orders } = await database.query(
      'SELECT * FROM orders ORDER BY id'
    )
    assert.equal(orders[0].items[0].reservationActive, true)
    assert.equal(orders[1].items[0].stockDeductedAt, '2026-01-01T00:00:00Z')
    assert.equal(orders[2].items[0].inventoryReviewRequired, true)
    assert.equal(
      orders.every((order) => order.payment_status === 'Unpaid'),
      true
    )
    assert.equal(
      orders.every(
        (order) => order.reference !== `SV-${order.id.toUpperCase()}`
      ),
      true
    )
    assert.equal(
      (await database.query('SELECT COUNT(*)::int AS count FROM payments'))
        .rows[0].count,
      0
    )
    assert.equal(
      (
        await database.query(
          'SELECT COUNT(*)::int AS count FROM terms_acceptances'
        )
      ).rows[0].count,
      0
    )
    assert.equal(
      (
        await database.query(
          'SELECT COUNT(*)::int AS count FROM customer_addresses WHERE is_default=TRUE'
        )
      ).rows[0].count,
      1
    )
    await assert.rejects(
      database.query('DELETE FROM users WHERE id=$1', [user]),
      /foreign key/
    )
    await assert.rejects(
      database.query('UPDATE products SET stock=1 WHERE id=$1', [product]),
      /check constraint/
    )
  }
)
