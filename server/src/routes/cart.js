import express from 'express'
import { asyncRoute } from '../lib/asyncRoute.js'
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
      quantity: z.number().int().min(1).max(100),
    })
  ),
})

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  let cart = await getCartByUserId(req.user.id)
  if (!cart) cart = await createCart(req.user.id)
  res.json(normalizeId(cart))
}))

router.put('/', requireAuth, asyncRoute(async (req, res) => {
  const parsed = cartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const quantities = new Map()
  for (const item of parsed.data.items) {
    const product = await getProductById(item.productId)
    if (!product || !product.active) return res.status(400).json({ message: 'A selected product is unavailable.' })
    const quantity = (quantities.get(product.id) || 0) + item.quantity
    if (quantity > product.stock || quantity > 100) {
      return res.status(400).json({ message: 'Quantity exceeds stock' })
    }
    quantities.set(product.id, quantity)
  }
  await createCart(req.user.id)
  const cart = await updateCart(req.user.id, Array.from(quantities, ([productId, quantity]) => ({ productId, quantity })))
  if (!cart) return res.status(404).json({ message: 'Cart not found' })
  return res.json(normalizeId(cart))
}))

export default router
