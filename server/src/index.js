// ✅ MUST BE FIRST (ESM-safe dotenv)
import 'dotenv/config'

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import passport from 'passport'

// Routes
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import feedbackRoutes from './routes/feedback.js'
import adminRoutes from './routes/admin.js'
import userRoutes from './routes/users.js'
import reviewRoutes from './routes/reviews.js'
import publicRoutes from './routes/public.js'

// Middleware
import { errorHandler } from './middleware/error.js'

const app = express()
const port = process.env.PORT || 4000

// ─────────────────────────────
// Security & Core Middleware
// ─────────────────────────────
app.use(helmet())

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '30mb' }))
app.use(cookieParser())
app.use(passport.initialize())
app.use(morgan('dev'))

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

// ─────────────────────────────
// Health Check
// ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// ─────────────────────────────
// API Routes
// ─────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/users', userRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/public', publicRoutes)

// ─────────────────────────────
// Global Error Handler
// ─────────────────────────────
app.use(errorHandler)

// ─────────────────────────────
// Start Server
// ─────────────────────────────
app.listen(port, () => {
  console.log(`✅ Severino backend running on port ${port}`)
})
