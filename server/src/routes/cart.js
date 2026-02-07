import express from 'express'
import { z } from 'zod'
import { createCart, getCartByUserId, updateCart } from '../db/carts.js'
import { requireAuth } from '../middleware/auth.js'
import { getProductById } from '../db/products.js'
import { normalizeId } from '../db/util.js'

const router = express.Router()

const cartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().min(1).max(100),
    })
  ),
})

router.get('/', requireAuth, async (req, res) => {
  let cart = await getCartByUserId(req.user.id)
  if (!cart) cart = await createCart(req.user.id)
  res.json(normalizeId(cart))
})

router.put('/', requireAuth, async (req, res) => {
  const parsed = cartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  for (const item of parsed.data.items) {
    const product = await getProductById(item.productId)
    if (product && item.quantity > product.stock) {
      return res.status(400).json({ message: 'Quantity exceeds stock' })
    }
  }
  const cart = await updateCart(req.user.id, parsed.data.items)
  if (!cart) return res.status(404).json({ message: 'Cart not found' })
  return res.json(normalizeId(cart))
})

export default router
