import express from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { z } from 'zod'
import { callOtp, proxyOtp } from '../otp-client.js'
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByPhone,
  updateUser,
  sanitizeUser,
} from '../db/users.js'


const router = express.Router()

const normalizePhilippineMobile = (value = '') => {
  const compact = String(value).replace(/[\s-]/g, '')
  if (/^09\d{9}$/.test(compact)) {
    return `+63${compact.slice(1)}`
  }
  if (/^9\d{9}$/.test(compact)) {
    return `+63${compact}`
  }
  if (/^\+639\d{9}$/.test(compact)) {
    return compact
  }
  if (/^639\d{9}$/.test(compact)) {
    return `+${compact}`
  }
  return ''
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  phone: z
    .string()
    .trim()
    .transform((value) => normalizePhilippineMobile(value))
    .refine(Boolean, 'Enter a valid Philippine mobile number'),
  addressLine: z.string().trim().optional(),
  barangay: z.string().trim().min(2, 'Barangay is required'),
  city: z.string().trim().min(2, 'City is required'),
  province: z.string().trim().min(2, 'Province is required'),
  zip: z.string().trim().min(3, 'ZIP is required'),
  country: z.string().trim().min(2, 'Country is required'),
  verificationId: z.string().min(8),
})

const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Mobile number or email is required').optional(),
  email: z.string().trim().optional(),
  password: z.string().min(8),
})

const getZodErrorMessage = (parsed, fallback = 'Invalid input') => {
  if (parsed.success) return ''
  return parsed.error.issues[0]?.message || fallback
}

const googleConfigReady =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URL

const getClientOrigin = () => process.env.CLIENT_ORIGIN || '/'

const buildLoginRedirect = (reason) => {
  let root = getClientOrigin()
  try {
    const parsed = new URL(getClientOrigin())
    root = `${parsed.protocol}//${parsed.host}`
  } catch {
    root = getClientOrigin().replace(/\/+$/, '')
  }
  if (!reason) return `${root}/login`
  return `${root}/login?oauth=${encodeURIComponent(reason)}`
}

const clearAuthCookies = (res) => {
  const options = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  }
  res.clearCookie('token', options)
  res.clearCookie('oauth_state', options)
}

if (googleConfigReady) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        return done(null, profile)
      }
    )
  )
}

router.post('/otp/send', proxyOtp('/otp/send'))
router.post('/otp/verify', proxyOtp('/otp/verify'))

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }

  const existing = await getUserByPhone(parsed.data.phone)
  if (existing) {
    return res.status(409).json({ message: 'Mobile number already registered' })
  }
  const existingEmail = await getUserByEmail(parsed.data.email)
  if (existingEmail) {
    return res.status(409).json({ message: 'Email already registered' })
  }

  const verificationResult = await callOtp('/otp/inspection', { challengeId: parsed.data.verificationId })
  if (verificationResult.status !== 200) {
    return res.status(verificationResult.status).json(verificationResult.body)
  }
  const verification = verificationResult.body
  if (
    !verification ||
    verification.type !== 'register' ||
    verification.email !== parsed.data.email ||
    !verification.verifiedAt ||
    Date.now() > verification.expiresAt
  ) {
    return res.status(403).json({ message: 'Verify OTP before creating account' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    verified: true,
    phone: parsed.data.phone,
    addressLine: parsed.data.addressLine || '',
    barangay: parsed.data.barangay || '',
    city: parsed.data.city || '',
    province: parsed.data.province || '',
    zip: parsed.data.zip || '',
    country: parsed.data.country || '',
    address: `${parsed.data.addressLine || ''}, ${parsed.data.barangay}, ${parsed.data.city}, ${parsed.data.province}, ${parsed.data.zip}, ${parsed.data.country}`,
  })
  const consumed = await callOtp('/otp/consume', { challengeId: verification.id })
  if (consumed.status !== 200) console.error('OTP cleanup failed after registration')

  return res.status(201).json({
    id: user.id,
    phone: user.phone,
    requiresVerification: false,
  })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }

  const identifier = parsed.data.identifier || parsed.data.email || ''
  const normalizedPhone = normalizePhilippineMobile(identifier)
  const normalizedEmail = identifier.toLowerCase()
  const user = normalizedPhone
    ? await getUserByPhone(normalizedPhone)
    : await getUserByEmail(normalizedEmail)
  if (!user || !user.passwordHash) {
    return res.status(404).json({ message: 'Account not found' })
  }
  if (!user.verified && user.role !== 'admin') {
    return res.status(403).json({ message: 'Account not verified' })
  }

  const match = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '2h',
  })
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return res.json({ requires2fa: false })
})

router.post('/verify', proxyOtp('/verify'))
router.post('/verify/resend', proxyOtp('/verify/resend'))

router.get('/google', (req, res, next) => {
  if (!googleConfigReady) {
    return res.status(500).json({ message: 'Google OAuth not configured' })
  }

  clearAuthCookies(res)
  const state = crypto.randomBytes(24).toString('hex')
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  })

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account',
    state,
  })(req, res, next)
})

router.get('/google/callback', async (req, res, next) => {
  if (!googleConfigReady) {
    return res.status(500).send('Google OAuth not configured')
  }

  const expectedState = req.cookies?.oauth_state
  const actualState = typeof req.query?.state === 'string' ? req.query.state : ''
  if (!expectedState || !actualState || expectedState !== actualState) {
    clearAuthCookies(res)
    return res.redirect(buildLoginRedirect('cancelled'))
  }

  return passport.authenticate('google', { session: false }, async (error, profile) => {
    clearAuthCookies(res)
    if (error || !profile) {
      return res.redirect(buildLoginRedirect('cancelled'))
    }

    const email = profile?.emails?.[0]?.value
    const emailVerified = profile?._json?.email_verified
    if (!email || emailVerified === false) {
      return res.redirect(buildLoginRedirect('failed'))
    }

    let user = await getUserByEmail(email)
    if (!user) {
      user = await createUser({
        name: profile.displayName || 'Google User',
        email,
        passwordHash: '',
        verified: true,
      })
    } else if (!user.verified) {
      user = await updateUser(user.id, { verified: true })
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    })
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res.redirect(getClientOrigin())
  })(req, res, next)
})

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return res.json({ message: 'Logged out' })
})

router.get('/me', async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await getUserById(payload.id)
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    return res.json(sanitizeUser(user))
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
})

export default router
