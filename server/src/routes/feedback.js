import express from 'express'
import { z } from 'zod'
import { createFeedback, getFeedback } from '../db/feedback.js'
import { getUserById } from '../db/users.js'
import { getOrdersByUserId } from '../db/orders.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { normalizeList, normalizeId } from '../db/util.js'

const router = express.Router()

const feedbackSchema = z.object({
  orderId: z.string().min(4),
  rating: z.number().min(1).max(5),
  message: z.string().min(4),
})

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const feedback = await getFeedback()
  res.json(normalizeList(feedback))
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const orders = await getOrdersByUserId(req.user.id)
  const order = orders.find((item) => item._id.toString() === parsed.data.orderId)
  if (!order || order.status !== 'To Review') {
    return res.status(400).json({ message: 'Order is not ready for feedback' })
  }
  const user = await getUserById(req.user.id)
  const entry = await createFeedback({ userId: req.user.id, ...parsed.data })
  entry.userName = user?.name || 'Customer'
  entry.userEmail = user?.email || ''
  return res.status(201).json(normalizeId(entry))
})

export default router
