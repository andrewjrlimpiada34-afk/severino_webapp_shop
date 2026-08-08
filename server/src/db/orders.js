import { getDb, withTransaction } from './postgres.js'
import { createId, parseJson } from './util.js'

const mapOrder = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        items: parseJson(row.items, []),
        total: Number(row.total),
        status: row.status,
        address: row.address,
        contactName: row.contact_name,
        phone: row.phone,
        email: row.email,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
      }
    : null

const selectOrderById = async (db, id, forUpdate = false) => {
  const { rows } = await db.query(
    `SELECT * FROM orders WHERE id = $1 LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  )
  return mapOrder(rows[0])
}

export const getOrderById = async (id) => {
  if (!id) return null
  return selectOrderById(getDb(), id)
}

export const getOrders = async () => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM orders ORDER BY created_at DESC')
  return rows.map(mapOrder)
}

export const getOrdersByUserId = async (userId) => {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT * FROM orders
     WHERE user_id = $1 AND status <> 'Removed'
     ORDER BY created_at DESC`,
    [userId]
  )
  return rows.map(mapOrder)
}

export const createOrder = async (data) => {
  const db = getDb()
  const id = createId()
  const now = new Date()
  const items = (data.items || []).map((item, index) => ({
    ...item,
    itemId: `${index}-${item.productId}`,
    trackingStatus: 'Pending COD',
    trackingEvents: [{ status: 'Pending COD', at: now.toISOString() }],
  }))
  await db.query(
    `INSERT INTO orders (
      id, user_id, items, total, status, address, contact_name, phone,
      email, payment_method, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id, data.userId, JSON.stringify(items), Number(data.total || 0),
      data.status || 'Pending', data.address, data.contactName, data.phone,
      data.email, data.paymentMethod, now,
    ]
  )
  return getOrderById(id)
}

export const updateOrderStatus = async (id, status) => {
  const db = getDb()
  const result = await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id])
  return result.rowCount ? getOrderById(id) : null
}

export const cancelOrder = async (id, userId) =>
  withTransaction(async (connection) => {
    const order = await selectOrderById(connection, id, true)
    if (!order || order.userId !== userId || order.status !== 'Pending COD') return null
    const at = new Date().toISOString()
    const items = order.items.map((item) => ({
      ...item,
      trackingStatus: 'Cancelled',
      trackingEvents: [...(item.trackingEvents || []), { status: 'Cancelled', at }],
    }))
    await connection.query(
      `UPDATE orders SET status = 'Cancelled', items = $1 WHERE id = $2`,
      [JSON.stringify(items), id]
    )
    return { ...order, status: 'Cancelled', items }
  })

export const updateOrderItemStatus = async (orderId, itemId, status, userId = null) =>
  withTransaction(async (connection) => {
    const order = await selectOrderById(connection, orderId, true)
    if (!order || (userId && order.userId !== userId)) return null
    if (userId && order.status !== 'Pending COD' && order.status !== 'Pending') return null
    const itemIndex = order.items.findIndex((item) => item.itemId === itemId)
    if (itemIndex < 0) return null
    const at = new Date().toISOString()
    const items = [...order.items]
    items[itemIndex] = {
      ...items[itemIndex],
      trackingStatus: status,
      trackingEvents: [...(items[itemIndex].trackingEvents || []), { status, at }],
    }
    await connection.query('UPDATE orders SET items = $1 WHERE id = $2', [
      JSON.stringify(items),
      orderId,
    ])
    return { ...order, items }
  })

export const verifyOrder = async (id) =>
  withTransaction(async (connection) => {
    const order = await selectOrderById(connection, id, true)
    if (!order) return null
    if (order.status !== 'Pending COD') {
      const error = new Error('Order already processed')
      error.statusCode = 400
      throw error
    }
    const at = new Date().toISOString()

    for (const item of order.items) {
      const { rows: products } = await connection.query(
        'SELECT id FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1 FOR UPDATE',
        [item.productId, item.productId]
      )
      if (!products[0]) {
        const error = new Error(`Product not found: ${item.productId}`)
        error.statusCode = 400
        throw error
      }
      const result = await connection.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3',
        [item.quantity, products[0].id, item.quantity]
      )
      if (!result.rowCount) {
        const error = new Error(`Insufficient stock for ${item.productId}`)
        error.statusCode = 400
        throw error
      }
    }

    const items = order.items.map((item) => ({
      ...item,
      trackingStatus: 'To Ship',
      trackingEvents: [...(item.trackingEvents || []), { status: 'To Ship', at }],
    }))
    await connection.query(
      `UPDATE orders SET status = 'To Ship', items = $1 WHERE id = $2`,
      [JSON.stringify(items), id]
    )
    return { ...order, status: 'To Ship', items }
  })

export const removeOrderById = async (id) => {
  const order = await getOrderById(id)
  if (!order) return null
  const db = getDb()
  await db.query('DELETE FROM orders WHERE id = $1', [id])
  return order
}

export const removeOrdersByUserId = async (userId) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM orders WHERE user_id = $1', [userId])
  const orders = rows.map(mapOrder)
  await db.query('DELETE FROM orders WHERE user_id = $1', [userId])
  return orders
}
