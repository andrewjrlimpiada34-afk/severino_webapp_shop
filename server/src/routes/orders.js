import express from 'express'
import { z } from 'zod'
import { createOrder, getOrders, getOrdersByUserId, updateOrderStatus } from '../db/orders.js'
import { recordSale } from '../db/inventory.js'
import { decrementStock, getProductById } from '../db/products.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { normalizeId, normalizeList } from '../db/util.js'

const router = express.Router()

const orderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string().min(2).optional(),
      quantity: z.number().min(1),
      price: z.number().min(0),
    })
  ),
  address: z.string().min(5),
  contactName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email(),
  paymentMethod: z.literal('COD'),
})

router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    const orders = await getOrders()
    return res.json(normalizeList(orders))
  }
  const orders = await getOrdersByUserId(req.user.id)
  return res.json(normalizeList(orders))
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  if (parsed.data.items.some((item) => item.quantity > 100)) {
    return res.status(400).json({ message: 'Item quantity exceeds limit' })
  }
  for (const item of parsed.data.items) {
    const product = await getProductById(item.productId)
    if (product && item.quantity > product.stock) {
      return res.status(400).json({ message: 'Quantity exceeds stock' })
    }
  }
  const total = parsed.data.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const order = await createOrder({
    userId: req.user.id,
    total,
    status: 'Pending COD',
    ...parsed.data,
  })
  await recordSale(order._id.toString(), total)
  return res.status(201).json(normalizeId(order))
})

router.patch('/:id/cancel', requireAuth, async (req, res) => {
  const orders = await getOrdersByUserId(req.user.id)
  const order = orders.find((item) => item._id.toString() === req.params.id)
  if (!order) return res.status(404).json({ message: 'Not found' })
  if (order.userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  // Backward-compatible: existing orders are tracked at order-level.
  // For item tracking, cancel each item independently (same action type, per item updates).
  if (order.status !== 'Pending COD') {
    return res.status(400).json({ message: 'Order already processed' })
  }

  const now = new Date()
  const cancelledEvents = (order.items || []).map((i) => i)

  // Update whole order doc but per-item status inside `items[]`.
  const db = await (await import('../db/mongo.js')).getDb()
  const updated = await db.collection('orders').findOneAndUpdate(
    { _id: new (await import('mongodb')).ObjectId(req.params.id) },
    {
      $set: {
        status: 'Cancelled',
        'items.$[].trackingStatus': 'Cancelled',
      },
      $push: {
        'items.$[].trackingEvents': {
          status: 'Cancelled',
          at: now,
        },
      },
    },
    { returnDocument: 'after' }
  )

  return res.json(normalizeId(updated))
})


router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body
  const order = await updateOrderStatus(req.params.id, status)
  if (!order) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(order))
})

// ---- Item-level actions (per Item ID) ----
router.patch('/:orderId/items/:itemId/cancel', requireAuth, async (req, res) => {
  const { orderId, itemId } = req.params
  const orders = await getOrdersByUserId(req.user.id)
  const order = orders.find((o) => o._id.toString() === orderId)
  if (!order) return res.status(404).json({ message: 'Not found' })

  // Only allow cancelling items while the order is still pending COD
  if (order.status !== 'Pending COD' && order.status !== 'Pending') {
    // existing code uses both 'Pending COD' (created) and order-level 'Pending'
    return res.status(400).json({ message: 'Order already processed' })
  }

  const now = new Date()
  const db = await (await import('../db/mongo.js')).getDb()

  const updated = await db.collection('orders').findOneAndUpdate(
    {
      _id: new (await import('mongodb')).ObjectId(orderId),
      'items.itemId': itemId,
    },
    {
      $set: {
        'items.$[elem].trackingStatus': 'Cancelled',
      },
      $push: {
        'items.$[elem].trackingEvents': { status: 'Cancelled', at: now },
      },
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'elem.itemId': itemId }],
    }
  )

  if (!updated?.value) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated.value))
})

router.patch('/:orderId/items/:itemId/status', requireAuth, requireAdmin, async (req, res) => {
  const { orderId, itemId } = req.params
  const { status } = req.body

  const order = await (await getOrders()).find((o) => o._id?.toString?.() === orderId)
  if (!order) return res.status(404).json({ message: 'Not found' })

  // Ensure item exists; also allow item-level transitions while order is active
  const now = new Date()
  const db = await (await import('../db/mongo.js')).getDb()

  const updated = await db.collection('orders').findOneAndUpdate(
    {
      _id: new (await import('mongodb')).ObjectId(orderId),
      'items.itemId': itemId,
    },
    {
      $set: {
        'items.$[elem].trackingStatus': status,
      },
      $push: {
        'items.$[elem].trackingEvents': { status, at: now },
      },
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'elem.itemId': itemId }],
    }
  )

  if (!updated?.value) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated.value))
})


router.patch('/:id/verify', requireAuth, requireAdmin, async (req, res) => {
  const orders = await getOrders()
  const order = orders.find((item) => item._id.toString() === req.params.id)
  if (!order) return res.status(404).json({ message: 'Not found' })
  if (order.status !== 'Pending COD') {
    return res.status(400).json({ message: 'Order already processed' })
  }

  // Decrement stock per item
  for (const item of order.items) {
    await decrementStock(item.productId, item.quantity)
  }

  const now = new Date()

  // Per-item tracking update
  const db = await (await import('../db/mongo.js')).getDb()
  const updated = await db.collection('orders').findOneAndUpdate(
    { _id: new (await import('mongodb')).ObjectId(req.params.id) },
    {
      $set: {
        status: 'To Ship',
        'items.$[].trackingStatus': 'To Ship',
      },
      $push: {
        'items.$[].trackingEvents': {
          status: 'To Ship',
          at: now,
        },
      },
    },
    { returnDocument: 'after' }
  )

  return res.json(normalizeId(updated))
})


router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const updated = await updateOrderStatus(req.params.id, 'Removed')
  if (!updated) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated))
})

export default router
