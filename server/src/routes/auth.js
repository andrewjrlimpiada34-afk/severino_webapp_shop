import express from 'express'
import { asyncRoute } from '../lib/asyncRoute.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { normalizePhilippineMobile } from '../../shared/loginValidation.js'
import { loginSchema } from '../lib/loginSchema.js'
import { createAuthEncryptionKey, decryptAuthPayload } from '../lib/encryptedAuth.js'
import { callOtp, proxyOtp } from '../otp-client.js'
import { getPrimaryClientOrigin } from '../lib/clientOrigins.js'
import { withTransaction } from '../db/postgres.js'
import { createId } from '../db/util.js'
import { PRIVACY_VERSION, TERMS_VERSION } from '../../shared/policyVersions.js'
import { completeGoogleOnboarding, findGoogleUser, getGoogleOnboarding, startGoogleOnboarding } from '../db/googleIdentity.js'
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByPhone,
  updateUser,
  sanitizeUser,
} from '../db/users.js'


const router = express.Router()
const invalidCredentials = 'Invalid email, mobile number, or password.'
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
})

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const registerSchema = z.object({
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Accept the Terms and Conditions before creating an account.' }) }),
  termsVersion: z.literal(TERMS_VERSION),
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

const getZodErrorMessage = (parsed, fallback = 'Invalid input') => {
  if (parsed.success) return ''
  return parsed.error.issues[0]?.message || fallback
}

const googleConfigReady =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URL

const getClientOrigin = () => getPrimaryClientOrigin()

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

router.get('/encryption-key', asyncRoute(async (req, res) => {
  return res.json(await createAuthEncryptionKey())
}))

router.post('/register', decryptAuthPayload, asyncRoute(async (req, res) => {
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
  const user = await withTransaction(async (connection) => {
    const created = await createUser({
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
    }, connection)
    await connection.query('INSERT INTO terms_acceptances(id,user_id,terms_version,privacy_version,method) VALUES ($1,$2,$3,$4,$5)', [createId(), created.id, TERMS_VERSION, PRIVACY_VERSION, 'email'])
    await connection.query(`INSERT INTO customer_addresses(id,user_id,label,name,phone,address_line,barangay,city,province,zip,country,is_default) VALUES ($1,$2,'Home',$3,$4,$5,$6,$7,$8,$9,$10,TRUE)`, [createId(), created.id, created.name, created.phone, created.addressLine, created.barangay, created.city, created.province, created.zip, created.country])
    return created
  })
  const consumed = await callOtp('/otp/consume', { challengeId: verification.id })
  if (consumed.status !== 200) console.error('OTP cleanup failed after registration')

  return res.status(201).json({
    phone: user.phone,
    requiresVerification: false,
  })
}))

router.post('/login', loginLimiter, decryptAuthPayload, asyncRoute(async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }

  try {
    const identifier = parsed.data.identifier
    const normalizedPhone = normalizePhilippineMobile(identifier)
    let user = normalizedPhone
      ? await getUserByPhone(normalizedPhone)
      : await getUserByEmail(identifier)
    const match = await bcrypt.compare(parsed.data.password, user?.passwordHash || dummyPasswordHash)
    const googleProof = user && !user.verified && req.cookies?.google_onboarding
      ? await getGoogleOnboarding(req.cookies.google_onboarding)
      : null
    const verifiedByGoogle = Boolean(googleProof && googleProof.email === user.email)
    if (!user || user.deletedAt || !user.passwordHash || !match || (!user.verified && user.role !== 'admin' && !verifiedByGoogle)) {
      return res.status(401).json({ message: invalidCredentials })
    }
    if (verifiedByGoogle) user = await updateUser(user.id, { verified: true })

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    })
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res.json({ requires2fa: false, user: sanitizeUser(user) })
  } catch (error) {
    return next(error)
  }
}))

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

router.get('/google/callback', asyncRoute(async (req, res, next) => {
  if (!googleConfigReady) {
    return res.status(500).send('Google OAuth not configured')
  }

  const expectedState = req.cookies?.oauth_state
  const actualState = typeof req.query?.state === 'string' ? req.query.state : ''
  if (!expectedState || !actualState || expectedState !== actualState) {
    clearAuthCookies(res)
    return res.redirect(buildLoginRedirect('cancelled'))
  }

  const completeGoogleLogin = async (error, profile) => {
    clearAuthCookies(res)
    if (error || !profile) {
      return res.redirect(buildLoginRedirect('cancelled'))
    }

    const email = profile?.emails?.[0]?.value?.trim().toLowerCase()
    const emailVerified = profile?._json?.email_verified
    if (!email || emailVerified !== true || !profile.id) {
      return res.redirect(buildLoginRedirect('failed'))
    }

    const identity = await findGoogleUser(profile.id)
    if (!identity) {
      const pending = await startGoogleOnboarding({ id: profile.id, email, name: profile.displayName || 'Google customer' })
      res.cookie('google_onboarding', pending, { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 10 * 60 * 1000 })
      return res.redirect(`${getClientOrigin()}/google-onboarding`)
    }
    const user = await getUserById(identity.id)
    if (!user || user.deletedAt || user.role === 'admin') return res.redirect(buildLoginRedirect('failed'))

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    })
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res.redirect(getClientOrigin())
  }
  return passport.authenticate('google', { session: false }, (error, profile) => {
    void completeGoogleLogin(error, profile).catch(next)
  })(req, res, next)
}))

router.post('/logout', (req, res) => {
  res.clearCookie('google_onboarding', { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production' })
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return res.json({ message: 'Logged out' })
})

router.get('/me', asyncRoute(async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
  const user = await getUserById(payload.id)
  if (!user || user.deletedAt) return res.status(401).json({ message: 'Unauthorized' })
  return res.json(sanitizeUser(user))
}))

router.get('/google/onboarding', asyncRoute(async (req, res) => {
  const pending = await getGoogleOnboarding(req.cookies?.google_onboarding)
  return pending ? res.json(pending) : res.status(401).json({ message: 'Restart Google sign-in to continue.' })
}))
router.post('/google/complete', asyncRoute(async (req, res) => {
  const parsed = z.object({ termsAccepted: z.literal(true), termsVersion: z.literal(TERMS_VERSION) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Accept the current Terms and Conditions before continuing.' })
  let authenticatedUserId = null
  if (req.cookies?.token) {
    try { authenticatedUserId = jwt.verify(req.cookies.token, process.env.JWT_SECRET).id } catch { /* Completion still supports a new Google account. */ }
  }
  const id = await completeGoogleOnboarding(req.cookies?.google_onboarding, authenticatedUserId)
  const user = await getUserById(id)
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' })
  const cookieOptions = { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production' }
  res.cookie('token', token, cookieOptions)
  res.clearCookie('google_onboarding', cookieOptions)
  return res.json(sanitizeUser(user))
}))

export default router
