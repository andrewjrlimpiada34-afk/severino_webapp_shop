import express from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { z } from 'zod'
import { send_otp } from '../mailer.js'
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByPhone,
  updateUser,
  sanitizeUser,
} from '../db/users.js'
import {
  consumeOtp,
  createOtp,
  getLatestOtpByEmail,
  getOtpById,
  incrementOtpAttempts,
  markOtpVerified,
} from '../db/otps.js'

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

const verifySchema = z.object({
  challengeId: z.string().min(8),
  code: z.string().min(6),
})

const resendSchema = z.object({
  challengeId: z.string().min(8),
})

const otpSendSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase()),
})

const otpVerifySchema = z.object({
  challengeId: z.string().min(8),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP'),
})

const getZodErrorMessage = (parsed, fallback = 'Invalid input') => {
  if (parsed.success) return ''
  return parsed.error.issues[0]?.message || fallback
}

const isMailConfigured = () =>
  !!(
    (process.env.PROMAILER_API_URL && process.env.PROMAILER_API_KEY) ||
    (process.env.SMTP_EMAIL && process.env.SMTP_PASS) ||
    (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  )

const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 5 * 60 * 1000)
const OTP_RESEND_MS = Number(process.env.OTP_RESEND_MS || 60 * 1000)
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)

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

const otpRateMap = new Map()
const isRateLimited = (key, limit = 5, windowMs = 10 * 60 * 1000) => {
  const now = Date.now()
  const entry = otpRateMap.get(key)
  if (!entry || now > entry.resetAt) {
    otpRateMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count += 1
  return entry.count > limit
}

const generateOtp = () => {
  const code = crypto.randomInt(100000, 1000000).toString()
  return code
}

router.post('/otp/send', async (req, res) => {
  const parsed = otpSendSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }
  if (!isMailConfigured()) {
    return res.status(500).json({ message: 'Email service not configured' })
  }

  const email = parsed.data.email
  const existing = await getUserByEmail(email)
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' })
  }

  const rateKey = `${req.ip || 'ip'}:${email}`
  if (isRateLimited(rateKey)) {
    return res.status(429).json({ message: 'Too many requests. Try again later.' })
  }

  const recent = await getLatestOtpByEmail(email, 'register')
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < OTP_RESEND_MS) {
    return res.status(429).json({ message: 'Please wait before requesting another OTP.' })
  }

  const code = generateOtp()
  const expiresAt = Date.now() + OTP_TTL_MS
  const challenge = await createOtp({
    id: `${email}-${Date.now()}`,
    email,
    code,
    expiresAt,
    type: 'register',
    attempts: 0,
  })

  try {
    const result = await send_otp({
      to: email,
      subject: 'Verify your Severino account',
      text: `Your Severino verification code is ${code}. It expires in 5 minutes.`,
    })
    if (!result.success) {
      throw result.error || new Error('Email send failed')
    }
  } catch {
    await consumeOtp(challenge.id)
    return res.status(502).json({
      message: 'Unable to send OTP email. Please verify Gmail settings and try again.',
    })
  }

  return res.json({
    challengeId: challenge.id,
    message: 'OTP sent to email',
  })
})

router.post('/otp/verify', async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }

  const entry = await getOtpById(parsed.data.challengeId)
  if (!entry || entry.type !== 'register') {
    return res.status(400).json({ message: 'Invalid or expired OTP' })
  }
  if (Date.now() > entry.expiresAt) {
    await consumeOtp(parsed.data.challengeId)
    return res.status(400).json({ message: 'Invalid or expired OTP' })
  }
  if (entry.attempts >= OTP_MAX_ATTEMPTS) {
    await consumeOtp(parsed.data.challengeId)
    return res.status(400).json({ message: 'Too many attempts. Request a new OTP.' })
  }
  if (entry.code !== parsed.data.code) {
    await incrementOtpAttempts(parsed.data.challengeId)
    return res.status(400).json({ message: 'Invalid email OTP' })
  }

  await markOtpVerified(parsed.data.challengeId)
  return res.json({ verified: true, message: 'Email OTP verified' })
})

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

  const verification = await getOtpById(parsed.data.verificationId)
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
  await consumeOtp(verification.id)

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

router.post('/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }
  const entry = await getOtpById(parsed.data.challengeId)
  if (!entry) {
    return res.status(400).json({ message: 'Invalid code' })
  }
  if (Date.now() > entry.expiresAt) {
    await consumeOtp(parsed.data.challengeId)
    return res.status(400).json({ message: 'Code expired' })
  }
  if (entry.code !== parsed.data.code) {
    return res.status(400).json({ message: 'Invalid code' })
  }
  await consumeOtp(parsed.data.challengeId)

  const user = await getUserById(entry.userId)
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  await updateUser(entry.userId, { verified: true })
  return res.json({ success: true })
})

router.post('/verify/resend', async (req, res) => {
  const parsed = resendSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }

  const entry = await getOtpById(parsed.data.challengeId)
  if (!entry) {
    return res.status(400).json({ message: 'Challenge not found. Register again.' })
  }

  const user = await getUserById(entry.userId)
  if (!user) {
    await consumeOtp(parsed.data.challengeId)
    return res.status(404).json({ message: 'User not found' })
  }
  if (user.verified) {
    await consumeOtp(parsed.data.challengeId)
    return res.status(409).json({ message: 'Email already verified' })
  }

  if (!isMailConfigured()) {
    return res.status(500).json({ message: 'Email service not configured' })
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000
  const challenge = await createOtp({
    id: `${entry.userId}-${Date.now()}`,
    userId: entry.userId,
    email: user.email,
    code,
    expiresAt,
  })

  try {
    const result = await send_otp({
      to: user.email,
      subject: 'Verify your Severino account',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    })
    if (!result.success) {
      throw result.error || new Error('SMTP send failed')
    }
    await consumeOtp(parsed.data.challengeId)
    return res.json({ challengeId: challenge.id, email: user.email })
  } catch {
    await consumeOtp(challenge.id)
    return res.status(502).json({
      message:
        'Unable to resend OTP email. Please verify SMTP settings and try again.',
    })
  }
})

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
