import express from 'express'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { getSalesSummary } from '../db/inventory.js'
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
} from '../db/banners.js'
import { removeCartByUserId } from '../db/carts.js'
import { removeOrdersByUserId } from '../db/orders.js'
import { z } from 'zod'
import { normalizeList, normalizeId } from '../db/util.js'
import { assertNoDataUrls, isDataUrl } from '../lib/images.js'
import { createCache } from '../lib/cache.js'

const router = express.Router()
const inventoryCache = createCache(20000)
const bannersCache = createCache(20000)

router.use(requireAuth, requireAdmin)

router.get('/sales', async (req, res) => {
  res.json(await getSalesSummary())
})

router.get('/users', async (req, res) => {
  const users = await getUsers()
  res.json(
    normalizeList(users).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }))
  )
})

router.delete('/users/:id', async (req, res) => {
  const target = await getUserById(req.params.id)
  if (target?.role === 'admin') {
    return res.status(403).json({ message: 'Cannot remove admin account' })
  }
  const removed = await removeUser(req.params.id)
  if (!removed) return res.status(404).json({ message: 'Not found' })
  await removeCartByUserId(req.params.id)
  await removeOrdersByUserId(req.params.id)
  return res.json({ success: true })
})

router.get('/inventory', async (req, res) => {
  const cached = inventoryCache.get()
  if (cached) return res.json(cached)
  const items = normalizeList(await getProducts())
  inventoryCache.set(items)
  return res.json(items)
})

const bannerSchema = z.object({
  images: z.array(z.string().min(1)).min(1),
}).refine((data) => assertNoDataUrls(data.images), {
  message: 'Inline images are not allowed',
})

const bannerStorySchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional(),
  message: z.string().max(1500).optional(),
})

router.get('/banners', async (req, res) => {
  const cached = bannersCache.get()
  if (cached) return res.json(cached)
  const banners = await getBanners()
  bannersCache.set(banners)
  return res.json(banners)
})

router.put('/banners', async (req, res) => {
  const parsed = bannerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateBanners(parsed.data.images)
  bannersCache.clear()
  return res.json(updated)
})

router.get('/banner-stories', async (req, res) => {
  const stories = await getBannerStories()
  res.json(stories)
})

router.put('/banner-stories', async (req, res) => {
  const parsed = z.object({ stories: z.array(bannerStorySchema).length(5) }).safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateBannerStories(
    parsed.data.stories.map((story) => ({
      id: story.id || '',
      title: story.title?.trim() || '',
      message: story.message?.trim() || '',
    }))
  )
  return res.json(updated)
})

const loginPopupSchema = z.object({
  image: z.string().optional(),
}).refine((data) => !isDataUrl(data.image), {
  message: 'Inline images are not allowed',
})

router.get('/login-popup', async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
})

router.put('/login-popup', async (req, res) => {
  const parsed = loginPopupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateLoginPopup(parsed.data.image || '')
  return res.json({ image: updated })
})

const loginAnnouncementSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional(),
  message: z.string().max(1500).optional(),
})

router.get('/login-announcement', async (req, res) => {
  const announcements = await getLoginAnnouncements()
  res.json(announcements)
})

router.put('/login-announcement', async (req, res) => {
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
})

const heroImageSchema = z.object({
  image: z.string().optional(),
}).refine((data) => !isDataUrl(data.image), {
  message: 'Inline images are not allowed',
})

router.get('/hero-image', async (req, res) => {
  const image = await getHeroImage()
  res.json({ image: image || '' })
})

router.put('/hero-image', async (req, res) => {
  const parsed = heroImageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const updated = await updateHeroImage(parsed.data.image || '')
  return res.json({ image: updated })
})

export default router
