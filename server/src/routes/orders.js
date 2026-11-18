import express from 'express'
import { z } from 'zod'
import { asyncRoute } from '../lib/asyncRoute.js'
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getOrders,
  getOrdersByUserId,
  reconcileOrderItem,
  returnOrderItem,
  serializeOrder,
  updateOrderItemStatus,
  updateOrderStatus,
  verifyOrder
} from '../db/orders.js'
import { getPaymentHistory, recordPayment } from '../db/payments.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { orderSteps } from '../../shared/orderWorkflow.js'
import { normalizePhilippineMobile } from '../../shared/loginValidation.js'

const router = express.Router()
const statusSchema = z.object({ status: z.enum(orderSteps) })
const orderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(191),
        quantity: z.number().int().min(1).max(100)
      })
    )
    .min(1)
    .max(100),
  addressId: z.string().max(24).optional(),
  address: z.string().trim().min(5).max(1500),
  contactName: z.string().trim().min(2).max(150),
  phone: z
    .string()
    .transform(normalizePhilippineMobile)
    .refine(Boolean, 'Enter a valid Philippine mobile number.'),
  email: z.string().trim().email().max(320),
  paymentMethod: z.literal('COD'),
  checkoutKey: z.string().min(16).max(100).optional(),
  fromCart: z.boolean().default(false),
  notes: z.string().trim().max(500).default('')
})
const paymentSchema = z.object({
  kind: z.enum(['collection', 'refund']),
  status: z.enum(['Pending Verification', 'Paid', 'Failed']),
  amount: z
    .number()
    .positive()
    .max(9999999999.99)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
      'Use at most two decimal places.'
    ),
  method: z.string().trim().min(2).max(40),
  reference: z.string().trim().min(3).max(150),
  reason: z.string().trim().max(500).default(''),
  requestKey: z.string().min(16).max(100),
  collectionVerified: z.boolean().default(false)
})
router.use(requireAuth)
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
const respond = (req, res, order, status = 200) =>
  order
    ? res.status(status).json(serializeOrder(order, req.user.role === 'admin'))
    : res.status(404).json({ message: 'Order unavailable.' })

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const admin = req.user.role === 'admin'
    const orders = admin
      ? await getOrders()
      : await getOrdersByUserId(req.user.id)
    return res.json(orders.map((order) => serializeOrder(order, admin)))
  })
)
router.post(
  '/',
  asyncRoute(async (req, res) => {
    const parsed = orderSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message })
    // Both browser and API clients must retain this key across uncertain retries.
    const checkoutKey = parsed.data.checkoutKey || req.get('Idempotency-Key')
    if (!checkoutKey || checkoutKey.length < 16 || checkoutKey.length > 100)
      return res
        .status(400)
        .json({ message: 'Refresh checkout before placing your order.' })
    return respond(
      req,
      res,
      await createOrder({ ...parsed.data, checkoutKey, userId: req.user.id }),
      201
    )
  })
)
router.patch(
  '/:id/cancel',
  asyncRoute(async (req, res) =>
    respond(req, res, await cancelOrder(req.params.id, req.user.id))
  )
)
router.patch(
  '/:orderId/items/:itemId/cancel',
  asyncRoute(async (req, res) =>
    respond(
      req,
      res,
      await updateOrderItemStatus(
        req.params.orderId,
        req.params.itemId,
        'Cancelled',
        req.user.id
      )
    )
  )
)
router.patch(
  '/:id/status',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ message: 'Invalid order status.' })
    return respond(
      req,
      res,
      await updateOrderStatus(req.params.id, parsed.data.status, req.user.id)
    )
  })
)
router.patch(
  ['/:orderId/items/:itemId/progress', '/:orderId/items/:itemId/status'],
  requireAdmin,
  asyncRoute(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ message: 'Invalid order status.' })
    return respond(
      req,
      res,
      await updateOrderItemStatus(
        req.params.orderId,
        req.params.itemId,
        parsed.data.status,
        null,
        req.user.id
      )
    )
  })
)
router.patch(
  '/:id/verify',
  requireAdmin,
  asyncRoute(async (req, res) =>
    respond(req, res, await verifyOrder(req.params.id, req.user.id))
  )
)
router.patch(
  '/:id/admin-cancel',
  requireAdmin,
  asyncRoute(async (req, res) =>
    respond(
      req,
      res,
      await updateOrderStatus(req.params.id, 'Cancelled', req.user.id)
    )
  )
)
router.delete(
  '/:id',
  requireAdmin,
  asyncRoute(async (req, res) =>
    respond(
      req,
      res,
      await updateOrderStatus(req.params.id, 'Removed', req.user.id)
    )
  )
)
router.get(
  '/:id/payments',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const order = await getOrderById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order unavailable.' })
    return res.json(await getPaymentHistory(order.id))
  })
)
router.post(
  '/:id/payments',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const parsed = paymentSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message })
    try {
      return respond(
        req,
        res,
        await recordPayment(req.params.id, parsed.data, req.user.id)
      )
    } catch (error) {
      if (
        error.code === '23505' &&
        error.constraint === 'payments_verified_reference'
      )
        return res
          .status(409)
          .json({
            message: 'This payment or refund reference was already recorded.'
          })
      throw error
    }
  })
)
router.post(
  '/:id/items/:itemId/reconcile',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({ alreadyDeducted: z.boolean(), confirmed: z.literal(true) })
      .safeParse(req.body)
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: 'Confirm your inventory inspection.' })
    return respond(
      req,
      res,
      await reconcileOrderItem(
        req.params.id,
        req.params.itemId,
        parsed.data.alreadyDeducted,
        req.user.id
      )
    )
  })
)
router.post(
  '/:id/items/:itemId/return',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({
        quantity: z.number().int().min(1).max(100),
        requestKey: z.string().min(16).max(100),
        received: z.literal(true)
      })
      .safeParse(req.body)
    if (!parsed.success)
      return res
        .status(400)
        .json({
          message:
            'Enter the received quantity and confirm inspection of the returned goods.'
        })
    return respond(
      req,
      res,
      await returnOrderItem(
        req.params.id,
        req.params.itemId,
        parsed.data.quantity,
        parsed.data.requestKey,
        req.user.id
      )
    )
  })
)
export default router
