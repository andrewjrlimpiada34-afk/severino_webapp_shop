import express from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import {
  createUser,
  getUserByEmail,
  getUserById,
  removeUser,
  updateUser,
  sanitizeUser,
} from '../db/users.js'
import { consumeOtp, createOtp, getOtpById } from '../db/otps.js'

const router = express.Router()

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().trim().min(7, 'Phone number is too short'),
  addressLine: z.string().trim().optional(),
  barangay: z.string().trim().min(2, 'Barangay is required'),
  city: z.string().trim().min(2, 'City is required'),
  province: z.string().trim().min(2, 'Province is required'),
  zip: z.string().trim().min(3, 'ZIP is required'),
  country: z.string().trim().min(2, 'Country is required'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const verifySchema = z.object({
  challengeId: z.string().min(8),
  code: z.string().min(6),
})

const resendSchema = z.object({
  challengeId: z.string().min(8),
})

const getZodErrorMessage = (parsed, fallback = 'Invalid input') => {
  if (parsed.success) return ''
  return parsed.error.issues[0]?.message || fallback
}

const parseSmtpSecure = (value, port) => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return Number(port) === 465
}

const getMailConfig = () => {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    return {
      transport: {
        host: smtpHost,
        port: Number(smtpPort),
        secure: parseSmtpSecure(process.env.SMTP_SECURE, smtpPort),
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      },
      from: process.env.EMAIL_FROM || `"Severino" <${smtpUser}>`,
    }
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      transport: {
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || `"Severino" <${process.env.GMAIL_USER}>`,
    }
  }

  return null
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

const sendOtpEmail = async ({ mailConfig, to, code }) => {
  const transporter = nodemailer.createTransport(mailConfig.transport)
  await transporter.sendMail({
    from: mailConfig.from,
    to,
    subject: 'Verify your Severino account',
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  })
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

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
  }

  const mailConfig = getMailConfig()
  if (!mailConfig) {
    return res.status(500).json({ message: 'Email service not configured' })
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

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000
  const challenge = await createOtp({
    id: `${user._id.toString()}-${Date.now()}`,
    userId: user._id.toString(),
    email: user.email,
    code,
    expiresAt,
  })

  try {
    await sendOtpEmail({ mailConfig, to: user.email, code })
  } catch (error) {
    await consumeOtp(challenge.id)
    await removeUser(user._id.toString())
    return res.status(502).json({
      message:
        'Unable to send OTP email. Please verify SMTP settings and try again.',
    })
  }

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
    return res.status(400).json({ message: getZodErrorMessage(parsed) })
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

  const mailConfig = getMailConfig()
  if (!mailConfig) {
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
    await sendOtpEmail({ mailConfig, to: user.email, code })
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
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' })
  }
})

export default router
