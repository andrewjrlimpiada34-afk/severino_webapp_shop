import express from 'express'
import { z } from 'zod'
import { createReview, deleteReview, getReviewById, getReviewsByProductId } from '../db/reviews.js'
import { getUserById } from '../db/users.js'
import { requireAuth } from '../middleware/auth.js'
import { normalizeId, normalizeList } from '../db/util.js'

const router = express.Router()

const reviewSchema = z.object({
  rating: z.preprocess((val) => Number(val), z.number().min(1).max(5)),
  comment: z.string().trim().min(3),
})

router.get('/:productId', async (req, res) => {
  const reviews = await getReviewsByProductId(req.params.productId)
  res.json(normalizeList(reviews))
})

router.post('/:productId', requireAuth, async (req, res) => {
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
  })
  return res.status(201).json(normalizeId(review))
})

router.delete('/:reviewId', requireAuth, async (req, res) => {
  const review = await getReviewById(req.params.reviewId)
  if (!review) return res.status(404).json({ message: 'Not found' })
  if (review.userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  const removed = await deleteReview(req.params.reviewId)
  return res.json(normalizeId(removed))
})

export default router
