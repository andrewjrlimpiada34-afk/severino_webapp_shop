import { getDb, withTransaction } from './postgres.js'
import { createId, parseJson } from './util.js'
import { auditAction } from './audit.js'
import { getOrderById } from './orders.js'

const paymentError = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode })
const cents = (amount) => Math.round(Number(amount) * 100)

export async function recordPayment(orderId, data, actorId) {
  const id = await withTransaction(async (connection) => {
    const { rows } = await connection.query(
      'SELECT * FROM orders WHERE (id = $1 OR reference = $1) LIMIT 1 FOR UPDATE',
      [orderId]
    )
    const order = rows[0]
    if (!order) throw paymentError('Order unavailable.', 404)
    const { rows: previous } = await connection.query(
      'SELECT * FROM payments WHERE order_id = $1 AND request_key = $2',
      [order.id, data.requestKey]
    )
    if (previous.length) {
      if (
        previous[0].kind !== data.kind ||
        previous[0].status !== data.status ||
        cents(previous[0].amount) !== cents(data.amount) ||
        previous[0].transaction_reference !== data.reference ||
        previous[0].method !== data.method
      )
        throw paymentError(
          'This payment reference has already been used for another action.'
        )
      return order.id
    }
    const amount = cents(data.amount)
    const collected = cents(order.gross_collected || 0)
    const refunded = cents(order.refunded_total || 0)
    if (data.kind === 'collection') {
      if (
        ['Cancelled', 'Removed'].includes(order.status) ||
        Number(order.total) <= 0
      )
        throw paymentError('This order cannot receive a payment confirmation.')
      if (collected > 0)
        throw paymentError('Payment has already been confirmed.')
      if (amount !== cents(order.total))
        throw paymentError('Confirm the full current order amount.')
      if (data.method !== order.payment_method)
        throw paymentError('Use the payment method recorded on this order.')
      if (data.status === 'Paid' && !data.collectionVerified)
        throw paymentError(
          'Verify actual collection before confirming a payment.',
          400
        )
    } else {
      if (!data.collectionVerified)
        throw paymentError(
          'Verify actual refund payment before confirming a refund.',
          400
        )
      if (data.status !== 'Paid' || amount > collected - refunded)
        throw paymentError('Refund exceeds the remaining verified collection.')
      if (!data.reason?.trim())
        throw paymentError('Enter the refund reason.', 400)
    }
    const verified = data.status === 'Paid'
    let itemSnapshot = parseJson(order.items, []).filter(
      (item) =>
        !['Cancelled', 'Removed'].includes(item.trackingStatus || order.status)
    )
    if (data.kind === 'refund') {
      const collection = await connection.query(
        "SELECT items_snapshot FROM payments WHERE order_id=$1 AND kind='collection' AND status='Paid'",
        [order.id]
      )
      itemSnapshot = parseJson(collection.rows[0]?.items_snapshot, [])
    }
    const values = [
      createId(),
      order.id,
      data.kind,
      data.status,
      data.amount,
      data.method,
      data.reference,
      data.reason || '',
      data.requestKey,
      verified ? actorId : null,
      JSON.stringify(itemSnapshot)
    ]
    if (data.kind === 'collection') {
      await connection.query(
        `INSERT INTO payments(id,order_id,kind,status,amount,method,transaction_reference,reason,request_key,verified_by,items_snapshot,verified_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $10::varchar IS NOT NULL THEN CURRENT_TIMESTAMP END)
        ON CONFLICT(order_id) WHERE kind = 'collection' DO UPDATE SET status=EXCLUDED.status, amount=EXCLUDED.amount, method=EXCLUDED.method, transaction_reference=EXCLUDED.transaction_reference,
        reason=EXCLUDED.reason, request_key=EXCLUDED.request_key, verified_by=EXCLUDED.verified_by, items_snapshot=EXCLUDED.items_snapshot, verified_at=EXCLUDED.verified_at WHERE payments.status <> 'Paid'`,
        values
      )
    } else {
      await connection.query(
        `INSERT INTO payments(id,order_id,kind,status,amount,method,transaction_reference,reason,request_key,verified_by,items_snapshot,verified_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP)`,
        values
      )
    }
    const gross =
      collected + (data.kind === 'collection' && verified ? amount : 0)
    const refunds = refunded + (data.kind === 'refund' ? amount : 0)
    const status =
      data.kind === 'refund'
        ? refunds === gross
          ? 'Refunded'
          : 'Partially Refunded'
        : data.status
    await connection.query(
      `UPDATE orders SET payment_status=$1, gross_collected=$2, refunded_total=$3, paid_at=CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id=$5`,
      [
        status,
        gross / 100,
        refunds / 100,
        data.kind === 'collection' && verified,
        order.id
      ]
    )
    await auditAction(
      connection,
      actorId,
      data.kind === 'refund'
        ? 'payment_refunded'
        : `payment_${data.status.toLowerCase().replaceAll(' ', '_')}`,
      order.id,
      {
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        reason: data.reason || '',
        requestKey: data.requestKey
      }
    )
    return order.id
  })
  return getOrderById(id)
}

export async function getPaymentHistory(orderId) {
  const { rows } = await getDb().query(
    `SELECT p.id, p.kind, p.status, p.amount, p.method, p.transaction_reference AS reference, p.reason, p.verified_at AS "verifiedAt", p.created_at AS "createdAt", u.name AS "verifiedBy"
    FROM payments p LEFT JOIN users u ON u.id = p.verified_by WHERE p.order_id = $1 ORDER BY p.created_at, p.id`,
    [orderId]
  )
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }))
}

export async function getCollectedSales() {
  const { rows } = await getDb()
    .query(`SELECT p.id, p.order_id, p.kind, p.amount, p.verified_at, o.reference, p.items_snapshot, o.contact_name, o.status
    FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.status = 'Paid' AND o.status NOT IN ('Cancelled','Removed') ORDER BY p.verified_at DESC, p.id`)
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    reference: row.reference,
    kind: row.kind,
    total: Number(row.amount) * (row.kind === 'refund' ? -1 : 1),
    paymentVerified: true,
    createdAt: row.verified_at,
    contactName: row.contact_name,
    status: row.status,
    items: parseJson(row.items_snapshot, [])
  }))
}
