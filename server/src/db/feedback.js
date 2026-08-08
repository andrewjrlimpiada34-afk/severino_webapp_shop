import { getDb } from './postgres.js'
import { createId, parseJson } from './util.js'

const mapFeedback = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        orderId: row.order_id,
        rating: Number(row.rating),
        message: row.message,
        attachment: parseJson(row.attachment, null),
        createdAt: row.created_at,
      }
    : null

export const getFeedback = async () => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM feedback ORDER BY created_at DESC')
  return rows.map(mapFeedback)
}

export const createFeedback = async (data) => {
  const db = getDb()
  const id = createId()
  await db.query(
    `INSERT INTO feedback (id, user_id, order_id, rating, message, attachment, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [
      id,
      data.userId,
      data.orderId,
      data.rating,
      data.message,
      data.attachment ? JSON.stringify(data.attachment) : null,
    ]
  )
  const { rows } = await db.query('SELECT * FROM feedback WHERE id = $1 LIMIT 1', [id])
  return mapFeedback(rows[0])
}
