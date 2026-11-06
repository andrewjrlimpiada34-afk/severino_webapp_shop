import 'dotenv/config'

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import passport from 'passport'

import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import feedbackRoutes from './routes/feedback.js'
import adminRoutes from './routes/admin.js'
import userRoutes from './routes/users.js'
import reviewRoutes from './routes/reviews.js'
import publicRoutes from './routes/public.js'
import uploadRoutes from './routes/uploads.js'
import { closeDb, testDbConnection } from './db/postgres.js'
import { errorHandler } from './middleware/error.js'
import { startInventoryListener, stopInventoryListener } from './lib/inventoryEvents.js'
import { createCorsOptions, getClientOrigins } from './lib/clientOrigins.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const allowedOrigins = getClientOrigins()

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())
app.use(cors(createCorsOptions()))
app.use(express.json({ limit: '30mb' }))
app.use(cookieParser())
app.use(passport.initialize())
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'))
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store')
  return res.json({ service: 'severino-backend', status: 'ok' })
})

app.get('/health', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const databaseConnected = await testDbConnection()
    return res.status(databaseConnected ? 200 : 503).json({
      status: databaseConnected ? 'ok' : 'unavailable',
      database: databaseConnected ? 'connected' : 'disconnected',
    })
  } catch {
    return res.status(503).json({ status: 'unavailable', database: 'disconnected' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/users', userRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/uploads', uploadRoutes)
app.use(errorHandler)

let server
let shuttingDown = false

const shutdown = (signal, fatalError = null) => {
  if (shuttingDown) return
  shuttingDown = true
  const fatal = Boolean(fatalError) || ['unhandledRejection', 'uncaughtException'].includes(signal)
  if (fatal) console.error(`Fatal ${signal}:`, fatalError?.stack || fatalError?.message || String(fatalError))
  stopInventoryListener()
  console.log(`Received ${signal}; shutting down.`)

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out.')
    process.exit(1)
  }, 25000)
  forceExit.unref()

  const finish = async (closeError = null) => {
    try {
      await closeDb()
    } catch (databaseError) {
      console.error('Failed to close PostgreSQL pool:', databaseError.message)
      closeError ||= databaseError
    }
    clearTimeout(forceExit)
    process.exit(fatal || closeError ? 1 : 0)
  }

  if (server) {
    server.close(finish)
    server.closeIdleConnections?.()
  }
  else void finish()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (error) => shutdown('unhandledRejection', error))
process.on('uncaughtException', (error) => shutdown('uncaughtException', error))

try {
  await testDbConnection()
  void startInventoryListener()
  server = app.listen(port, '0.0.0.0', () => {
    console.log(`Severino backend listening on 0.0.0.0:${port}`)
    console.log('Allowed frontend origins:', allowedOrigins.length ? allowedOrigins.join(', ') : '(none configured; set CLIENT_ORIGIN)')
  })
} catch (error) {
  console.error('Backend startup failed:', error.message)
  await closeDb().catch(() => null)
  process.exit(1)
}
