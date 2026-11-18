import { getDb, withTransaction } from './postgres.js'
import { createId, parseJson } from './util.js'
import { logInventory } from './audit.js'
import {
  inventoryChange,
  notifyInventoryChange,
  publishInventoryChange
} from '../lib/inventoryEvents.js'

const seedProducts = [
  'Cucumber Melon',
  'Cloudy Scent',
  'Bacc540',
  'Burberry Weekend',
  'VelvetPetals',
  'LacosteRed',
  'Sauvage',
  'PoloSport',
  'LacosteWhite',
  'LacosteBlack',
  'CHGoodGirl',
  'MsDior',
  'TheBestScent',
  'StrongRed',
  'LanvinEclat'
]
const sizes = ['70ml', '80ml', '90ml', '100ml']
const categories = ['Men', 'Women', 'Unisex']
let seeded = false

const mapProduct = (row) =>
  row
    ? {
        id: row.id,
        legacyId: row.legacy_id || undefined,
        name: row.name,
        price: Number(row.price),
        stock: Number(row.stock) - Number(row.reserved_stock || 0),
        physicalStock: Number(row.stock),
        reservedStock: Number(row.reserved_stock || 0),
        notes: row.notes || '',
        description: row.description || '',
        imageUrl: row.image_url || '',
        imageUrls: parseJson(row.image_urls, []),
        size: row.size || '',
        category: row.category || 'Unisex',
        active: Boolean(row.active),
        createdAt: row.created_at
      }
    : null

const insertProduct = async (db, data) => {
  const product = {
    id: data.id || createId(),
    legacyId: data.legacyId || null,
    name: data.name,
    price: Number(data.price || 0),
    stock: Number(data.stock || 0),
    notes: data.notes || '',
    description: data.description || '',
    imageUrl: data.imageUrl || '',
    imageUrls: data.imageUrls || [data.imageUrl || '', '', '', ''],
    size: data.size || '100ml',
    category: data.category || 'Unisex',
    active: data.active !== false,
    createdAt: data.createdAt || new Date()
  }
  await db.query(
    `INSERT INTO products (
      id, legacy_id, name, price, stock, notes, description, image_url,
      image_urls, size, category, active, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      product.id,
      product.legacyId,
      product.name,
      product.price,
      product.stock,
      product.notes,
      product.description,
      product.imageUrl,
      JSON.stringify(product.imageUrls),
      product.size,
      product.category,
      product.active,
      product.createdAt
    ]
  )
  return product.id
}

const ensureSeeded = async () => {
  if (seeded) return
  const db = getDb()
  const { rows } = await db.query('SELECT COUNT(*) AS count FROM products')
  if (Number(rows[0].count) === 0) {
    await withTransaction(async (connection) => {
      await connection.query(
        "SELECT pg_advisory_xact_lock(hashtext('severino-catalog-seed'))"
      )
      const existing = await connection.query(
        'SELECT COUNT(*) AS count FROM products'
      )
      if (Number(existing.rows[0].count) !== 0) return
      for (let index = 0; index < seedProducts.length; index += 1) {
        const product = {
          name: seedProducts[index],
          price: 300,
          stock: 10 + (index % 5) * 4,
          notes: 'Signature blend',
          description:
            'A refined scent with balanced top, heart, and base notes.',
          imageUrls: ['', '', '', ''],
          size: sizes[index % sizes.length],
          category: categories[index % categories.length],
          active: true
        }
        const id = await insertProduct(connection, product)
        await logInventory(
          connection,
          { id, stock: product.stock, reserved_stock: 0 },
          {
            action: 'opening_balance',
            stockDelta: product.stock,
            operationKey: `opening:${id}`,
            reason: 'Initial catalog seed'
          }
        )
      }
    })
  }
  seeded = true
}

export const getProducts = async () => {
  await ensureSeeded()
  const db = getDb()
  const { rows } = await db.query(
    'SELECT * FROM products ORDER BY created_at ASC'
  )
  return rows.map(mapProduct)
}

export const getProductById = async (id) => {
  if (!id) return null
  await ensureSeeded()
  const db = getDb()
  const { rows } = await db.query(
    'SELECT * FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1',
    [id, id]
  )
  return mapProduct(rows[0])
}

export const createProduct = async (data, actorId = null) => {
  const id = await withTransaction(async (connection) => {
    const createdId = await insertProduct(connection, data)
    await logInventory(
      connection,
      { id: createdId, stock: data.stock, reserved_stock: 0 },
      {
        action: 'opening_balance',
        stockDelta: data.stock,
        actorId,
        operationKey: `opening:${createdId}`,
        reason: 'Product created'
      }
    )
    return createdId
  })
  return getProductById(id)
}

const productColumns = {
  name: 'name',
  price: 'price',
  stock: 'stock',
  notes: 'notes',
  description: 'description',
  imageUrl: 'image_url',
  imageUrls: 'image_urls',
  size: 'size',
  category: 'category',
  active: 'active'
}

export const updateProduct = async (id, data, actorId = null) => {
  const result = await withTransaction(async (connection) => {
    const { rows } = await connection.query(
      'SELECT * FROM products WHERE id = $1 OR legacy_id = $2 LIMIT 1 FOR UPDATE',
      [id, id]
    )
    const product = rows[0]
    if (!product) return null
    if (
      data.stock !== undefined &&
      data.stock < Number(product.reserved_stock || 0)
    )
      throw Object.assign(
        new Error('Physical stock cannot be lower than reserved stock.'),
        { statusCode: 409 }
      )
    if (
      data.stock !== undefined &&
      data.expectedStock !== undefined &&
      data.expectedStock !== Number(product.stock)
    )
      throw Object.assign(
        new Error(
          'Stock changed while you were editing. Refresh inventory before saving.'
        ),
        { statusCode: 409 }
      )
    const updates = []
    const values = []
    for (const [key, column] of Object.entries(productColumns)) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue
      updates.push(`${column} = $${values.length + 1}`)
      values.push(
        key === 'imageUrls' ? JSON.stringify(data[key] || []) : data[key]
      )
    }
    if (!updates.length) return { product }
    const updated = await connection.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, product.id]
    )
    const changed = updated.rows[0]
    if (data.stock !== undefined && Number(product.stock) !== data.stock)
      await logInventory(connection, changed, {
        action: 'adjustment',
        stockDelta: data.stock - Number(product.stock),
        actorId,
        operationKey: `adjustment:${createId()}`,
        reason: data.stockReason || 'Administrator stock adjustment'
      })
    const event = inventoryChange([
      {
        id: changed.id,
        legacyId: changed.legacy_id,
        stock: Number(changed.stock) - Number(changed.reserved_stock || 0)
      }
    ])
    await notifyInventoryChange(connection, event)
    return { product: changed, event }
  })
  if (!result) return null
  if (result.event) publishInventoryChange(result.event)
  return mapProduct(result.product)
}

export const getProductSoldCounts = async () => {
  const db = getDb()
  const { rows } = await db.query(
    `SELECT item.value->>'productId' AS "productId",
            SUM(COALESCE((item.value->>'quantity')::INTEGER, 0)) AS "soldCount"
     FROM orders AS order_row
     CROSS JOIN LATERAL jsonb_array_elements(order_row.items) AS item(value)
     WHERE order_row.status NOT IN ('Cancelled', 'Removed')
       AND order_row.gross_collected > order_row.refunded_total
       AND COALESCE(item.value->>'trackingStatus', '') NOT IN ('Cancelled', 'Removed')
     GROUP BY item.value->>'productId'`
  )
  return rows.reduce((counts, row) => {
    counts[row.productId] = Number(row.soldCount || 0)
    return counts
  }, {})
}
