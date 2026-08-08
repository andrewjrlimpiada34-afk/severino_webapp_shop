import 'dotenv/config'
import dns from 'node:dns'
import { MongoClient } from 'mongodb'
import { closeDb, getDb } from '../src/db/mysql.js'

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')

const migrationDnsServers = (process.env.MIGRATION_DNS_SERVERS || '1.1.1.1,8.8.8.8')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean)

if (migrationDnsServers.length) {
  dns.setServers(migrationDnsServers)
}

const mongoClient = new MongoClient(process.env.MONGODB_URI)
const mysql = getDb()
const idOf = (value) => value?.toString?.() || String(value || '')
const optional = (value) => String(value || '').trim() || null
const dateOf = (value) => (value ? new Date(value) : new Date())
const jsonOf = (value, fallback) => JSON.stringify(value ?? fallback)

const migrate = async () => {
  await mongoClient.connect()
  const mongo = mongoClient.db(process.env.MONGODB_DB || 'severino')
  const connection = await mysql.getConnection()
  const counts = {}

  try {
    await connection.beginTransaction()

    const users = await mongo.collection('users').find({}).toArray()
    for (const user of users) {
      await connection.execute(
        `INSERT INTO users (
          id, name, email, phone, password_hash, role, verified, address,
          address_line, barangay, city, province, zip, country, backup_address,
          profile_image, preferred_theme, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), email = VALUES(email), phone = VALUES(phone),
          password_hash = VALUES(password_hash), role = VALUES(role), verified = VALUES(verified),
          address = VALUES(address), address_line = VALUES(address_line),
          barangay = VALUES(barangay), city = VALUES(city), province = VALUES(province),
          zip = VALUES(zip), country = VALUES(country), backup_address = VALUES(backup_address),
          profile_image = VALUES(profile_image), preferred_theme = VALUES(preferred_theme)`,
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
      await connection.execute(
        `INSERT INTO products (
          id, legacy_id, name, price, stock, notes, description, image_url,
          image_urls, size, category, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), price = VALUES(price), stock = VALUES(stock), notes = VALUES(notes),
          description = VALUES(description), image_url = VALUES(image_url),
          image_urls = VALUES(image_urls), size = VALUES(size), category = VALUES(category),
          active = VALUES(active)`,
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
      await connection.execute(
        `INSERT INTO carts (id, user_id, items, created_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE items = VALUES(items)`,
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
      await connection.execute(
        `INSERT INTO orders (
          id, user_id, items, total, status, address, contact_name, phone,
          email, payment_method, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          items = VALUES(items), total = VALUES(total), status = VALUES(status),
          address = VALUES(address), contact_name = VALUES(contact_name), phone = VALUES(phone),
          email = VALUES(email), payment_method = VALUES(payment_method)`,
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
      await connection.execute(
        `INSERT INTO reviews (
          id, product_id, user_id, user_name, user_email, rating, comment, attachment, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          rating = VALUES(rating), comment = VALUES(comment), attachment = VALUES(attachment)`,
        [
          idOf(review._id), productId,
          userIds.has(String(review.userId)) ? String(review.userId) : null,
          review.userName || 'Customer', review.userEmail || '',
          Number(review.rating), review.comment || '',
          review.attachment ? JSON.stringify(review.attachment) : null, dateOf(review.createdAt),
        ]
      )
      migratedReviews += 1
    }
    counts.reviews = migratedReviews
    counts.skippedReviews = reviews.length - migratedReviews

    const feedback = await mongo.collection('feedback').find({}).toArray()
    for (const entry of feedback) {
      await connection.execute(
        `INSERT INTO feedback (id, user_id, order_id, rating, message, attachment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           rating = VALUES(rating), message = VALUES(message), attachment = VALUES(attachment)`,
        [
          idOf(entry._id), userIds.has(String(entry.userId)) ? String(entry.userId) : null,
          orderIds.has(String(entry.orderId)) ? String(entry.orderId) : null, Number(entry.rating),
          entry.message || '', entry.attachment ? JSON.stringify(entry.attachment) : null,
          dateOf(entry.createdAt),
        ]
      )
    }
    counts.feedback = feedback.length

    const sales = await mongo.collection('sales').find({}).toArray()
    let migratedSales = 0
    for (const sale of sales) {
      if (!orderIds.has(String(sale.orderId))) continue
      await connection.execute(
        `INSERT INTO sales (id, order_id, total, created_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total = VALUES(total)`,
        [idOf(sale._id), String(sale.orderId), Number(sale.total || 0), dateOf(sale.createdAt)]
      )
      migratedSales += 1
    }
    counts.sales = migratedSales
    counts.skippedSales = sales.length - migratedSales

    const otps = await mongo.collection('otps').find({}).toArray()
    for (const otp of otps) {
      const expiresAt = otp.expiresAt instanceof Date ? otp.expiresAt.getTime() : Number(otp.expiresAt)
      await connection.execute(
        `INSERT INTO otps (
          id, user_id, email, phone, code, type, expires_at, attempts, verified_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          code = VALUES(code), expires_at = VALUES(expires_at), attempts = VALUES(attempts),
          verified_at = VALUES(verified_at)`,
        [
          String(otp.id), userIds.has(String(otp.userId)) ? String(otp.userId) : null,
          optional(otp.email), optional(otp.phone),
          String(otp.code), otp.type || 'register', expiresAt, Number(otp.attempts || 0),
          otp.verifiedAt ? dateOf(otp.verifiedAt) : null, dateOf(otp.createdAt),
        ]
      )
    }
    counts.otps = otps.length

    const banners = await mongo.collection('banners').find({}).toArray()
    for (const banner of banners) {
      const { _id, key, ...value } = banner
      await connection.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, JSON.stringify(value)]
      )
    }
    counts.appSettings = banners.length

    await connection.commit()
    console.table(counts)
    console.log('MongoDB to MySQL migration completed successfully.')
  } catch (error) {
    await connection.rollback()
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
