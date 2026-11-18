import express from 'express'
import { asyncRoute } from '../lib/asyncRoute.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { getSalesSummary } from '../db/inventory.js'
import { getCollectedSales } from '../db/payments.js'
import { getDb } from '../db/postgres.js'
import { getUserById, getUsers, removeUser } from '../db/users.js'
import { getProducts } from '../db/products.js'
import {
  getBannerStories,
  getBanners,
  getLoginAnnouncements,
  getLoginPopup,
  updateBannerStories,
  updateBanners,
  updateLoginAnnouncements,
  updateLoginPopup,
  getHeroImage,
  updateHeroImage,
  getFeaturedBanners,
  updateFeaturedBanners,
} from '../db/banners.js'

import { removeCartByUserId } from '../db/carts.js'
import { z } from 'zod'
import { normalizeList } from '../db/util.js'
import { assertNoDataUrls, isDataUrl } from '../lib/images.js'
import { createCache } from '../lib/cache.js'
import { bannerStoriesSchema } from '../lib/bannerStorySchema.js'
import { createFaq, deleteFaq, getFaqs, updateFaq } from '../db/faqs.js'

const router = express.Router()
const bannersCache = createCache(20000)

router.use(requireAuth, requireAdmin)

const faqSchema = z.object({
  question: z.string().trim().min(1, 'Enter a question.').max(200, 'Questions can have up to 200 characters.'),
  answer: z.string().trim().min(1, 'Enter an answer.').max(3000, 'Answers can have up to 3000 characters.'),
})

router.get('/faqs', asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await getFaqs())
}))

router.post('/faqs', asyncRoute(async (req, res) => {
  const parsed = faqSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message })
  }
  return res.status(201).json(await createFaq(parsed.data))
}))

router.put('/faqs/:id', asyncRoute(async (req, res) => {
  const parsed = faqSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message })
  }
  const updated = await updateFaq(req.params.id, parsed.data)
  if (!updated) return res.status(404).json({ message: 'FAQ no longer exists. Refresh the list.' })
  return res.json(updated)
}))

router.delete('/faqs/:id', asyncRoute(async (req, res) => {
  const removed = await deleteFaq(req.params.id)
  if (!removed) return res.status(404).json({ message: 'FAQ no longer exists. Refresh the list.' })
  return res.json({ success: true })
}))

router.get('/sales', asyncRoute(async (req, res) => {
  res.json(await getSalesSummary())
}))
router.get('/sales/history', asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  return res.json(await getCollectedSales())
}))
router.get('/inventory/logs', asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const page = Math.max(0, Math.min(10000, Number.parseInt(req.query.page, 10) || 0))
  const { rows } = await getDb().query(`SELECT l.*, p.name AS product_name, u.name AS actor_name FROM inventory_logs l JOIN products p ON p.id=l.product_id LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.created_at DESC, l.id DESC LIMIT 100 OFFSET $1`, [page * 100])
  return res.json(rows)
}))

router.get('/users', asyncRoute(async (req, res) => {
  const users = await getUsers()
  res.json(
    normalizeList(users).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }))
  )
}))

router.delete('/users/:id', asyncRoute(async (req, res) => {
  const target = await getUserById(req.params.id)
  if (target?.role === 'admin') {
    return res.status(403).json({ message: 'Cannot remove admin account' })
  }
  const removed = await removeUser(req.params.id)
  if (!removed) return res.status(404).json({ message: 'Not found' })
  await removeCartByUserId(req.params.id)
  return res.json({ success: true })
}))

router.get('/inventory', asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const items = normalizeList(await getProducts()).map((product) => ({ ...product, availableStock: product.stock, stock: product.physicalStock }))
  return res.json(items)
}))

const bannerSchema = z.object({
  images: z.array(z.string().min(1)).min(1),
}).refine((data) => assertNoDataUrls(data.images), {
  message: 'Inline images are not allowed',
})

router.get('/banners', asyncRoute(async (req, res) => {
  const cached = bannersCache.get()
  if (cached) return res.json(cached)
  const banners = await getBanners()
  bannersCache.set(banners)
  return res.json(banners)
}))

router.put('/banners', asyncRoute(async (req, res) => {
  const parsed = bannerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateBanners(parsed.data.images)
  bannersCache.clear()
  return res.json(updated)
}))

router.get('/banner-stories', asyncRoute(async (req, res) => {
  const stories = await getBannerStories()
  res.json(stories)
}))

router.put('/banner-stories', asyncRoute(async (req, res) => {
  const parsed = bannerStoriesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateBannerStories(
    parsed.data.stories.map((story) => ({
      ...story,
      id: story.id || '',
      title: story.title?.trim() || '',
      message: story.message?.trim() || '',
    }))
  )
  return res.json(updated)
}))

const loginPopupSchema = z.object({
  image: z.string().optional(),
}).refine((data) => !isDataUrl(data.image), {
  message: 'Inline images are not allowed',
})

router.get('/login-popup', asyncRoute(async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
}))

router.put('/login-popup', asyncRoute(async (req, res) => {
  const parsed = loginPopupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateLoginPopup(parsed.data.image || '')
  return res.json({ image: updated })
}))

const loginAnnouncementSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional(),
  message: z.string().max(1500).optional(),
})

router.get('/login-announcement', asyncRoute(async (req, res) => {
  const announcements = await getLoginAnnouncements()
  res.json(announcements)
}))

router.put('/login-announcement', asyncRoute(async (req, res) => {
  const parsed = z.object({ announcements: z.array(loginAnnouncementSchema) }).safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateLoginAnnouncements(
    parsed.data.announcements.map((announcement) => ({
      id: announcement.id || '',
      title: announcement.title?.trim() || '',
      message: announcement.message?.trim() || '',
    }))
  )
  return res.json(updated)
}))

const heroImageSchema = z.object({
  image: z.string().optional(),
}).refine((data) => !isDataUrl(data.image), {
  message: 'Inline images are not allowed',
})

router.get('/hero-image', asyncRoute(async (req, res) => {
  const image = await getHeroImage()
  res.json({ image: image || '' })
}))

router.put('/hero-image', asyncRoute(async (req, res) => {
  const parsed = heroImageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateHeroImage(parsed.data.image || '')
  return res.json({ image: updated })
}))

const featuredBannerSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional(),
  image: z.string().optional(),
  message: z.string().max(1500).optional(),
})

const featuredBannersSchema = z
  .object({
    items: z.array(featuredBannerSchema).max(3),
  })
  .refine((data) => data.items.every((i) => !isDataUrl(i.image || '')), {
    message: 'Inline images are not allowed',
  })


router.get('/featured-banners', asyncRoute(async (req, res) => {
  const items = await getFeaturedBanners()
  return res.json(items)
}))

router.put('/featured-banners', asyncRoute(async (req, res) => {
  const parsed = featuredBannersSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateFeaturedBanners(parsed.data.items)
  bannersCache.clear()
  return res.json(updated)
}))

export default router
