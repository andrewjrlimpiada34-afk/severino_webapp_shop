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
import { inventoryChange, inventoryEvents, notifyInventoryChange, publishInventoryChange } from '../lib/inventoryEvents.js'
import { getDb } from '../db/postgres.js'

const router = express.Router()
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

const productSchema = z
  .object({
    name: z.string().min(2),
    price: z.number().min(0),
    stock: z.number().int().min(0),
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

router.get('/', asyncRoute(async (req, res) => {
  const soldCounts = await getProductSoldCounts()
  const products = normalizeList(await getProducts()).map((product) => ({
    ...product,
    soldCount: soldCounts[product.id] || 0,
  }))
  res.set('Cache-Control', 'no-store')
  return res.json(products)
}))

router.get('/stock-events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(': connected\n\n')
  const send = (event) => {
    if (!res.destroyed && !res.writableEnded) res.write(`event: stock\ndata: ${JSON.stringify(event)}\n\n`)
  }
  const end = () => res.end()
  inventoryEvents.on('change', send)
  inventoryEvents.on('shutdown', end)
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000)
  heartbeat.unref()
  res.on('close', () => { clearInterval(heartbeat); inventoryEvents.off('change', send); inventoryEvents.off('shutdown', end) })
})

router.get('/:id', asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const product = await getProductById(req.params.id)
  if (!product) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(product))
}))

router.post('/', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const product = await createProduct(parsed.data)
  const event = inventoryChange([{ id: product.id, legacyId: product.legacyId || null, stock: product.stock }])
  publishInventoryChange(event)
  await notifyInventoryChange(getDb(), event).catch(() => console.error('Inventory notification unavailable; clients will resync on reconnect.'))
  return res.status(201).json(normalizeId(product))
}))

router.patch('/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (isDataUrl(req.body.imageUrl) || !assertNoDataUrls(req.body.imageUrls || [])) {
    return res.status(400).json({ message: 'Inline images are not allowed' })
  }
  const product = await updateProduct(req.params.id, req.body)
  if (!product) return res.status(404).json({ message: 'Not found' })
  const event = inventoryChange([{ id: product.id, legacyId: product.legacyId || null, stock: product.stock }])
  publishInventoryChange(event)
  await notifyInventoryChange(getDb(), event).catch(() => console.error('Inventory notification unavailable; clients will resync on reconnect.'))
  return res.json(normalizeId(product))
}))

export default router
