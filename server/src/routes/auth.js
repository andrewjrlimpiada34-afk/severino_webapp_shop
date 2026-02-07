import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { createUser, getUserByEmail, getUserById, updateUser, sanitizeUser } from '../db/users.js'
import { consumeOtp, createOtp, getOtpById } from '../db/otps.js'

const router = express.Router()

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(7),
  addressLine: z.string().optional(),
  barangay: z.string().min(2),
  city: z.string().min(2),
  province: z.string().min(2),
  zip: z.string().min(3),
  country: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const verifySchema = z.object({
  challengeId: z.string().min(8),
  code: z.string().min(6),
})

const googleConfigReady =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REDIRECT_URL

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

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }

  const existing = await getUserByEmail(parsed.data.email)
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await createUser({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    phone: parsed.data.phone || '',
    addressLine: parsed.data.addressLine || '',
    barangay: parsed.data.barangay || '',
    city: parsed.data.city || '',
    province: parsed.data.province || '',
    zip: parsed.data.zip || '',
    country: parsed.data.country || '',
    address: `${parsed.data.addressLine || ''}, ${parsed.data.barangay}, ${parsed.data.city}, ${parsed.data.province}, ${parsed.data.zip}, ${parsed.data.country}`,
  })

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ message: 'Email service not configured' })
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000
  const challenge = await createOtp({
    id: `${user._id.toString()}-${Date.now()}`,
    userId: user._id.toString(),
    email: user.email,
    code,
    expiresAt,
  })

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: `"Severino" <${process.env.GMAIL_USER}>`,
    to: user.email,
    subject: 'Verify your Severino account',
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  })

  return res.status(201).json({
    id: user._id.toString(),
    email: user.email,
    requiresVerification: true,
    challengeId: challenge.id,
  })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input' })
  }

  const user = await getUserByEmail(parsed.data.email)
  if (!user || !user.passwordHash) {
    return res.status(404).json({ message: 'Email not found' })
  }
  if (!user.verified && user.role !== 'admin') {
    return res.status(403).json({ message: 'Email not verified' })
  }

  const match = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
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
    return res.status(400).json({ message: 'Invalid input' })
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

router.get(
  '/google',
  (req, res, next) => {
    if (!googleConfigReady) {
      return res.status(500).json({ message: 'Google OAuth not configured' })
    }
    return next()
  },
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
)

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleConfigReady) {
      return res.status(500).send('Google OAuth not configured')
    }
    return next()
  },
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    const profile = req.user
    const email = profile?.emails?.[0]?.value
    if (!email) {
      return res.redirect(process.env.CLIENT_ORIGIN || '/')
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
      await updateUser(user._id.toString(), { verified: true })
    }

    const token = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    })
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res.redirect(process.env.CLIENT_ORIGIN || '/')
  }
)

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
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' })
  }
})

export default router
