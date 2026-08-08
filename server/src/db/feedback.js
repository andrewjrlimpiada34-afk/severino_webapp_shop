import { getDb } from './mysql.js'
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
  const [rows] = await db.execute('SELECT * FROM feedback ORDER BY created_at DESC')
  return rows.map(mapFeedback)
}

export const createFeedback = async (data) => {
  const db = getDb()
  const id = createId()
  await db.execute(
    `INSERT INTO feedback (id, user_id, order_id, rating, message, attachment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
    [
      id,
      data.userId,
      data.orderId,
      data.rating,
      data.message,
      data.attachment ? JSON.stringify(data.attachment) : null,
    ]
  )
  const [rows] = await db.execute('SELECT * FROM feedback WHERE id = ? LIMIT 1', [id])
  return mapFeedback(rows[0])
}
