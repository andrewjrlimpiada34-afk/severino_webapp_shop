import express from 'express'
import { asyncRoute } from '../lib/asyncRoute.js'
import { z } from 'zod'
import { createReview, deleteReview, getReviewById, getReviewsByProductId } from '../db/reviews.js'
import { getUserById } from '../db/users.js'
import { requireAuth } from '../middleware/auth.js'
import { normalizeId } from '../db/util.js'
import jwt from 'jsonwebtoken'

const router = express.Router()
function publicReview(review, userId) {
  const { userId: owner, userEmail, ...safe } = normalizeId(review)
  void userEmail
  return { ...safe, canDelete: Boolean(userId && owner === userId) }
}

const reviewSchema = z.object({
  rating: z.preprocess((val) => Number(val), z.number().min(1).max(5)),
  comment: z.string().trim().min(3),
  attachment: z
    .object({
      url: z.string().url().max(2000),
      mediaType: z.enum(['image', 'video']),
    })
    .nullable()
    .optional(),
})

router.get('/:productId', asyncRoute(async (req, res) => {
  const reviews = await getReviewsByProductId(req.params.productId)
  let userId
  try { userId = jwt.verify(req.cookies?.token || req.headers.authorization?.replace('Bearer ', ''), process.env.JWT_SECRET).id } catch { /* Public reviews remain available to guests. */ }
  res.set('Cache-Control', 'no-store')
  res.json(reviews.map((review) => publicReview(review, userId)))
}))

router.post('/:productId', requireAuth, asyncRoute(async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const user = await getUserById(req.user.id)
  const review = await createReview({
    productId: req.params.productId,
    userId: req.user.id,
    userName: user?.name || 'Customer',
    userEmail: user?.email || '',
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    attachment: parsed.data.attachment || null,
  })
  return res.status(201).json(publicReview(review, req.user.id))
}))

router.delete('/:reviewId', requireAuth, asyncRoute(async (req, res) => {
  const review = await getReviewById(req.params.reviewId)
  if (!review) return res.status(404).json({ message: 'Not found' })
  if (review.userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  const removed = await deleteReview(req.params.reviewId)
  return res.json(publicReview(removed, req.user.id))
}))

export default router
