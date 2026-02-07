import express from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getUserById, updateUser } from '../db/users.js'
import { requireAuth } from '../middleware/auth.js'
import { normalizeId } from '../db/util.js'

const router = express.Router()

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  addressLine: z.string().optional(),
  barangay: z.string().min(2),
  city: z.string().min(2),
  province: z.string().min(2),
  zip: z.string().min(3),
  country: z.string().min(2),
  backupAddress: z.string().optional(),
  profileImage: z.string().optional(),
  preferredTheme: z.string().optional(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.user.id)
  if (!user) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(user))
})

router.patch('/me', requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }
  const address = `${parsed.data.addressLine || ''}, ${parsed.data.barangay}, ${parsed.data.city}, ${parsed.data.province}, ${parsed.data.zip}, ${parsed.data.country}`
  const user = await updateUser(req.user.id, { ...parsed.data, address })
  if (!user) return res.status(404).json({ message: 'Not found' })
  return res.json(normalizeId(user))
})

router.patch('/password', requireAuth, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid password format' })
  }
  const user = await getUserById(req.user.id)
  if (!user || !user.passwordHash) {
    return res.status(404).json({ message: 'User not found' })
  }
  const match = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!match) {
    return res.status(401).json({ message: 'Current password is incorrect' })
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await updateUser(req.user.id, { passwordHash })
  return res.json({ success: true })
})

router.patch('/theme', requireAuth, async (req, res) => {
  const themeSchema = z.object({
    preferredTheme: z.string().min(1),
  })
  const parsed = themeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid theme' })
  }
  const user = await updateUser(req.user.id, { preferredTheme: parsed.data.preferredTheme })
  if (!user) return res.status(404).json({ message: 'Not found' })
  return res.json({ preferredTheme: user.preferredTheme })
})

export default router
