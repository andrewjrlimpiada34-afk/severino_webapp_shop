import 'dotenv/config'
import dns from 'node:dns'
import { MongoClient } from 'mongodb'
import { closeDb, getDb } from '../src/db/postgres.js'

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')

const migrationDnsServers = (process.env.MIGRATION_DNS_SERVERS || '1.1.1.1,8.8.8.8')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean)

if (migrationDnsServers.length) dns.setServers(migrationDnsServers)

const mongoClient = new MongoClient(process.env.MONGODB_URI)
const postgres = getDb()
const idOf = (value) => value?.toString?.() || String(value || '')
const optional = (value) => String(value || '').trim() || null
const dateOf = (value) => (value ? new Date(value) : new Date())
const jsonOf = (value, fallback) => JSON.stringify(value ?? fallback)

const migrate = async () => {
  await mongoClient.connect()
  const mongo = mongoClient.db(process.env.MONGODB_DB || 'severino')
  const connection = await postgres.connect()
  const counts = {}

  try {
    await connection.query('BEGIN')

    const users = await mongo.collection('users').find({}).toArray()
    for (const user of users) {
      await connection.query(
        `INSERT INTO users (
          id, name, email, phone, password_hash, role, verified, address,
          address_line, barangay, city, province, zip, country, backup_address,
          profile_image, preferred_theme, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
          password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
          verified = EXCLUDED.verified, address = EXCLUDED.address,
          address_line = EXCLUDED.address_line, barangay = EXCLUDED.barangay,
          city = EXCLUDED.city, province = EXCLUDED.province, zip = EXCLUDED.zip,
          country = EXCLUDED.country, backup_address = EXCLUDED.backup_address,
          profile_image = EXCLUDED.profile_image, preferred_theme = EXCLUDED.preferred_theme`,
        [
          idOf(user._id), user.name || 'Customer', optional(user.email), optional(user.phone),
          user.passwordHash || '', user.role || 'customer', Boolean(user.verified),
          user.address || '', user.addressLine || '', user.barangay || '', user.city || '',
          user.province || '', user.zip || '', user.country || '', user.backupAddress || '',
          user.profileImage || '', user.preferredTheme || 'Default', dateOf(user.createdAt),
        ]
      )
    }
    counts.users = users.length
    const userIds = new Set(users.map((user) => idOf(user._id)))

    const products = await mongo.collection('products').find({}).toArray()
    const productIds = new Map()
    for (const product of products) {
      const id = idOf(product._id)
      productIds.set(id, id)
      if (product.id) productIds.set(String(product.id), id)
      await connection.query(
        `INSERT INTO products (
          id, legacy_id, name, price, stock, notes, description, image_url,
          image_urls, size, category, active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, price = EXCLUDED.price, stock = EXCLUDED.stock,
          notes = EXCLUDED.notes, description = EXCLUDED.description,
          image_url = EXCLUDED.image_url, image_urls = EXCLUDED.image_urls,
          size = EXCLUDED.size, category = EXCLUDED.category, active = EXCLUDED.active`,
        [
          id, optional(product.id), product.name, Number(product.price || 0),
          Number(product.stock || 0), product.notes || '', product.description || '',
          product.imageUrl || '', jsonOf(product.imageUrls, []), product.size || '100ml',
          product.category || 'Unisex', product.active !== false, dateOf(product.createdAt),
        ]
      )
    }
    counts.products = products.length

    const carts = await mongo.collection('carts').find({}).toArray()
    let migratedCarts = 0
    for (const cart of carts) {
      if (!userIds.has(String(cart.userId))) continue
      const items = (cart.items || []).map((item) => ({
        ...item,
        productId: productIds.get(String(item.productId)) || String(item.productId),
      }))
      await connection.query(
        `INSERT INTO carts (id, user_id, items, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items`,
        [idOf(cart._id), String(cart.userId), jsonOf(items, []), dateOf(cart.createdAt)]
      )
      migratedCarts += 1
    }
    counts.carts = migratedCarts
    counts.skippedCarts = carts.length - migratedCarts

    const orders = await mongo.collection('orders').find({}).toArray()
    const orderIds = new Set()
    for (const order of orders) {
      if (!userIds.has(String(order.userId))) continue
      const items = (order.items || []).map((item) => ({
        ...item,
        productId: productIds.get(String(item.productId)) || String(item.productId),
      }))
      await connection.query(
        `INSERT INTO orders (
          id, user_id, items, total, status, address, contact_name, phone,
          email, payment_method, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          items = EXCLUDED.items, total = EXCLUDED.total, status = EXCLUDED.status,
          address = EXCLUDED.address, contact_name = EXCLUDED.contact_name,
          phone = EXCLUDED.phone, email = EXCLUDED.email,
          payment_method = EXCLUDED.payment_method`,
        [
          idOf(order._id), String(order.userId), jsonOf(items, []), Number(order.total || 0),
          order.status || 'Pending', order.address || '', order.contactName || 'Customer',
          order.phone || '', order.email || '', order.paymentMethod || 'COD', dateOf(order.createdAt),
        ]
      )
      orderIds.add(idOf(order._id))
    }
    counts.orders = orderIds.size
    counts.skippedOrders = orders.length - orderIds.size

    const reviews = await mongo.collection('reviews').find({}).toArray()
    let migratedReviews = 0
    for (const review of reviews) {
      const productId = productIds.get(String(review.productId))
      if (!productId) continue
      await connection.query(
        `INSERT INTO reviews (
          id, product_id, user_id, user_name, user_email, rating, comment, attachment, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          rating = EXCLUDED.rating, comment = EXCLUDED.comment,
          attachment = EXCLUDED.attachment`,
        [
          idOf(review._id), productId,
          userIds.has(String(review.userId)) ? String(review.userId) : null,
          review.userName || 'Customer', review.userEmail || '', Number(review.rating),
          review.comment || '', review.attachment ? JSON.stringify(review.attachment) : null,
          dateOf(review.createdAt),
        ]
      )
      migratedReviews += 1
    }
    counts.reviews = migratedReviews
    counts.skippedReviews = reviews.length - migratedReviews

    const feedback = await mongo.collection('feedback').find({}).toArray()
    for (const entry of feedback) {
      await connection.query(
        `INSERT INTO feedback (id, user_id, order_id, rating, message, attachment, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           rating = EXCLUDED.rating, message = EXCLUDED.message,
           attachment = EXCLUDED.attachment`,
        [
          idOf(entry._id), userIds.has(String(entry.userId)) ? String(entry.userId) : null,
          orderIds.has(String(entry.orderId)) ? String(entry.orderId) : null,
          Number(entry.rating), entry.message || '',
          entry.attachment ? JSON.stringify(entry.attachment) : null, dateOf(entry.createdAt),
        ]
      )
    }
    counts.feedback = feedback.length

    const sales = await mongo.collection('sales').find({}).toArray()
    let migratedSales = 0
    for (const sale of sales) {
      if (!orderIds.has(String(sale.orderId))) continue
      await connection.query(
        `INSERT INTO sales (id, order_id, total, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET total = EXCLUDED.total`,
        [idOf(sale._id), String(sale.orderId), Number(sale.total || 0), dateOf(sale.createdAt)]
      )
      migratedSales += 1
    }
    counts.sales = migratedSales
    counts.skippedSales = sales.length - migratedSales

    const otps = await mongo.collection('otps').find({}).toArray()
    for (const otp of otps) {
      const expiresAt = otp.expiresAt instanceof Date ? otp.expiresAt.getTime() : Number(otp.expiresAt)
      await connection.query(
        `INSERT INTO otps (
          id, user_id, email, phone, code, type, expires_at, attempts, verified_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code, expires_at = EXCLUDED.expires_at,
          attempts = EXCLUDED.attempts, verified_at = EXCLUDED.verified_at`,
        [
          String(otp.id), userIds.has(String(otp.userId)) ? String(otp.userId) : null,
          optional(otp.email), optional(otp.phone), String(otp.code), otp.type || 'register',
          expiresAt, Number(otp.attempts || 0), otp.verifiedAt ? dateOf(otp.verifiedAt) : null,
          dateOf(otp.createdAt),
        ]
      )
    }
    counts.otps = otps.length

    const banners = await mongo.collection('banners').find({}).toArray()
    for (const banner of banners) {
      const { _id, key, ...value } = banner
      await connection.query(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)
         ON CONFLICT (setting_key) DO UPDATE SET
           setting_value = EXCLUDED.setting_value,
           updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value)]
      )
    }
    counts.appSettings = banners.length

    await connection.query('COMMIT')
    console.table(counts)
    console.log('MongoDB to PostgreSQL migration completed successfully.')
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  } finally {
    connection.release()
  }
}

try {
  await migrate()
} catch (error) {
  console.error('Migration failed:', error)
  process.exitCode = 1
} finally {
  await mongoClient.close()
  await closeDb()
}
