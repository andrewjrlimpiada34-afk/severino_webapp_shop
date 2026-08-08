import { getDb } from './postgres.js'
import { createId, parseJson } from './util.js'

const mapReview = (row) =>
  row
    ? {
        id: row.id,
        productId: row.product_id,
        userId: row.user_id,
        userName: row.user_name || 'Customer',
        userEmail: row.user_email || '',
        rating: Number(row.rating),
        comment: row.comment,
        attachment: parseJson(row.attachment, null),
        createdAt: row.created_at,
      }
    : null

export const getReviewsByProductId = async (productId) => {
  const db = getDb()
  const { rows } = await db.query(
    'SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
    [productId]
  )
  return rows.map(mapReview)
}

export const createReview = async (data) => {
  const db = getDb()
  const id = createId()
  await db.query(
    `INSERT INTO reviews (
      id, product_id, user_id, user_name, user_email, rating, comment, attachment, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
    [
      id, data.productId, data.userId, data.userName || 'Customer', data.userEmail || '',
      data.rating, data.comment, data.attachment ? JSON.stringify(data.attachment) : null,
    ]
  )
  return getReviewById(id)
}

export const getReviewById = async (id) => {
  if (!id) return null
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM reviews WHERE id = $1 LIMIT 1', [id])
  return mapReview(rows[0])
}

export const deleteReview = async (id) => {
  const review = await getReviewById(id)
  if (!review) return null
  const db = getDb()
  await db.query('DELETE FROM reviews WHERE id = $1', [id])
  return review
}
