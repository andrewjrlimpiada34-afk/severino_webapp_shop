import { getDb } from './postgres.js'

export const getSalesSummary = async () => {
  const db = getDb()
  const { rows } = await db.query(
    `WITH verified AS (
      SELECT order_id, SUM(CASE WHEN kind='collection' THEN amount ELSE 0 END) AS gross,
        SUM(CASE WHEN kind='refund' THEN amount ELSE 0 END) AS refunds FROM payments WHERE status='Paid' GROUP BY order_id
    ) SELECT COUNT(*) FILTER (WHERE o.status NOT IN ('Cancelled','Removed')) AS count,
      COALESCE(SUM(v.gross) FILTER (WHERE o.status NOT IN ('Cancelled','Removed')),0) AS gross,
      COALESCE(SUM(v.refunds) FILTER (WHERE o.status NOT IN ('Cancelled','Removed')),0) AS refunds,
      COALESCE(SUM(v.gross-v.refunds) FILTER (WHERE o.status NOT IN ('Cancelled','Removed')),0) AS revenue,
      COUNT(*) FILTER (WHERE o.status='Pending COD') AS pending,
      COUNT(*) FILTER (WHERE COALESCE(v.gross,0)=0 AND o.status NOT IN ('Cancelled','Removed')) AS unpaid,
      COALESCE(SUM(v.gross-v.refunds) FILTER (WHERE o.status IN ('Cancelled','Removed')),0) AS refund_liability
      FROM orders o LEFT JOIN verified v ON v.order_id=o.id`
  )
  return {
    count: Number(rows[0].count || 0),
    revenue: Number(rows[0].revenue || 0),
    gross: Number(rows[0].gross || 0), refunds: Number(rows[0].refunds || 0),
    pending: Number(rows[0].pending || 0), unpaid: Number(rows[0].unpaid || 0), refundLiability: Number(rows[0].refund_liability || 0),
  }
}
