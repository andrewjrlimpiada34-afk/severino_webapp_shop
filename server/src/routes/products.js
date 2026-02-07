import express from 'express'
import { z } from 'zod'
import { createProduct, getProductById, getProducts, updateProduct } from '../db/products.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { normalizeId, normalizeList } from '../db/util.js'

const router = express.Router()

const productSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  stock: z.number().min(0),
  notes: z.string().min(2),
  size: z.string().optional(),
  description: z.string().min(10).optional(),
  imageUrl: z.string().min(1).optional(),
  imageUrls: z.array(z.string().min(1)).optional(),
  category: z.enum(['Men', 'Women', 'Unisex']).optional(),
  active: z.boolean().default(true),
})

router.get('/', async (req, res) => {
  const products = await getProducts()
  res.json(normalizeList(products))
})

router.get('/:id', async (req, res) => {
  const product = await getProductById(req.params.id)
  if (!product) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(product))
})

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const product = await createProduct(parsed.data)
  return res.status(201).json(normalizeId(product))
})

router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await updateProduct(req.params.id, req.body)
  if (!product) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(product))
})

export default router
