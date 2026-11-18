import express from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { asyncRoute } from '../lib/asyncRoute.js'
import { deleteAddress, listAddresses, saveAddress } from '../db/addresses.js'
import { normalizePhilippineMobile } from '../../shared/loginValidation.js'

const router = express.Router()
export const addressSchema = z.object({
  label: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(150),
  phone: z
    .string()
    .transform(normalizePhilippineMobile)
    .refine(Boolean, 'Enter a valid Philippine mobile number.'),
  addressLine: z.string().trim().max(255).default(''),
  barangay: z.string().trim().min(2).max(150),
  city: z.string().trim().min(2).max(150),
  province: z.string().trim().min(2).max(150),
  zip: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(100),
  isDefault: z.boolean().default(false)
})
router.use(requireAuth)
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
router.get(
  '/',
  asyncRoute(async (req, res) => res.json(await listAddresses(req.user.id)))
)
router.post(
  '/',
  asyncRoute(async (req, res) => {
    const parsed = addressSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message })
    return res.status(201).json(await saveAddress(req.user.id, parsed.data))
  })
)
router.put(
  '/:id',
  asyncRoute(async (req, res) => {
    const parsed = addressSchema.safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message })
    const address = await saveAddress(req.user.id, parsed.data, req.params.id)
    return address
      ? res.json(address)
      : res.status(404).json({ message: 'Address unavailable.' })
  })
)
router.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    return (await deleteAddress(req.user.id, req.params.id))
      ? res.json({ success: true })
      : res.status(404).json({ message: 'Address unavailable.' })
  })
)
export default router
