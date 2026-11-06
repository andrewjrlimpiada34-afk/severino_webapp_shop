import express from 'express'
import { asyncRoute } from '../lib/asyncRoute.js'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getUserById, isPhoneRegisteredToAnotherUser, sanitizeUser, updateUser } from '../db/users.js'
import { normalizePhilippineMobile } from '../../shared/loginValidation.js'
import { requireAuth } from '../middleware/auth.js'
import { isDataUrl } from '../lib/images.js'

const router = express.Router()

const profileSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email().optional().or(z.literal('')),
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
  .refine((data) => !isDataUrl(data.profileImage), {
    message: 'Inline images are not allowed',
  })

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
})

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await getUserById(req.user.id)
  if (!user) return res.status(404).json({ message: 'Not found' })
  return res.json(sanitizeUser(user))
}))

const deliveryPhoneSchema = z.object({
  phone: z.string().transform(normalizePhilippineMobile).refine(Boolean, 'Enter a valid Philippine mobile number.'),
})

router.post('/me/check-delivery-phone', requireAuth, asyncRoute(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const parsed = deliveryPhoneSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid Philippine mobile number.' })
  const registeredToAnotherUser = await isPhoneRegisteredToAnotherUser(parsed.data.phone, req.user.id)
  return res.json({ registeredToAnotherUser })
}))

router.patch('/me', requireAuth, asyncRoute(async (req, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors?.[0]?.message || 'Invalid input' })
  }
  const currentUser = await getUserById(req.user.id)
  if (!currentUser) return res.status(404).json({ message: 'Not found' })
  const nextData = { ...parsed.data }
  if (currentUser.passwordHash && !currentUser.email) {
    delete nextData.email
  }
  const address = `${parsed.data.addressLine || ''}, ${parsed.data.barangay}, ${parsed.data.city}, ${parsed.data.province}, ${parsed.data.zip}, ${parsed.data.country}`
  let user
  try {
    user = await updateUser(req.user.id, { ...nextData, address })
  } catch (error) {
    const conflicts = {
      users_phone_key: 'This mobile number is already registered to another user. Use a different number for your account.',
      users_email_key: 'This email is already registered to another user. Use a different email for your account.',
    }
    if (error.code === '23505' && Object.hasOwn(conflicts, error.constraint)) {
      return res.status(409).json({ message: conflicts[error.constraint] })
    }
    throw error
  }
  if (!user) return res.status(404).json({ message: 'Not found' })
  return res.json(sanitizeUser(user))
}))

router.patch('/password', requireAuth, asyncRoute(async (req, res) => {
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
}))

router.patch('/theme', requireAuth, asyncRoute(async (req, res) => {
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
}))

export default router
