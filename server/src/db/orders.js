import { isDeliveryLocality, localityMessage } from '../lib/deliveryLocality.js'
import { createHash, randomBytes } from 'node:crypto'
import { getDb, withTransaction } from './postgres.js'
import { createId, parseJson } from './util.js'
import {
  getNextOrderStatus,
  getOrderItemStatus,
  normalizeOrderStatus,
  orderSteps,
  summarizeOrderStatus
} from '../../shared/orderWorkflow.js'
import {
  inventoryChange,
  notifyInventoryChange,
  publishInventoryChange
} from '../lib/inventoryEvents.js'
import { auditAction, logInventory } from './audit.js'

const workflowError = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode })
const cents = (value) => Math.round(Number(value) * 100)
const stockEvent = (product) => ({
  id: product.id,
  legacyId: product.legacy_id || null,
  stock: Number(product.stock) - Number(product.reserved_stock || 0)
})
const mapOrder = (row) =>
  row
    ? {
        id: row.id,
        reference: row.reference,
        workflowVersion: 2,
        userId: row.user_id,
        items: parseJson(row.items, []),
        total: Number(row.total),
        originalTotal: Number(row.original_total ?? row.total),
        status: row.status,
        address: row.address,
        addressSnapshot: parseJson(row.address_snapshot),
        contactName: row.contact_name,
        phone: row.phone,
        email: row.email,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status || 'Unpaid',
        grossCollected: Number(row.gross_collected || 0),
        refundedTotal: Number(row.refunded_total || 0),
        paidAt: row.paid_at,
        createdAt: row.created_at,
        archivedAt: row.archived_at,
        requestFingerprint: row.request_fingerprint
      }
    : null

const selectOrder = async (connection, id, lock = false, userId = null) => {
  const { rows } = await connection.query(
    `SELECT * FROM orders WHERE (id = $1 OR reference = $1)${userId ? ' AND user_id = $2' : ''} LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    userId ? [id, userId] : [id]
  )
  return mapOrder(rows[0])
}
export const getOrderById = (id, userId = null) =>
  selectOrder(getDb(), id, false, userId)
export const getOrders = async () => {
  const { rows } = await getDb().query(
    'SELECT * FROM orders WHERE archived_at IS NULL ORDER BY created_at DESC'
  )
  return rows.map(mapOrder)
}
export const getOrdersByUserId = async (userId) => {
  const { rows } = await getDb().query(
    "SELECT * FROM orders WHERE user_id = $1 AND status <> 'Removed' ORDER BY created_at DESC",
    [userId]
  )
  return rows.map(mapOrder)
}

export function serializeOrder(order, admin = false) {
  if (!order) return null
  const { requestFingerprint, userId, ...safe } = order
  void requestFingerprint
  if (admin) return { ...safe, userId }
  return { ...safe, id: order.reference }
}

async function finishInventory(work) {
  const result = await withTransaction(work)
  if (result.event) publishInventoryChange(result.event)
  return result.order
}

async function committedEvent(connection, products) {
  if (!products.length) return null
  const event = inventoryChange(products)
  await notifyInventoryChange(connection, event)
  return event
}

export const createOrder = (data) =>
  finishInventory(async (connection) => {
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          items: data.items
            .map(({ productId, quantity }) => ({ productId, quantity }))
            .sort((a, b) => a.productId.localeCompare(b.productId)),
          addressId: data.addressId,
          shippingAddress: data.shippingAddress,
          address: data.address,
          contactName: data.contactName,
          phone: data.phone,
          email: data.email,
          paymentMethod: data.paymentMethod,
          fromCart: data.fromCart,
          notes: data.notes
        })
      )
      .digest('hex')
    await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `checkout:${data.userId}:${data.checkoutKey}`
    ])
    const previous = await connection.query(
      'SELECT * FROM orders WHERE user_id = $1 AND checkout_key = $2',
      [data.userId, data.checkoutKey]
    )
    if (previous.rows.length) {
      const order = mapOrder(previous.rows[0])
      if (order.requestFingerprint !== fingerprint)
        throw workflowError(
          'This checkout was already used. Start a new checkout for changed details.'
        )
      return { order }
    }
    let snapshot = {
      formatted: data.address,
      name: data.contactName,
      phone: data.phone,
      email: data.email,
      notes: data.notes || ''
    }
    if (data.addressId) {
      const { rows } = await connection.query(
        'SELECT * FROM customer_addresses WHERE id = $1 AND user_id = $2 FOR SHARE',
        [data.addressId, data.userId]
      )
      if (!rows[0])
        throw workflowError('Select one of your saved addresses.', 400)
      const address = rows[0]
      snapshot = {
        name: data.contactName,
        phone: data.phone,
        email: data.email,
        addressLine: address.address_line,
        barangay: address.barangay,
        city: address.city,
        province: address.province,
        zip: address.zip,
        country: address.country,
        formatted: [
          address.address_line,
          address.barangay,
          address.city,
          address.province,
          address.zip,
          address.country
        ]
          .filter(Boolean)
          .join(', '),
        notes: data.notes || ''
      }
    }
    if (!data.addressId) {
      // Older clients sent a single formatted address. Read their locality from the end.
      const parts = data.address.split(',').map(part => part.trim())
      const [barangay, city, province, zip, country] = parts.slice(-5)
      const shipping = data.shippingAddress || { addressLine: parts.slice(0, -5).join(', '), barangay, city, province, zip, country }
      if (!isDeliveryLocality(shipping)) throw workflowError(localityMessage, 400)
      snapshot = { ...snapshot, ...shipping, formatted: [shipping.addressLine, shipping.barangay, shipping.city,
        shipping.province, shipping.zip, shipping.country].filter(Boolean).join(', ') }
    }
    const requestedIds = data.items.map((item) => item.productId)
    const { rows: products } = await connection.query(
      'SELECT * FROM products WHERE id = ANY($1::text[]) OR legacy_id = ANY($1::text[]) ORDER BY id FOR UPDATE',
      [requestedIds]
    )
    const quantities = new Map()
    for (const item of data.items) {
      const product = products.find(
        (entry) =>
          entry.id === item.productId || entry.legacy_id === item.productId
      )
      if (!product || !product.active || cents(product.price) <= 0)
        throw workflowError('A selected product is unavailable.', 400)
      quantities.set(
        product.id,
        (quantities.get(product.id) || 0) + item.quantity
      )
    }
    const id = createId()
    const now = new Date()
    const items = []
    const changes = []
    for (const product of products) {
      const quantity = quantities.get(product.id)
      if (!quantity) continue
      if (
        quantity > 100 ||
        quantity > Number(product.stock) - Number(product.reserved_stock || 0)
      )
        throw workflowError(
          'Quantity exceeds available stock. Review your cart.'
        )
      const itemId = `${items.length}-${product.id}`
      items.push({
        itemId,
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity,
        trackingStatus: 'Pending COD',
        reservationActive: true,
        trackingEvents: [{ status: 'Pending COD', at: now.toISOString() }]
      })
      const result = await connection.query(
        'UPDATE products SET reserved_stock = reserved_stock + $1 WHERE id = $2 AND stock - reserved_stock >= $1 RETURNING *',
        [quantity, product.id]
      )
      if (!result.rowCount)
        throw workflowError('Stock changed. Review your cart.')
      changes.push({ product: result.rows[0], itemId, quantity })
    }
    const total =
      items.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0) /
      100
    if (total > 9999999999.99)
      throw workflowError(
        'Order amount exceeds the supported checkout limit.',
        400
      )
    const reference = `SV-${randomBytes(10).toString('hex').toUpperCase()}`
    await connection.query(
      `INSERT INTO orders(id,user_id,items,total,original_total,status,address,contact_name,phone,email,payment_method,created_at,reference,checkout_key,request_fingerprint,address_snapshot)
    VALUES ($1,$2,$3,$4,$4,'Pending COD',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        data.userId,
        JSON.stringify(items),
        total,
        snapshot.formatted,
        snapshot.name,
        snapshot.phone,
        snapshot.email,
        data.paymentMethod,
        now,
        reference,
        data.checkoutKey,
        fingerprint,
        JSON.stringify(snapshot)
      ]
    )
    for (const change of changes)
      await logInventory(connection, change.product, {
        orderId: id,
        itemKey: change.itemId,
        action: 'reserve',
        reservedDelta: change.quantity,
        actorId: data.userId,
        operationKey: `reserve:${id}:${change.itemId}`
      })
    if (data.fromCart) {
      const { rows } = await connection.query(
        'SELECT * FROM carts WHERE user_id = $1 FOR UPDATE',
        [data.userId]
      )
      if (rows[0]) {
        const remainingQuantities = new Map(quantities)
        const remaining = parseJson(rows[0].items, [])
          .map((item) => {
            const canonical = products.find(
              (product) =>
                product.id === item.productId ||
                product.legacy_id === item.productId
            )?.id
            const consumed = Math.min(
              item.quantity,
              remainingQuantities.get(canonical) || 0
            )
            remainingQuantities.set(
              canonical,
              (remainingQuantities.get(canonical) || 0) - consumed
            )
            return { ...item, quantity: item.quantity - consumed }
          })
          .filter((item) => item.quantity > 0)
        await connection.query(
          'UPDATE carts SET items = $1 WHERE user_id = $2',
          [JSON.stringify(remaining), data.userId]
        )
      }
    }
    return {
      order: await selectOrder(connection, id),
      event: await committedEvent(
        connection,
        changes.map(({ product }) => stockEvent(product))
      )
    }
  })

async function saveItems(connection, order, items, products = []) {
  const status = summarizeOrderStatus(items, order.status)
  const total =
    items
      .filter(
        (item) =>
          !['Cancelled', 'Removed'].includes(
            getOrderItemStatus({ ...order, status }, item)
          )
      )
      .reduce((sum, item) => sum + cents(item.price) * item.quantity, 0) / 100
  await connection.query(
    'UPDATE orders SET items = $1, status = $2, total = $4 WHERE id = $3',
    [JSON.stringify(items), status, order.id, total]
  )
  return {
    order: { ...order, items, status, total },
    event: await committedEvent(connection, products)
  }
}

async function advanceItem(
  connection,
  order,
  item,
  target,
  actorId,
  customer,
  products
) {
  const current = getOrderItemStatus(order, item)
  if (current === target) return item
  if (['Cancelled', 'Removed'].includes(current))
    throw workflowError('This item is no longer active.')
  if (customer && (target !== 'Cancelled' || current !== 'Pending COD'))
    throw workflowError('Only pending items can be cancelled.')
  if (
    !customer &&
    target === 'Cancelled' &&
    !['Pending COD', 'Approved', 'To Ship'].includes(current)
  )
    throw workflowError('Dispatched items must use the verified return action.')
  if (target !== 'Cancelled' && getNextOrderStatus(current) !== target)
    throw workflowError(
      `Complete ${getNextOrderStatus(current) || 'the current step'} before moving to ${target}.`
    )
  const at = new Date().toISOString()
  let updated = { ...item }
  const quantity = Number(item.quantity)
  const dispatch = target === 'To Receive' && !item.stockDeductedAt
  const release = target === 'Cancelled' && item.reservationActive
  const restore =
    target === 'Cancelled' && item.stockDeductedAt && !item.stockRestoredAt
  if (dispatch || release || restore) {
    if (item.inventoryReviewRequired)
      throw workflowError(
        'Reconcile this older item with actual inventory before continuing.'
      )
    const { rows } = await connection.query(
      'SELECT * FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1 FOR UPDATE',
      [item.productId, item.productId]
    )
    const product = rows[0]
    if (!product || !Number.isInteger(quantity) || quantity < 1)
      throw workflowError('Product inventory is unavailable.')
    if (dispatch && !item.reservationActive)
      throw workflowError('This order requires inventory reconciliation.')
    const stockDelta = dispatch ? -quantity : restore ? quantity : 0
    const reservedDelta = dispatch || release ? -quantity : 0
    const result = await connection.query(
      'UPDATE products SET stock = stock + $1, reserved_stock = reserved_stock + $2 WHERE id = $3 RETURNING *',
      [stockDelta, reservedDelta, product.id]
    )
    await logInventory(connection, result.rows[0], {
      orderId: order.id,
      itemKey: item.itemId,
      action: dispatch ? 'dispatch' : release ? 'release' : 'restore',
      stockDelta,
      reservedDelta,
      actorId,
      operationKey: `${target}:${order.id}:${item.itemId}`
    })
    products.push(stockEvent(result.rows[0]))
    updated = { ...updated, reservationActive: false }
    if (dispatch)
      updated = {
        ...updated,
        stockDeductedAt: at,
        stockDeductedQuantity: quantity
      }
    if (restore) updated.stockRestoredAt = at
  }
  if (target === 'Approved') updated.approvedAt = at
  await auditAction(
    connection,
    customer ? null : actorId,
    customer ? 'customer_cancel_item' : 'fulfillment_update',
    order.id,
    { itemKey: item.itemId, from: current, to: target }
  )
  return {
    ...updated,
    trackingStatus: target,
    trackingEvents: [...(item.trackingEvents || []), { status: target, at }]
  }
}

export const updateOrderItemStatus = (
  orderId,
  itemId,
  status,
  userId = null,
  actorId = userId
) => {
  const target = normalizeOrderStatus(status)
  if (!target || (!orderSteps.includes(target) && target !== 'Cancelled'))
    throw workflowError('Invalid order status.', 400)
  return finishInventory(async (connection) => {
    const order = await selectOrder(connection, orderId, true, userId)
    if (!order) return { order: null }
    const index = order.items.findIndex(
      (item, itemIndex) =>
        (item.itemId || `${itemIndex}-${item.productId}`) === itemId
    )
    if (index < 0) return { order: null }
    const items = [...order.items]
    items[index] = { ...items[index], itemId }
    const products = []
    items[index] = await advanceItem(
      connection,
      order,
      items[index],
      target,
      actorId,
      Boolean(userId),
      products
    )
    return saveItems(connection, order, items, products)
  })
}

export const updateOrderStatus = (
  id,
  status,
  actorId = null,
  userId = null
) => {
  const target = normalizeOrderStatus(status)
  if (!['Removed', 'Cancelled', ...orderSteps].includes(target))
    throw workflowError('Invalid order status.', 400)
  return finishInventory(async (connection) => {
    const order = await selectOrder(connection, id, true, userId)
    if (!order) return { order: null }
    if (target === 'Removed') {
      if (
        normalizeOrderStatus(order.status) === 'Cancelled' &&
        order.grossCollected > order.refundedTotal
      )
        throw workflowError(
          'Confirm the outstanding refund before archiving this canceled order.'
        )
      if (
        !['Cancelled', 'To Review', 'Removed'].includes(
          normalizeOrderStatus(order.status)
        )
      )
        throw workflowError('Complete or cancel this order before archiving.')
      await connection.query(
        'UPDATE orders SET archived_at = CURRENT_TIMESTAMP WHERE id = $1',
        [order.id]
      )
      await auditAction(connection, actorId, 'archive_order', order.id)
      return { order: { ...order, archivedAt: new Date().toISOString() } }
    }
    if (normalizeOrderStatus(order.status) === target && target === 'Cancelled')
      return { order }
    const products = []
    const items = [...order.items]
    await connection.query(
      'SELECT id FROM products WHERE id = ANY($1::text[]) OR legacy_id = ANY($1::text[]) ORDER BY id FOR UPDATE',
      [items.map((item) => item.productId)]
    )
    const indices = items
      .map((_, index) => index)
      .sort((a, b) =>
        String(items[a].productId).localeCompare(String(items[b].productId))
      )
    for (const index of indices) {
      const current = getOrderItemStatus(order, items[index])
      if (
        ['Cancelled', 'Removed'].includes(current) ||
        (target !== 'Cancelled' &&
          orderSteps.indexOf(current) >= orderSteps.indexOf(target))
      )
        continue
      items[index] = await advanceItem(
        connection,
        order,
        {
          ...items[index],
          itemId: items[index].itemId || `${index}-${items[index].productId}`
        },
        target,
        actorId,
        Boolean(userId),
        products
      )
    }
    return saveItems(connection, order, items, products)
  })
}
export const verifyOrder = (id, actorId) =>
  updateOrderStatus(id, 'Approved', actorId)
export const cancelOrder = (id, userId) =>
  updateOrderStatus(id, 'Cancelled', userId, userId)

export const reconcileOrderItem = (id, itemKey, alreadyDeducted, actorId) =>
  finishInventory(async (connection) => {
    const order = await selectOrder(connection, id, true)
    if (!order) return { order: null }
    const index = order.items.findIndex(
      (item, position) =>
        (item.itemId || `${position}-${item.productId}`) === itemKey
    )
    const item = order.items[index]
    if (!item) return { order: null }
    if (!item.inventoryReviewRequired) return { order }
    const current = getOrderItemStatus(order, item)
    if (
      !alreadyDeducted &&
      !['Pending COD', 'Approved', 'To Ship'].includes(current)
    )
      throw workflowError(
        'A dispatched legacy item requires evidence of its existing stock deduction.'
      )
    const { rows } = await connection.query(
      'SELECT * FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1 FOR UPDATE',
      [item.productId, item.productId]
    )
    const product = rows[0]
    if (!product) throw workflowError('Product inventory unavailable.')
    let reconciled = product
    if (!alreadyDeducted) {
      const result = await connection.query(
        'UPDATE products SET reserved_stock = reserved_stock + $1 WHERE id = $2 AND stock - reserved_stock >= $1 RETURNING *',
        [item.quantity, product.id]
      )
      if (!result.rowCount)
        throw workflowError(
          'Insufficient available inventory to reserve this item.'
        )
      reconciled = result.rows[0]
    }
    await logInventory(connection, reconciled, {
      orderId: order.id,
      itemKey,
      action: 'legacy_reconciliation',
      reservedDelta: alreadyDeducted ? 0 : item.quantity,
      actorId,
      operationKey: `reconcile:${order.id}:${itemKey}`,
      reason: alreadyDeducted
        ? 'Administrator verified historical deduction'
        : 'Administrator verified stock was not deducted; reservation created'
    })
    const items = [...order.items]
    items[index] = {
      ...item,
      productId: product.id,
      itemId: itemKey,
      inventoryReviewRequired: false,
      reservationActive: !alreadyDeducted,
      ...(alreadyDeducted
        ? {
            stockDeductedAt: new Date().toISOString(),
            stockDeductedQuantity: item.quantity
          }
        : {})
    }
    await auditAction(
      connection,
      actorId,
      'legacy_inventory_reconciled',
      order.id,
      { itemKey, alreadyDeducted }
    )
    return saveItems(connection, order, items, [stockEvent(reconciled)])
  })

export const returnOrderItem = (id, itemKey, quantity, requestKey, actorId) =>
  finishInventory(async (connection) => {
    const order = await selectOrder(connection, id, true)
    if (!order) return { order: null }
    const operationKey = `return:${order.id}:${requestKey}`
    const previous = await connection.query(
      'SELECT * FROM inventory_logs WHERE operation_key = $1',
      [operationKey]
    )
    if (previous.rows.length) {
      if (
        previous.rows[0].item_key !== itemKey ||
        Number(previous.rows[0].stock_delta) !== quantity
      )
        throw workflowError(
          'This return reference was already used for different quantities.'
        )
      return { order }
    }
    const index = order.items.findIndex(
      (item, position) =>
        (item.itemId || `${position}-${item.productId}`) === itemKey
    )
    const item = order.items[index]
    if (
      !item ||
      !['To Receive', 'To Review'].includes(getOrderItemStatus(order, item))
    )
      throw workflowError('Only dispatched items can be received as returns.')
    if (!item.stockDeductedAt || item.inventoryReviewRequired)
      throw workflowError(
        'Reconcile this historical stock deduction before accepting a return.'
      )
    if (
      quantity >
      Number(item.stockDeductedQuantity || item.quantity) -
        Number(item.returnedQuantity || 0)
    )
      throw workflowError(
        'Return quantity exceeds the outstanding dispatched quantity.'
      )
    const { rows } = await connection.query(
      'SELECT * FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1 FOR UPDATE',
      [item.productId, item.productId]
    )
    if (!rows[0]) throw workflowError('Product inventory unavailable.')
    const result = await connection.query(
      'UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *',
      [quantity, rows[0].id]
    )
    await logInventory(connection, result.rows[0], {
      orderId: order.id,
      itemKey,
      action: 'return',
      stockDelta: quantity,
      actorId,
      operationKey,
      reason: 'Administrator verified returned goods were received and accepted'
    })
    await auditAction(connection, actorId, 'goods_returned', order.id, {
      itemKey,
      quantity,
      requestKey
    })
    const items = [...order.items]
    items[index] = {
      ...item,
      returnedQuantity: Number(item.returnedQuantity || 0) + quantity
    }
    return saveItems(connection, order, items, [stockEvent(result.rows[0])])
  })
