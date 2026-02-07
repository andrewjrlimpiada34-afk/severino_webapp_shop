import express from 'express'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { getSalesSummary } from '../db/inventory.js'
import { getUserById, getUsers, removeUser } from '../db/users.js'
import { getProducts } from '../db/products.js'
import { getBanners, updateBanners, getLoginPopup, updateLoginPopup } from '../db/banners.js'
import { removeCartByUserId } from '../db/carts.js'
import { removeOrdersByUserId } from '../db/orders.js'
import { z } from 'zod'
import { normalizeList, normalizeId } from '../db/util.js'

const router = express.Router()

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
  const items = await getProducts()
  res.json(normalizeList(items))
})

const bannerSchema = z.object({
  images: z.array(z.string().min(1)).min(1),
})

router.get('/banners', async (req, res) => {
  res.json(await getBanners())
})

router.put('/banners', async (req, res) => {
  const parsed = bannerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const updated = await updateBanners(parsed.data.images)
  return res.json(updated)
})

const loginPopupSchema = z.object({
  image: z.string().optional(),
})

router.get('/login-popup', async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
})

router.put('/login-popup', async (req, res) => {
  const parsed = loginPopupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const updated = await updateLoginPopup(parsed.data.image || '')
  return res.json({ image: updated })
})

export default router
