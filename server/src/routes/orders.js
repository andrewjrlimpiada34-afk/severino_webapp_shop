import express from 'express'
import { z } from 'zod'
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getOrders,
  getOrdersByUserId,
  updateOrderItemStatus,
  updateOrderStatus,
  verifyOrder,
} from '../db/orders.js'
import { recordSale } from '../db/inventory.js'
import { getProductById } from '../db/products.js'
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
    return res.json(normalizeList(await getOrders()))
  }
  return res.json(normalizeList(await getOrdersByUserId(req.user.id)))
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })
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
  await recordSale(order.id, total)
  return res.status(201).json(normalizeId(order))
})

router.patch('/:id/cancel', requireAuth, async (req, res) => {
  const order = await getOrderById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Not found' })
  if (order.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden' })
  if (order.status !== 'Pending COD') {
    return res.status(400).json({ message: 'Order already processed' })
  }
  const updated = await cancelOrder(req.params.id, req.user.id)
  if (!updated) return res.status(400).json({ message: 'Order already processed' })
  return res.json(normalizeId(updated))
})

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const order = await updateOrderStatus(req.params.id, req.body.status)
  if (!order) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(order))
})

router.patch('/:orderId/items/:itemId/cancel', requireAuth, async (req, res) => {
  const { orderId, itemId } = req.params
  const order = await getOrderById(orderId)
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ message: 'Not found' })
  }
  if (order.status !== 'Pending COD' && order.status !== 'Pending') {
    return res.status(400).json({ message: 'Order already processed' })
  }
  const updated = await updateOrderItemStatus(orderId, itemId, 'Cancelled', req.user.id)
  if (!updated) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated))
})

router.patch('/:orderId/items/:itemId/status', requireAuth, requireAdmin, async (req, res) => {
  const { orderId, itemId } = req.params
  const updated = await updateOrderItemStatus(orderId, itemId, req.body.status)
  if (!updated) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated))
})

router.patch('/:id/verify', requireAuth, requireAdmin, async (req, res, next) => {
  const order = await getOrderById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Not found' })
  if (order.status !== 'Pending COD') {
    return res.status(400).json({ message: 'Order already processed' })
  }
  try {
    const updated = await verifyOrder(req.params.id)
    return res.json(normalizeId(updated))
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message })
    }
    return next(error)
  }
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const updated = await updateOrderStatus(req.params.id, 'Removed')
  if (!updated) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated))
})

export default router
