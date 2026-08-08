import express from 'express'
import { z } from 'zod'
import {
  createProduct,
  getProductById,
  getProducts,
  getProductSoldCounts,
  updateProduct,
} from '../db/products.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { normalizeId, normalizeList } from '../db/util.js'
import { assertNoDataUrls, isDataUrl } from '../lib/images.js'
import { createCache } from '../lib/cache.js'

const router = express.Router()
const productsCache = createCache(300000)

const productSchema = z
  .object({
    name: z.string().min(2),
    price: z.number().min(0),
    stock: z.number().min(0),
    notes: z.string().min(2),
    size: z.string().optional(),
    description: z.string().min(10).optional(),
    imageUrl: z.string().min(1).optional(),
    imageUrls: z.array(z.string().min(1)).optional(),
    category: z.enum(['Men', 'Women', 'Unisex', 'Signature', 'Fresh', 'Floral', 'Amber']).optional(),
    active: z.boolean().default(true),
  })
  .refine((data) => !isDataUrl(data.imageUrl), {
    message: 'Inline images are not allowed',
  })
  .refine((data) => assertNoDataUrls(data.imageUrls || []), {
    message: 'Inline images are not allowed',
  })

router.get('/', async (req, res) => {
  const cached = productsCache.get()
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300')
    return res.json(cached)
  }
  const soldCounts = await getProductSoldCounts()
  const products = normalizeList(await getProducts()).map((product) => ({
    ...product,
    soldCount: soldCounts[product.id] || 0,
  }))
  productsCache.set(products)
  res.set('Cache-Control', 'public, max-age=300')
  return res.json(products)
})

router.get('/:id', async (req, res) => {
  const product = await getProductById(req.params.id)
  if (!product) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(product))
})

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const product = await createProduct(parsed.data)
  productsCache.clear()
  return res.status(201).json(normalizeId(product))
})

router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  if (isDataUrl(req.body.imageUrl) || !assertNoDataUrls(req.body.imageUrls || [])) {
    return res.status(400).json({ message: 'Inline images are not allowed' })
  }
  const product = await updateProduct(req.params.id, req.body)
  productsCache.clear()
  if (!product) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(product))
})

export default router
