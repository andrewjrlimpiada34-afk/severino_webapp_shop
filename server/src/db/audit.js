import { createId } from './util.js'

export const auditAction = (
  connection,
  actorId,
  action,
  orderId,
  details = {}
) =>
  connection.query(
    'INSERT INTO admin_audit_logs(id, admin_id, action, order_id, details) VALUES ($1, $2, $3, $4, $5)',
    [createId(), actorId, action, orderId, JSON.stringify(details)]
  )

export const logInventory = (
  connection,
  product,
  {
    orderId = null,
    itemKey = null,
    action,
    stockDelta = 0,
    reservedDelta = 0,
    actorId = null,
    operationKey,
    reason = ''
  }
) =>
  connection.query(
    `INSERT INTO inventory_logs(id, product_id, order_id, item_key, action, stock_delta, reserved_delta, stock_after, reserved_after, actor_id, operation_key, reason)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      createId(),
      product.id,
      orderId,
      itemKey,
      action,
      stockDelta,
      reservedDelta,
      product.stock,
      product.reserved_stock || 0,
      actorId,
      operationKey,
      reason
    ]
  )
