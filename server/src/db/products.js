import { getDb, withTransaction } from './mysql.js'
import { createId, parseJson } from './util.js'

const seedProducts = [
  'Cucumber Melon', 'Cloudy Scent', 'Bacc540', 'Burberry Weekend', 'VelvetPetals',
  'LacosteRed', 'Sauvage', 'PoloSport', 'LacosteWhite', 'LacosteBlack', 'CHGoodGirl',
  'MsDior', 'TheBestScent', 'StrongRed', 'LanvinEclat',
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
        stock: Number(row.stock),
        notes: row.notes || '',
        description: row.description || '',
        imageUrl: row.image_url || '',
        imageUrls: parseJson(row.image_urls, []),
        size: row.size || '',
        category: row.category || 'Unisex',
        active: Boolean(row.active),
        createdAt: row.created_at,
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
    createdAt: data.createdAt || new Date(),
  }
  await db.execute(
    `INSERT INTO products (
      id, legacy_id, name, price, stock, notes, description, image_url,
      image_urls, size, category, active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id, product.legacyId, product.name, product.price, product.stock,
      product.notes, product.description, product.imageUrl, JSON.stringify(product.imageUrls),
      product.size, product.category, product.active, product.createdAt,
    ]
  )
  return product.id
}

const ensureSeeded = async () => {
  if (seeded) return
  const db = getDb()
  const [rows] = await db.execute('SELECT COUNT(*) AS count FROM products')
  if (Number(rows[0].count) === 0) {
    await withTransaction(async (connection) => {
      for (let index = 0; index < seedProducts.length; index += 1) {
        await insertProduct(connection, {
          name: seedProducts[index],
          price: 300,
          stock: 10 + (index % 5) * 4,
          notes: 'Signature blend',
          description: 'A refined scent with balanced top, heart, and base notes.',
          imageUrls: ['', '', '', ''],
          size: sizes[index % sizes.length],
          category: categories[index % categories.length],
          active: true,
        })
      }
    })
  }
  seeded = true
}

export const getProducts = async () => {
  await ensureSeeded()
  const db = getDb()
  const [rows] = await db.execute('SELECT * FROM products ORDER BY created_at ASC')
  return rows.map(mapProduct)
}

export const getProductById = async (id) => {
  if (!id) return null
  await ensureSeeded()
  const db = getDb()
  const [rows] = await db.execute(
    'SELECT * FROM products WHERE id = ? OR legacy_id = ? LIMIT 1',
    [id, id]
  )
  return mapProduct(rows[0])
}

export const createProduct = async (data) => {
  const db = getDb()
  const id = await insertProduct(db, data)
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
  active: 'active',
}

export const updateProduct = async (id, data) => {
  const product = await getProductById(id)
  if (!product) return null
  const updates = []
  const values = []
  for (const [key, column] of Object.entries(productColumns)) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue
    updates.push(`${column} = ?`)
    values.push(key === 'imageUrls' ? JSON.stringify(data[key] || []) : data[key])
  }
  if (!updates.length) return product
  const db = getDb()
  await db.execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, [...values, product.id])
  return getProductById(product.id)
}

export const decrementStock = async (id, quantity, connection = getDb()) => {
  const [products] = await connection.execute(
    'SELECT * FROM products WHERE id = ? OR legacy_id = ? LIMIT 1',
    [id, id]
  )
  const product = mapProduct(products[0])
  if (!product) return null
  const [result] = await connection.execute(
    'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
    [quantity, product.id, quantity]
  )
  if (!result.affectedRows) return null
  const [rows] = await connection.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [product.id])
  return mapProduct(rows[0])
}

export const getProductSoldCounts = async () => {
  const db = getDb()
  const [rows] = await db.execute(
    `SELECT item.product_id AS productId, SUM(item.quantity) AS soldCount
     FROM orders AS order_row
     JOIN JSON_TABLE(
       order_row.items,
       '$[*]' COLUMNS (
         product_id VARCHAR(191) PATH '$.productId',
         quantity INT PATH '$.quantity',
         tracking_status VARCHAR(60) PATH '$.trackingStatus'
       )
     ) AS item
     WHERE order_row.status NOT IN ('Cancelled', 'Removed')
       AND COALESCE(item.tracking_status, '') NOT IN ('Cancelled', 'Removed')
     GROUP BY item.product_id`
  )
  return rows.reduce((counts, row) => {
    counts[row.productId] = Number(row.soldCount || 0)
    return counts
  }, {})
}
