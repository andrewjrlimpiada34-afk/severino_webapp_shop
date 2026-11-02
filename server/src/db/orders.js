import { getDb, withTransaction } from './postgres.js'
import { createId, parseJson } from './util.js'
import { getNextOrderStatus, getOrderItemStatus, normalizeOrderStatus, orderSteps, summarizeOrderStatus } from '../../shared/orderWorkflow.js'
import { inventoryChange, notifyInventoryChange, publishInventoryChange } from '../lib/inventoryEvents.js'

const mapOrder = (row) =>
  row
    ? {
        id: row.id,
        workflowVersion: 1,
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

const workflowError = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode })

const inventoryTransaction = async (work) => {
  const result = await withTransaction(work)
  if (result.event) publishInventoryChange(result.event)
  return result.order
}

async function saveItems(connection, order, items, products = []) {
  const status = summarizeOrderStatus(items, order.status)
  await connection.query('UPDATE orders SET items = $1, status = $2 WHERE id = $3', [JSON.stringify(items), status, order.id])
  const event = products.length ? inventoryChange(products) : null
  // PostgreSQL delivers this notification only after the transaction commits.
  if (event) await notifyInventoryChange(connection, event)
  return { order: { ...order, items, status }, event }
}

async function advanceItem(connection, order, item, target, userId, products) {
  const current = getOrderItemStatus(order, item)
  if (current === target) return item
  if (current === 'Cancelled' || current === 'Removed') throw workflowError('This item is no longer active.')
  if (userId) {
    if (target !== 'Cancelled' || current !== 'Pending COD') throw workflowError('Only pending items can be cancelled.')
  } else if (!orderSteps.includes(target) || getNextOrderStatus(current) !== target) {
    throw workflowError(`Complete ${getNextOrderStatus(current) || 'the current step'} before moving this item to ${target}.`)
  }

  const at = new Date().toISOString()
  let updated = { ...item }
  if (target === 'Approved' && !item.stockDeductedAt) {
    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) throw workflowError('Invalid item quantity.', 400)
    const { rows } = await connection.query(
      'SELECT id, legacy_id FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1 FOR UPDATE',
      [item.productId, item.productId]
    )
    if (!rows[0]) throw workflowError('Product no longer exists.', 404)
    const result = await connection.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3 RETURNING id, legacy_id, stock',
      [quantity, rows[0].id, quantity]
    )
    if (!result.rowCount) throw workflowError('Insufficient stock. Refresh inventory before approving this item.')
    products.push({ id: rows[0].id, legacyId: rows[0].legacy_id || null, stock: Number(result.rows[0].stock) })
    updated = { ...updated, approvedAt: at, stockDeductedAt: at, stockDeductedQuantity: quantity }
  }
  return { ...updated, trackingStatus: target, trackingEvents: [...(item.trackingEvents || []), { status: target, at }] }
}

export const updateOrderItemStatus = async (orderId, itemId, status, userId = null) => {
  const target = normalizeOrderStatus(status)
  if (!(userId ? target === 'Cancelled' : orderSteps.includes(target))) throw workflowError('Invalid order status.', 400)
  return inventoryTransaction(async (connection) => {
    const order = await selectOrderById(connection, orderId, true)
    if (!order || (userId && order.userId !== userId)) return { order: null }
    const index = order.items.findIndex((item, itemIndex) => (item.itemId || `${itemIndex}-${item.productId}`) === itemId)
    if (index < 0) return { order: null }
    const products = []
    const updated = await advanceItem(connection, order, order.items[index], target, userId, products)
    if (updated === order.items[index]) return { order }
    const items = [...order.items]
    items[index] = updated
    return saveItems(connection, order, items, products)
  })
}

export const updateOrderStatus = async (id, status) => {
  const target = normalizeOrderStatus(status)
  if (target !== 'Removed' && !orderSteps.includes(target)) throw workflowError('Invalid order status.', 400)
  return inventoryTransaction(async (connection) => {
    const order = await selectOrderById(connection, id, true)
    if (!order) return { order: null }
    if (target === 'Removed') {
      await connection.query('UPDATE orders SET status = $1 WHERE id = $2', ['Removed', id])
      return { order: { ...order, status: 'Removed' } }
    }
    if (['Cancelled', 'Removed'].includes(normalizeOrderStatus(order.status))) throw workflowError('This order is no longer active.')
    if (!order.items.some((item) => !['Cancelled', 'Removed'].includes(getOrderItemStatus(order, item)))) throw workflowError('This order has no active items.')
    const products = []
    const items = [...order.items]
    const indices = items.map((_, index) => index).sort((a, b) => String(items[a].productId).localeCompare(String(items[b].productId)))
    for (const index of indices) {
      const current = getOrderItemStatus(order, items[index])
      if (['Cancelled', 'Removed'].includes(current) || orderSteps.indexOf(current) >= orderSteps.indexOf(target)) continue
      items[index] = await advanceItem(connection, order, items[index], target, null, products)
    }
    if (items.every((item, index) => item === order.items[index])) return { order }
    return saveItems(connection, order, items, products)
  })
}

export const verifyOrder = (id) => updateOrderStatus(id, 'Approved')

export const cancelOrder = (id, userId) => inventoryTransaction(async (connection) => {
  const order = await selectOrderById(connection, id, true)
  if (!order || order.userId !== userId) return { order: null }
  if (normalizeOrderStatus(order.status) === 'Cancelled') return { order }
  if (normalizeOrderStatus(order.status) === 'Removed') throw workflowError('This order is no longer active.')
  const products = []
  const items = []
  for (const item of order.items) {
    const current = getOrderItemStatus(order, item)
    items.push(current === 'Cancelled' || current === 'Removed' ? item : await advanceItem(connection, order, item, 'Cancelled', userId, products))
  }
  return saveItems(connection, order, items)
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
