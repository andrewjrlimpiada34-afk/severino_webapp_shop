import { getDb } from './mysql.js'
import { createId } from './util.js'

export const recordSale = async (orderId, total) => {
  const db = getDb()
  const entry = { id: createId(), orderId, total: Number(total), createdAt: new Date() }
  await db.execute(
    'INSERT INTO sales (id, order_id, total, created_at) VALUES (?, ?, ?, ?)',
    [entry.id, entry.orderId, entry.total, entry.createdAt]
  )
  return entry
}

export const getSalesSummary = async () => {
  const db = getDb()
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue
     FROM orders
     WHERE status NOT IN ('Cancelled', 'Removed')`
  )
  return {
    count: Number(rows[0].count || 0),
    revenue: Number(rows[0].revenue || 0),
  }
}
