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
  if (order.status !== 'Pending COD') {
    return res.status(400).json({ message: 'Order already processed' })
  }
  const updated = await updateOrderStatus(req.params.id, 'Cancelled')
  return res.json(normalizeId(updated))
})

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body
  const order = await updateOrderStatus(req.params.id, status)
  if (!order) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(order))
})

router.patch('/:id/verify', requireAuth, requireAdmin, async (req, res) => {
  const orders = await getOrders()
  const order = orders.find((item) => item._id.toString() === req.params.id)
  if (!order) return res.status(404).json({ message: 'Not found' })
  if (order.status !== 'Pending COD') {
    return res.status(400).json({ message: 'Order already processed' })
  }
  for (const item of order.items) {
    await decrementStock(item.productId, item.quantity)
  }
  const updated = await updateOrderStatus(req.params.id, 'To Ship')
  return res.json(normalizeId(updated))
})

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const updated = await updateOrderStatus(req.params.id, 'Removed')
  if (!updated) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(updated))
})

export default router
